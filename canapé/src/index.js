import http2 from 'node:http2'
import fs from 'node:fs'
import crypto from 'node:crypto'

import { route } from './route.js'
import { preamble } from './preamble.js'
import { epilogue } from './epilogue.js'
import { ROUTES } from './routes/index.js'

/** @import { SecureServerOptions } from 'node:http2' */

const {
	SSL_OP_NO_TLSv1,
	SSL_OP_NO_TLSv1_1,
	SSL_OP_NO_TLSv1_2,
} = crypto.constants

const IPV6_ONLY = process.env['CANAPE_IPV6_ONLY'] ?? false
const CANAPE_HOST = process.env['CANAPE_HOST'] ?? ''
const CANAPE_PORT = process.env['CANAPE_PORT'] ?? 6095
const CREDENTIALS_HOST = (process.env['CANAPE_CREDENTIALS'] ?? '').split(',').map(c => c.trim()).filter(c => c.length > 0)
const SERVER_NAME = process.env['CANAPE_SERVER_NAME']

/** @type {SecureServerOptions} */
const options = {
	allowHTTP1: false,
	secureOptions: SSL_OP_NO_TLSv1 | SSL_OP_NO_TLSv1_1 | SSL_OP_NO_TLSv1_2,
	minVersion: 'TLSv1.3',
	settings: {
		enablePush: false
	},
	ALPNProtocols: [ 'h2' ]
}

const router = state => route(ROUTES, state)
const controller = new AbortController()
const shutdownSignal = controller.signal

const server = http2.createSecureServer(options)
server.setTimeout(10 * 1_000)
for(const credentialHost of CREDENTIALS_HOST) {
	server.addContext(credentialHost, {
		key: fs.readFileSync(`./certificates/${credentialHost}-privkey.pem`, 'utf-8'),
		cert: fs.readFileSync(`./certificates/${credentialHost}-cert.pem`, 'utf-8')
	})
}

// server.on('request', (req, res) => res.end('hello'))
server.on('drop', data => console.log('Drop', data))
// server.on('connection', socket => console.log('new connection'))
// server.on('secureConnection', socket => console.log('new secure connection'))
// server.on('keylog', (data) => console.log('key log', data))
// server.on('unknownProtocol', socket => { console.log('Unknown Protocol', socket.getProtocol()) ; socket.end() })
server.on('tlsClientError', (error, socket) => { console.log('TLS Error', error) })
server.on('error', error => console.log('Server Error', error))
server.on('sessionError', error => { console.log('session error', error) })
server.on('listening', () => console.log('Server Up', SERVER_NAME, server.address()))
server.on('close', () => console.log('End of Line'))
// server.on('session', session => { console.log('new session') })
server.on('stream', (stream, headers) => {
	// const start = performance.now()
	const state = preamble(stream, headers, SERVER_NAME, shutdownSignal)
	router(state)
		.then(epilogue)
		.catch(e => epilogue({ ...state, type: 'error', cause: e.message }))
		.catch(e => console.error('Top Level Error:', e))
		// .finally(() => console.log('perf', performance.now() - start))
})

server.listen({
	ipv6Only: IPV6_ONLY,
	port: CANAPE_PORT,
	host: CANAPE_HOST,
	signal: shutdownSignal
})

process.on('SIGINT', () => {
	if(shutdownSignal.aborted) { process.exit() }
	controller.abort('sigint')
})


