import { isValidMethod } from '@johntalton/http-core'

/** @import { RouteRequest, RouteFunction, RouteAction, RoutePreflight, RouteMethod } from '@johntalton/http-core' */

/**
 * @typedef {Object} RouteItem
 * @property {URLPattern} pattern
 * @property {Record<string|RouteMethod, RouteFunction>} methods
 */

/** @typedef {Array<RouteItem>} Routes */

/**
 * @param {RouteItem} routeItem
 * @return {Array<RouteMethod>}
 */
function methodFromRoute(routeItem) {
	return Object.keys(routeItem.methods)
		.map(method => isValidMethod(method) ? method : undefined)
		.filter(method => method !== undefined)
}

/**
 * @param {Routes} routes
 * @param {RoutePreflight} state
 * @returns {RouteAction}
 */
function routeOptions(routes, state) {
	const {
		method,
		url,
		shutdownSignal
	} = state

	for(const routeItem of routes) {
		if(shutdownSignal.aborted) { return { ...state, type: 'error', cause: `shutdown during options routing (${shutdownSignal.reason})` } }

		const matches = routeItem.pattern.exec(url)
		if(matches === null || matches === undefined) { continue }

		const methods = methodFromRoute(routeItem)

		return {
			...state,
			type: 'preflight',
			methods,
			supportedQueryTypes: undefined
		}
	}

	return { ...state, type: '404', method, url, message: 'options route not found' }
}


/**
 * @param {Routes} routes
 * @param {RouteRequest|RouteAction} state
 * @returns {Promise<RouteAction>}
 */
export async function route(routes, state) {
	const routeStart = performance.now()

	const {
		type,
		shutdownSignal,
	} = state

	if(type === 'preflight') { return routeOptions(routes, state) }
	if(type !== 'request') { return state }

	const {
		method,
		url
	} = state

	for(const routeItem of routes) {
		if(shutdownSignal.aborted) { return { ...state, type: 'error', cause: `shutdown during routing (${shutdownSignal.reason})` } }

		const matches = routeItem.pattern.exec(url)
		if(matches === null || matches === undefined) { continue }

		const fn = routeItem.methods[method]
		if(fn === undefined) {
			const methods = methodFromRoute(routeItem)
			return { ...state, type: 'not-allowed', method, methods, url }
		}

		state.meta.performance.push({
			name: 'route', duration: performance.now() - routeStart
		})

		const handlerStart = performance.now()
		const result = await Promise.try(fn, matches.pathname.groups, state)
			.catch(e => {
				throw new Error('Route function error', { cause: e })
			})
		const handlerDelta = performance.now() - handlerStart

		state.meta.performance.push({
			name: 'handler', duration: handlerDelta
		})

		return result
	}

	return { ...state, type: '404', method, url, message: 'route not found' }
}