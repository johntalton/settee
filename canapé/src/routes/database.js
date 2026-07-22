import { MIME_TYPE_JSON, MIME_TYPE_URL_FORM_DATA } from '@johntalton/http-util'
import { Settee } from '@johntalton/settee'

/** @import { RouteMatches, RouteRequest, RouteAction } from '@johntalton/http-core' */
/** @import { CanapeConfig } from '../index.js' */

export class DatabaseRoute {
	/**
	 * @param {RouteMatches} matches
	 * @param {RouteRequest<CanapeConfig>} state
	 * @returns {Promise<RouteAction<CanapeConfig>>}
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
			return { ...state, type: 'unsupported-media', supportedTypes: [ MIME_TYPE_JSON ] }
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

	/**
	 * @param {RouteMatches} matches
	 * @param {RouteRequest<CanapeConfig>} state
	 * @returns {Promise<RouteAction<CanapeConfig>>}
	 */
	static async query(matches, state) {
		const { config } = state
		const { db } = matches

		if(db === undefined) { return { ...state, type: '404', message: 'database undefined' } }
		const foundDB = config.dbs.find(value => value.name === db)
		if(foundDB === undefined) { return { ...state, type: '404', message: 'database not found' }}

		//
		const negotiatedType = state.accept.select.type([ MIME_TYPE_JSON ])
		if(negotiatedType?.mimetype !== MIME_TYPE_JSON) {
			return { ...state, type: 'not-acceptable', acceptableTypes: [ MIME_TYPE_JSON ] }
		}

		//
		const negotiatedEncoding = state.accept.select.encoding()

		//
		if(state.body.contentType?.mimetype !== MIME_TYPE_URL_FORM_DATA) {
			return { ...state, type: 'unsupported-media', supportedTypes: [ MIME_TYPE_URL_FORM_DATA ], supportedQueryTypes: [ MIME_TYPE_URL_FORM_DATA ] }
		}

		const query = state.url.searchParams.get('q')
		if(query === null) {
			return { ...state, type: 'error', cause: 'missing query parameter' }
		}

		//
		if(query === '') {
			return { ...state, type: 'error', cause: 'empty query parameter' }
		}

		//
		const results = await Array.fromAsync(Settee.query(query, foundDB))

		return {
			...state,
			type: 'json',
			obj: { results },
			encoding: negotiatedEncoding?.name
		}
	}
}
