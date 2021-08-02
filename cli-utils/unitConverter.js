import Graph from 'graph-data-structure'

const DEBUG = false

const fuelTypes = [ 'gas', 'oil', 'coal' ]
const graph = {}
const conversion = {}
let countries = []

export const initUnitConversionGraph = async( pgClient ) => {
	const result = await pgClient.query( 'select * from public.conversion_constant' )
	const constants = result.rows ?? []
	constants.forEach( c => {
		if( !conversion[ c.from_unit ] ) conversion[ c.from_unit ] = {}
		conversion[ c.from_unit ][ c.to_unit ] = {
			factor: c.factor,
			low: c.low,
			high: c.high,
			fuel: c.fossil_fuel_type
		}
	} )

	// Build one Graph() per fuel type
	fuelTypes.forEach( t => {

		graph[ t ] = Graph()
		const thisFuelConversions = constants.filter( c => c.fossil_fuel_type === t || c.fossil_fuel_type === null )
		//console.log( t, constants.length, thisFuelConversions.length )

		// Add all unique units as nodes
		const allUnits = {}
		thisFuelConversions.forEach( u => {
			allUnits[ u.from_unit ] = true
			allUnits[ u.to_unit ] = true
		} )
		Object.keys( allUnits ).forEach( u => graph[ t ].addNode( u ) )

		thisFuelConversions.forEach( conv => {
			graph[ t ].addEdge( conv.from_unit, conv.to_unit )
		} )
	} )
	return graph
}

export const initCountries = async( pgClient ) => {
	const result = await pgClient.query( 'select iso3166, en from public.countries' )
	countries = ( result.rows ?? [] ).map( c => ( { iso3166: c.iso3166, en: c.en.toLowerCase() } ) )
	return countries
}

export const getISO3166 = name => {
	const row = countries.find( c => c.en === name.toLowerCase() )
	if( !row ) {
		console.log( 'ISO3166 not found for', name )
		return 'n/a'
	}
	return row.iso3166
}

export const convertVolume = ( volume, fuel, fromUnit, toUnit ) => {
	try {
		const path = graph[ fuel ].shortestPath( fromUnit, toUnit )
		let factor = 1

		for( let step = 1; step < path.length; step++ ) {
			const from = path[ step - 1 ]
			const to = path[ step ]

			const conv = conversion[ from ][ to ]

			if( !conv ) throw new Error(
				`Conversion data issue: From ${ from } to ${ to } for ${ fuel } is ${ JSON.stringify( conv ) }` )

			factor *= conv.factor
		}

		//console.log( fuel, factor, path )
		return factor * volume
	} catch( e ) {
		console.log( e.message + ': ' + fromUnit, toUnit )
		return volume
	}
}