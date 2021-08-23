import util from 'util'
import stream from 'stream'
import csv from 'csv'
import { pgClient } from "./pool.js"
import { convertVolume, initCountries, initUnitConversionGraph } from "./unitConverter.js"

const { parse, stringify } = csv
const { Transform } = stream
const pipeline = util.promisify( stream.pipeline )

const insertedProjects = {}

const filterData = ( fn, options = {} ) =>
	new Transform( {
		objectMode: true,
		...options,

		transform( chunk, encoding, callback ) {
			if( chunk[ 'iso3166' ]?.length > 0 ) {
				callback( null, chunk )
			} else {
				console.log( '...skip', chunk[ 'Mine_ID' ] )
				callback( null, undefined )
			}
		}
	} )

const transformData = ( fn, options = {} ) =>
	new Transform( {
		objectMode: true,
		...options,

		async transform( chunk, encoding, callback ) {

			console.log( '+', chunk[ 'source_project_id' ] )
			chunk.co2e = convertVolume( chunk[ 'volume' ], chunk[ 'fossil_fuel_type' ], chunk[ 'unit' ], 'kgco2e' )
			//chunk.iso3166 = chunk.ISO3166

			callback( null, chunk )
		}
	} )

const dbInsert = async( chunk, cb ) => {

	const projectKey = chunk[ 'iso3166' ] + '-' + chunk[ 'project_id' ]
	let last_id

	if( insertedProjects[ projectKey ] ) {
		last_id = insertedProjects[ projectKey ].id
	} else {
		const params = [
			/* 01 */ chunk[ 'iso3166' ],
			/* 02 */ chunk[ 'iso31662' ] ?? null,
			/* 03 */ chunk[ 'project_id' ], // project_id
			/* 04 */ chunk[ 'source_project_name' ], // source_project_name
			/* 05 */ chunk[ 'source_project_id' ], // source_project_id
		]
		console.log( JSON.stringify( params ) )
		const inserted = await pgClient.query(
			`INSERT INTO public.sparse_projects
             (iso3166, iso3166_2, project_id, source_project_name, source_project_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`, params )

		last_id = inserted.rows?.[ 0 ]?.id
		insertedProjects[ projectKey ] = inserted.rows?.[ 0 ]
	}

	let dataType = 'production'
	if( chunk.reserves.toLowerCase() === 'TRUE' ) dataType = 'reserve'
	if( chunk.projection.toLowerCase() === 'TRUE' ) dataType = 'projection'

	const dparams = [
		/* 01 */ last_id,
		/* 02 */ parseInt(chunk[ 'year' ]) || null,
		/* 03 */ parseFloat( chunk[ 'volume' ] ), // volume
		/* 04 */ chunk[ 'unit' ] ?? 'e6ton', // unit
		/* 05 */ chunk[ 'grade' ], // grade
		/* 06 */ chunk[ 'source_id' ],
		/* 07 */ chunk[ 'fossil_fuel_type' ], // fossil_fuel_type
		/* 08 */ dataType,
		/* 09 */ parseInt(chunk[ 'data_year' ]) || null
	]
	console.log( JSON.stringify( dparams ) )
	await pgClient.query(
		`INSERT INTO public.sparse_data_point
         (sparse_project_id, year, volume, unit, grade, source_id, fossil_fuel_type, data_type, data_year)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, dparams )

	cb( null, chunk )
}

const dbSaver = ( fn, options = {} ) =>
	new Transform( {
		objectMode: true,
		...options,

		async transform( chunk, encoding, callback ) {
			await dbInsert( chunk, callback )
		}
	} )

try {
	await pgClient.connect()
	console.log( 'CONNECTED' )

	await initUnitConversionGraph( pgClient )
	await initCountries( pgClient )

	await pipeline(
		process.stdin,
		parse( { delimiter: ',', columns: true } ),
		filterData(),
		transformData(),
		dbSaver(),
		stringify( { delimiter: ',', header: true } ),
		process.stdout,
		( err ) => {
			if( err ) {
				console.error( 'Pipeline failed', err.message )
			} else {
				console.log( 'Pipeline succeeded' )
			}
		}
	)
	console.log( 'PIPE DONE' )
	await pgClient.end()
	console.log( 'DISCONNECTED' )
} catch( e ) {
	console.log( e )
}

