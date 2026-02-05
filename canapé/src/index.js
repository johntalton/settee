import http2 from 'node:http2'
import fs from 'node:fs'
import crypto from 'node:crypto'

import { route } from './route.js'
import { preamble } from './preamble.js'
import { epilogue } from './epilogue.js'
import { ROUTES } from './routes/index.js'

import config from './config.json' with { type: 'json' }

const {
	HTTP2_METHOD_GET,
	HTTP2_METHOD_HEAD,
	HTTP2_METHOD_POST,
	HTTP2_METHOD_PUT,
	HTTP2_METHOD_OPTIONS,
	HTTP2_METHOD_DELETE,
	HTTP2_METHOD_TRACE
} = http2.constants

export const KNOWN_METHODS = [
	HTTP2_METHOD_GET,
	HTTP2_METHOD_HEAD,
	HTTP2_METHOD_POST,
	HTTP2_METHOD_PUT,
	HTTP2_METHOD_OPTIONS,
	HTTP2_METHOD_DELETE,
	HTTP2_METHOD_TRACE
]

/** @import { Http2Stream, ServerHttp2Stream, IncomingHttpHeaders } from 'node:http2' */
/** @import { SecureServerOptions } from 'node:http2' */

/** @import { SetteeOptions } from '@johntalton/settee' */

/** @import { Metadata } from '@johntalton/http-util/response' */
/** @import { BodyFuture } from '@johntalton/http-util/body' */
/** @import { EtagItem, IMFFixDate } from '@johntalton/http-util/headers' */

/** @typedef {'request'} RouteTypeRequest */
/** @typedef {'json'|'404'|'sse'|'error'|'preflight'|'not-allowed'|'trace'|'created'|'unsupported-media'|'not-modified'|'precondition-failed'|'unprocessable'|'not-acceptable'|'conflict'|'not-implemented'|'unavailable'} RouteType */
/** @typedef {'GET'|'HEAD'|'POST'|'PUT'|'OPTIONS'|'DELETE'|'TRACE'} RouteMethod */

/** @typedef {string & { readonly _brand: 'sid' }} StreamID */

/**
 * @typedef {Object} CanapeConfig
 * @property {boolean} maintenance_mode
 * @property {Array<{ name: string } & SetteeOptions>} dbs
 */

/**
 * @typedef {Object} RouteBase
 * @property {RouteTypeRequest|RouteType} type
 * @property {CanapeConfig} config
 * @property {StreamID} streamId
 * @property {ServerHttp2Stream} stream
 * @property {Metadata} meta
 * @property {AbortSignal} shutdownSignal
 */

/**
 * @typedef {Object} RouteRequestBase
 * @property {'request'} type
 * @property {RouteMethod} method
 * @property {URL} url
 * @property {IncomingHttpHeaders} headers
 * @property {BodyFuture} body
 * @property {RouteRequestAccept} accept
 * @property {RouteRemoteClient} client
 * @property {RouteConditions} conditions
 * @property {string} SNI
 */
/** @typedef {RouteBase & RouteRequestBase} RouteRequest */

/**
 * @typedef {Object} RouteErrorBase
 * @property {'error'} type
 * @property {string} cause
 * @property {Error|undefined} [error]
 */
/** @typedef {RouteBase & RouteErrorBase } RouteError */

/**
 * @typedef {Object} RouteNotAllowedBase
 * @property {'not-allowed'} type
 * @property {RouteMethod} method
 * @property {URL} url
 * @property {Array<RouteMethod>} methods
 */
/** @typedef {RouteBase & RouteNotAllowedBase} RouteNotAllowed */

/**
 * @typedef {Object} RouteTraceBase
 * @property {'trace'} type
 * @property {RouteMethod} method
 * @property {URL} url
 * @property {IncomingHttpHeaders} headers
 * @property {number} maxForwards
 * @property {RouteRequestAccept} accept
 */
/** @typedef {RouteBase & RouteTraceBase} RouteTrace */

/**
 * @typedef {Object} RouteRequestAccept
 * @property {string|undefined} type
 * @property {string|undefined} encoding
 * @property {string|undefined} language
 */

/**
 * @typedef {Object} RouteRemoteClient
 * @property {string|undefined} family
 * @property {string|undefined} ip
 * @property {number|undefined} port
 */

/**
 * @typedef {Object} RouteConditions
 * @property {Array<EtagItem>} match
 * @property {Array<EtagItem>} noneMatch
 * @property {IMFFixDate|undefined} modifiedSince
 * @property {IMFFixDate|undefined} unmodifiedSince
 * @property {IMFFixDate|EtagItem|undefined} [range]
 */

/**
 * @typedef {Object} RoutePreflightBase
 * @property {'preflight'} type
 * @property {RouteMethod} method
 * @property {URL} url
 * @property {Array<RouteMethod>} methods
 */
/** @typedef {RouteBase & RoutePreflightBase} RoutePreflight */

/**
 * @typedef {Object} RouteJSONBase
 * @property {'json'} type
 * @property {RouteRequestAccept} accept
 * @property {Record<any, any>} obj
 * @property {IMFFixDate|string|undefined} [lastModified]
 * @property {EtagItem|undefined} [etag]
 * @property {number|undefined} [age]
 */
/** @typedef {RouteBase & RouteJSONBase} RouteJSON */

/**
 * @typedef {Object} Route404Base
 * @property {'404'} type
 * @property {string} method
 * @property {URL} url
 * @property {string} message
 */
/** @typedef {RouteBase & Route404Base} Route404 */

/**
 * @typedef {Object} RouteCreatedBase
 * @property {'created'} type
 * @property {URL|string} location
 * @property {EtagItem|undefined} [etag]
 */
/** @typedef {RouteBase & RouteCreatedBase} RouteCreated */

/**
 * @typedef {Object} RouteUnsupportedMediaTypeBase
 * @property {'unsupported-media'} type
 * @property {Array<string>|string} acceptableMediaTypes
 */
/** @typedef {RouteBase & RouteUnsupportedMediaTypeBase} RouteUnsupportedMediaType */

/**
 * @typedef {Object} RouteNotModifiedBase
 * @property {'not-modified'} type
 * @property {number} age
 * @property {EtagItem|undefined} [etag]
 * @property {number|undefined} [age]
 */
/** @typedef {RouteBase & RouteNotModifiedBase} RouteNotModified */

/**
 * @typedef {Object} RoutePreconditionFailedBase
 * @property {'precondition-failed'} type
 * @property {EtagItem|undefined} [etag]
 */
/** @typedef {RouteBase & RoutePreconditionFailedBase} RoutePreconditionFailed */

/**
 * @typedef {Object} RouteNotAcceptableBase
 * @property {'not-acceptable'} type
 * @property {Array<string>|undefined} [acceptableMediaTypes]
 * @property {Array<string>|undefined} [acceptableEncodings]
 * @property {Array<string>|undefined} [acceptableLanguages]
 */
/** @typedef {RouteBase & RouteNotAcceptableBase} RouteNotAcceptable */

/**
 * @typedef {Object} RouteUnprocessableBase
 * @property {'unprocessable'} type
 * @property {string} message
 */
/** @typedef {RouteBase & RouteUnprocessableBase} RouteUnprocessable */

/**
 * @typedef {Object} RouteConflictBase
 * @property {'conflict'} type
 * @property {string|undefined} [message]
 */
/** @typedef {RouteBase & RouteConflictBase} RouteConflict */

/**
 * @typedef {Object} RouteNotImplementedBase
 * @property {'not-implemented'} type
 * @property {string|undefined} [message]
 */
/** @typedef {RouteBase & RouteNotImplementedBase} RouteNotImplemented */

/**
 * @typedef {Object} RouteUnavailableBase
 * @property {'unavailable'} type
 * @property {string|undefined} [message]
 * @property {number|undefined} [retryAfter]
 */
/** @typedef {RouteBase & RouteUnavailableBase} RouteUnavailable */


/**
 * @typedef {Object} RouteSSEBase
 * @property {'sse'} type
 * @property {boolean} active
 * @property {boolean} bom
 * @property {MessagePort} port
 * @property {RouteRequestAccept} accept
 */
/** @typedef {RouteBase & RouteSSEBase} RouteSSE */

/** @typedef {RouteError | RouteNotAllowed | RoutePreflight | RouteJSON | Route404 | RouteSSE | RouteTrace | RouteCreated | RouteUnsupportedMediaType | RouteNotModified | RoutePreconditionFailed | RouteUnprocessable | RouteNotAcceptable | RouteConflict | RouteNotImplemented | RouteUnavailable } RouteAction */

/** @typedef {Record<string, string|undefined>} RouteMatches */
/** @typedef {(matches: RouteMatches, state: RouteRequest) => Promise<RouteAction>} RouteFunction */

/**
 * @param {Http2Stream} stream
 * @returns {stream is ServerHttp2Stream}
 */
function isServerStream(stream) {
	if(stream === null) { return false }
	return true
}

/**
 * @param {string|undefined|Array<string>} header
 * @returns {header is string}
 */
export function isValidHeader(header) {
	return header !== undefined && isValidLikeHeader(header)
}

/**
 * @param {string|undefined|Array<string>} header
 * @returns {header is string|undefined}
 */
export function isValidLikeHeader(header) {
	return !Array.isArray(header)
}

/**
 * @param {string|undefined|Array<string>} method
 * @returns {method is RouteMethod}
 */
export function isValidMethod(method) {
	if(!isValidHeader(method)) { return false }

	return KNOWN_METHODS.includes(method)
}

/**
 * @param {number} rstCode
 */
export function closeCodeToString(rstCode) {
	if(rstCode === http2.constants.NGHTTP2_NO_ERROR) { return '(No Error)' }
	else if(rstCode === http2.constants.NGHTTP2_PROTOCOL_ERROR) { return '(Protocol Error)' }
	else if(rstCode === http2.constants.NGHTTP2_INTERNAL_ERROR) { return '(Internal Error)' }
	else if(rstCode === http2.constants.NGHTTP2_FLOW_CONTROL_ERROR) { return '(Flow Control Error)' }
	else if(rstCode === http2.constants.NGHTTP2_SETTINGS_TIMEOUT) { return '(Settings Timeout)' }
	else if(rstCode === http2.constants.NGHTTP2_STREAM_CLOSED) { return '(Closed)' }
	else if(rstCode === http2.constants.NGHTTP2_FRAME_SIZE_ERROR) { return '(Frame Size Error)' }
	else if(rstCode === http2.constants.NGHTTP2_REFUSED_STREAM) { return '(Refused)' }
	else if(rstCode === http2.constants.NGHTTP2_CANCEL) { return '(Cancel)' }
	else if(rstCode === http2.constants.NGHTTP2_COMPRESSION_ERROR) { return '(Compression Error)' }
	else if(rstCode === http2.constants.NGHTTP2_CONNECT_ERROR) { return '(Connect Error)' }
	else if(rstCode === http2.constants.NGHTTP2_ENHANCE_YOUR_CALM) { return '(Chill)' }
	else if(rstCode === http2.constants.NGHTTP2_INADEQUATE_SECURITY) { return '(Inadequate Security)' }
	else if(rstCode === http2.constants.NGHTTP2_HTTP_1_1_REQUIRED) { return '(HTTP 1.1 Requested)' }

	return `(${rstCode})`
}

export const REQUEST_ID_SIZE = 5

/**
 * @returns {StreamID}
 */
 export function requestId() {
	const buffer = new Uint8Array(REQUEST_ID_SIZE)
	crypto.getRandomValues(buffer)
	// @ts-ignore
	return buffer.toHex()
}

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

/** @type {(state: RouteRequest|RouteAction) => Promise<RouteAction>} */
const router = state => route(ROUTES, state)
const controller = new AbortController()
const shutdownSignal = controller.signal

const server = http2.createSecureServer(options)
// server.setTimeout(10 * 1_000)
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
server.on('tlsClientError', (error, _socket) => {
	if('code' in error) {
		if(error.code === 'ERR_SSL_SSL/TLS_ALERT_CERTIFICATE_UNKNOWN') { return }
		if(error.code === 'ERR_SSL_NO_SUITABLE_SIGNATURE_ALGORITHM') { return }
		// ERR_SSL_SSL/TLS_ALERT_BAD_CERTIFICATE
	}
	console.log('TLS Error', error)
})
server.on('error', error => console.log('Server Error', error))
server.on('sessionError', error => { console.log('session error', error) })
server.on('listening', () => console.log('Server Up', SERVER_NAME, server.address()))
server.on('close', () => console.log('End of Line'))
// server.on('session', session => { console.log('new session') })
server.on('stream', (stream, headers) => {
	const streamId = requestId()

	// console.log('new stream', streamId, stream.id)
	stream.on('aborted', () => console.log('stream aborted', streamId))
	stream.on('close', () => {
		if(stream.rstCode !== http2.constants.NGHTTP2_NO_ERROR) {
			console.log('stream close', streamId, closeCodeToString(stream.rstCode))
		}
	})
	stream.on('error', error => console.log('stream error', streamId, error.message))
	stream.on('frameError', (type, code, id) => console.log('stream frameError', streamId, type, code, id))

	// tickle the type
	if(!isServerStream(stream)) { return }

	// const start = performance.now()
	const state = preamble(config, streamId, stream, headers, SERVER_NAME, shutdownSignal)
	router(state)
		.then(epilogue)
		.catch(e => epilogue({ ...state, type: 'error', cause: e.message, error: e }))
		.catch(e => console.error('Top Level Error:', streamId, e))
		// .finally(() => console.log('perf', streamId, performance.now() - start))
})

server.listen({
	ipv6Only: IPV6_ONLY,
	port: CANAPE_PORT,
	host: CANAPE_HOST,
	signal: shutdownSignal
})

// 'SIGTERM', 'SIGKILL' 'SIGHUP
process.on('SIGINT', () => {
	if(shutdownSignal.aborted) { process.exit() }
	controller.abort('SIGINT')
})


