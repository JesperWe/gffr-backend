import { pgClient } from "./pool.js"
import { convertVolume, initCountries, initUnitConversionGraph } from "./unitConverter.js"

const DEBUG = true

try {
	await pgClient.connect()
	console.log( 'CONNECTED' )

	await initUnitConversionGraph( pgClient )
	await initCountries( pgClient )
	//console.log( graph?.coal?.serialize() )

	//const rows1 = await pgClient.query( 'TRUNCATE public.sparse_data_point RESTART IDENTITY CASCADE' )
	//const rows2 = await pgClient.query( 'TRUNCATE public.sparse_projects RESTART IDENTITY' )

	const result = await pgClient.query(
		`SELECT p.id,
                p.project_identifier,
                min(pdp.year) AS first_year,
                max(pdp.year) AS last_year,
                pdp.fossil_fuel_type,
                pdp.subtype,
                pdp.source_id
         FROM public.project p,
              public.project_data_point pdp
         WHERE p.id = pdp.project_id
           AND pdp.data_type = 'production'
         GROUP BY p.id, pdp.fossil_fuel_type, pdp.subtype, pdp.source_id
         ORDER BY p.project_identifier`
	)
	const projects = result.rows ?? []

	let currentProject, currentEmissions = 0
	for( const project of projects ) {
		//DEBUG && console.log( 'Project', project )

		if( currentProject && currentProject !== project.id ) {
			// Save emissions
			const res = await pgClient.query( 'update public.project set production_co2e = $1 where id=$2', [ currentEmissions, currentProject ] )
			DEBUG && console.log( 'SAVED', { currentProject, currentEmissions } )
			currentEmissions = 0
		}

		currentProject = project.id

		const params = [ project.id, project.fossil_fuel_type, project.source_id, project.last_year ]
		if( project.subtype ) params.push( project.subtype )

		const r = await pgClient.query( `
            select *
            from public.project_data_point
            where project_id = $1
              and fossil_fuel_type = $2
              and source_id = $3
              and year = $4` + ( project.subtype ? ' and subtype=$5' : '' ),
			params )

		const data = r.rows?.[ 0 ]
		if( !data || !data.unit ) {
			console.log( 'BAD DATA POINT', { data, project } )
			continue
		}
		//console.log(  data )
		currentEmissions += convertVolume( data?.volume, data?.fossil_fuel_type, data?.unit, 'kgco2e' )
	}

	if( currentProject ) { // Last one
		const res = await pgClient.query( 'update public.project set production_co2 = $1 where id=$2', [ currentEmissions, currentProject ] )
		DEBUG && console.log( 'SAVED', { currentProject, currentEmissions } )
	}

	console.log( 'DONE' )
	await pgClient.end()
	console.log( 'DISCONNECTED' )
} catch( e ) {
	console.log( e )
}
