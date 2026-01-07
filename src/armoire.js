import { isMainThread, Worker, parentPort } from 'node:worker_threads'
import fs from 'node:fs/promises'
import path from 'node:path'

import { SETTEE_INTERNAL_PROPERTIES, fromOptions } from '@johntalton/settee'

/** @import { SetteeOptions, Document } from '@johntalton/settee' */

/**
 * @param {Map<string, Array<[ any, any ]>>} result
 * @param {number} total_count
 */
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

/**
 * @template T
 * @param {string} filepath
 * @param {(doc: Document<T>) => Array<[ any, any ]>|Iterable<[ any, any ]>|undefined} fn
 * @param {Array<string>} filterKeyList
 * @param {AbortSignal} signal
 */
async function processFilePath(filepath, fn, filterKeyList, signal) {
	// console.log('mapping over', entry.name)
	const json = await fs.readFile(filepath, { encoding: 'utf8', flag: 'r', signal })
	const internalDoc = JSON.parse(json)

	const id = internalDoc[SETTEE_INTERNAL_PROPERTIES.ID]

	const keySet = await Promise.try(fn, internalDoc)
		.catch(e => {
			console.warn('error in mapFn', e.message)
			return undefined
		})

	if(keySet === undefined) { return }

	if(filterKeyList.length === 0) {
		return [ id, keySet ]
	}

	const filteredKeySet = [ ...keySet ].filter(item => filterKeyList.includes(item[0]))
	return [ id, filteredKeySet ]
}

export class Armoire {
	/**
	 * @param {Array<string>} filterKeys
	 * @param {SetteeOptions} options
	 */
	static async map(filterKeys, options) {
		const { documentsRoot, signal } = fromOptions(options)

		const url = new URL('./armoire.js', import.meta.url)

		const length = 8
		const workers = Array.from({ length }, (_, index) => {
			return new Worker(url, { name: 'Armoire', workerData: index })
		})

		const results = new Map()
		let total_count = 0
		const { promise, resolve, reject } = Promise.withResolvers()

		const dir = await fs.opendir(documentsRoot, { bufferSize: 32, encoding: 'utf8' })
		const iterator = dir[Symbol.asyncIterator]()

		const next = async () => {
			while(true) {
				// 	signal?.throwIfAborted()
				const { done, value } = await iterator.next()
				if(done === undefined || done || signal.aborted) {
					for(const worker of workers) { worker.postMessage({ type: 'end' }) }
					resolve(results)
					// await dir.close()
					return undefined
				}

				if(!value.isFile()) { continue }
				if(value.name.startsWith('.')) { continue }

				total_count += 1
				return path.normalize(path.join(value.parentPath, value.name))
			}
		}

		for(const worker of workers) {
			worker.on('message', async message => {
				const { type } = message

				if(type === 'ready') {
					const filepath = await next()
					if(filepath === undefined) {
						return
					}

					worker.postMessage({ type: 'file', filepath, filterKeys })
				}
				else if(type === 'result') {
					const { result } = message
					const [ key, value ] = result

					results.set(key, value)
				}
				else if(type === 'fail') {
					console.log('fail', message)
				}
				else {
					console.warn('unknown message type from worker', type)
				}
			})
		}

		return promise
			.then(result => {
				return formatResults(result, total_count)
			})
	}

	/**
	 * @template T
	 * @param {{ type: string, filepath: string, filterKeys: Array<string>}} message
	 * @param {(doc: Document<T>) => Array<[ any, any ]>|Iterable<[ any, any ]>|undefined} mapFn
	 */
	static async handleMessage(message, mapFn) {
		const { type } = message

		if(type === 'end') {
			parentPort?.close()
		}
		else if(type === 'file') {
			const { filepath, filterKeys } = message
			await processFilePath(filepath, mapFn, filterKeys, AbortSignal.timeout(1_000))
				.then(result => {
					if(result === undefined) { return }
					if(result.length === 0) { return }
					parentPort?.postMessage({ type: 'result', filepath, result })
				})
				.catch(e => {
					// console.log('process failed for', filepath, e.message)
					parentPort?.postMessage({ type: 'fail', filepath, message: e.message })
				})

			parentPort?.postMessage({ type: 'ready' })
		}
		else {
			console.warn('unknown message type for parent', type)
		}
	}
}

// if(!isMainThread) {
// 	const { default: mapFn } = await import('../_by_color.js')
// 	parentPort?.on('message', message => Armoire.handleMessage(message, mapFn))
// 	parentPort?.postMessage({ type: 'ready' })
// }
// else {
// 	const start = performance.now()
// 	const result = await Armoire.map([ 'pink', 'yellow' ], {
// 		documentsRoot: 'data/color/docs',
// 		internal_signal: AbortSignal.timeout(30 * 1_000)
// 	})

// 	const delta = performance.now() - start
// 	console.log(result.total_count)
// 	console.log(result.rows.length)
// 	console.log(result.rows[0])
// 	console.log(delta / 1000)
// }