import util from 'util'
import stream from 'stream'
import csv from 'csv'
import { pgClient } from "./pool.js"
import fetch from 'node-fetch'
import { convertVolume, initCountries, initUnitConversionGraph } from "./unitConverter.js"

const { parse, stringify } = csv
const { Transform } = stream
const pipeline = util.promisify( stream.pipeline )

const filterData = ( fn, options = {} ) =>
	new Transform( {
		objectMode: true,
		...options,

		transform( chunk, encoding, callback ) {
			if( chunk[ 'Production_Status' ] === 'Production' ) {
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

			console.log( '+', chunk[ 'Mine_ID' ] )
			chunk.co2e = convertVolume( chunk[ 'Production_e6tons' ], 'coal', 'e6ton', 'kgco2e' )
			chunk.iso3166 = chunk.ISO3166

			const link = chunk[ 'GEM_Wiki_Page_ENG' ]?.split( '/' )
			const page = encodeURIComponent( link[ link.length - 1 ] )
			const apiUrl = `https://www.gem.wiki/w/api.php?action=parse&page=${ page }&prop=wikitext&format=json`
			try {
				const api = await fetch( apiUrl )
				if( api.ok ) {
					const resp = await api.json()
					const content = resp?.parse?.wikitext?.[ '*' ]

					const start = content.indexOf( '==Background==' )
					if( start < 0 ) console.log( 'No Background header in text for', chunk[ 'Mine_ID' ] )
					else {
						let bg = content.substring( start + 14 )
						const end = bg.indexOf( '==' )
						if( end > 0 ) bg = bg.substring( 0, end )
						bg = bg.trim()
						chunk.description = bg
					}
				}
			} catch( e ) {
				console.log( e.message )
			}
			callback( null, chunk )
		}
	} )

const columns = {
	'Mine_ID': 'source_project_id',
	'Mine_Name': '',
	'GEM_Wiki_Page_ENG': '',
	'Operator': '',
	'OC_Operator_ID': '',
	'Production_e6tons': 'volume',
	'co2e': 'co2e',
	'Mine Type': 'project_type',
	'Mining Method': 'project_method',
	'Type': 'production_type',
	'Grade': 'production_grade',
	'CH4 m3 / ton': 'methane_m3_ton',
	'fuel': 'fossil_fuel_type',
	'unit': 'unit',
	'Reserves_2p': 'reserves',
	'Location': 'location_name',
	'Province': 'region',
	'ISO3166': 'country',
	'geo_position': 'geo_position',
}

const dbInsert = async( chunk, cb ) => {

	const params = [
		/* 01 */ chunk[ 'iso3166' ],
		/* 02 */ chunk[ 'iso31662' ] ?? null,
		/* 03 */ chunk[ 'Mine_Name' ], // project_id
		/* 04 */ chunk[ 'Mine_Name' ], // source_project_name
		/* 05 */ chunk[ 'Mine_ID' ], // source_project_id
		/* 06 */ chunk[ 'Province' ], // region
		/* 07 */ chunk[ 'Location' ], // location_name
		/* 08 */ chunk[ 'Operator' ], // operator_name
		/* 09 */ chunk[ 'OC_Operator_ID' ]?.substring( 26 ), //oc_operator_id
		/* 10 */ chunk[ 'Longitude' ], // geo_position
		/* 11 */ chunk[ 'Latitude' ], // geo_position
		/* 12 */ chunk[ 'co2e' ] ?? 0, // production_co2e
		/* 13 */ chunk[ 'description' ] ?? '', // description
		/* 14 */ chunk[ 'GEM_Wiki_Page_ENG' ], // link_url
		/* 15 */ chunk[ 'Mine Type' ], // production_type
		/* 16 */ chunk[ 'Mining Method' ], // production_method
		/* 17 */ chunk[ 'CH4 m3 / ton' ], // methane_m3_ton
	]
	//console.log( params )
	const inserted = await pgClient.query(
		`INSERT INTO public.sparse_projects
         (iso3166, iso3166_2, project_id, source_project_name, source_project_id, region, location_name, operator_name,
          oc_operator_id, geo_position, production_co2e, description, link_url, production_type,
          production_method, methane_m3_ton)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ST_SetSRID(ST_POINT($10, $11), 4326), $12, $13, $14, $15, $16,
                 $17) RETURNING *`, params )

	console.log( '_______________', inserted.rows?.[ 0 ]?.id )
	const last_id = inserted.rows?.[ 0 ]?.id

	const dparams = [
		/* 01 */ last_id, // year
		/* 02 */ chunk[ 'year' ] ?? 2021, // year
		/* 03 */ parseFloat( chunk[ 'Production_e6tons' ] ), // volume
		/* 04 */ chunk[ 'unit' ] ?? 'e6ton', // unit
		/* 05 */ chunk[ 'Grade' ], // grade
		/* 06 */ 15, // source_id
		/* 07 */ 'coal', // fossil_fuel_type
		/* 08 */ chunk[ 'Type' ]?.toLowerCase() ?? null, // subtype
		/* 09 */ 'production', // data_type
	]
	await pgClient.query(
		`INSERT INTO public.sparse_data_point
         (sparse_project_id, year, volume, unit, grade, source_id, fossil_fuel_type, subtype, data_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, dparams )

	const res = parseFloat( chunk[ 'Reserves_2p' ] )
	if( res > 0 ) {
		dparams[ 2 ] = res
		dparams[ 3 ] = 'e6ton'
		dparams[ 4 ] = '2p'
		dparams[ 8 ] = 'reserve'

		await pgClient.query(
			`INSERT INTO public.sparse_data_point
             (sparse_project_id, year, volume, unit, grade, source_id, fossil_fuel_type, subtype, data_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, dparams )
	}

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
	//console.log( graph?.coal?.serialize() )

	//const rows1 = await pgClient.query( 'TRUNCATE public.sparse_data_point RESTART IDENTITY CASCADE' )
	//const rows2 = await pgClient.query( 'TRUNCATE public.sparse_projects RESTART IDENTITY' )

	await pipeline(
		process.stdin,
		parse( { delimiter: ',', columns: true } ),
		filterData(),
		transformData(),
		dbSaver(),
		stringify( { delimiter: ',', header: true, columns } ),
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

