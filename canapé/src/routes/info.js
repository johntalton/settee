import { performance } from 'node:perf_hooks'
import { getHeapStatistics } from 'node:v8'

import { MIME_TYPE_JSON } from '@johntalton/http-util'
import { Settee } from '@johntalton/settee'

/** @import { RouteMatches, RouteRequest, RouteAction } from '@johntalton/http-core' */
/** @import { CanapeConfig } from '../index.js' */

export class InfoRoute {
	/**
	 * @param {RouteMatches} _matches
	 * @param {RouteRequest<CanapeConfig>} state
	 * @returns {Promise<RouteAction<CanapeConfig>>}
	 */
	static async getRoot(_matches, state) {
		const { config } = state

		//
		// console.log('--->', state.secFetchMetadata)



		//
		const negotiatedType = state.accept.select.type([ MIME_TYPE_JSON ])
		if(negotiatedType?.mimetype !== MIME_TYPE_JSON) {
			return { ...state, type: 'not-acceptable', acceptableTypes: [ MIME_TYPE_JSON ] }
		}

		const negotiatedEncoding = state.accept.select.encoding()

		//
		const memUsage = process.memoryUsage()
		const heapStats = getHeapStatistics()

		return {
			...state,
			type: 'json',
			encoding: negotiatedEncoding?.name,
			obj: {
				dbs: config.dbs.map(db => db.name),
				now: Math.trunc(performance.now() / 1000),
				uptimeSeconds: process.uptime(),
				maintenance_mode: config.maintenance_mode ?? false,
				usage: memUsage,
				heap: heapStats,
				arch: process.arch,
				platform: process.platform,
				availableMem: process.availableMemory(),
				cpuUsage: process.cpuUsage(),
				resourceUsage: process.resourceUsage(),
				performance: performance.nodeTiming

			}
		}

	}

	/**
	 * @param {RouteMatches} matches
	 * @param {RouteRequest<CanapeConfig>} state
	 * @returns {Promise<RouteAction<CanapeConfig>>}
	 */
	static async getDB(matches, state) {
		const { config } = state
		const { db } = matches

		if(db === undefined) { return { ...state, type: '404', message: 'database undefined' }}
		const foundDB = config.dbs.find(value => value.name === db)
		if(foundDB === undefined) { return { ...state, type: '404', message: 'database not found' } }

		//
		const negotiatedType = state.accept.select.type([ MIME_TYPE_JSON ])
		if(negotiatedType?.mimetype !== MIME_TYPE_JSON) {
			return { ...state, type: 'not-acceptable', acceptableTypes: [ MIME_TYPE_JSON ] }
		}

		const negotiatedEncoding = state.accept.select.encoding()

		const info = await Settee.info(foundDB)
			.catch(e => { throw new Error('Error fetching DB info', { cause: e }) })

		return {
			...state,
			type: 'json',
			encoding: negotiatedEncoding?.name,
			obj: {
				...info,
				digestAlgo: foundDB.digestAlgo
			}
		}
	}

	/**
	 * @param {RouteMatches} matches
	 * @param {RouteRequest<CanapeConfig>} state
	 * @returns {Promise<RouteAction<CanapeConfig>>}
	 */
	static async getView(matches, state) {
		const { config } = state
		const { db } = matches

		if(db === undefined) { return { ...state, type: '404', message: 'database undefined' }}
		const foundDB = config.dbs.find(value => value.name === db)
		if(foundDB === undefined) { return { ...state, type: '404', message: 'database not found' } }

		//
		const negotiatedType = state.accept.select.type([ MIME_TYPE_JSON ])
		if(negotiatedType?.mimetype !== MIME_TYPE_JSON) {
			return { ...state, type: 'not-acceptable', acceptableTypes: [ MIME_TYPE_JSON ] }
		}

		const negotiatedEncoding = state.accept.select.encoding()

		//
		const info = await Settee.viewInfo(foundDB)

		return {
			...state,
			type: 'json',
			obj: info,
			encoding: negotiatedEncoding?.name
		}
	}
}
