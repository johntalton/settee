import { Conditional, ETag, MIME_TYPE_JSON } from '@johntalton/http-util'
import { isValidDocId, SETTEE_INTERNAL_PROPERTIES, Settee } from '@johntalton/settee'
import { matchSecFetchPolicy } from '../utils/sec-fetch-policy.js'

/** @import { DocId, UserDocument, Document, SetteeOptions } from '@johntalton/settee' */
/** @import { RouteMatches, RouteRequest, RouteAction } from '@johntalton/http-core' */
/** @import { CanapeConfig } from '../index.js' */
/** @import { AppliedPreferencesInput } from '@johntalton/http-util/headers' */

export const DEFAULT_API_TIMEOUT = Temporal.Duration.from({ seconds: 5 })

export class DocumentRoute {
	/**
	 * @param {RouteMatches} matches
	 * @param {RouteRequest<CanapeConfig>} state
	 * @returns {Promise<RouteAction<CanapeConfig>>}
	 */
	static async head(matches, state) {
		return DocumentRoute.get(matches, state)
	}

	/**
	 * @param {RouteMatches} matches
	 * @param {RouteRequest<CanapeConfig>} state
	 * @returns {Promise<RouteAction<CanapeConfig>>}
	 */
	static async get(matches, state) {
		const { config } = state
		const { db, id } = matches

		/** @type {AppliedPreferencesInput} */
		const appliedPreferences = {}

		//
		const wait = Temporal.Duration.from({
			seconds: state.preferences.wait ?? DEFAULT_API_TIMEOUT.total('seconds')
		})
		appliedPreferences.wait = state.preferences.wait === undefined ? undefined : wait.total('seconds')
		const waitSignal = AbortSignal.timeout(wait.total('milliseconds'))

		//
		const signal = AbortSignal.any([
			state.shutdownSignal,
			waitSignal
		])


		//
		if(!matchSecFetchPolicy(state.secFetchMetadata, {
			method: state.method,
			allowSubdomains: true
		})) {
			//
			console.log('REJECT - Resource Isolation Policy', state.secFetchMetadata)
			return {
				...state,
				type: 'forbidden',
				context: { appliedPreferences }
			}
		}

		//
		if(db === undefined) { return { ...state, type: '404', message: 'database undefined', context: { appliedPreferences } }}
		const foundDB = config.dbs.find(value => value.name === db)
		if(foundDB === undefined) { return { ...state, type: '404', message: 'database not found', context: { appliedPreferences } } }

		if (!isValidDocId(id)) { return { ...state, type: '404', message: 'invalid document id', context: { appliedPreferences } } }

		//
		const negotiatedType = state.accept.select.type([ MIME_TYPE_JSON ])
		if(negotiatedType?.mimetype !== MIME_TYPE_JSON) {
			return {
				...state,
				type: 'not-acceptable',
				acceptableTypes: [ MIME_TYPE_JSON ],
				context: { appliedPreferences }
			}
		}

		const negotiatedEncoding = state.accept.select.encoding()

		try {
			/** @type {Document<Object>} */
			const obj = await Settee.get(id, { ...foundDB, signal })

			const revision = obj[SETTEE_INTERNAL_PROPERTIES.REVISION]
			if(revision === undefined) {
				throw new Error('document missing revision tag')
			}

			const etag = ETag.strong(revision)

			const testMatch = state.conditions.match.length > 0
			const testNonMatch = state.conditions.noneMatch.length > 0

			if(testMatch && Conditional.hasAny(state.conditions.match)) {
				// match any
			}
			else if(testMatch && !Conditional.hasEtagItem(state.conditions.match, etag, true)) {
				// not found in etag list
				return {
					...state,
					type: 'precondition-failed',
					etag,
					context: { appliedPreferences }
				}
			}

			if(testNonMatch && Conditional.hasAny(state.conditions.noneMatch)) {
				// match any
				// todo: what nonsense is this
				// return not-modified
			}
			else if(testNonMatch && Conditional.hasEtagItem(state.conditions.noneMatch, etag, true)) {
				// found match in etag list
				return {
					...state,
					type: 'not-modified',
					etag,
					context: { appliedPreferences }
				}
			}

			return {
				...state,
				type: 'json',
				obj,
				encoding: negotiatedEncoding?.name,
				// lastModified: undefined,
				etag,
				context: { appliedPreferences }
			}
		}
		catch(error) {
			if(!Error.isError(error)) { throw error }
			console.log('document get error', error.message, state.url.href)
			if('code' in error && error.code === 'ENOENT') { return { ...state, type: '404', message: 'document does not exist', context: { appliedPreferences } }}
			throw error
		}
	}

	/**
	 * @template {UserDocument} T
	 * @param {RouteRequest<CanapeConfig>} state
	 * @param {DocId} id
	 * @param {T} doc
	 * @param {SetteeOptions} options
	 * @returns {Promise<RouteAction<CanapeConfig>>}
	 */
	static async #create(state, id, doc, options) {
		console.log('no revision, this is a create')

		//
		const negotiatedEncoding = state.accept.select.encoding()

		//
		try {
			const obj = await Settee.set(id, doc, options)
			const etag = obj[SETTEE_INTERNAL_PROPERTIES.REVISION]
			if(etag === undefined) { throw new Error('document missing revision tag') }

			// TODO 201 Created
			return {
				...state,
				type: 'json',
				etag: ETag.strong(etag),
				obj,
				encoding: negotiatedEncoding?.name
			}
		}
		catch(e) {
			if(!Error.isError(e)) { throw e }
			throw new Error('Failed to create document', { cause: e })
		}
	}

	/**
	 * @template {UserDocument} T
	 * @param {RouteRequest<CanapeConfig>} state
	 * @param {DocId} id
	 * @param {Document<T>} doc
	 * @param {SetteeOptions} options
	 * @returns {Promise<RouteAction<CanapeConfig>>}
	 */
	static async #update(state, id, doc, options) {
		console.log('revision, try update')

		//
		const negotiatedEncoding = state.accept.select.encoding()

		//
		const has = await Settee.has(id, options)
		if(!has) {
			return { ...state, type: '404', message: 'document not found' }
		}

		const obj = await Settee.update(doc, options)
		const etag = obj[SETTEE_INTERNAL_PROPERTIES.REVISION]
		if(etag === undefined) { throw new Error('document missing revision tag') }

		return {
			...state,
			type: 'json',
			etag: ETag.strong(etag),
			obj,
			encoding: negotiatedEncoding?.name
		}
	}

	/**
	 * @param {RouteMatches} matches
	 * @param {RouteRequest<CanapeConfig>} state
	 * @returns {Promise<RouteAction<CanapeConfig>>}
	 */
	static async post(matches, state) {
		const { config } = state
		const { db, id } = matches

		if (!isValidDocId(id)) { return { ...state, type: 'unprocessable' } }
		if(db === undefined) { return { ...state, type: '404', message: 'database undefined' }}
		const foundDB = config.dbs.find(value => value.name === db)
		if(foundDB === undefined) { return { ...state, type: '404', message: 'database not found' } }

		if(state.body.contentType?.mimetype !== MIME_TYPE_JSON) {
			return { ...state, type: 'unsupported-media', supportedTypes: [ MIME_TYPE_JSON ] }
		}

		/** @type {Record<string, string>|Document<any>} */
		const doc = await state.body.json()
		const revision = doc[SETTEE_INTERNAL_PROPERTIES.REVISION]

		//
		const negotiatedType = state.accept.select.type([ MIME_TYPE_JSON ])
		if(negotiatedType?.mimetype !== MIME_TYPE_JSON) {
			return { ...state, type: 'not-acceptable', acceptableTypes: [ MIME_TYPE_JSON ] }
		}

		//
		if(revision === undefined) {
			if(doc[SETTEE_INTERNAL_PROPERTIES.ID] !== undefined) {
				return { ...state, type: 'unprocessable' }
			}
			return DocumentRoute.#create(state, id, doc, foundDB)
		}

		//
		if(id !== doc[SETTEE_INTERNAL_PROPERTIES.ID]) {
			throw new Error('update id does not match doc id')
		}

		return DocumentRoute.#update(state, id, doc, foundDB)
	}
}