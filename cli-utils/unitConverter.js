import Graph from 'graph-data-structure'

const DEBUG = false

const fuelTypes = []
const graph = {}
const conversions = {}
let countries = []

function _join( a, b ) {
	return a + ( b ? '|' + b : '' )
}

export const initUnitConversionGraph = async( pgClient ) => {
	const result = await pgClient.query( 'select * from public.conversion_constant' )
	const _constants = result.rows ?? []

	const constants = _constants.map( c => {
		c.fuel = _join( c.fossil_fuel_type, c.subtype )
		if( !fuelTypes.includes( c.fuel ) ) fuelTypes.push( c.fuel )
		return c
	} )

	// Build one Graph() and conversions table per fuel type
	fuelTypes.forEach( t => {

		graph[ t ] = Graph()

		const thisFuelConversions = constants.filter( c => c.fuel === t || c.fossil_fuel_type === null )
		DEBUG && console.log( t, constants.length, thisFuelConversions.length )

		// Build conversions table for this fuel
		conversions[ t ] = {}
		const conversion = conversions[ t ]
		thisFuelConversions.forEach( c => {
			c.toUnit = _join( c.to_unit, c.modifier )
			c.fromUnit = _join( c.from_unit, c.country )

			if( !conversion[ c.fromUnit ] ) conversion[ c.fromUnit ] = {}
			conversion[ c.fromUnit ][ c.toUnit ] = {
				id: c.id,
				factor: c.factor,
				low: c.low,
				high: c.high,
				fuel: c.fuel
			}
			return c
		} )

		// Add all unique units as nodes
		const allUnits = {}
		thisFuelConversions.forEach( u => {
			allUnits[ u.fromUnit ] = true
			allUnits[ u.toUnit ] = true
		} )
		Object.keys( allUnits ).forEach( u => graph[ t ].addNode( u ) )

		thisFuelConversions.forEach( conv => {
			DEBUG && console.log( t, conv.fromUnit, '-->', conv.toUnit )
			graph[ t ].addEdge( conv.fromUnit, conv.toUnit )
		} )
	} )
	return graph
}

export const initCountries = async( pgClient ) => {
	const result = await pgClient.query( 'select iso3166, en from public.country' )
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

export const convertVolume = ( volume, fuel, fromUnit, toUnit, country ) => {
	try {
		//console.log( fuel, graph[ fuel ].serialize() )
		//console.log( fuel, conversions[ fuel ] )

		const fromSpecific = _join( fromUnit, country )
		let fromU = fromUnit
		if( !graph[ fuel ] ) throw new Error( 'No conversion graph for ' + fuel )
		if( graph[ fuel ].serialize().nodes.find( n => n.id === fromSpecific ) ) {
			DEBUG && console.log( 'FOUND', fromSpecific )
			fromU = fromSpecific
		}
		const path = graph[ fuel ].shortestPath( fromU, toUnit )
		let factor = 1
		const conversion = conversions[ fuel ]

		for( let step = 1; step < path.length; step++ ) {
			const from = path[ step - 1 ]
			const to = path[ step ]

			const conv = conversion[ from ][ to ]

			if( !conv ) throw new Error(
				`Conversion data issue: From ${ from } to ${ to } for ${ fuel } is ${ JSON.stringify( conv ) }` )

			DEBUG && console.log( { from, to, conv, factor, fuel } )
			factor *= conv.factor
		}

		DEBUG && console.log( fuel, factor, path )
		return factor * volume
	} catch( e ) {
		console.log( e.message + ': ' + fromUnit, toUnit, fuel /*, graph[ fuel ]?.serialize() */ )
		return volume
	}
}