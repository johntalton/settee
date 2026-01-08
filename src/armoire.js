import { isMainThread, Worker, parentPort, workerData, threadName } from 'node:worker_threads'
import fs from 'node:fs/promises'
import path from 'node:path'

import {
	SETTEE_DEFAULT,
	formatResults,
	fromOptions,
	importView,
	processFilePath
} from '@johntalton/settee'

/** @import { SetteeOptions, ViewFunction } from '@johntalton/settee' */

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
	 * @param {string} viewName
	 * @param {Array<string>|undefined} [filterKeys]
	 * @param {(SetteeOptions & ArmoireOptions)|undefined} [options]
	 */
	static async map(viewName, filterKeys, options) {
		const { documentsRoot, signal } = fromOptions(options)
		const threadCount = options?.threadCount ?? DEFAULT_THREAD_COUNT

		const url = new URL(import.meta.url)

		const workers = Array.from({ length: threadCount }, (_, index) => {
			return new Worker(url, { name: `Armoire#${index}`, workerData: { index, viewName, options } })
		})

		const results = new Map()
		let total_count = 0
		const { promise, resolve, reject } = Promise.withResolvers()

		const dir = await fs.opendir(documentsRoot, { bufferSize: DIRECTORY_BUFFER_SIZE, encoding: SETTEE_DEFAULT.FILE_ENCODING })
		const iterator = dir[Symbol.asyncIterator]()

		const next = async () => {
			while(true) {
				// signal?.throwIfAborted()
				if(signal.aborted) {
					// console.log('reject next on signal')
					reject(new Error(signal.reason))
				}

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

					worker.postMessage({ type: CONTROL_MESSAGE.FILE, filepath, filterKeys })
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

		return promise
			.then(result => {
				return formatResults(result, total_count)
			})
			.finally(() => {
				for(const worker of workers) {
					worker.terminate()
				}
			})
	}

	/**
	 * @template T, K, V
	 * @param {{ type: string, filepath: string, filterKeys: Array<string>}} message
	 * @param {ViewFunction<T, K, V>} mapFn
	 */
	static async handleMessage(message, mapFn) {
		const { type } = message

		if(type === CONTROL_MESSAGE.END) {
			parentPort?.close()
		}
		else if(type === CONTROL_MESSAGE.FILE) {
			const { filepath, filterKeys } = message
			await processFilePath(filepath, mapFn, filterKeys, AbortSignal.timeout(1_000))
				.then(result => {
					if(result === undefined) { return }
					if(result.length !== 2) { return }
					parentPort?.postMessage({ type: WORKER_MESSAGE.RESULT, filepath, result })
				})
				.catch(e => {
					// console.log('process failed for', filepath, e.message)
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