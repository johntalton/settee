import { Settee, isValidDocId } from '@johntalton/settee'

/** @import { RouteResult } from '../route.js' */

export class DocumentRoute {
	static async head(db, id) { }

	/**
	 * @param {Record<string, string>} matches
	 * @returns {Promise<RouteResult>}
	 */
	static async get(matches, state) {
		const { db, id } = matches

		if (db === undefined) { return { type: '404' } }
		if (!isValidDocId(id)) { return { type: '404' } }

		const obj = await Settee.get(id)

		return {
			...state,
			type: 'json',
			obj
		}
	}

	/**
	 * @returns {Promise<RouteResult>}
	 */
	static async post(matches, state) {
		const { db } = matches
		if (db === undefined) { return { type: '404' } }

		const doc = await state.body.json()

		// if(!('_id' in doc)) { return { type: '422' } }

		const id = doc._id
		if (!isValidDocId(id)) { return { type: '422' } }

		const obj = await Settee.set(id, doc)

		return {
			type: 'json',
			obj
		}
	}
}