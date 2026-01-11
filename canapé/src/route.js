import http2 from 'node:http2'

const {
	HTTP2_HEADER_METHOD
} = http2.constants

/** @typedef {'request'|'json'|'404'|'sse'|'abort'|'unsupported'|'error'|'preflight'|'limit'} RouteResultType */

/**
 * @typedef {Object} RouteResult
 * @property {RouteResultType} type
 * @property {Record<any, any>|undefined} [obj]
 */

/** @typedef {(matches: Record<string, string|undefined>, query: URLSearchParams) => Promise<RouteResult>} RouteMethod */

/**
 * @typedef {Object} RouteItem
 * @property {URLPattern} pattern
 * @property {Record<string, RouteMethod>} methods
 */

/** @typedef {Array<RouteItem>} Routes */

/**
 * @param {Routes} routes
 * @param {RouteResult} state
 * @returns {Promise<RouteResult>}
 */
export async function route(routes, state) {
	const routeStart = performance.now()

	const {
		type,
		stream,
		method,
		url,
		body,
		accept,
		meta,
		shutdownSignal,
	} = state

	const defaultReturn = {
		stream,
		meta,
		shutdownSignal
	}

	if(type !== 'request') { return { type: 'error', cause: `unknown type ${type}`, ...defaultReturn  } }

	for(const route of routes) {
		if(shutdownSignal.aborted) { return { type: 'abort', method, url, ...defaultReturn } }

		const matches = route.pattern.exec(url)
		if(matches === null || matches === undefined) { continue }

		const fn = route.methods[method]
		if(fn === undefined) { return { type: 'unsupported', method, url, ...defaultReturn } }

		defaultReturn.meta.performance.push({
			name: 'route', duration: performance.now() - routeStart
		})

		const handlerStart = performance.now()
		const result = await fn(matches.pathname.groups, state)
		const handlerDelta = performance.now() - handlerStart

		defaultReturn.meta.performance.push({
			name: 'handler', duration: handlerDelta
		})

		return {
			type: 'json',
			accept,
			...result,
			...defaultReturn
		}
	}

	return { type: '404', method, url, ...defaultReturn }
}