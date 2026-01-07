import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as crypto from 'node:crypto'

/** @typedef {string & { readonly _brand: 'id' }} DocId */
/** @typedef {string & { readonly _brand: 'rev' }} RevisionId */

/**
 * @typedef {Object} SetteeOptionsResolved
 * @property {string} db
 * @property {string} documentsDir
 * @property {string} documentsRoot
 * @property {string} viewsDir
 * @property {string} viewsRoot
 * @property {number} timeoutMs
 * @property {AbortSignal} signal
 *
 * @property {AbortSignal|undefined} [internal_signal] Overrides signal usage and creation
 */

/** @typedef {Partial<SetteeOptionsResolved>} SetteeOptions */
/** @typedef {{ [SETTEE_INTERNAL_PROPERTIES.ID]: string,  [SETTEE_INTERNAL_PROPERTIES.REVISION]: string }} DocumentBase */
/**
 * @template T
 * @typedef {DocumentBase & T } Document
 */


export const SETTEE_ENV = {
	DB_ROOT: 'SETTEE_DB',
	DOCUMENTS_DIRECTORY: 'SETTEE_DOCS_DIR',
	VIEWS_DIRECTORY: 'SETTEE_VIEWS_DIR',

	TIMEOUT_MS: 'SETTEE_TIMEOUT'
}


export const SETTEE_DEFAULT = {
	ROOT: './db',
	DOCS: './docs',
	VIEWS: './views',

	FILE_EXTENSION: 'json',
	DIGEST_ALGO: 'SHA-1',
	TIMEOUT_MS: '100'
}

export const SETTEE_INTERNAL_PROPERTIES = {
	ID: 'settee:id',
	REVISION: 'settee:revision'
}

const ENV_ROOT = process.env[SETTEE_ENV.DB_ROOT] ?? SETTEE_DEFAULT.ROOT
const ENV_DOCS_DIR = process.env[SETTEE_ENV.DOCUMENTS_DIRECTORY] ?? SETTEE_DEFAULT.DOCS
const ENV_VIEWS_DIR = process.env[SETTEE_ENV.VIEWS_DIRECTORY] ?? SETTEE_DEFAULT.VIEWS
const ENV_TIMEOUT_MS = parseInt(process.env[SETTEE_ENV.TIMEOUT_MS] ?? SETTEE_DEFAULT.TIMEOUT_MS, 10)

/**
 * @param {SetteeOptions|undefined} [options]
 * @returns {SetteeOptionsResolved}
 */
export function fromOptions(options) {
	const db = options?.db ?? ENV_ROOT
	const documentsDir = options?.documentsDir ?? ENV_DOCS_DIR
	const documentsRoot = options?.documentsRoot ?? path.join(db, documentsDir)
	const viewsDir = options?.viewsDir ?? ENV_VIEWS_DIR
	const viewsRoot = options?.viewsRoot ?? path.join(db, viewsDir)
	const timeoutMs = options?.timeoutMs ?? ENV_TIMEOUT_MS

	if(Number.isFinite(timeoutMs)) {}
	if(timeoutMs <= 0) {}

	// if we have an internal signal, use that, otherwise
	//  combined optional signal with timeout or just timeout
	const signal = options?.internal_signal ?? ((options?.signal === undefined) ?
		AbortSignal.timeout(timeoutMs) :
		AbortSignal.any([ options.signal, AbortSignal.timeout(timeoutMs) ]))

	return {
		db,
		documentsDir,
		viewsDir,
		documentsRoot,
		viewsRoot,
		timeoutMs,
		signal,
		internal_signal: options?.internal_signal
	}
}

/**
 * @param {string} id
 * @returns {id is DocId}
 */
export function isValidDocId(id) {
	if(id === undefined) { return false }
	if(id === '') { return false }
	return true
}

/**
 * @param {string} id
 * @returns {id is RevisionId}
 */
export function isValidRevisionId(id) {
	if(id === undefined) { return false }
	if(id === '') { return false }
	return true
}

/**
 * @param {string} documentsRoot
 * @param {DocId} id
 */
export function pathFromId(documentsRoot, id) {
	if(id.includes(path.sep)) { throw new Error('invalid id (sep)') }
	if(id.includes(path.delimiter)) { throw new Error('invalid id (delimiter)') }

	return path.normalize(path.format({
		dir: documentsRoot,
		name: id,
		ext: SETTEE_DEFAULT.FILE_EXTENSION
	}))
}

/**
 * @template T
 * @param {Document<T>|T} doc
 * @returns {Promise<RevisionId>}
 */
export async function revisionFrom(doc) {
	const json = JSON.stringify({
		...doc,
		[SETTEE_INTERNAL_PROPERTIES.ID]: undefined,
		[SETTEE_INTERNAL_PROPERTIES.REVISION]: undefined,
	})
	const encoder = new TextEncoder()
	const buffer = encoder.encode(json)

	const hash = await crypto.subtle.digest(SETTEE_DEFAULT.DIGEST_ALGO, buffer)
	const hash8 = new Uint8Array(hash)

	/** @ts-ignore */
	return hash8.toBase64()
}

/**
 * @template T
 * @param {DocId} id
 * @param {Document<T>|T} doc
 * @returns {Promise<Document<T>>}
 */
export async function internalDocFrom(id, doc) {
	const revision = await revisionFrom(doc)
	const internalDoc = {
		...doc,
		[SETTEE_INTERNAL_PROPERTIES.ID]: id,
		[SETTEE_INTERNAL_PROPERTIES.REVISION]: revision,
	}

	return internalDoc
}

/**
 * @template T
 * @param {Document<T>} doc
 * @returns {Promise<boolean>}
 */
export async function internalDocHasIntegrity(doc) {
	const revision = doc[SETTEE_INTERNAL_PROPERTIES.REVISION]
	const computedRevision = await revisionFrom(doc)
	return computedRevision === revision
}

export class Settee {
	/**
	 * @param {SetteeOptions|undefined} [options]
	 */
	static async* changes(options) {
		const {
			documentsRoot,
			signal
		} = fromOptions(options)

		try {
			const watcher = fs.watch(documentsRoot, { signal })

			for await (const { eventType, filename } of watcher) {
				//
				console.log('watch:', eventType, filename)
			}
		}
		catch(e) {
			// if(e.name === 'AbortError') { return }
			throw e
		}
	}

	/**
	 * @param {DocId} id
	 * @param {SetteeOptions|undefined} [options]
	 * @returns {Promise<boolean>}
	 */
	static async has(id, options) {
		const {
			documentsRoot
		} = fromOptions(options)

		const filepath = pathFromId(documentsRoot, id)

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
		const internalDoc = await Settee.get(id, options)
		if(!internalDocHasIntegrity(internalDoc)) { return true }
		return internalDoc[SETTEE_INTERNAL_PROPERTIES.REVISION] !== revision
	}

	/**
	 * @template T
	 * @param {DocId} id
	 * @param {SetteeOptions|undefined} [options]
	 * @returns {Promise<Document<T>>}
	 */
	static async get(id, options) {
		const {
			documentsRoot,
			signal
		} = fromOptions(options)

		const filepath = pathFromId(documentsRoot, id)

		const json = await fs.readFile(filepath, { encoding: 'utf8', flag: 'r', signal })
		return JSON.parse(json)
	}

	/**
	 * @template T
	 * @param {DocId} id
	 * @param {T} doc
	 * @param {SetteeOptions|undefined} [options]
	 * @returns {Promise<Document<T>>}
	 */
	static async set(id, doc, options) {
		const {
			documentsRoot,
			signal
		} = fromOptions(options)

		const filepath = pathFromId(documentsRoot, id)
		const internalDoc = await internalDocFrom(id, doc)
		const internalJson = JSON.stringify(internalDoc)

		return fs.writeFile(filepath, internalJson, { mode: 0o600, flag: 'ax', encoding: 'utf8', flush: true, signal })
			.then(() => internalDoc)
	}

	/**
	 * @template T
	 * @param {Document<T>} doc
	 * @param {SetteeOptions|undefined} [options]
	 * @returns {Promise<Document<T>>}
	 */
	static async update(doc, options) {
		const id =  doc[SETTEE_INTERNAL_PROPERTIES.ID]
		const revision = doc[SETTEE_INTERNAL_PROPERTIES.REVISION]

		if(!isValidDocId(id)) { throw new Error('invalid doc id') }
		if(!isValidRevisionId(revision)) { throw new Error('invalid revision id') }

		const {
			documentsRoot,
			signal
		} = fromOptions(options)

		const modified = await Settee.isModified(id, revision, { ...options, internal_signal: signal })
		if(modified) { throw new Error('revision miss-match') }

		const filepath = pathFromId(documentsRoot, id)
		const internalDoc = await internalDocFrom(id, doc)
		const internalJson = JSON.stringify(internalDoc)

		return fs.writeFile(filepath, internalJson, { mode: 0o600, flag: 'w', encoding: 'utf8', flush: true, signal })
			.then(() => internalDoc)
	}

	/**
	 * @param {DocId} id
	 * @param {RevisionId} revision
	 * @param {SetteeOptions|undefined} [options]
	 */
	static async delete(id, revision, options) {
		const {
			documentsRoot,
			signal
		} = fromOptions(options)

		const modified = await Settee.isModified(id, revision, { ...options, internal_signal: signal })
		if(modified) { throw new Error('revision miss-match') }

		const filepath = pathFromId(documentsRoot, id)

		return fs.rm(filepath, { maxRetries: 0 })
	}

	/**
	 * @template T
	 * @param {(doc: Document<T>) => Array<[ any, any ]>|undefined} fn
	 * @param {string|Array<string>|undefined} [filterKey]
	 * @param {SetteeOptions|undefined} [options]
	 */
	static async map(fn, filterKey, options) {
		function formatResults(result, total_count) {
			const output = result
				.entries()
				.filter(entry => entry[1] !== undefined)
				.map(entry => entry[1].map(item => ({ [SETTEE_INTERNAL_PROPERTIES.ID]: entry[0], key: item[0], value: item[1] })))
				.reduce((accumulator, value) => {
					value.forEach(element => {
						accumulator.push(element)
					})

					return accumulator
				}, [])

		return { total_count, rows: output }
		}

		async function processDirent(entry, result) {
			// console.log('mapping over', entry.name)
			const filepath = path.join(documentsRoot, entry.name)
			const json = await fs.readFile(filepath, { encoding: 'utf8', flag: 'r', signal })
			const internalDoc = JSON.parse(json)

			const id = internalDoc[SETTEE_INTERNAL_PROPERTIES.ID]

			const keySet = await Promise.try(fn, internalDoc)
			if(filterKeyList.length === 0) {
				result.set(id, keySet)
			}
			else {
				const filteredKeySet = keySet?.filter(item => filterKeyList.includes(item[0]))
				result.set(id, filteredKeySet)
			}
		}


		const {
			documentsRoot,
			signal
		} = fromOptions(options)

		const filterKeyList = filterKey === undefined ? [] : Array.isArray(filterKey) ? filterKey : [ filterKey ]

		const result = new Map()
		let total_count = 0

		const useIterator = true
		const listing = await (useIterator ?
			fs.opendir(documentsRoot, { bufferSize: 32, encoding: 'utf8' }) :
			fs.readdir(documentsRoot, { withFileTypes: true, encoding: 'utf8' }))

		for await (const entry of listing) {
			signal.throwIfAborted()
			if(!entry.isFile()) { continue }
			if(entry.name.startsWith('.')) { continue }
			await processDirent(entry, result)
				.catch(e => {
					console.warn('process Dirent error', entry.name, e.message)
				})
			total_count += 1
		}

		// signal.throwIfAborted()
		return formatResults(result, total_count)
	}
}
