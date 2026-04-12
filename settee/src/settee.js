/** biome-ignore-all lint/nursery/noExcessiveLinesPerFile: legacy */
/** biome-ignore-all lint/style/noNestedTernary: <explanation> */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { Chifforobe } from './chifforobe.js'

/** @import { Dirent } from 'node:fs' */

/** @typedef {string & { readonly _brand: 'id' }} DocId */
/** @typedef {string & { readonly _brand: 'rev' }} RevisionId */

/** @typedef {'SHA-1'|'SHA-256'|'SHA-384'|'SHA-512'} KnownDigestAlgorithm */

/** @typedef {crypto.webcrypto.Algorithm|KnownDigestAlgorithm|string} DigestAlgorithm */

/**
 * @typedef {Object} SetteeOptionsResolved
 * @property {string} documentsRoot
 * @property {string} viewsRoot
 * @property {AbortSignal} signal
 * @property {DigestAlgorithm} digestAlgo
*/

/**
 * @typedef {Object} SetteeConstructionOptions
 * @property {string} db
 * @property {string} documentsDir
 * @property {string} viewsDir
 * @property {number} timeoutMs
 * @property {AbortSignal|undefined} [internal_signal] Overrides signal usage and creation
 */

/** @typedef {Partial<SetteeOptionsResolved> & Partial<SetteeConstructionOptions>} SetteeOptions */


/** @typedef {{ [SETTEE_INTERNAL_PROPERTIES.ID]: DocId,  [SETTEE_INTERNAL_PROPERTIES.REVISION]: RevisionId }} DocumentBase */
/**
 * @template T
 * @typedef {DocumentBase & T } Document
 */

/**
 * @template K, V
 * @typedef {Array<[ K, V ]>|Iterable<[ K, V ]>} ViewFunctionResult
*/

/**
 * @template K, V
 * @typedef {Object} ViewFunctionRowResultItem
 * @property {DocId} id
 * @property {K} key
 * @property {V} value
 */

/**
 * @template K, V
 * @typedef {Object} ViewFunctionRowResult
 * @property {number} total_count
 * @property {Array<ViewFunctionRowResultItem<K, V>>} rows
 */

/**
 * @template D, K, V
 * @typedef {(doc: Document<D>) => ViewFunctionResult<K, V>|undefined} ViewFunction
 */

export const SETTEE_ENV = {
	DB_ROOT: 'SETTEE_DB',
	DOCUMENTS_DIRECTORY: 'SETTEE_DOCS_DIR',
	VIEWS_DIRECTORY: 'SETTEE_VIEWS_DIR',
	TIMEOUT_MS: 'SETTEE_TIMEOUT_MS',
	DIGEST_ALGO: 'SETTEE_DIGEST_ALGORITHM',
	NEW_DATABASE_ROOT: 'SETTEE_NEW_DB'
}

export const SETTEE_DEFAULT = {
	RESOLVE_PREFIX: '.',
	DB: 'db',
	DOCS: 'docs',
	VIEWS: 'views',

	DIGEST_ALGO: 'SHA-1',
	TIMEOUT_MS: '100',

	/** @type {BufferEncoding} */
	FILE_ENCODING: 'utf-8',

	FILE_EXTENSION: 'json',
	VIEW_EXTENSION: 'js',

	IGNORE_PREFIX: '.'
}

export const FILE_FLAGS = {
	DOC_GET: 'r',
	DOC_SET: 'ax',
	DOC_UPDATE: 'w',
	MAP_PROCESS: 'r'
}
export const FILE_MODE = 0o600

export const SETTEE_INTERNAL_PROPERTIES = {
	ID: 'settee:id',
	REVISION: 'settee:revision'
}

export const EMPTY_STRING = ''

const ENV_DB_DIR = process.env[SETTEE_ENV.DB_ROOT] ?? SETTEE_DEFAULT.DB
const ENV_DOCS_DIR = process.env[SETTEE_ENV.DOCUMENTS_DIRECTORY] ?? SETTEE_DEFAULT.DOCS
const ENV_VIEWS_DIR = process.env[SETTEE_ENV.VIEWS_DIRECTORY] ?? SETTEE_DEFAULT.VIEWS
const ENV_TIMEOUT_MS = Number.parseInt(process.env[SETTEE_ENV.TIMEOUT_MS] ?? SETTEE_DEFAULT.TIMEOUT_MS, 10)
const ENV_DIGEST_ALGO = process.env[SETTEE_ENV.DIGEST_ALGO] ?? SETTEE_DEFAULT.DIGEST_ALGO
const ENV_NEW_DB_DIR = process.env[SETTEE_ENV.NEW_DATABASE_ROOT]

/**
 * @param {SetteeOptions|undefined} [options]
 * @param {string} [resolverPrefix=SETTEE_DEFAULT.RESOLVE_PREFIX]
 * @returns {SetteeConstructionOptions & Omit<SetteeOptionsResolved, 'signal'>}
 */
export function fromOptionsResolved(options, resolverPrefix = SETTEE_DEFAULT.RESOLVE_PREFIX) {
	const db = options?.db ?? ENV_DB_DIR
	const documentsDir = options?.documentsDir ?? ENV_DOCS_DIR
	const viewsDir = options?.viewsDir ?? ENV_VIEWS_DIR
	const timeoutMs = options?.timeoutMs ?? ENV_TIMEOUT_MS
	const digestAlgo = options?.digestAlgo ?? ENV_DIGEST_ALGO

	const documentsRoot = path.resolve(resolverPrefix, options?.documentsRoot ?? path.join(db, documentsDir))
	const viewsRoot = path.resolve(resolverPrefix, options?.viewsRoot ?? path.join(db, viewsDir))

	if(Number.isFinite(timeoutMs)) {}
	if(timeoutMs <= 0) {}

	return {
		db,
		documentsDir,
		viewsDir,
		timeoutMs,
		digestAlgo,
		documentsRoot,
		viewsRoot
	}
}

/**
 * @param {SetteeOptions|undefined} [options]
 * @param {string|undefined} [resolverPrefix]
 * @returns {SetteeOptionsResolved}
 */
export function fromOptions(options, resolverPrefix) {
	const {
		documentsRoot,
		viewsRoot,
		digestAlgo,
		timeoutMs
	} = fromOptionsResolved(options, resolverPrefix)

	// if we have an internal signal, use that, otherwise
	//  combined optional signal with timeout or just timeout
	const signal = options?.internal_signal ?? ((options?.signal === undefined) ?
		AbortSignal.timeout(timeoutMs) :
		AbortSignal.any([ options.signal, AbortSignal.timeout(timeoutMs) ]))

	return {
		documentsRoot,
		viewsRoot,
		digestAlgo,
		signal
	}
}

/**
 * @param {string|undefined} id
 * @returns {id is DocId}
 */
export function isValidDocId(id) {
	if(id === undefined) { return false }
	if(id === EMPTY_STRING) { return false }
	return true
}

/**
 * @param {string|undefined} id
 * @returns {id is RevisionId}
 */
export function isValidRevisionId(id) {
	if(id === undefined) { return false }
	if(id === EMPTY_STRING) { return false }
	return true
}

/**
 * @param {string} documentsRoot
 * @param {DocId} id
 */
export function pathFromId(documentsRoot, id) {
	if(id.includes(path.sep)) { throw new Error('invalid id (sep)') }
	// if(id.includes(path.delimiter)) { throw new Error('invalid id (delimiter)') }

	return path.normalize(path.format({
		dir: documentsRoot,
		name: id,
		ext: SETTEE_DEFAULT.FILE_EXTENSION
	}))
}

/**
 * @template T
 * @param {Document<T>|T} doc
 * @param {DigestAlgorithm} digestAlgo
 * @returns {Promise<RevisionId>}
 */
export async function revisionFrom(doc, digestAlgo) {
	const json = JSON.stringify({
		...doc,
		[SETTEE_INTERNAL_PROPERTIES.ID]: undefined,
		[SETTEE_INTERNAL_PROPERTIES.REVISION]: undefined,
	})
	const encoder = new TextEncoder()
	const buffer = encoder.encode(json)

	const hash = await crypto.subtle.digest(digestAlgo, buffer)
	const hash8 = new Uint8Array(hash)
	const hash64 = hash8.toBase64()

	if(!isValidRevisionId(hash64)) { throw new Error('invalid revision id') }

	return hash64
}

/**
 * @template T
 * @param {DocId} id
 * @param {Document<T>|T} doc
 * @param {DigestAlgorithm} digestAlgo
 * @returns {Promise<Document<T>>}
 */
export async function internalDocFrom(id, doc, digestAlgo) {
	const revision = await revisionFrom(doc, digestAlgo)
	return {
		...doc,
		[SETTEE_INTERNAL_PROPERTIES.ID]: id,
		[SETTEE_INTERNAL_PROPERTIES.REVISION]: revision,
	}
}

/**
 * @template D
 * @param {Document<D>} doc
 * @param {DigestAlgorithm} digestAlgo
 * @returns {Promise<boolean>}
 */
export async function internalDocHasIntegrity(doc, digestAlgo) {
	const revision = doc[SETTEE_INTERNAL_PROPERTIES.REVISION]
	const computedRevision = await revisionFrom(doc, digestAlgo)

	return computedRevision === revision
}

/**
 * @param {string} viewName
 * @param {SetteeOptions|undefined} [options]
 */
export function pathFromView(viewName, options) {
	const {
		viewsRoot
	} = fromOptions(options)

	return path.format({
		dir: viewsRoot,
		name: viewName,
		ext: SETTEE_DEFAULT.VIEW_EXTENSION
	})
}

/**
 * @template D, K, V
 * @param {string} viewName
 * @param {SetteeOptions|undefined} [options]
 * @returns {Promise<ViewFunction<D, K, V>>}
 */
export async function importView(viewName, options) {
	const viewPath = pathFromView(viewName, options)

	const mod = await import(viewPath)
	// 	.catch(e => {
	// 		console.log(e.message)
	// 		if(e.code === 'ERR_MODULE_NOT_FOUND') {
	// 			console.log('unable to load map function', e.message)
	// 		}

	// 		return undefined
	// 	})

	// if(mod === undefined) { throw new Error('unable to load module') }
	const { default: mapFn, map } = mod
	const fn = map ?? mapFn
	if(fn === undefined) { throw new Error('unable to load map function') }
	return fn
}

/**
 * @template D, K, V
 * @param {string} filepath
 * @param {(doc: Document<D>) => ViewFunctionResult<K, V>|undefined} fn
 * @param {Array<K>} filterKeyList
 * @param {AbortSignal} signal
 * @returns {Promise<[ DocId, ViewFunctionResult<K, V> ]|undefined>}
 */
export async function processFilePath(filepath, fn, filterKeyList, signal) {
	const json = await fs.readFile(filepath, { encoding: SETTEE_DEFAULT.FILE_ENCODING, flag: FILE_FLAGS.MAP_PROCESS, signal })
	const internalDoc = JSON.parse(json)

	const id = internalDoc[SETTEE_INTERNAL_PROPERTIES.ID]

	const keySet = await Promise.try(fn, internalDoc)
	if(keySet === undefined) { return }

	if(filterKeyList === undefined || filterKeyList.length === 0) {
		return [ id, [ ...keySet ] ]
	}

	const filteredKeySet = [ ...keySet ].filter(item => filterKeyList.includes(item[0]))
	return [ id, filteredKeySet ]
}

/**
 * @template K, V
 * @param {Map<DocId, ViewFunctionResult<K, V>>} results
 * @param {number} total_count
 * @param {Array<K>} filterKeyList
 * @returns {ViewFunctionRowResult<K, V>}
 */
export function formatResults(results, total_count, filterKeyList) {
	const output = results
		.entries()
		.filter(entry => entry[1] !== undefined)
		.map(([ docId, result ]) => [ ...result ].map(item => ({ id: docId, key: item[0], value: item[1] })))
		.reduce((accumulator, value) => {
			const filterValue = filterKeyList.length > 0 ? value.filter(element => filterKeyList.includes(element.key)) : value
			accumulator.push(...filterValue)

			return accumulator
		}, [])

	return { total_count, rows: output }
}

export class Settee {
	/**
	 * @param {string|undefined} filterViewName
	 * @param {SetteeOptions|undefined} [options]
	 */
	static async* changes(filterViewName, options) {
		const {
			documentsRoot,
			signal
		} = fromOptions(options)


		const filterFn = filterViewName === undefined ? undefined : await importView(filterViewName, { ...options, internal_signal: signal })

		try {
			await using watcher = fs.watch(documentsRoot, { encoding: SETTEE_DEFAULT.FILE_ENCODING, signal })

			for await (const { eventType, filename } of watcher) {
				//
				// console.log('watch:', eventType, filename)
				if(filename === null) { continue }
				if(filename.startsWith(SETTEE_DEFAULT.IGNORE_PREFIX)) { continue }

				const id = path.parse(filename).name
				if(!isValidDocId(id)) { continue }

				if(filterFn !== undefined) {
					const doc = await Settee.get(id, { ...options, internal_signal: signal })
					const filterMatches = filterFn(doc)
					if(filterMatches === undefined || Array.from(filterMatches).length === 0) { continue }
				}

				yield { eventType, id }
			}
		}
		catch(e) {
			// if(e.name === 'AbortError') { return }
			throw e
		}
	}

	/**
	 * @param {string} name
	 * @param {SetteeOptions|undefined} options
	 */
		static async createDatabase(name, options) {
			if(name !== options?.db) {
				throw new Error('name does not match options db')
			}

			const newDatabaseRoot = ENV_NEW_DB_DIR

			const {
				db,
				documentsDir,
				documentsRoot,
				viewsDir,
				viewsRoot,
				digestAlgo
			} = fromOptionsResolved(options, newDatabaseRoot)

			if(newDatabaseRoot === undefined) { throw new Error('creation disabled') }

			// todo getHashes returns inconsistent names for digest
			// const validAlgorithms = crypto.getHashes()
			// const algoName = (typeof digestAlgo === 'string') ? digestAlgo : digestAlgo.name
			// if(!validAlgorithms.includes(algoName)) {
			// 	console.log(digestAlgo, validAlgorithms)
			// 	// throw new Error('unknown digest algorithm')
			// }
			try {
				await revisionFrom({}, digestAlgo)
			}
			catch(e) {
				throw new Error('Error in digest algorithm ', { cause: e })
			}

			await fs.access(newDatabaseRoot, fs.constants.F_OK)

			const dbDir = path.resolve(newDatabaseRoot, db)

			const exists = await fs.access(dbDir, fs.constants.F_OK)
				.then(() => true)
				.catch(() => false)

			if(exists) { throw new Error('database with name already exists') }

			// console.log('create', { dbDir, documentsRoot, viewsRoot })

			await fs.mkdir(dbDir, { mode: fs.constants.S_IRWXU })
			await fs.mkdir(documentsRoot, { mode: fs.constants.S_IRWXU })
			await fs.mkdir(viewsRoot, { mode: fs.constants.S_IRWXU })

			const viewAllPath = path.join(viewsRoot, 'all.js')
			const data = 'export default doc => [ [ doc[\'settee:id\'], 1 ] ]'

			await fs.writeFile(viewAllPath, data, { encoding: SETTEE_DEFAULT.FILE_ENCODING, mode: FILE_MODE, flag: 'ax', flush: true})

			return {
				db: dbDir,
				documentsDir,
				viewsDir,
				digestAlgo
			}
		}
	/**
	 * @param {SetteeOptions|undefined} options
	 */
	static async _info(options) {
		const {
			documentsRoot
		} = fromOptions(options)

		let total_count = 0
		let size = 0

		const iterator = await fs.opendir(documentsRoot, { bufferSize: 32, encoding: SETTEE_DEFAULT.FILE_ENCODING })
		for await (const entry of iterator) {
			if(!entry.isFile()) { continue }
			if(entry.name.startsWith(SETTEE_DEFAULT.IGNORE_PREFIX)) { continue }

			const stat = await fs.stat(path.join(documentsRoot, entry.name), { bigint: false })
			size += stat.size
			total_count += 1
		}

		return {
			total_count,
			size
		}
	}

	/**
	 * @param {SetteeOptions|undefined} options
	 */
	static async info(options) {
		const {
			documentsRoot,
			signal
		} = fromOptions(options)

		let total_count = 0
		let size = 0
		let overallDone = false

		using iterator = await fs.opendir(documentsRoot, { bufferSize: 64, encoding: SETTEE_DEFAULT.FILE_ENCODING })
		const iter = iterator[Symbol.asyncIterator]()

		/** @type {(entry: IteratorResult<Dirent<string>, undefined>) => Promise<void>} */
		const process = async ({ done, value }) => {
			if(done) { overallDone = true; return }
			if(!value.isFile()) { return }
			if(value.name.startsWith(SETTEE_DEFAULT.IGNORE_PREFIX)) { return }

			return fs.stat(path.join(documentsRoot, value.name), { bigint: false })
				.then(stat => {
					total_count += 1
					size += stat.size
				})
		}

		while(!overallDone) {
			signal.throwIfAborted()
			const items = Array.from({ length: 64 }, () => iter.next().then(process))
			await Promise.all(items)
		}

		return {
			total_count,
			size
		}
	}

	/**
	 * @param {SetteeOptions|undefined} options
	 */
	static async viewInfo(options) {
		const {
			viewsRoot,
			signal
		} = fromOptions(options)

		using iterator = await fs.opendir(viewsRoot, { bufferSize: 64, encoding: SETTEE_DEFAULT.FILE_ENCODING })

		const views = []
		for await (const view of iterator) {
			signal.throwIfAborted()

			if(!view.isFile()) { continue }
			if(view.name.startsWith(SETTEE_DEFAULT.IGNORE_PREFIX)) { continue }

			const { name } = path.parse(view.name)

			const cache = await Chifforobe.info(name, options)


			views.push({
				name,
				cache
			})
		}

		return {
			views
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
		const {
			digestAlgo,
			signal
		} = fromOptions(options)

		const internalDoc = await Settee.get(id, { ...options, internal_signal: signal })
		if(!internalDocHasIntegrity(internalDoc, digestAlgo)) { return true }
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
			digestAlgo,
			signal
		} = fromOptions(options)

		const filepath = pathFromId(documentsRoot, id)

		// const futureStats = fs.stat(filepath)

		const json = await fs.readFile(filepath, { encoding: SETTEE_DEFAULT.FILE_ENCODING, flag: FILE_FLAGS.DOC_GET, signal })
		const internalDoc = JSON.parse(json)
		const valid = await internalDocHasIntegrity(internalDoc, digestAlgo)
		if(!valid) { throw new Error('invalid integrity') }

		// const { mtime } = await futureStats

		return internalDoc
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
			digestAlgo,
			signal
		} = fromOptions(options)

		const filepath = pathFromId(documentsRoot, id)
		const internalDoc = await internalDocFrom(id, doc, digestAlgo)
		const internalJson = JSON.stringify(internalDoc)

		return fs.writeFile(filepath, internalJson, { mode: FILE_MODE, flag: FILE_FLAGS.DOC_SET, encoding: SETTEE_DEFAULT.FILE_ENCODING, flush: true, signal })
			.then(() => internalDoc)
			.catch(error => {
				if(error.code === 'EEXIST') {
					throw new Error('Write Failure Already exists')
				}
				throw new Error('Write Failure', { cause: error })
			})
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
			digestAlgo,
			signal
		} = fromOptions(options)

		const modified = await Settee.isModified(id, revision, { ...options, internal_signal: signal })
		if(modified) { throw new Error('revision miss-match') }

		const filepath = pathFromId(documentsRoot, id)
		const internalDoc = await internalDocFrom(id, doc, digestAlgo)
		const internalJson = JSON.stringify(internalDoc)

		return fs.writeFile(filepath, internalJson, { mode: FILE_MODE, flag: FILE_FLAGS.DOC_UPDATE, encoding: SETTEE_DEFAULT.FILE_ENCODING, flush: true, signal })
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
	 * @template K, V
	 * @param {string} viewName
	 * @param {K|Array<K>|undefined} [filterKey]
	 * @param {SetteeOptions|undefined} [options]
	 * @returns {Promise<ViewFunctionRowResult<K,V>>}
	 */
	static async map(viewName, filterKey, options) {
		const {
			documentsRoot,
			signal
		} = fromOptions(options)

		const filterKeyList = filterKey === undefined ? [] : Array.isArray(filterKey) ? filterKey : [ filterKey ]

		// const cachedResult = await Chifforobe.load(viewName,  { ...options, internal_signal: signal })
		// if(cachedResult !== undefined) {
		// 	const result = new Map(cachedResult)
		// 	const total_count = cachedResult.length
		// 	return formatResults(result, total_count, filterKeyList)
		// }

		const fn = await importView(viewName, { ...options, internal_signal: signal })

		/** @type Map<DocId, ViewFunctionResult<K, V>> */
		const result = new Map()
		let total_count = 0

		const listing = await fs.opendir(documentsRoot, { bufferSize: 32, encoding: SETTEE_DEFAULT.FILE_ENCODING })

		for await (const entry of listing) {
			signal.throwIfAborted()
			if(!entry.isFile()) { continue }
			if(entry.name.startsWith(SETTEE_DEFAULT.IGNORE_PREFIX)) { continue }

			const filepath = path.join(documentsRoot, entry.name)
			await processFilePath(filepath, fn, [], signal)
				.then(results => {
					if(results === undefined) { return }
					if(results.length !== 2) { return }

					total_count += 1

					const [ docId, value ] = results
					result.set(docId, [ ...value ])
				})
				.catch(e => {
					console.warn('process Dirent error', entry.name, e.message)
				})
		}

		// await Chifforobe.store(viewName, result, { ...options, internal_signal: signal })

		return formatResults(result, total_count, filterKeyList)
	}

	/**
	 * @param {string} filter
	 * @param {SetteeOptions|undefined} [options]
	 *@returns {AsyncGenerator<string, void, undefined>}
	 */
	static async *query(filter, options) {
		const {
			documentsRoot,
			signal
		} = fromOptions(options)

		const listing = await fs.opendir(documentsRoot, { bufferSize: 32, encoding: SETTEE_DEFAULT.FILE_ENCODING })
		for await (const entry of listing) {
			signal.throwIfAborted()
			if(!entry.isFile()) { continue }
			if(entry.name.startsWith(SETTEE_DEFAULT.IGNORE_PREFIX)) { continue }

			const id = path.parse(entry.name).name

			if(!id.includes(filter)) { continue }

			// const filepath = path.join(documentsRoot, entry.name)
			// const info = await fs.stat(filepath)
			yield id
		}
	}
}
