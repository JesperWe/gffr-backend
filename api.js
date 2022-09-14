// API route module.
const express = require( 'express' )
const router = express.Router()
const fetch = require( 'isomorphic-unfetch' )
const sendgrid = require( './sendgrid' )

router.post( '/v1/mail', ( req, res ) => sendgrid( req, res ) )

router.put( '/v1/:system/:cmd/:param/:id', ( req, res ) => {
	const { system } = req.params
	switch( system ) {
		default:
	}
	res.status( 404 ).end()
} )

router.get( '/v1/:system/:cmd?/:param?/:param2?', async( req, res ) => {
	const { system, cmd } = req.params
	let api
	switch( system ) {

		case 'ip-location':
			try {
				api = await fetch( 'http://ip-api.com/json/' + cmd )
				if( !api.ok ) throw new Error( 'ip-api.com Status ' + api.status + ' ' + api.statusText )
				const result = await api.json()
				res.status( 200 ).send( result ).end()
				return
			}
			catch( e ) {
				console.log( e )
				res.status( 500 ).send( e.message ).end()
			}
			break

		default:
	}
	res.status( 404 ).end()
} )

module.exports = router
