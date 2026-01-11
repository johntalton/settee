import http2 from 'node:http2'
import { TLSSocket } from 'node:tls'

import { requestBody } from '@johntalton/http-util/body'

import {
	MIME_TYPE_JSON,
	MIME_TYPE_TEXT,
	MIME_TYPE_XML,
	parseContentType,

	Accept,
	AcceptEncoding,
	AcceptLanguage,

	Forwarded,
	FORWARDED_KEY_FOR,
	KNOWN_FORWARDED_KEYS
} from '@johntalton/http-util/headers'
import { ENCODER_MAP, HTTP_HEADER_FORWARDED, HTTP_HEADER_ORIGIN } from '@johntalton/http-util/response'

// import { RateLimiter } from '../util/rate-limiter.js'
// import { getTokens } from '../util/token.js'

/** @import { ServerHttp2Stream, IncomingHttpHeaders } from 'node:http2' */

const { HTTP2_METHOD_OPTIONS } = http2.constants

const {
	HTTP2_HEADER_METHOD,
	HTTP2_HEADER_AUTHORITY,
	HTTP2_HEADER_SCHEME,
	HTTP2_HEADER_PATH,
	HTTP2_HEADER_AUTHORIZATION,
	HTTP2_HEADER_CONTENT_TYPE,
	HTTP2_HEADER_CONTENT_LENGTH,
	HTTP2_HEADER_CONTENT_DISPOSITION,
	HTTP2_HEADER_ACCEPT,
	HTTP2_HEADER_ACCEPT_ENCODING,
	HTTP2_HEADER_ACCEPT_LANGUAGE,
	HTTP2_HEADER_REFERER,
	HTTP2_HEADER_HOST,
	HTTP2_HEADER_VIA,
	HTTP2_HEADER_CACHE_CONTROL,
	HTTP2_HEADER_ETAG,
	HTTP2_HEADER_IF_MATCH,
	HTTP2_HEADER_IF_MODIFIED_SINCE,
	HTTP2_HEADER_IF_NONE_MATCH,
	HTTP2_HEADER_IF_RANGE,
	HTTP2_HEADER_IF_UNMODIFIED_SINCE,
	HTTP2_HEADER_LAST_MODIFIED
} = http2.constants

const DEFAULT_SUPPORTED_LANGUAGES = [ 'en-US', 'en' ]
const DEFAULT_SUPPORTED_MIME_TYPES = [ MIME_TYPE_JSON, MIME_TYPE_XML, MIME_TYPE_TEXT ]
const DEFAULT_SUPPORTED_ENCODINGS = [ ...ENCODER_MAP.keys() ]

const FORWARDED_KEY_SECRET = 'secret'
const FORWARDED_ACCEPTABLE_KEYS = [ ...KNOWN_FORWARDED_KEYS, FORWARDED_KEY_SECRET ]
const FORWARDED_REQUIRED = process.env['CANAPE_FORWARDED_REQUIRED'] === 'true'
const FORWARDED_DROP_RIGHTMOST = (process.env['CANAPE_FORWARDED_SKIP_LIST'] ?? '').split(',').map(s => s.trim()).filter(s => s.length > 0)
const FORWARDED_SECRET = process.env['CANAPE_FORWARDED_SECRET']

const ALLOWED_ORIGINS = (process.env['CANAPE_ALLOWED_ORIGINS'] ?? '').split(',').map(s => s.trim())

const BODY_TIMEOUT_SEC = 2 * 1000
const BODY_BYTE_LENGTH = 1000 * 1000

const ipRateLimitStore = new Map()
const ipRateLimitPolicy = {
	name: 'ip',
	quota: 25,
	windowSeconds: 15,
	size: 50,
	quotaUnits: 1
}

/**
 * @param {string|undefined|Array<string>} header
 * @returns {header is string}
 */
function isValidHeader(header) {
	return header !== undefined && !Array.isArray(header)
}

/**
 * @param {string|undefined|Array<string>} header
 * @returns {header is string|undefined}
 */
function isValidLikeHeader(header) {
	return !Array.isArray(header)
}

/**
 * @param {ServerHttp2Stream} stream
 * @param {IncomingHttpHeaders} headers
 * @param {string|undefined} servername
 * @param {AbortSignal} shutdownSignal
 * @returns {RouteResult}
 */
export function preamble(stream, headers, servername, shutdownSignal) {
	const preambleStart = performance.now()

	//
	const method = headers[HTTP2_HEADER_METHOD]
	const fullPathAndQuery = headers[HTTP2_HEADER_PATH]
	const authority = headers[HTTP2_HEADER_AUTHORITY]
	const scheme = headers[HTTP2_HEADER_SCHEME]
	//
	const authorization = headers[HTTP2_HEADER_AUTHORIZATION]
	//
	const fullForwarded = headers[HTTP_HEADER_FORWARDED]
	//
	const fullContentType = headers[HTTP2_HEADER_CONTENT_TYPE]
	const fullContentLength = headers[HTTP2_HEADER_CONTENT_LENGTH]
	const fullAccept = headers[HTTP2_HEADER_ACCEPT]
	const fullAcceptEncoding = headers[HTTP2_HEADER_ACCEPT_ENCODING]
	const fullAcceptLanguage = headers[HTTP2_HEADER_ACCEPT_LANGUAGE]
	//
	const origin = headers[HTTP_HEADER_ORIGIN]
	// const host = header[HTTP2_HEADER_HOST]
	// const referer = header[HTTP2_HEADER_REFERER]
	// const UA = header[HTTP_HEADER_USER_AGENT]

	// // SEC Client Hints
	// const secUA = header[HTTP_HEADER_SEC_CH_UA]
	// const secPlatform = header[HTTP_HEADER_SEC_CH_PLATFORM]
	// const secMobile = header[HTTP_HEADER_SEC_CH_MOBILE]
	// const secFetchSite = header[HTTP_HEADER_SEC_FETCH_SITE]
	// const secFetchMode = header[HTTP_HEADER_SEC_FETCH_MODE]
	// const secFetchDest = header[HTTP_HEADER_SEC_FETCH_DEST]


	const allowedOrigin = (ALLOWED_ORIGINS.includes(origin) || (ALLOWED_ORIGINS.includes('*'))) ? origin : undefined

	const defaultReturn = {
		stream,
		meta: {
			servername,
			performance: [],
			origin: allowedOrigin
		},
		shutdownSignal
	}

	if(stream.session === undefined) { return { type: 'error', ...defaultReturn } }
	if(!(stream.session.socket instanceof TLSSocket)) { return { type: 'error', ...defaultReturn }}

	const ip = stream.session.socket.remoteAddress
	const port = stream.session.socket.remotePort
	// @ts-ignore
	const SNI = stream.session.socket.servername // TLS SNI

	//
	if(!isValidHeader(fullPathAndQuery)) { return { type: 'error', cause: 'improper header', ...defaultReturn }}
	if(!isValidHeader(method)) { return { type: 'error', cause: 'improper header', ...defaultReturn }}

	if(!isValidLikeHeader(fullContentType)) { return { type: 'error', cause: 'improper header', ...defaultReturn }}
	if(!isValidLikeHeader(fullContentLength)) { return { type: 'error', cause: 'improper header', ...defaultReturn }}
	if(!isValidLikeHeader(fullAccept)) { return { type: 'error', cause: 'improper header', ...defaultReturn }}
	if(!isValidLikeHeader(fullAcceptEncoding)) { return { type: 'error', cause: 'improper header', ...defaultReturn }}
	if(!isValidLikeHeader(fullAcceptLanguage)) { return { type: 'error', cause: 'improper header', ...defaultReturn }}
	if(!isValidLikeHeader(authorization)) { return { type: 'error', cause: 'improper header', ...defaultReturn }}

	//
	const requestUrl = new URL(fullPathAndQuery, `${scheme}://${authority}`)

	//
	// Forwarded
	//
	const forwardedList = Forwarded.parse(fullForwarded, FORWARDED_ACCEPTABLE_KEYS)
	const forwarded = Forwarded.selectRightMost(forwardedList, FORWARDED_DROP_RIGHTMOST)
	const forwardedFor = forwarded?.get(FORWARDED_KEY_FOR)
	const forwardedSecret = forwarded?.get(FORWARDED_KEY_SECRET)

	if(FORWARDED_REQUIRED && forwarded === undefined) { return { type: 'error', cause: 'forwarded required', ...defaultReturn } }
	if(FORWARDED_REQUIRED && forwardedFor === undefined) { return { type: 'error', cause: 'forwarded for required', ...defaultReturn } }
	if(FORWARDED_REQUIRED && forwardedSecret !== FORWARDED_SECRET) { return { type: 'error', cause: 'forwarded invalid', ...defaultReturn } }

	//
	// Options
	//
	if(method === HTTP2_METHOD_OPTIONS) { return { type: 'preflight', url: requestUrl, ...defaultReturn }}

	//
	// rate limit
	//
	// const ipRateLimitKey = `${ip}`
	// if(!RateLimiter.test(ipRateLimitStore, ipRateLimitKey, ipRateLimitPolicy)) { return { type: 'limit', url: requestUrl, policy: ipRateLimitPolicy, ...defaultReturn } }

	//
	// token
	//
	// const tokens = getTokens(authorization, requestUrl.searchParams)

	//
	// content negotiation
	//
	const contentType = parseContentType(fullContentType)
	const acceptedEncoding = AcceptEncoding.select(fullAcceptEncoding, DEFAULT_SUPPORTED_ENCODINGS)
	const accept = Accept.select(fullAccept, DEFAULT_SUPPORTED_MIME_TYPES)
	const acceptedLanguage = AcceptLanguage.select(fullAcceptLanguage, DEFAULT_SUPPORTED_LANGUAGES)

	//
	// setup future body
	//
	const contentLength = fullContentLength === undefined ? undefined : parseInt(fullContentLength, 10)
	const body = requestBody(stream, {
		byteLimit: BODY_BYTE_LENGTH,
		contentLength,
		contentType,
		signal: AbortSignal.any([
			shutdownSignal,
			AbortSignal.timeout(BODY_TIMEOUT_SEC)
		])
	})

	//
	const preambleEnd = performance.now()

	return {
		type: 'request',
		method,
		url: requestUrl,
		origin: allowedOrigin,
		stream,
		headers,
		body,
		// tokens,
		accept: {
			type: accept,
			encoding: acceptedEncoding,
			language: acceptedLanguage
		},
		client: { ip, port },
		SNI,
		meta: {
			servername,
			origin: allowedOrigin,
			performance: [
				{ name: 'preamble', duration: preambleEnd - preambleStart }
			]
		},
		shutdownSignal
	}
}