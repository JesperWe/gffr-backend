import { pgClient } from "./pool.js"
import { convertVolume, initCountries, initUnitConversionGraph } from "./unitConverter.js"
import ProgressBar from 'progress'

const DEBUG = false

const args = process.argv.slice( 2 )

function _join( a, b ) {
	return a + ( b ? '|' + b.toLowerCase() : '' )
}

try {
	await pgClient.connect()
	console.log( 'DB connected.' )

	await initUnitConversionGraph( pgClient )
	await initCountries( pgClient )
	//console.log( graph?.coal?.serialize() )

  let result = await pgClient.query(
    `SELECT 
          c.iso3166,
          min(cdp.year) AS first_year,
          max(cdp.year) AS last_year
          FROM public.country c, public.country_data_point cdp
          WHERE c.iso3166 = cdp.iso3166
          GROUP BY c.iso3166, cdp.iso3166, cdp.fossil_fuel_type, cdp.subtype, cdp.source_id`
  )
	const countries = result.rows ?? []
	const bar = new ProgressBar( '[:bar] :percent', { total: countries.length, width: 100 } )

	for( const country of countries ) {

		let currentEmissions = 0
		let processedFuels = []
    let emissionsData = {}

		result = await pgClient.query(
			`SELECT DISTINCT "year", volume, unit, fossil_fuel_type, subtype, source_id FROM public.country_data_point cdp
        	 WHERE iso3166 = $1
	        	AND cdp.fossil_fuel_type IN ('oil', 'gas', 'coal')
        	 ORDER BY "year" DESC`,
			[ country.iso3166 ]
		)

		const dataPoints = result.rows ?? []
		DEBUG && console.log( 'Country', country, dataPoints )
		dataPoints.forEach( data => {
			if( !data || !data.unit ) {
				console.log( 'BAD DATA POINT', { data, country } )
				return
			}

			const fuel = _join( data?.fossil_fuel_type, data?.subtype )
			if( processedFuels.includes( fuel ) ) return
			processedFuels.push( fuel )

      emissionsData = processedFuels.reduce((prev, curr) => {
        const key = curr.split('|')[0]
        prev[key] = {
          scope1: prev.scope1 ? prev.scope1 + convertVolume( data?.volume, curr, data?.unit, 'kgco2e|GWP100' ) :
            convertVolume( data?.volume, curr, data?.unit, 'kgco2e|GWP100' ),
          scope3: prev.scope3 ? prev.scope3 + convertVolume( data?.volume, _join( curr, data?.subtype ), data?.unit, 'kgco2e' ) :
            convertVolume( data?.volume, _join( curr, data?.subtype ), data?.unit, 'kgco2e' )
        };
        return prev;
      }, {});

      const scope1 = convertVolume( data?.volume, data?.fossil_fuel_type, data?.unit, 'kgco2e|GWP100' )
      DEBUG && console.log( 'ADD', { fuel, data, scope1: ( scope1 / 1e9 ).toFixed( 1 ) } )
      currentEmissions += scope1

      const scope3 = convertVolume( data?.volume, fuel, data?.unit, 'kgco2e' )
      DEBUG && console.log( 'ADD', { fuel, data, scope3: ( scope3 / 1e9 ).toFixed( 1 ) } )
      currentEmissions += scope3
		} )
    //
		await pgClient.query( 'UPDATE public.country SET production_co2e = $1 WHERE iso3166 = $2', [ emissionsData, country.iso3166 ] )
		bar.tick()
	}
	console.log( 'DONE' )
} catch
	( e ) {
	console.log( e )
}

await pgClient.end()
console.log( 'DB disconnected.' )
