import parse from 'csv-parse/lib/sync.js'
import { pgClient } from "./pool.js"
import copyStream from 'pg-copy-streams'
import { initCountries, initUnitConversionGraph } from "./unitConverter.js"
import ProgressBar from 'progress'
import _fs from 'fs'
import EventEmitter from 'events'

const fs = _fs.promises
const copyFrom = copyStream.from
const args = process.argv.slice( 2 )

const pointColumns = [ "project_id", "data_type", "year", "volume", "unit", "grade", "fossil_fuel_type", "subtype", "source_id", "quality", "data_year" ]

let errorProj

try {
	if( !args[ 0 ] ) {
		console.log( 'Missing project file!' )
		process.exit()
	}

	await pgClient.connect()
	console.log( 'DB connected.' )

	await initUnitConversionGraph( pgClient )
	await initCountries( pgClient )

	let fails = '', failCounter = 0

	const content = await fs.readFile( args[ 0 ] )

	const columnMap = {
		'Unit ID': 'project_identifier',
		'Quantity (converted)': 'volume',
		'Units (converted)': 'source_unit',
		'fuel_type': 'fossil_fuel_type',
		'': '',
	}

	const unitMap = {
		'million m³/y': 'e6m3',
		'million bbl/y': 'e6bbl',
		'million boe/y': 'e6boe',
	}

	const _projects = parse( content,
		{
			skip_empty_lines: true,
			columns: header =>
				header.map( column => columnMap[ column.trim() ] ?? column.trim() )
		}
	)

	if( _projects?.length === 0 ) {
		console.log( `Zarro projects.` )
		process.exit()
	}

	if( args[ 1 ] ) {
		// const deleted = await pgClient.query( `DELETE FROM public.project WHERE ${args[1]}`, [] )
		const deletedOil = await pgClient.query( `DELETE FROM project P USING project_data_point D WHERE P.id = D.project_id AND P."project_type" = 'sparse' AND D.source_id = 15 AND D.fossil_fuel_type = 'oil'`, [] )
		const deletedGas = await pgClient.query( `DELETE FROM project P USING project_data_point D WHERE P.id = D.project_id AND P."project_type" = 'sparse' AND D.source_id = 15 AND D.fossil_fuel_type = 'gas'`, [] )
		console.log( `Deleted ${ deletedOil.rowCount } + ${ deletedGas.rowCount } projects.` )
	}

	// First look for multiple entries and merge project data
	let lastProj = {}, idSequence = 0
	const projects = []
	const dataPoints = []

	console.log( `Preparing ${ _projects?.length } data points.` )
	console.log( _projects[ 0 ] )

	_projects.forEach( p => {
		if( lastProj.project_identifier !== p.project_identifier ) {
			if( lastProj.project_identifier ) {
				projects.push( lastProj )
				//console.log( lastProj )
			}
			p.id = ++idSequence
			lastProj = p
			lastProj.production_co2e = 0
		} else {
		}

		const unit = unitMap[ p.source_unit ]
		if( !unit ) {
			fails += '\nData point skipped, unknown unit: ' + p.project_identifier
			failCounter++
			return
		}

		if( !p.volume ) {
			fails += '\nData point skipped, no volume: ' + p.project_identifier
			failCounter++
			return
		}

		if( !( parseFloat( p.volume ) > 0 ) ) {
			fails += '\nBad volume: ' + p.project_identifier
			failCounter++
			return
		}

		dataPoints.push( {
			project_id: lastProj.id,
			data_type: 'production',
			volume: p.volume,
			unit,
			fossil_fuel_type: p.fossil_fuel_type,
			source_id: 15
		} )

	} )
	projects.push( lastProj )

	const bar = new ProgressBar( '[:bar] :percent', { total: projects.length, width: 100 } )
	let noDataCounter = 0

	if( failCounter > 0 ) {
		console.log( `Prepare Error count: ${ failCounter }.` )
		console.log( fails )
	}

	console.log( `Importing ${ projects?.length } projects.` )

	for( const project of projects ) {

		if( project.ISO3166?.length !== 2 ) {
			fails += '\nBad ISO3166: ' + JSON.stringify( project )
			continue
		}

		let region = project[ ' Subnational unit (province, state) ' ]
		if( project[ ' Project' ] === 'subnational' ) region = project[ 'Unit name' ]

		const params = [
			/* 01 */ project[ 'ISO3166' ],
			/* 02 */ project[ 'iso31662' ] ?? '',
			/* 03 */ project[ 'Unit name' ],
			/* 04 */ region,
			/* 05 */ project[ 'Unit name' ], // source_project_name
			/* 06 */ project.project_identifier, // source_project_id
			/* 07 */ project[ 'Wiki URL' ], // link_url
			/* 08 */ project[ 'Data year' ], // data_year
			/* 09 */ project[ 'Project' ] === 'subnational' ? [ 'subnational' ] : null, // tags
		]

		if( !project.id ) {
			console.log( project )
			throw new Error( 'Project has no id property.' )
		}

		errorProj = project

		const inserted = await pgClient.query(
			`INSERT INTO public.project	
             (iso3166, iso3166_2, project_identifier, region, source_project_name, source_project_id, link_url, data_year, project_type, tags)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sparse', $9)
             RETURNING *`, params )

		const last_id = inserted.rows?.[ 0 ]?.id

		const points = dataPoints.filter( p => p.project_id === project[ 'id' ] )
		if( points.length === 0 ) {
			noDataCounter++
			// console.log( project )
			// console.log( dataPoints[ 0 ] )
			// process.exit()
		} else {
			const insertStream = pgClient.query( copyFrom( `COPY public.project_data_point ( ${ pointColumns.join( ',' ) } ) FROM STDIN CSV` ) )

			for( let point of points ) {
				point.project_id = last_id
				const pointLine = pointColumns.map( c => point[ c ] ).join( ',' )
				//console.log( pointLine )
				insertStream.write( pointLine + '\n' )
			}
			insertStream.end()
			await EventEmitter.once( insertStream, 'finish' )
		}
		bar.tick()
	}

	await pgClient.end()
	if( noDataCounter > 0 ) console.log( noDataCounter + ' projects had no data points!' )
	if( fails.length ) {
		console.log( 'Failures:' )
		console.log( fails )
	}
	console.log( 'DB disconnected.' )
} catch( e ) {
	await pgClient.end()
	console.log( e )
	console.log( 'Last project was:' )
	console.log( errorProj )
}
