import { MIME_TYPE_JSON } from '@johntalton/http-util'
import { Settee } from '@johntalton/settee'

/** @import { RouteMatches, RouteRequest, RouteAction } from '../index.js' */

export class DatabaseRoute {
	/**
	 * @param {RouteMatches} matches
	 * @param {RouteRequest} state
	 * @returns {Promise<RouteAction>}
	 */
	static async create(matches, state) {
		const { config } = state
		const { db } = matches

		// 201 created
		// 202 accepted
		// 204 no content
		// 409 conflict
		// 422 unprocessable

		if(db === undefined) { return { ...state, type: '404', message: 'database undefined' } }
		const foundDB = config.dbs.find(value => value.name === db)
		if(foundDB !== undefined) { return { ...state, type: 'conflict', message: 'existing db found' }}

		if(state.body.contentType?.mimetype !== MIME_TYPE_JSON) {
			return { ...state, type: 'unsupported-media', acceptableMediaTypes: [ MIME_TYPE_JSON ] }
		}

		const body = await state.body.json()
		state.meta.performance.push({
			name: 'body', duration: state.body.duration
		})

		const digestAlgo = body.digestAlgo ?? body.digestAlgorithm
		try {
			const options = await Settee.createDatabase(db, { db, digestAlgo })

			console.log('live-patch of config - unsaved', options)
			state.config.dbs.push({
				...options,
				name: db
			})

			return {
				...state,
				type: 'created',
				location: `#database/${db}`
			}
		}
		catch(e) {
			if(!Error.isError(e)) { throw e }
			return { ...state, type: 'error', cause: e.message, error: e }
		}
	}
}
