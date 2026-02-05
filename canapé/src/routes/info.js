import { Settee } from '@johntalton/settee'
import * as v8 from 'node:v8'
import { performance } from 'node:perf_hooks'

/** @import { RouteMatches, RouteRequest, RouteAction } from '../index.js' */

export class InfoRoute {
	/**
	 * @param {RouteMatches} _matches
	 * @param {RouteRequest} state
	 * @returns {Promise<RouteAction>}
	 */
	static async getRoot(_matches, state) {
		const { config } = state

		const memUsage = process.memoryUsage()
		const heapStats = v8.getHeapStatistics()

		return {
			...state,
			type: 'json',
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
	 * @param {RouteRequest} state
	 * @returns {Promise<RouteAction>}
	 */
	static async getDB(matches, state) {
		const { config } = state
		const { db } = matches

		if(db === undefined) { return { ...state, type: '404', message: 'database undefined' }}
		const foundDB = config.dbs.find(value => value.name === db)
		if(foundDB === undefined) { return { ...state, type: '404', message: 'database not found' } }

		const info = await Settee.info(foundDB)
			.catch(e => { throw new Error('Error fetching DB info', { cause: e }) })

		return {
			...state,
			type: 'json',
			obj: {
				...info,
				digestAlgo: foundDB.digestAlgo
			}
		}
	}

	/**
	 * @param {RouteMatches} matches
	 * @param {RouteRequest} state
	 * @returns {Promise<RouteAction>}
	 */
	static async getView(matches, state) {
		const { config } = state
		const { db } = matches

		if(db === undefined) { return { ...state, type: '404', message: 'database undefined' }}
		const foundDB = config.dbs.find(value => value.name === db)
		if(foundDB === undefined) { return { ...state, type: '404', message: 'database not found' } }

		const info = await Settee.viewInfo(foundDB)

		return {
			...state,
			type: 'json',
			obj: info
		}
	}
}
