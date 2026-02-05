import http2 from 'node:http2'
import { TLSSocket } from 'node:tls'

import { requestBody } from '@johntalton/http-util/body'
import {
	MIME_TYPE_JSON,
	MIME_TYPE_TEXT,
	MIME_TYPE_XML,
	MIME_TYPE_EVENT_STREAM,
	MIME_TYPE_MESSAGE_HTTP,
	parseContentType,

	Accept,
	AcceptEncoding,
	AcceptLanguage,

	Forwarded,
	FORWARDED_KEY_FOR,
	KNOWN_FORWARDED_KEYS,
	Conditional
} from '@johntalton/http-util/headers'
import { ENCODER_MAP, HTTP_HEADER_FORWARDED, HTTP_HEADER_ORIGIN } from '@johntalton/http-util/response'

import { isValidHeader, isValidLikeHeader, isValidMethod } from './index.js'

// import { RateLimiter } from '../util/rate-limiter.js'
// import { getTokens } from '../util/token.js'

/** @import { ServerHttp2Stream, IncomingHttpHeaders } from 'node:http2' */

/** @import { RouteRequest, RouteAction, CanapeConfig, StreamID } from './index.js' */

const { HTTP2_METHOD_OPTIONS, HTTP2_METHOD_TRACE } = http2.constants

const {
	HTTP2_HEADER_METHOD,
	HTTP2_HEADER_AUTHORITY,
	HTTP2_HEADER_SCHEME,
	HTTP2_HEADER_PATH,
	HTTP2_HEADER_AUTHORIZATION,
	HTTP2_HEADER_CONTENT_TYPE,
	HTTP2_HEADER_CONTENT_LENGTH,
	HTTP2_HEADER_ACCEPT,
	HTTP2_HEADER_ACCEPT_ENCODING,
	HTTP2_HEADER_ACCEPT_LANGUAGE,
	// HTTP2_HEADER_REFERER,
	// HTTP2_HEADER_HOST,
	// HTTP2_HEADER_VIA,
	// HTTP2_HEADER_CACHE_CONTROL,
	HTTP2_HEADER_IF_MATCH,
	HTTP2_HEADER_IF_MODIFIED_SINCE,
	HTTP2_HEADER_IF_NONE_MATCH,
	HTTP2_HEADER_IF_RANGE,
	HTTP2_HEADER_IF_UNMODIFIED_SINCE,
	// HTTP2_HEADER_LAST_MODIFIED,
	HTTP2_HEADER_MAX_FORWARDS,
	// HTTP2_HEADER_FROM
} = http2.constants

const DEFAULT_SUPPORTED_LANGUAGES = [ 'en-US', 'en' ]
const DEFAULT_SUPPORTED_MIME_TYPES = [
	MIME_TYPE_JSON,
	MIME_TYPE_XML,
	MIME_TYPE_TEXT,
	MIME_TYPE_EVENT_STREAM,
	MIME_TYPE_MESSAGE_HTTP
]
const DEFAULT_SUPPORTED_ENCODINGS = [ ...ENCODER_MAP.keys() ]

const FORWARDED_KEY_SECRET = 'secret'
const FORWARDED_ACCEPTABLE_KEYS = [ ...KNOWN_FORWARDED_KEYS, FORWARDED_KEY_SECRET ]
const FORWARDED_REQUIRED = process.env['CANAPE_FORWARDED_REQUIRED'] === 'true'
const FORWARDED_DROP_RIGHTMOST = (process.env['CANAPE_FORWARDED_SKIP_LIST'] ?? '').split(',').map(s => s.trim()).filter(s => s.length > 0)
const FORWARDED_SECRET = process.env['CANAPE_FORWARDED_SECRET']

const ALLOWED_ORIGINS = (process.env['CANAPE_ALLOWED_ORIGINS'] ?? '').split(',').map(s => s.trim()).filter(s => s.length > 0)

const ALLOW_TRACE = process.env['CANAPE_ALLOW_TRACE'] === 'true'

const BODY_TIMEOUT_SEC = 2 * 1000
const BODY_BYTE_LENGTH = 1000 * 1000

// const ipRateLimitStore = new Map()
// const ipRateLimitPolicy = {
// 	name: 'ip',
// 	quota: 25,
// 	windowSeconds: 15,
// 	size: 50,
// 	quotaUnits: 1
// }

/**
 * @param {CanapeConfig} config
 * @param {StreamID} streamId
 * @param {ServerHttp2Stream} stream
 * @param {IncomingHttpHeaders} headers
 * @param {string|undefined} servername
 * @param {AbortSignal} shutdownSignal
 * @returns {RouteRequest|RouteAction}
 */
export function preamble(config, streamId, stream, headers, servername, shutdownSignal) {
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
	const maxForwards = headers[HTTP2_HEADER_MAX_FORWARDS]
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

	//
	// const from = headers[HTTP2_HEADER_FROM]

	// Conditions
	const conditionIfMatch = headers[HTTP2_HEADER_IF_MATCH]
	const conditionIfNoneMatch = headers[HTTP2_HEADER_IF_NONE_MATCH]
	const conditionIfModifiedSince = headers[HTTP2_HEADER_IF_MODIFIED_SINCE]
	const conditionIfUnmodifiedSince = headers[HTTP2_HEADER_IF_UNMODIFIED_SINCE]
	const conditionIfRange = headers[HTTP2_HEADER_IF_RANGE]

	// // SEC Client Hints
	// const secUA = header[HTTP_HEADER_SEC_CH_UA]
	// const secPlatform = header[HTTP_HEADER_SEC_CH_PLATFORM]
	// const secMobile = header[HTTP_HEADER_SEC_CH_MOBILE]
	// const secFetchSite = header[HTTP_HEADER_SEC_FETCH_SITE]
	// const secFetchMode = header[HTTP_HEADER_SEC_FETCH_MODE]
	// const secFetchDest = header[HTTP_HEADER_SEC_FETCH_DEST]

	//
	const allowedOrigin = (origin !== undefined) ?
		((ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) ?
		(URL.canParse(origin) ?
		origin : undefined) : undefined) : undefined

	// console.log('Allowed Origins', origin, allowedOrigin, ALLOWED_ORIGINS)

	/** @type {RouteRequest|RouteAction} */
	const state = {
		type: 'error',
		cause: 'initialize',
		config,
		streamId,
		stream,
		meta: {
			servername,
			performance: [],
			origin: allowedOrigin,
			customHeaders: []
		},
		shutdownSignal
	}

	if(shutdownSignal.aborted) {
		return { ...state, type: 'unavailable', retryAfter: 60 }
	}

	if(stream.session === undefined) { return { ...state, type: 'error', cause: 'undefined session' } }
	if(!(stream.session.socket instanceof TLSSocket)) { return { ...state, type: 'error', cause: 'not a TLSSocket' }}

	const family = stream.session.socket.remoteFamily
	const ip = stream.session.socket.remoteAddress
	const port = stream.session.socket.remotePort

	// @ts-ignore
	const SNI = stream.session.socket.servername // TLS SNI

	//
	if(!isValidHeader(fullPathAndQuery)) { return { ...state, type: 'error', cause: 'improper path' }}
	if(!isValidMethod(method)) { return { ...state, type: 'not-implemented', message: 'unknown or invalid method' }}

	if(!isValidLikeHeader(fullContentType)) { return { ...state, type: 'error', cause: 'improper header (content type)' }}
	if(!isValidLikeHeader(fullContentLength)) { return { ...state, type: 'error', cause: 'improper header (content length)' }}
	if(!isValidLikeHeader(fullAccept)) { return { ...state, type: 'error', cause: 'improper header (accept)' }}
	if(!isValidLikeHeader(fullAcceptEncoding)) { return { ...state, type: 'error', cause: 'improper header (accept encoding)' }}
	if(!isValidLikeHeader(fullAcceptLanguage)) { return { ...state, type: 'error', cause: 'improper header (accept language)' }}
	if(!isValidLikeHeader(authorization)) { return { ...state, type: 'error', cause: 'improper header (authorization)' }}
	if(!isValidLikeHeader(maxForwards)) { return { ...state, type: 'error', cause: 'improper header (max forwards)' } }
	if(!isValidLikeHeader(conditionIfMatch)) { return { ...state, type: 'error', cause: 'improper header (if match)' } }
	if(!isValidLikeHeader(conditionIfNoneMatch)) { return { ...state, type: 'error', cause: 'improper header (if none match)' } }
	if(!isValidLikeHeader(conditionIfModifiedSince)) { return { ...state, type: 'error', cause: 'improper header (if modified since)' } }
	if(!isValidLikeHeader(conditionIfUnmodifiedSince)) { return { ...state, type: 'error', cause: 'improper header (if unmodified since)' } }
	if(!isValidLikeHeader(conditionIfRange)) { return { ...state, type: 'error', cause: 'improper header (if range)' } }

	//
	const requestUrl = new URL(fullPathAndQuery, `${scheme}://${authority}`)

	//
	const conditions = {
		match: Conditional.parseEtagList(conditionIfMatch),
		noneMatch: Conditional.parseEtagList(conditionIfNoneMatch),
		modifiedSince: Conditional.parseFixDate(conditionIfModifiedSince),
		unmodifiedSince: Conditional.parseFixDate(conditionIfUnmodifiedSince),
		// range: conditionIfRange
	}

	//
	// Forwarded
	//
	const forwardedList = Forwarded.parse(fullForwarded, FORWARDED_ACCEPTABLE_KEYS)
	const forwarded = Forwarded.selectRightMost(forwardedList, FORWARDED_DROP_RIGHTMOST)
	const forwardedFor = forwarded?.get(FORWARDED_KEY_FOR)
	const forwardedSecret = forwarded?.get(FORWARDED_KEY_SECRET)

	if(FORWARDED_REQUIRED && forwarded === undefined) { return { ...state, type: 'error', cause: 'forwarded required' } }
	if(FORWARDED_REQUIRED && forwardedFor === undefined) { return { ...state, type: 'error', cause: 'forwarded for required' } }
	if(FORWARDED_REQUIRED && forwardedSecret !== FORWARDED_SECRET) { return { ...state, type: 'error', cause: 'forwarded invalid' } }

	//
	// Options
	//
	if(method === HTTP2_METHOD_OPTIONS) {
		const preambleEnd = performance.now()
		state.meta.performance.push({ name: 'preamble-preflight', duration: preambleEnd - preambleStart })
		return { ...state, type: 'preflight', method, methods: [], url: requestUrl }
	}

	//
	// rate limit
	//
	// const ipRateLimitKey = `${ip}`
	// if(!RateLimiter.test(ipRateLimitStore, ipRateLimitKey, ipRateLimitPolicy)) { return { type: 'limit', url: requestUrl, policy: ipRateLimitPolicy, ...defaultReturn } }

	//
	// content negotiation
	//
	const contentType = parseContentType(fullContentType)
	const acceptedEncoding = AcceptEncoding.select(fullAcceptEncoding, DEFAULT_SUPPORTED_ENCODINGS)
	const accept = Accept.select(fullAccept, DEFAULT_SUPPORTED_MIME_TYPES)
	const acceptedLanguage = AcceptLanguage.select(fullAcceptLanguage, DEFAULT_SUPPORTED_LANGUAGES)
	const acceptObject = {
			type: accept,
			encoding: acceptedEncoding,
			language: acceptedLanguage
		}

	//
	// Trace
	//
	if(method === HTTP2_METHOD_TRACE) {
		if(!ALLOW_TRACE) { return { ...state, type: 'not-allowed', method, methods: [], url: requestUrl }}
		const maxForwardsValue = maxForwards !== undefined ? parseInt(maxForwards) : 0
		const preambleEnd = performance.now()
		state.meta.performance.push({ name: 'preamble-trace', duration: preambleEnd - preambleStart })
		if(acceptObject.type === MIME_TYPE_MESSAGE_HTTP) { return { ...state, type: 'not-acceptable', acceptableMediaTypes: [ MIME_TYPE_MESSAGE_HTTP ] } }
		return { ...state, type: 'trace', method, headers, url: requestUrl, maxForwards: maxForwardsValue, accept: acceptObject }
	}

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
	// token
	//
	// const tokens = getTokens(authorization, requestUrl.searchParams)

	//
	const preambleEnd = performance.now()
	state.meta.performance.push({ name: 'preamble', duration: preambleEnd - preambleStart })

	return {
		...state,
		type: 'request',
		method,
		url: requestUrl,
		headers,
		body,
		// tokens,
		conditions,
		accept: acceptObject,
		client: { family, ip, port },
		SNI
	}
}