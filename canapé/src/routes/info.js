import { Settee, isValidDocId } from '@johntalton/settee'

/** @import { RouteResult } from '../route.js' */

export class InfoRoute {
	/**
	 * @param {Record<string, string>} matches
	 * @returns {Promise<RouteResult>}
	 */
	static async getRoot(matches, state) {

		return {
			type: 'json',
			obj: {
				dbs: [ 'exports', 'color' ],
				uptime: Math.trunc(performance.now() / 1000),
				maintenance_mode: false
			}
		}

	}

	/**
	 * @param {Record<string, string>} matches
	 * @returns {Promise<RouteResult>}
	 */
	static async getDB(matches, state) {
		const { db } = matches

		return {
			type: 'json',
			obj: {
				total_count: 1024
			}
		}
	}
}
