import pg from 'pg'
import dotenv from "dotenv"

const { Client } = pg

dotenv.config( { path: '../.env' } )

let ssl = false

if( process.env.POSTGRES_CONNECTION_URL?.indexOf( 'localhost' ) < 0 )
	ssl = { rejectUnauthorized: false }

const pgClient = new Client( {
	connectionString: process.env.POSTGRES_CONNECTION_URL,
	application_name: 'CLI-UTIL',
	ssl
} )

export { pgClient }
