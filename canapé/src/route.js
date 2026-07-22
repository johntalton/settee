/** biome-ignore-all lint/performance/noAwaitInLoops: because we do */
import { isValidMethod } from '@johntalton/http-core'

/** @import { Config, PreambleRouteResult, RouteFunction, RouteError, RoutePreflight, Route404, RouteRequest, RouteAction, RouteMethod } from '@johntalton/http-core' */

/**
 * @template {Config} C
 * @typedef {Object} RouteItem
 * @property {URLPattern} pattern
 * @property {Record<string|RouteMethod, RouteFunction<C>>} methods
 */

/**
 * @template {Config} C
 * @typedef {Array<RouteItem<C>>} Routes
 */

/**
 * @template {Config} C
 * @param {RouteItem<C>} routeItem
 * @return {Array<RouteMethod>}
 */
function methodFromRoute(routeItem) {
	return Object.keys(routeItem.methods)
		.map(method => isValidMethod(method) ? method : undefined)
		.filter(method => method !== undefined)
}

/**
 * @template {Config} C
 * @param {Routes<C>} routes
 * @param {RouteRequest<C>} state
 * @returns {RoutePreflight<C>|Route404<C>|RouteError<C>}
 */
function routeOptions(routes, state) {
	const {
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
			supportedQueryTypes: [],
			supportedTypes: [],
			supportedHeaders: []
		}
	}

	return { ...state, type: '404', message: 'options route not found' }
}


/**
 * @template {Config} C
 * @param {Routes<C>} routes
 * @param {PreambleRouteResult<C>} state
 * @returns {Promise<RouteAction<C>>}
 */
export async function route(routes, state) {
	const routeStart = performance.now()

	const {
		type,
		shutdownSignal,
	} = state

	if(type !== 'request') { return state }
	if(state.method === 'OPTIONS') { return routeOptions(routes, state) }

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
			return { ...state, type: 'not-allowed', method, methods }
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

	return { ...state, type: '404', method, message: 'route not found' }
}