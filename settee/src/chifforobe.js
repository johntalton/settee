import fs from 'node:fs/promises'
import path from 'node:path'

import { fromOptions, FILE_FLAGS, FILE_MODE } from './settee.js'

/** @import { SetteeOptions, DocId, ViewFunctionResult } from './settee.js' */

/**
 * @typedef {Object} ChifforobeOptions
 * @property {string|undefined} [cacheDir]
 */

export const CHIFFOROBE_ENV = {
	CACHE_DIR: 'CHIFFOROBE_CACHE_DIR'
}

export const CHIFFOROBE_DEFAULT = {
	RESOLVER_PREFIX: '.',
	CACHE_DIR: '.cache',

	/** @type {BufferEncoding} */
	FILE_ENCODING: 'utf-8',

	FILE_EXTENSION: 'json',
}

export const FILE_FLAGS_OVERWRITE = 'w'

export const ENV_VIEWS_CACHE_DIR = process.env[CHIFFOROBE_ENV.CACHE_DIR] ?? CHIFFOROBE_DEFAULT.CACHE_DIR

export class Chifforobe {
	/**
	 * @template K, V
	 * @param {string} viewName
	 * @param {Map<DocId, ViewFunctionResult<K, V>>} results
	 * @param {(SetteeOptions & ChifforobeOptions)|undefined} [options]
	 */
	static async store(viewName, results, options) {
		const { viewsRoot, signal } = fromOptions(options)
		const cacheDir = options?.cacheDir ?? ENV_VIEWS_CACHE_DIR
		const cacheRoot = path.resolve(CHIFFOROBE_DEFAULT.RESOLVER_PREFIX, viewsRoot, cacheDir)

		await fs.access(cacheRoot, fs.constants.F_OK)
			.catch(async e => {
				if(e.code !== 'ENOENT') { throw e }
				await fs.mkdir(cacheRoot, { mode: fs.constants.S_IRWXU })
			})

		const viewCacheFile = path.format({
			dir: cacheRoot,
			name: '.' + viewName,
			ext: CHIFFOROBE_DEFAULT.FILE_EXTENSION
		})

		const cacheJson = JSON.stringify([ ...results.entries() ])

		return fs.writeFile(viewCacheFile, cacheJson, {
			mode: FILE_MODE,
			flag: 'w',
			encoding: CHIFFOROBE_DEFAULT.FILE_ENCODING,
			flush: true,
			signal
		})
	}

	/**
	 * @param {string} viewName
	 * @param {(SetteeOptions & ChifforobeOptions)|undefined} [options]
	 */
	static async load(viewName, options) {
		const { viewsRoot, signal } = fromOptions(options)
		const cacheDir = options?.cacheDir ?? ENV_VIEWS_CACHE_DIR
		const cacheRoot = path.resolve(CHIFFOROBE_DEFAULT.RESOLVER_PREFIX, viewsRoot, cacheDir)

		const viewCacheFile = path.format({
			dir: cacheRoot,
			name: '.' + viewName,
			ext: CHIFFOROBE_DEFAULT.FILE_EXTENSION
		})

		try {
			await fs.access(viewCacheFile, fs.constants.F_OK)
		}
		catch(e) {
			if(e.code === 'ENOENT') { return }
			throw e
		}


		const file = await fs.readFile(viewCacheFile, {
			flag: 'r',
			encoding: CHIFFOROBE_DEFAULT.FILE_ENCODING,
			signal
		})

		return JSON.parse(file)
	}
}