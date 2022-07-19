import parse from 'csv-parse/lib/sync.js'
import { pgClient } from "./pool.js"
import copyStream from 'pg-copy-streams'
import { initCountries, initUnitConversionGraph } from "./unitConverter.js"
import ProgressBar from 'progress'
import _fs from 'fs'

const fs = _fs.promises
const copyFrom = copyStream.from
const args = process.argv.slice( 2 )

const pointColumns = [ "project_id", "data_type", "volume", "unit", "grade", "fossil_fuel_type", "subtype", "source_id", "quality" ]

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
		'Mine IDs': 'source_project_id',
		'Mine Name': 'project_identifier',
		'Coal Output (Annual, Mt)': 'volume',
		'Normalise Coal Type': 'subtype',
		'Production or Capacity Data': 'row_type',
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
		const deleted = await pgClient.query( `DELETE FROM public.project WHERE ${args[1]}`, [] )
		console.log( `Deleted ${ deleted.rowCount } projects.` )
	}

	// First look for multiple entries and merge project data
	let lastProj = {}, idSequence = 0
	const projects = []

	console.log( `Preparing ${ _projects?.length } data points.` )
	//console.log( _projects[ 0 ] )

	_projects
		.forEach( p => {

			if( lastProj.project_identifier !== p.project_identifier ) {
				if( lastProj.project_identifier ) {
					projects.push( lastProj )
					//console.log( lastProj.source_project_id, lastProj.volume, lastProj.dataPoints )
				}
				p.id = ++idSequence
				lastProj = p
				lastProj.production_co2e = 0
				lastProj.dataPoints = []
			}

			const unit = 'e6ton' // unitMap[ p.source_unit ]
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

			lastProj.dataPoints.push( {
				project_id: lastProj.id,
				data_type: 'production',
				volume: parseFloat( p.volume ),
				unit,
				fossil_fuel_type: 'coal',
				subtype: p.subtype === 'Unknown' ? null : p.subtype,
				source_id: 15
			} )

			if( parseFloat( p[ 'Proven Reserve' ] ) > 0 ) {
				lastProj.dataPoints.push( {
					project_id: lastProj.id,
					data_type: 'reserve',
					volume: parseFloat( p[ 'Proven Reserve' ] ),
					unit: 'e6ton',
					fossil_fuel_type: 'coal',
					subtype: p.subtype === 'Unknown' ? null : p.subtype,
					source_id: 15,
					grade: '1p'
				} )
			}
			if( parseFloat( p[ 'Probable Reserve' ] ) > 0 ) {
				lastProj.dataPoints.push( {
					project_id: lastProj.id,
					data_type: 'reserve',
					volume: parseFloat( p[ 'Probable Reserve' ] ),
					unit: 'e6ton',
					fossil_fuel_type: 'coal',
					subtype: p.subtype === 'Unknown' ? null : p.subtype,
					source_id: 15,
					grade: '2p'
				} )
			}
		} )

	projects.push( lastProj )
	//console.log( 'Last last', lastProj.source_project_id, lastProj.volume, lastProj.dataPoints )

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

		const params = [
			/* 01 */ project[ 'ISO3166' ],
			/* 02 */ project[ 'iso31662' ] ?? '',
			/* 03 */ project.project_identifier,
			/* 04 */ project.Location ?? project.County, // region,
			/* 05 */ project.project_identifier, // source_project_name
			/* 06 */ project.source_project_id, // source_project_id
			/* 07 */ project[ 'GEM Wiki Page (ENG)' ], // link_url
			/* 08 */ 2021, // data_year,
			/* 09 */ project[ 'OC_Operator_ID' ], // oc_operator_id,
			/* 10 */ project[ 'Operators' ], // oc_operator_id,
			/* 11 */ project[ 'Longitude' ] || null, // geo_position,
			/* 12 */ project[ 'Latitude' ] || null, // geo_position,
			/* 13 */ project[ 'Mine Type' ], // geo_position,
			/* 14 */ project[ 'Mining Method' ], // geo_position,
			/* 15 */ project.methane_m3_ton, // methane_m3_ton,
		]

		if( !project.id ) {
			console.log( project )
			throw new Error( 'Project has no id property.' )
		}

		errorProj = project

		const inserted = await pgClient.query(
			`INSERT INTO public.project	
             (iso3166, iso3166_2, project_identifier, region, source_project_name, source_project_id, link_url, data_year, oc_operator_id, 
             operator_name, geo_position, production_type, production_method, project_type, methane_m3_ton)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ST_SetSRID(ST_POINT($11, $12), 4326), $13, $14, 'sparse', $15)
             RETURNING *`, params )

		const last_id = inserted.rows?.[ 0 ]?.id

		for( const pdp of project.dataPoints ) {
			await pgClient.query(
				`INSERT INTO public.project_data_point ( ${ pointColumns.join( ',' ) } )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
				[ last_id, pdp.data_type, pdp.volume, pdp.unit, null, 'coal', pdp.subtype, 15, 1 ] )
			//"project_id", "data_type", "volume", "unit", "grade", "fossil_fuel_type", "subtype", "source_id", "quality"
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
