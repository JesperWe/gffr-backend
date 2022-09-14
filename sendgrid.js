const sendgrid = require( '@sendgrid/mail' )
const { Client } = require( 'pg' )

let ssl = false
if( process.env.POSTGRES_CMS_URL?.indexOf( 'localhost' ) < 0 )
	ssl = { rejectUnauthorized: false }

async function handler( req, res ) {

	const pgClient = new Client( {
		connectionString: process.env.POSTGRES_CMS_URL,
		application_name: 'MAIL-API',
		ssl
	} )

	if( !req.body.formId ) {
		res.status( 400 ).send( { message: 'Form ID required' } )
		return
	}

	await pgClient.connect()
	const form = await pgClient.query( 'SELECT * FROM public.components_shared_feedback_forms WHERE id = $1', [ req.body.formId ] )
	await pgClient.end()

	if( form.rowCount !== 1 ) {
		res.status( 404 ).send( { message: 'Form not found' } )
		return
	}

	const txt = JSON.parse( req.body?.text )
	let text = ''
	Object.keys( txt ).forEach( t => text += t + ': ' + txt[ t ] + '\n' )

	const message = {}
	message.to = form.rows[ 0 ].recipients.split( '\n' ).join( ',' )
	message.text = "Feedback Form Message from fossilfuelregistry.org\n\n!! You CANNOT reply to this message directly !!\n\n\n" + text
	message.from = "fossilfuelregistry@gmail.com"
	message.subject = form.rows[ 0 ].subject

	delete message.formId

	console.log( message )

	try {
		sendgrid.setApiKey( process.env.SENDGRID_API )
		await sendgrid.send( message )
		res.status( 200 ).send( 'Message sent ok' )
	}
	catch( error ) {
		console.error( error.response.body )
		res.status( 500 ).send( error.message )
	}
}

module.exports = handler
