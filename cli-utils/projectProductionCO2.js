import { pgClient } from "./pool.js"
import { convertVolume, initCountries, initUnitConversionGraph } from "./unitConverter.js"
import ProgressBar from 'progress'

const DEBUG = false

const args = process.argv.slice( 2 )

function _join( a, b ) {
	return a + ( b ? '|' + b : '' )
}

try {
	await pgClient.connect()
	console.log( 'DB connected.' )

	await initUnitConversionGraph( pgClient )
	await initCountries( pgClient )
	//console.log( graph?.coal?.serialize() )

	let result = await pgClient.query(
		`SELECT p.id,
                p.project_identifier,
                min(pdp.year) AS first_year,
                max(pdp.year) AS last_year,
                methane_m3_ton
         FROM public.project p,
              public.project_data_point pdp
         WHERE p.id = pdp.project_id
           AND pdp.data_type = 'production'
           AND p.iso3166 = '${args[0]}'
         GROUP BY p.id, pdp.fossil_fuel_type, pdp.subtype, pdp.source_id
         ORDER BY p.project_identifier`
	)
	const projects = result.rows ?? []
	const bar = new ProgressBar( '[:bar] :percent', { total: projects.length, width: 100 } )

	for( const project of projects ) {

		let currentEmissions = 0
		let processedFuels = []

		result = await pgClient.query(
			`SELECT DISTINCT "year", volume, unit, fossil_fuel_type, subtype, source_id FROM public.project_data_point pdp
        	 WHERE project_id = $1 
        	 	AND pdp.data_type = 'production'
	        	AND pdp.fossil_fuel_type IN ('oil', 'gas', 'coal')
        	 ORDER BY "year" DESC`,
			[ project.id ]
		)

		const dataPoints = result.rows ?? []
		DEBUG && console.log( 'Project', project, dataPoints )

		dataPoints.forEach( data => {
			if( !data || !data.unit ) {
				console.log( 'BAD DATA POINT', { data, project } )
				return
			}

			if( !( data.year > 0 ) ) return

			const fuel = _join( data?.fossil_fuel_type, data?.subtype )
			if( processedFuels.includes( fuel ) ) return
			processedFuels.push( fuel )

			if( project.methane_m3_ton ) {
				// Calculate Scope1 for sparse project from production volume
				const e6ProductionTons = convertVolume( data?.volume, data.fossil_fuel_type, data?.unit, 'e6ton' )
				const e6m3Methane = e6ProductionTons * project.methane_m3_ton
				const e3tonMethane = convertVolume( e6m3Methane, data.fossil_fuel_type, 'e6m3', 'e3ton|sparse-scope1' )
				const scope1 = convertVolume( e3tonMethane * 1000000, 'coal', 'ch4kg', 'kgco2e|GWP100' )
				DEBUG && console.log( 'ADD CH4', { fuel, data, scope1: ( scope1 / 1e9 ).toFixed( 1 ) } )
				currentEmissions += scope1
			} else {
				const scope1 = convertVolume( data?.volume, fuel, data?.unit, 'kgco2e|GWP100' )
				DEBUG && console.log( 'ADD', { fuel, data, scope1: ( scope1 / 1e9 ).toFixed( 1 ) } )
				currentEmissions += scope1
			}
			const scope3 = convertVolume( data?.volume, fuel, data?.unit, 'kgco2e' )
			DEBUG && console.log( 'ADD', { fuel, data, scope3: ( scope3 / 1e9 ).toFixed( 1 ) } )
			currentEmissions += scope3
		} )

		DEBUG && console.log( 'SAVE', project.project_identifier, ( currentEmissions / 1e9 ).toFixed( 1 ) )
		const res = await pgClient.query( 'UPDATE public.project SET production_co2e = $1 WHERE id=$2', [ currentEmissions, project.id ] )
		bar.tick()
	}
	console.log( 'DONE' )
} catch
	( e ) {
	console.log( e )
}

await pgClient.end()
console.log( 'DB disconnected.' )
