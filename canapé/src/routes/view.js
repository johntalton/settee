import { MIME_TYPE_JSON } from "@johntalton/http-util"
import { Settee } from "@johntalton/settee"

/** @import { RouteMatches, RouteRequest, RouteAction } from '@johntalton/http-core' */
/** @import { CanapeConfig } from '../index.js' */

export class ViewRoute {
	/**
	 * @param {RouteMatches} matches
	 * @param {RouteRequest<CanapeConfig>} state
	 * @returns {Promise<RouteAction<CanapeConfig>>}
	 */
	static async get(matches, state) {
		const { config } = state
		const { db, view } = matches

		if(db === undefined) { return { ...state, type: '404', message: 'database undefined' }}
		const foundDB = config.dbs.find(value => value.name === db)
		if(foundDB === undefined) { return { ...state, type: '404', message: 'database not found' } }

		if (view === undefined) { return { ...state, type: '404', message: 'view undefined' } }

		//
		const negotiatedType = state.accept.select.type([ MIME_TYPE_JSON ])
		if(negotiatedType?.mimetype !== MIME_TYPE_JSON) {
			return { ...state, type: 'not-acceptable', acceptableTypes: [ MIME_TYPE_JSON ] }
		}

		const negotiatedEncoding = state.accept.select.encoding()

		//
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
			obj,
			encoding: negotiatedEncoding?.name
		}
	}
}
