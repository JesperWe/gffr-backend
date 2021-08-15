import util from 'util'
import stream from 'stream'
import csv from 'csv'
import { pgClient } from "./pool.js"
import fetch from 'node-fetch'
import { convertVolume, getISO3166, initCountries, initUnitConversionGraph } from "./unitConverter.js"

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
		/* 09 */ chunk[ 'OC_Operator_ID' ]?.substring(26), //oc_operator_id
		/* 10 */ chunk[ 'Longitude' ], // geo_position
		/* 11 */ chunk[ 'Latitude' ], // geo_position
		/* 12 */ chunk[ 'year' ] ?? 2021, // year
		/* 13 */ parseFloat( chunk[ 'Production_e6tons' ] ), // volume
		/* 14 */ chunk[ 'unit' ] ?? 'e6ton', // unit
		/* 15 */ chunk[ 'co2e' ] ?? 0, // production_co2e
		/* 16 */ chunk[ 'description' ] ?? '', // description
		/* 17 */ chunk[ 'GEM_Wiki_Page_ENG' ], // link_url
		/* 18 */ chunk[ 'Mine Type' ], // production_type
		/* 19 */ chunk[ 'Mining Method' ], // production_method
		/* 20 */ chunk[ 'Grade' ], // grade
		/* 21 */ chunk[ 'Reserves_2p' ] || null, // reserves
		/* 22 */ 15, // source_id
		/* 23 */ chunk[ 'fuel' ] ?? 'coal', // fossil_fuel_type
		/* 24 */ chunk[ 'Type' ]?.toLowerCase() ?? null, // subtype
		/* 25 */ false, // projection
		/* 26 */ chunk[ 'CH4 m3 / ton' ], // methane_m3_ton
		/* 27 */ '2p', // reserves_grade
		/* 28 */ 'e6ton' // reserves_unit
	]
	console.log(params)
	await pgClient.query(
		`INSERT INTO public.sparse_projects
         (iso3166, iso3166_2, project_id, source_project_name, source_project_id, region, location_name, operator_name,
          oc_operator_id, geo_position, "year", volume, unit, production_co2e, description, link_url, production_type,
          production_method, grade, reserves, source_id, fossil_fuel_type, subtype, projection, methane_m3_ton, reserves_grade, reserves_unit)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ST_SetSRID(ST_POINT($10, $11), 4326), $12, $13, $14, $15, $16, $17,
                 $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)`, params )
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

	const rows = await pgClient.query( 'DELETE FROM public.sparse_projects WHERE source_id = 15' )

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

