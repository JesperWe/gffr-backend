require( "dotenv" ).config()
const express = require( 'express' )
const bodyParser = require( 'body-parser' )
const morgan = require( 'morgan' )
const { pgPool, pgClient, doMigrations } = require( "./pool" )
const { postgraphile } = require( "postgraphile" )
const PgSimplifyInflectorPlugin = require( "@graphile-contrib/pg-simplify-inflector" )
const ConnectionFilterPlugin = require( "postgraphile-plugin-connection-filter" )
const postGIS = require( '@graphile/postgis' )
const cors = require( 'cors' )

const app = express()

app.use( morgan( 'tiny' ) )
app.use( bodyParser.json( { limit: '5mb' } ) )
app.use( bodyParser.urlencoded( { extended: true } ) )
app.use( cors() )

const graphileSettings = {
	watchPg: true,
	appendPlugins: [ PgSimplifyInflectorPlugin, ConnectionFilterPlugin, postGIS.default ],
	graphiql: process.env.ENABLE_GRAPHIQL !== undefined,
	enhanceGraphiql: process.env.ENABLE_GRAPHIQL !== undefined,
	enableCors: true,
	dynamicJson: true,
	ignoreRBAC: false,
	showErrorStack: true,
	extendedErrors: (
		process.env.ENABLE_GRAPHILE_DEBUG
			? [ 'severity', 'code', 'detail', 'hint', 'position', 'internalPosition', 'internalQuery', 'where', 'schema', 'table', 'column', 'dataType', 'constraint', 'file', 'line', 'routine' ]
			: [ "errcode" ]
	),
	enableQueryBatching: true,
	allowExplain: () => process.env.ENABLE_GRAPHILE_DEBUG,
	graphileBuildOptions: {
		connectionFilterAllowedOperators: [
			"isNull",
			"equalTo",
			// "notEqualTo",
			// "distinctFrom",
			// "notDistinctFrom",
			// "lessThan",
			// "lessThanOrEqualTo",
			// "greaterThan",
			// "greaterThanOrEqualTo",
			"includesInsensitive",
			"contains",
			"in",
			//"notIn",
		],
		connectionFilterRelations: true, // mandatory for filter 'people'
		connectionFilterComputedColumns: true,
		connectionFilterLists: true, // mandatory for filter 'tags'
		connectionFilterSetofFunctions: false,
		connectionFilterAllowEmptyObjectInput: true, // useful to search without filters
	}
}

app.set( 'trust proxy', true ) // So we can get client IP

app.use( "/api", require( './api' ) )

// ------------------------------------------------
const port = process.env.PORT || 3100

// Check that we have a database before starting.
const startupSequence = async() => {
	try {
		await pgClient.connect()
		const dbOkResult = await pgClient.query( 'SELECT * FROM public.conversion_constant LIMIT 1' )
		await pgClient.end()
		if( dbOkResult.fields.length > 3 ) console.log( '> DB access check OK' ) // ...arbitrary number: We have some columns.

		if( process.env.ENABLE_POSTGRES_MIGRATIONS === '1' ) {
			await doMigrations()
			app.use( postgraphile( pgPool, ["public", "bc"], graphileSettings ) )
			console.log( '> Postgraphile started after migrations' )
		} else {
			app.use( postgraphile( pgPool, ["public", "bc"], graphileSettings ) )
			console.log( '> Postgraphile started' )
		}
	} catch( error ) {
		console.log( 'Database fail:', error.code, error.message )
		pgClient.end()
	}
}

startupSequence()

console.log( '> Listen on', port )
app.listen( port )
