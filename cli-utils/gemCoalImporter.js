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
			if( chunk[ 'Production or Capacity Data' ] === 'Production' ) {
				callback( null, chunk )
			} else {
				console.log( '...skip', chunk[ 'Mine ID' ] )
				callback( null, undefined )
			}
		}
	} )

const transformData = ( fn, options = {} ) =>
	new Transform( {
		objectMode: true,
		...options,

		async transform( chunk, encoding, callback ) {

			console.log( '+', chunk[ 'Mine ID' ] )
			chunk.co2e = convertVolume( chunk[ 'Coal Output (Annual, Mt)' ], 'coal', 'Gg', 'kgco2e' )
			chunk.iso3166 = getISO3166( chunk.Country )

			const link = chunk[ 'GEM Wiki Page (ENG)' ]?.split( '/' )
			const page = encodeURIComponent( link[ link.length - 1 ] )
			const apiUrl = `https://www.gem.wiki/w/api.php?action=parse&page=${ page }&prop=wikitext&format=json`
			try {
				const api = await fetch( apiUrl )
				if( api.ok ) {
					const resp = await api.json()
					const content = resp?.parse?.wikitext?.[ '*' ]

					const start = content.indexOf( '==Background==' )
					if( start < 0 ) console.log( 'No Background header in text for', chunk[ 'Mine ID' ] )
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
	'Mine ID': 'source_project_id',
	'Mine Name': '',
	'GEM Wiki Page (ENG)': '',
	'Operators': '',
	'OC Operator ID': '',
	'Coal Output (Annual, Mt)': 'volume',
	'Mine Type': 'project_type',
	'Mining Method': 'project_method',
	'Coal Type': 'production_type',
	'Coal Grade': 'production_grade',
	'fuel': 'fossil_fuel_type',
	'unit': 'unit',
	'Reserves Total (Proven & Probable)': 'reserves',
	'Location': 'location_name',
	'State, Province': 'region',
	'Country': 'country',
	'geo_position': 'geo_position',
}

const dbInsert = async( chunk, cb ) => {

	await pgClient.query(
		`INSERT INTO public.sparse_projects
         (iso3166, iso3166_2, project_id, source_project_name, source_project_id, region, location_name, operator_name,
          oc_operator_id, geo_position, "year", volume, unit, production_co2e, description, link_url, production_type,
          production_method, production_grade, reserves, source_id, fossil_fuel_type, subtype, projection)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ST_SetSRID(ST_POINT($10, $11), 4326), $12, $13, $14, $15, $16, $17,
                 $18, $19, $20, $21, $22, $23, $24, $25)`, [
			/* 01 */ chunk[ 'iso3166' ],
			/* 02 */ chunk[ 'iso31662' ] ?? null,
			/* 03 */ chunk[ 'Mine Name' ],
			/* 04 */ chunk[ 'Mine Name' ],
			/* 05 */ chunk[ 'Mine ID' ],
			/* 06 */ chunk[ 'State, Province' ],
			/* 07 */ chunk[ 'Location' ],
			/* 08 */ chunk[ 'Operators' ],
			/* 09 */ chunk[ 'OC Operator ID' ],
			/* 10 */ chunk[ 'Longitude' ],
			/* 11 */ chunk[ 'Latitude' ],
			/* 12 */ chunk[ 'year' ] ?? 2021,
			/* 13 */ parseFloat( chunk[ 'Coal Output (Annual, Mt)' ] ),
			/* 14 */ chunk[ 'unit' ] ?? 'Gg',
			/* 15 */ chunk[ 'co2e' ] ?? 0,
			/* 16 */ chunk[ 'description' ] ?? '',
			/* 17 */ chunk[ 'GEM Wiki Page (ENG)' ],
			/* 18 */ chunk[ 'Coal Type' ],
			/* 19 */ chunk[ 'Mining Method' ],
			/* 20 */ chunk[ 'Coal Grade' ],
			/* 21 */ chunk[ 'reserves' ] ?? null,
			/* 22 */ 15, // source_id
			/* 23 */ chunk[ 'fuel' ] ?? 'coal',
			/* 24 */ chunk[ 'Coal Type' ]?.toLowerCase() ?? null,
			/* 25 */ false
		] )
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

	const rows = await pgClient.query( 'DELETE FROM public.sparse_projects' )

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

