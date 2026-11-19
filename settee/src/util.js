import fs from 'node:fs/promises'
import path from 'node:path'

import { FILE_FLAGS, SETTEE_DEFAULT, SETTEE_ENV, SETTEE_INTERNAL_PROPERTIES } from './defs.js'

/** @import { UserDocument, Document, SetteeOptions, SetteeConstructionOptions, SetteeOptionsResolved, DocId, ViewFunctionResult, ViewFunctionRowResult, ViewFunction } from './type.js' */


export const ENV_DB_DIR = process.env[SETTEE_ENV.DB_ROOT] ?? SETTEE_DEFAULT.DB
export const ENV_DOCS_DIR = process.env[SETTEE_ENV.DOCUMENTS_DIRECTORY] ?? SETTEE_DEFAULT.DOCS
export const ENV_VIEWS_DIR = process.env[SETTEE_ENV.VIEWS_DIRECTORY] ?? SETTEE_DEFAULT.VIEWS
export const ENV_TIMEOUT_MS = Number.parseInt(process.env[SETTEE_ENV.TIMEOUT_MS] ?? SETTEE_DEFAULT.TIMEOUT_MS, 10)
export const ENV_DIGEST_ALGO = process.env[SETTEE_ENV.DIGEST_ALGO] ?? SETTEE_DEFAULT.DIGEST_ALGO
export const ENV_NEW_DB_DIR = process.env[SETTEE_ENV.NEW_DATABASE_ROOT]


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

	if(Number.isFinite(timeoutMs)) {
		// todo
	}
	if(timeoutMs <= 0) {
		// todo
	}

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
 * @template {UserDocument} D, K, V
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
