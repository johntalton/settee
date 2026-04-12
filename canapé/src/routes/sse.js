import { MIME_TYPE_EVENT_STREAM } from '@johntalton/http-util'
import { Settee } from '@johntalton/settee'
import { SSE_LAST_EVENT_ID } from '@johntalton/sse-util'

/** @import { RouteMatches, RouteRequest, RouteAction } from '@johntalton/http-core' */

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

		const filterViewName = state.url.searchParams.get('view') ?? undefined

		const { port1, port2 } = new MessageChannel()

		const controller = new AbortController()

		const lastEventId = state.headers[SSE_LAST_EVENT_ID.toLowerCase()]
		console.log('sse last event id', lastEventId)

		Promise.resolve()
			.then(async () => {
				const sseEndSignal = controller.signal
				const signal = AbortSignal.any([ shutdownSignal, sseEndSignal ])

				for await (const change of Settee.changes(filterViewName, { ...foundDB, internal_signal: signal  })) {
					console.log('Settee Change', state.streamId, change)
					const { id } = change

					port1.postMessage({
						event: 'update',
						data: [ JSON.stringify({ id }) ]
					})
				}
			})
			.catch(e => {
				if(e.name === 'AbortError') {
					console.log('sse source aborted', state.streamId, e.cause)
				}
				else {
					console.warn('error in sse source', e)
				}
			})
			.finally(() => {
				console.log('sse source generator existed', state.streamId)
			})

		// Send welcome message with preferred timeout
		port1.postMessage({
		 	comment: '🚀',
			retryMs: 1000 * 60,
		})

		state.stream.once('close', () => {
			console.log('stream close in SSE source', state.streamId)
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