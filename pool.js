const { Pool, Client } = require( 'pg' )
const { createDb, migrate } = require( 'postgres-migrations' )

let ssl = false

if( process.env.POSTGRES_CONNECTION_URL.indexOf( 'localhost' ) < 0 )
	ssl = { rejectUnauthorized: false }

const pgPool = new Pool( {
	connectionString: process.env.POSTGRES_CONNECTION_URL,
	application_name: 'PostGraphile',
	ssl
} )

const pgClient = new Client( {
	connectionString: process.env.POSTGRES_CONNECTION_URL,
	application_name: 'REST-API',
	ssl
} )

const fallbackUrl = new URL( process.env.POSTGRES_CONNECTION_URL )
fallbackUrl.pathname = '/postgres'
const pgFallbackClient = new Client( {
	connectionString: fallbackUrl.toString(),
	application_name: 'API-DB-CREATE',
	ssl
} )

const doMigrations = async() => {
	const migrateClient = new Client( {
		connectionString: process.env.POSTGRES_ADMIN_URL,
		application_name: 'REST-API',
		ssl
	} )
	console.log( '> Running migrations.' )
	//console.log( migrateClient )
	try {
		await migrateClient.connect()
		await createDb( 'dev-grff', { client: migrateClient } )
		await migrate( { client: migrateClient }, "schema/migrations" )
	} catch( e ) {
		console.log( e )
	} finally {
		await migrateClient.end()
	}
}

module.exports = { pgPool, pgClient, pgFallbackClient, doMigrations }
