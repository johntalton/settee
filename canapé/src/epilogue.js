import { Response } from '@johntalton/http-util/response/object'
import { MIME_TYPE_JSON } from '@johntalton/http-util/headers'
import { ServerSentEvents } from '@johntalton/sse-util'

/** @import { ServerHttp2Stream } from 'node:http2' */
/** @import { RouteAction } from './index.js' */

/**
 * @param {ServerHttp2Stream} stream
 * @param {MessagePort} port
 * @param {AbortSignal} shutdownSignal
 */
function addSSEPortHandler(stream, port, shutdownSignal) {
	const signalHandler = () => {
		console.log('shutdown of SSE requested (shutdown signal)', shutdownSignal.reason)
		port.close()
		stream.end()
	}

	stream.once('close', (() => {
		console.log('stream close in sse handler')
		shutdownSignal.removeEventListener('abort', signalHandler)
		port.close()
	}))

	shutdownSignal.addEventListener('abort', signalHandler)

	// ServerSentEvents.messageToEventStreamLines({
	// 		comment: 'Welcome',
	// 		retryMs: 1000 * 60,
	// 	}).forEach(line => stream.write(line))

	port.onmessage = message => {
		const { data } = message
		console.log('sending sse data', data)
		// ServerSentEvents.messageToEventStreamLines(data)
		ServerSentEvents.lineGen(data)
			.forEach(line => stream.write(line))
	}
}

/**
 * @param {RouteAction} state
 */
export function epilogue(state) {
	const { type, stream, meta, streamId } = state

	meta.customHeaders.push([ 'X-Request-Id', streamId ])

	switch(type) {
		case '404': { Response.notFound(stream, state.message, meta) } break
		case 'trace': { Response.trace(stream, state.method, state.url, state.headers, meta) } break
		case 'preflight': { Response.preflight(stream, state.methods, meta) } break
		// case 'no-content': { Response.noContent(stream, state.etag, meta)} break
		// case 'accepted': { Response.accepted(stream, meta) } break
		case 'created': { Response.created(stream, new URL(state.location, meta.origin), state.etag, meta) } break
		case 'not-modified': { Response.notModified(stream, state.etag, state.age, { priv: true, maxAge: 60 }, meta) } break


		case 'conflict': { Response.conflict(stream, meta) } break
		case 'not-allowed': { Response.notAllowed(stream, state.methods, meta) } break
		case 'not-acceptable': { Response.notAcceptable(stream, state.acceptableMediaTypes ?? [], meta)} break
		case 'unsupported-media': { Response.unsupportedMediaType(stream, state.acceptableMediaTypes, meta) } break
		case 'unprocessable': { Response.unprocessable(stream, meta) } break
		case 'precondition-failed': { Response.preconditionFailed(stream, meta) } break


		case 'sse': {
			const { active, bom, port } = state

			Response.sse(stream, { ...meta, active, bom })
			if(active) { addSSEPortHandler(stream, port, state.shutdownSignal) }
		}
		break
		case 'json': {
			const { obj, accept, etag } = state

			if(accept.type === MIME_TYPE_JSON) {
				Response.json(stream, obj, accept.encoding, etag, undefined, { priv: true, maxAge: 60 }, meta)
			}
			else {
				// todo: but we did process the request - is that ok?
				Response.notAcceptable(stream, [ MIME_TYPE_JSON ], meta)
			}
		}
		break


		case 'unavailable': { Response.unavailable(stream, state.message, state.retryAfter, meta)} break
		case 'not-implemented': { Response.notImplemented(stream, state.message, meta)} break
		// case 'timeout': { Response.timeout(stream, meta) } break
		case 'error': {
			const { cause, error } = state
			console.log('send error', state.streamId, cause)
			if(error !== undefined) { console.log(error) }
			Response.error(stream, cause, meta)
		} break

		// case 'request' : { throw new Error('unhandled request') } break
		default: {
			/** @type {never} */
			const neverType = type
			Response.error(stream, `unknown type ${neverType}`, meta)
		} break
	}
}