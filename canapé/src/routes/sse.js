import { SSE_LAST_EVENT_ID } from '@johntalton/sse-util'

import { Settee } from '@johntalton/settee'
import { MIME_TYPE_EVENT_STREAM } from '@johntalton/http-util'

/** @import { RouteMatches, RouteRequest, RouteAction } from '../index.js' */

export class SSERoute {
  /**
	 * @param {RouteMatches} matches
	 * @param {RouteRequest} state
	 * @returns {Promise<RouteAction>}
	 */
  static async get(matches, state) {
		const { config, accept, shutdownSignal } = state
		const { db } = matches

		if(db === undefined) { return { ...state, type: '404', message: 'database undefined' }}
		const foundDB = config.dbs.find(value => value.name === db)
		if(foundDB === undefined) { return { ...state, type: '404', message: 'database not found' } }

		if(accept.type !== MIME_TYPE_EVENT_STREAM) {
			return { ...state, type: 'not-acceptable', acceptableMediaTypes: [ MIME_TYPE_EVENT_STREAM ] }
		}

		const { port1, port2 } = new MessageChannel()

		const controller = new AbortController()

		const lastEventId = state.headers[SSE_LAST_EVENT_ID.toLowerCase()]
		console.log('sse last event id', lastEventId)

		Promise.resolve()
			.then(async () => {
				const sseEndSignal = controller.signal
				const signal = AbortSignal.any([ shutdownSignal, sseEndSignal ])

				for await (const change of Settee.changes({ ...foundDB, internal_signal: signal  })) {
					console.log('Settee Change', change)
					const { id } = change

					port1.postMessage({
						event: 'update',
						data: [ JSON.stringify({ id }) ]
					})
				}
			})
			.catch(e => {
				if(e.name === 'AbortError') {
					console.log('sse source aborted', e.cause)
				}
				else {
					console.warn('error in sse source', e)
				}
			})
			.finally(() => {
				console.log('sse source generator existed')
			})

		// Send welcome message with preferred timeout
		port1.postMessage({
		 	comment: '🚀',
			retryMs: 1000 * 60,
		})

		state.stream.once('close', () => {
			console.log('stream close in SSE source')
			// clearInterval(interval)
			// clearImmediate(immediate)
			port1.close()
			controller.abort('stream close')
		})

		return {
			...state,
			type: 'sse',
			active: true,
			bom: true,
			port: port2
		}
  }
}