import {
	sendNotFound,
	sendSSE,
	sendJSON_Encoded,
	sendError
} from '@johntalton/http-util/response'
import { MIME_TYPE_JSON } from '@johntalton/http-util/headers'

/** @import { RouteResult } from './route.js' */

/**
 * @param {RouteResult} state
 */
export function epilogue(state) {
	const { type, stream, origin, meta } = state

	if(type === '404') {
		sendNotFound(stream, '', meta)
	}
	else if(type === 'sse') {
		sendSSE(stream, origin, { ...meta, active: true, bom: true })
	}
	else if(type === 'json') {
		const { obj, accept } = state

		if(accept.type === MIME_TYPE_JSON) {
			sendJSON_Encoded(stream, obj ?? {}, accept.encoding, origin, meta)
		}
		else {
			sendError(stream, `unknown content type ${accept.type}`, meta)
		}
	}
	else if(type === 'unsupported') {
		const { method, url } = state
		sendError(stream, `Unsupported ${method} ${url}`, meta)
	}
	else if(type === 'error') {
		const { cause } = state
		sendError(stream, cause, meta)
	}
	else { throw new Error(`unknown type ${type}`) }
}