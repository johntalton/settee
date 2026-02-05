import { Settee, Armoire } from "@johntalton/settee"

/** @import { RouteMatches, RouteRequest, RouteAction } from '../index.js' */

export class ViewRoute {
	/**
	 * @param {RouteMatches} matches
	 * @param {RouteRequest} state
	 * @returns {Promise<RouteAction>}
	 */
	static async get(matches, state) {
		const { config } = state
		const { db, view } = matches

		if(db === undefined) { return { ...state, type: '404', message: 'database undefined' }}
		const foundDB = config.dbs.find(value => value.name === db)
		if(foundDB === undefined) { return { ...state, type: '404', message: 'database not found' } }

		if (view === undefined) { return { ...state, type: '404', message: 'view undefined' } }


		const filterKeys = state.url.searchParams.getAll('key')
		// console.log('view', view, filterKeys)

		// state.stream.session.setTimeout(40 * 1000)
		// const obj = await Armoire.map(view, filterKeys, foundDB)
		const obj = await Settee.map(view, filterKeys, foundDB)
			.catch(e => {
				throw new Error('View mapping failure', { cause: e })
			})

		return {
			...state,
			type: 'json',
			obj
		}
	}
}
