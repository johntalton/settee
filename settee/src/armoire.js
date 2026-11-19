/** biome-ignore-all lint/style/useExportsLast: worker thread kickoff */
import fs from 'node:fs/promises'
import path from 'node:path'
import { isMainThread, parentPort, threadName, Worker, workerData } from 'node:worker_threads'

import { SETTEE_DEFAULT } from './defs.js'
import {
	formatResults,
	fromOptions,
	importView,
	processFilePath
} from './util.js'

/** @import { UserDocument, SetteeOptions, ViewFunction, ViewFunctionRowResult } from './type.js' */

/**
 * @typedef {Object} ArmoireOptions
 * @property {number|undefined} [threadCount]
 */


export const CONTROL_MESSAGE = {
	FILE: 'file',
	END: 'end'
}

export const WORKER_MESSAGE = {
	READY: 'ready',
	RESULT: 'result',
	FAIL: 'fail',
	ERROR: 'error'
}

export const DEFAULT_THREAD_COUNT = 4

export const DIRECTORY_BUFFER_SIZE = 64

export class Armoire {
	/**
	 * @template K, V
	 * @param {string} viewName
	 * @param {Array<K>|undefined} [filterKeys]
	 * @param {(SetteeOptions & ArmoireOptions)|undefined} [options]
	 * @returns {Promise<ViewFunctionRowResult<K, V>>}
	 */
	static async map(viewName, filterKeys, options) {
		const { documentsRoot, signal } = fromOptions(options)
		const threadCount = options?.threadCount ?? DEFAULT_THREAD_COUNT

		const url = new URL(import.meta.url)

		const workers = Array.from({ length: threadCount }, (_, index) =>
			new Worker(url, {
				name: `Armoire#${index}`,
				workerData: { index, viewName, options }
			}))

		const results = new Map()
		let total_count = 0
		const { promise, resolve, reject } = Promise.withResolvers()

		const dir = await fs.opendir(documentsRoot, { bufferSize: DIRECTORY_BUFFER_SIZE, encoding: SETTEE_DEFAULT.FILE_ENCODING })
		const iterator = dir[Symbol.asyncIterator]()

		const next = async () => {
			// biome-ignore lint/suspicious/noUnnecessaryConditions: loop until resolve
			while(true) {
				// signal?.throwIfAborted()
				if(signal.aborted) {
					// console.log('reject next on signal')
					reject(new Error(signal.reason))
					return undefined
				}

				// biome-ignore lint/performance/noAwaitInLoops: iterator loop
				const { done, value } = await iterator.next()
				if(done === undefined || done) {
					return undefined
				}

				if(!value.isFile()) { continue }
				if(value.name.startsWith(SETTEE_DEFAULT.IGNORE_PREFIX)) { continue }

				total_count += 1
				return path.normalize(path.join(value.parentPath, value.name))
			}
		}

		let remainingWorkers = threadCount

		for(const worker of workers) {
			// biome-ignore lint/suspicious/noLoopFunc: uses remaining to track count
			worker.on('exit', () => {
				remainingWorkers -= 1
				// console.log('worker exited', remainingWorkers)
				if(remainingWorkers === 0) {
					resolve(results)
				}
			})

			worker.on('message', async message => {
				const { type } = message

				if(type === WORKER_MESSAGE.READY) {
					const filepath = await next()
					if(filepath === undefined) {
						worker.postMessage({ type: CONTROL_MESSAGE.END })
						return
					}

					worker.postMessage({ type: CONTROL_MESSAGE.FILE, filepath })
				}
				else if(type === WORKER_MESSAGE.RESULT) {
					const { result } = message
					const [ key, value ] = result

					results.set(key, value)
				}
				else if(type === WORKER_MESSAGE.FAIL) {
					console.log('fail', message)
				}
				else if(type === WORKER_MESSAGE.ERROR) {
					reject(message.error)
				}
				else {
					console.warn('unknown message type from worker', type)
				}
			})
		}

		const filterKeyList = filterKeys === undefined ? [] : Array.isArray(filterKeys) ? filterKeys : [ filterKeys ]

		return promise
			.then(result => formatResults(result, total_count, filterKeyList))
			.finally(() => {
				for(const worker of workers) {
					worker.terminate()
				}
			})
	}

	/**
	 * @template {UserDocument} T, K, V
	 * @param {{ type: string, filepath: string, filterKeys: Array<string>}} message
	 * @param {ViewFunction<T, K, V>} mapFn
	 */
	static async handleMessage(message, mapFn) {
		const { type } = message

		if(type === CONTROL_MESSAGE.END) {
			parentPort?.close()
		}
		else if(type === CONTROL_MESSAGE.FILE) {
			const { filepath } = message
			await processFilePath(filepath, mapFn, [], AbortSignal.timeout(1000))
				.then(result => {
					if(result === undefined) { return }
					if(result.length !== 2) { return }
					parentPort?.postMessage({ type: WORKER_MESSAGE.RESULT, filepath, result })
				})
				.catch(e => {
					// console.log('process failed for', filepath, e)
					parentPort?.postMessage({ type: WORKER_MESSAGE.FAIL, filepath, message: e.message })
				})

			parentPort?.postMessage({ type: WORKER_MESSAGE.READY })
		}
		else {
			console.warn('unknown message type for parent', type)
		}
	}
}

if(!isMainThread) {
	console.log('Starting Worker')
	await importView(workerData.viewName, workerData.options)
		.then(mapFn => {
			parentPort?.on('message', message => Armoire.handleMessage(message, mapFn))
			parentPort?.postMessage({ type: WORKER_MESSAGE.READY, name: threadName })
		})
		.catch(e => {
			parentPort?.postMessage({ type: WORKER_MESSAGE.ERROR, error: e })
			parentPort?.close()
		})
}
