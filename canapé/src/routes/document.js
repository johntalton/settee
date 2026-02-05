import { Conditional, ETag } from '@johntalton/http-util'
import { SETTEE_INTERNAL_PROPERTIES, Settee, isValidDocId } from '@johntalton/settee'

/** @import { DocId, Document, SetteeOptions } from '@johntalton/settee' */
/** @import { RouteMatches, RouteRequest, RouteAction } from '../index.js' */

export class DocumentRoute {
	/**
	 * @param {RouteMatches} matches
	 * @param {RouteRequest} state
	 * @returns {Promise<RouteAction>}
	 */
	static async head(matches, state) {
		return DocumentRoute.get(matches, state)
	}

	/**
	 * @param {RouteMatches} matches
	 * @param {RouteRequest} state
	 * @returns {Promise<RouteAction>}
	 */
	static async get(matches, state) {
		const { config } = state
		const { db, id } = matches

		if(db === undefined) { return { ...state, type: '404', message: 'database undefined' }}
		const foundDB = config.dbs.find(value => value.name === db)
		if(foundDB === undefined) { return { ...state, type: '404', message: 'database not found' } }

		if (!isValidDocId(id)) { return { ...state, type: '404', message: 'invalid document id' } }

		try {
			/** @type {Document<Object>} */
			const obj = await Settee.get(id, foundDB)

			const etag = obj[SETTEE_INTERNAL_PROPERTIES.REVISION]


			const testMatch = state.conditions.match.length !== 0
			const testNonMatch = state.conditions.noneMatch.length !== 0

			if(testMatch && Conditional.hasAny(state.conditions.match)) {
				// match any
			}
			else if(testMatch && !Conditional.hasEtag(state.conditions.match, etag)) {
				// not found in etag list
				return {
					...state,
					type: 'precondition-failed',
					etag: ETag.strong(etag)
				}
			}

			if(testNonMatch && Conditional.hasAny(state.conditions.noneMatch)) {
				// match any
				// todo: what nonsense is this
				// return not-modified
			}
			else if(testNonMatch && Conditional.hasEtag(state.conditions.noneMatch, etag)) {
				// found match in etag list
				return {
					...state,
					type: 'not-modified',
					etag: ETag.strong(etag)
				}
			}

			return {
				...state,
				type: 'json',
				obj,
				lastModified: undefined,
				etag: ETag.strong(etag),
			}
		}
		catch(error) {
			if(!Error.isError(error)) { throw error }
			console.log('document get error', error.message, state.url)
			if(!Error.isError(error)) { throw error }
			if(error.code === 'ENOENT') { return { ...state, type: '404', message: 'document does not exist' }}
			throw error
		}
	}

	/**
	 * @template T
	 * @param {RouteRequest} state
	 * @param {DocId} id
	 * @param {T} doc
	 * @param {SetteeOptions} options
	 * @returns {Promise<RouteAction>}
	 */
	static async #create(state, id, doc, options) {
		console.log('no revision, this is a create')

		try {
			const obj = await Settee.set(id, doc, options)

			// TODO 201 Created
			return {
				...state,
				type: 'json',
				etag: ETag.strong(obj[SETTEE_INTERNAL_PROPERTIES.REVISION]),
				obj
			}
		}
		catch(e) {
			if(!Error.isError(e)) { throw e }
			throw new Error('Failed to create document', { cause: e })
		}
	}

	/**
	 * @template T
	 * @param {RouteRequest} state
	 * @param {DocId} id
	 * @param {Document<T>} doc
	 * @param {SetteeOptions} options
	 * @returns {Promise<RouteAction>}
	 */
	static async #update(state, id, doc, options) {
		console.log('revision, try update')

		const has = await Settee.has(id, options)
		if(!has) {
			return { ...state, type: '404', message: 'document not found' }
		}

		const obj = await Settee.update(doc, options)

		return {
			...state,
			type: 'json',
			etag: ETag.strong(obj[SETTEE_INTERNAL_PROPERTIES.REVISION]),
			obj
		}
	}

	/**
	 * @param {RouteMatches} matches
	 * @param {RouteRequest} state
	 * @returns {Promise<RouteAction>}
	 */
	static async post(matches, state) {
		const { config } = state
		const { db, id } = matches

		if (!isValidDocId(id)) { return { ...state, type: 'unprocessable', message: 'invalid document id' } }
		if(db === undefined) { return { ...state, type: '404', message: 'database undefined' }}
		const foundDB = config.dbs.find(value => value.name === db)
		if(foundDB === undefined) { return { ...state, type: '404', message: 'database not found' } }

		/** @type {Record<string, string>|Document<any>} */
		const doc = await state.body.json()
		const revision = doc[SETTEE_INTERNAL_PROPERTIES.REVISION]

		if(revision === undefined) {
			if(doc[SETTEE_INTERNAL_PROPERTIES.ID] !== undefined) {
				return { ...state, type: 'unprocessable', message: 'create with unspecified id' }
			}
			return DocumentRoute.#create(state, id, doc, foundDB)
		}
		else {
			if(id !== doc[SETTEE_INTERNAL_PROPERTIES.ID]) {
				throw new Error('update id does not match doc id')
			}

			return DocumentRoute.#update(state, id, doc, foundDB)
		}
	}
}