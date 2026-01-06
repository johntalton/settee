import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as crypto from 'node:crypto'

/**
 * @typedef {string & { readonly _brand: 'id' }} DocId
 */

/**
 * @typedef {string & { readonly _brand: 'rev' }} RevisionId
 */

/**
 * @typedef {Object} SetteeOptionsResolved
 * @property {string} documentRoot
 * @property {AbortSignal} signal
 */

/**
 * @typedef {Partial<SetteeOptionsResolved>} SetteeOptions
 */



export const SETTEE_ENV_DOCUMENT_ROOT= 'SETTEE_ROOT'
export const SETTEE_ENV_TIMEOUT = 'SETTEE_TIMEOUT'

export const SETTEE_DEFAULT_TIMEOUT_MS = '100'
export const SETTEE_DEFAULT_FILE_EXTENSION = 'json'

export const SETTEE_DEFAULT_ROOT = './documents'

export const SETTEE_INTERNAL_PROPERTIES = {
	ID: 'settee:id',
	REVISION: 'settee:revision'
}

const ENV = {
	ROOT: process.env[SETTEE_ENV_DOCUMENT_ROOT] ?? SETTEE_DEFAULT_ROOT,
	TIMEOUT: parseInt(process.env[SETTEE_ENV_TIMEOUT] ?? SETTEE_DEFAULT_TIMEOUT_MS, 10)
}


/**
 * @param {SetteeOptions|undefined} [options]
 * @returns {SetteeOptionsResolved}
 */
export function fromOptions(options){
	return {
		documentRoot: options?.documentRoot ?? ENV.ROOT,
		signal: options?.signal ?? AbortSignal.timeout(ENV.TIMEOUT)
	}
}

/**
 * @param {string} documentRoot
 * @param {DocId} id
 */
export function pathFromId(documentRoot, id) {
	if(id.includes(path.sep)) { throw new Error('invalid id (sep)') }
	if(id.includes(path.delimiter)) { throw new Error('invalid id (delimiter)') }

	return path.normalize(path.format({
		dir: documentRoot,
		name: id,
		ext: SETTEE_DEFAULT_FILE_EXTENSION
	}))
}

export class Settee {
	/**
	 * @param {SetteeOptions|undefined} [options]
	 */
	static async* changes(options) {

	}

	/**
	 * @param {DocId} id
	 * @param {SetteeOptions|undefined} [options]
	 * @returns {Promise<boolean>}
	 */
	static async has(id, options) {
		const {
			documentRoot
		} = fromOptions(options)

		const filepath = pathFromId(documentRoot, id)

		return fs.access(filepath, fs.constants.F_OK)
			.then(() => true)
			.catch(() => false)
	}

	/**
	 * @param {DocId} id
	 * @param {RevisionId} revision
	 * @param {SetteeOptions|undefined} [options]
	 * @returns {Promise<boolean>}
	 */
	static async isModified(id, revision, options) {

	}

	/**
	 * @template T
	 * @param {DocId} id
	 * @param {SetteeOptions|undefined} [options]
	 * @returns {Promise<T>}
	 */
	static async get(id, options) {
		const {
			documentRoot,
			signal
		} = fromOptions(options)

		const filepath = pathFromId(documentRoot, id)

		const json = await fs.readFile(filepath, { encoding: 'utf8', flag: 'r', signal})
		return JSON.parse(json)
	}

	/**
	 * @template T
	 * @param {DocId} id
	 * @param {T} doc
	 * @param {SetteeOptions|undefined} [options]
	 * @returns {Promise<boolean>}
	 */
	static async set(id, doc, options) {
		const {
			documentRoot,
			signal
		} = fromOptions(options)

		const filepath = pathFromId(documentRoot, id)
		const json = JSON.stringify(doc)

		const encoder = new TextEncoder()
		const buffer = encoder.encode(json)

		const hash = await crypto.subtle.digest('SHA-1', buffer)
		const hash8 = new Uint8Array(hash)
		const hashHex = hash8.toBase64()

		const internalDoc = {
			[SETTEE_INTERNAL_PROPERTIES.ID]: id,
			[SETTEE_INTERNAL_PROPERTIES.REVISION]: hashHex,
			...doc
		}

		const internalJson = JSON.stringify(internalDoc)

		return fs.writeFile(filepath, internalJson, { mode: 0o600, flag: 'ax', encoding: 'utf8', flush: true, signal })
			.then(() => true)
	}

	/**
	 * @template T
	 * @param {DocId} id
	 * @param {RevisionId} rev
	 * @param {T} doc
	 * @param {SetteeOptions|undefined} [options]
	 * @returns {Promise<T>}
	 */
	static async update(id, rev, doc, options) {


	}
}
