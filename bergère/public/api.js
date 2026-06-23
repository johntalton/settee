export const CANAPE_URL = 'https://canape.next.internal:6095/'
export const API_OPTIONS = {
	defaultTimeout: 1000
}

export class API {
	/**
	 * @param {string} databaseName
	 * @param {{ digestAlgo: string }} options
	 */
	static async createDB(databaseName, options) {
		const response = await fetch(new URL(`${databaseName}`, CANAPE_URL), {
			method: 'POST',
			mode: 'cors',
			headers: {
				'content-type': 'application/json',
				'accept': 'application/json'
			},
			body: JSON.stringify(options),
			signal: AbortSignal.timeout(API_OPTIONS.defaultTimeout)
		})

		if(!response.ok) {
			// const contentType = response.headers.get('content-type')
			const message = await response.text()
			if(message !== undefined && message !== '') {
				throw new Error(`failed to create db: ${message}`)
			}
			throw new Error('failed to create db')
		}
	}

	/**
	 * @param {string} databaseName
	 * @param {string} documentId
	 * @param {any} doc
	 */
	static async createDocument(databaseName, documentId, doc) {
		const response = await fetch(new URL(`${databaseName}/${documentId}`, CANAPE_URL), {
			method: 'POST',
			mode: 'cors',
			headers: {
				'content-type': 'application/json',
				'accept': 'application/json'
			},
			body: JSON.stringify(doc),
			signal: AbortSignal.timeout(API_OPTIONS.defaultTimeout)
		})

		if(!response.ok) {
			console.warn('failed to create document', response.status)
			throw new Error('failed to create document')
		}

		return response.json()
	}

	/**
	 * @param {string} databaseName
	 * @param {string} documentId
	 * @param {any} doc
	 */
	static async saveDocument(databaseName, documentId, doc) {
		const response = await fetch(new URL(`${databaseName}/${documentId}`, CANAPE_URL), {
			method: 'POST',
			mode: 'cors',
			headers: {
				'content-type': 'application/json',
				'accept': 'application/json'
			},
			body: JSON.stringify(doc),
			signal: AbortSignal.timeout(API_OPTIONS.defaultTimeout)
		})

		if(!response.ok) {
			console.warn('failed to save document', response.status)
			throw new Error('failed to save document')
		}

		return response.json()
	}

	/**
	 *
	 */
	static async listDBs() {
		const bearerToken = 'FAKE'

		const response = await fetch(CANAPE_URL, {
			method: 'GET',
			mode: 'cors',
			headers: {
				'Authorization': `Bearer ${bearerToken}`,
				'accept': 'application/json'
			},
			signal: AbortSignal.timeout(API_OPTIONS.defaultTimeout)
		})

		if(!response.ok) { return }

		return response.json()
	}

	/**
	 * @param {string} databaseName
	 */
	static async loadDBInfo(databaseName) {
		const itemResponse = await fetch(new URL(databaseName, CANAPE_URL), {
			method: 'GET',
			mode: 'cors',
			headers: {
				'accept': 'application/json'
			},
			signal: AbortSignal.timeout(API_OPTIONS.defaultTimeout)
		})
		if(!itemResponse.ok) { throw new Error('response not ok') }

		return itemResponse.json()
	}

	/**
	 * @param {string} databaseName
	 */
	static async viewInfo(databaseName) {
		const response = await fetch(new URL(`${databaseName}/view`, CANAPE_URL), {
			method: 'GET',
			mode: 'cors',
			headers: {
				// 'accept': 'application/json'
			},
			signal: AbortSignal.timeout(API_OPTIONS.defaultTimeout)
		})

		if(!response.ok) { throw new Error('failed loading view info') }

		return response.json()
	}

	/**
	 * @param {string} databaseName
	 * @param {string} viewName
	 */
	static async loadDocuments(databaseName, viewName) {
		const response = await fetch(new URL(`${databaseName}/view/${viewName}`, CANAPE_URL), {
			method: 'GET',
			headers: {
				accept: 'application/json'
			},
			signal: AbortSignal.timeout(API_OPTIONS.defaultTimeout)
		})

		if(!response.ok) { throw new Error('failed loading all documents') }

		return response.json()
	}

	/**
	 * @param {string} databaseName
	 * @param {string} id
	 */
	static async loadDocument(databaseName, id) {
		console.log('load document', databaseName, id)
		const response = await fetch(new URL(`/${databaseName}/${id}`, CANAPE_URL), {
			method: 'GET',
			// cache: 'no-cache', //'force-cache',
			// mode: 'cors',
			headers: {
				'Authorization': `Bearer ${'some_token'}`,
				// 'accept': 'application/json'
				// 'If-None-Match': '"fdEgzEJbmMOxNZJN0GcE4Zgs/TA="'
			},
			signal: AbortSignal.timeout(API_OPTIONS.defaultTimeout)
		})

		if(!response.ok) {
			console.log('response', response.status, await response.text())
			throw new Error('document response not ok')
		}

		// console.log('response', [...response.headers.entries()], response.redirected)
		// console.log('etag', response.headers.get('etag'))

		return response.json()
	}
}
