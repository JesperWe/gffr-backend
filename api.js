// API route module.
const express = require( 'express' )
const router = express.Router()
const Lime = require( './api-lime.js' )
const Fortnox = require( './api-fortnox' )
const Scrive = require( './api-scrive' )
const FusionAuth = require( './fusionauth' )
const AzureStorage = require( './azure-storage' )
const sysData = require( './api-sysdata' )
const companies = require( './companies' )
const invoiceSource = require( './invoiceSource' )
const WebHook = require( './api-webhook' )
const AgreementRequest = require( './api-agreementRequest' )
const postEmail = require( './api-email' )
const JiraApi = require( './api-jira' )
const CryptoService = require( './CryptoService' )
const Polling = require( './api-polling' )

router.post( '/v1/:system/:cmd?/:param?/:param2?', ( req, res ) => {
	const { system } = req.params
	switch( system ) {
		case 'lime':
			return Lime( req, res )
		case 'fortnox':
			return Fortnox( req, res )
		case 'azurestorage':
			return AzureStorage( req, res )
		case 'iam':
			return FusionAuth( req, res )
		case 'scrive':
			return Scrive( req, res )
		case 'companies':
			return companies( req, res )
		case 'invoiceSource':
			return invoiceSource( req, res )
		case 'callback':
			return WebHook ( req, res )
		case 'agreementRequests':
			return AgreementRequest( req, res )
		case 'email':
			return postEmail( req, res )
		case 'jira':
			return JiraApi( req, res )
		case 'crypto':
			return CryptoService( req, res )
		default:
	}
	res.status( 404 ).end()
} )

router.put( '/v1/:system/:cmd/:param/:id', ( req, res ) => {
	const { system } = req.params
	switch( system ) {
		case 'lime':
			return Lime( req, res )
		default:
	}
	res.status( 404 ).end()
} )

router.get( '/v1/:system/:cmd?/:param?/:param2?', ( req, res ) => {
	const { system } = req.params
	switch( system ) {
		case 'lime':
			return Lime( req, res )
		case 'scrive':
			return Scrive( req, res )
		case 'iam':
			return FusionAuth( req, res )
		case 'fortnox':
			return Fortnox( req, res )
		case 'agreementRequests':
			return AgreementRequest( req, res )
		case 'sysdata':
			return sysData( req, res )
		case 'poll':
			return Polling( req, res )
		default:
	}
	res.status( 404 ).end()
} )

module.exports = router
