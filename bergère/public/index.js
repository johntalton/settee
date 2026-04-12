/** biome-ignore-all lint/nursery/noExcessiveLinesPerFile: <explanation> */
import {
	API,
	CANAPE_URL,
	API_OPTIONS
} from './api.js'
import { UI } from './ui.js'

/**
 * @param {string} databaseName
 */
async function setupSSE(databaseName) {
	const sse = new EventSource(new URL(`${databaseName}/sse`, CANAPE_URL), {})
	sse.addEventListener('open', event => console.log('sse open', event))
	sse.addEventListener('message', event => console.log('sse message', event))
	sse.addEventListener('error', event => console.log('sse error', event))

	sse.addEventListener('update', event => console.log('sse update', event.data))

}

class Handler {
	static handleDatabaseListing() {
		UI.selectNavItem('listing')
		UI.setBreadcrumb()
		UI.selectSection('progress')

		document.body.dataset.databaseName = ''
		document.body.dataset.documentId = ''

		API.listDBs()
			.then(listing => {
				UI.insertDBListing(listing.dbs)
				UI.selectSection('listing')

				for(const db of listing.dbs) {
					API.loadDBInfo(db)
						.then(info => {
							UI.updateDBListingFor(db, info)
						})
						.catch(e => {
							console.warn('failed to load db info', e)
						})
				}
			})
			.catch(e => {
				UI.showToast('error loading DB listing')
				console.warn('error loading db listing', e)
			})
	}

	/**
	 * @param {string} databaseName
	 * @param {string} viewName
	 */
	static handleDatabaseSelection(databaseName, viewName) {
		if(databaseName === undefined || databaseName === '') {
			UI.showToast('invalid database key')
			return
		}

		document.body.dataset.databaseName = databaseName
		document.body.dataset.documentId = ''

		UI.selectNavItem('listing')
		UI.selectSection('progress')
		UI.setBreadcrumb(databaseName)
		UI.clearDocuments()
		UI.clearViewSelection()

		API.viewInfo(databaseName)
			.then(viewInfo => {
				UI.updateViewSelection(viewInfo.views, viewName)
			})
			.catch(error => {
				UI.showToast('error loading view info', error)
			})

		API.loadDocuments(databaseName, viewName)
			.then(documents => {
				UI.selectSection('documents')
				UI.insertDocuments(databaseName, documents.rows)
			})
			.catch(e => {
				UI.showToast('error loading database documents')
				console.warn('error loading documents', e)
			})
	}

	/**
	 * @param {string} databaseName
	 * @param {string} documentId
	 */
	static handleLoadDocument(databaseName, documentId) {
		document.body.dataset.databaseName = databaseName
		document.body.dataset.documentId = documentId

		UI.selectNavItem('listing')
		UI.selectSection('progress')
		UI.setBreadcrumb(databaseName, documentId)

		API.loadDocument(databaseName, documentId)
			.then(doc => {
				UI.selectSection('document')
				UI.insertDocument(doc)
			})
			.catch(e => {
				UI.showToast(`failed to load document (${documentId})`, e)
			})
	}

	/**
	 * @param {HTMLFormElement} form
	 */
	static handleNewDatabase(form) {
		const fd = new FormData(form)
		form.reset()

		UI.setBreadcrumb()
		UI.selectSection('progress')

		const databaseName = fd.get('name')
		const digestAlgo = fd.get('digestAlgo') ?? 'SHA-1'

		if(databaseName === null) {
			UI.showToast('database name is null')
			return
		}
		if(databaseName instanceof File) { throw new Error('database name is a File') }
		if(digestAlgo instanceof File) { throw new Error('digestAlgo name is a File') }

		API.createDB(databaseName, { digestAlgo })
			.then(() => {
				Handler.handleDatabaseListing()
			})
			.catch(e => {
				UI.showToast(e.message)
			})
	}

	/**
	 * @param {HTMLFormElement} form
	 */
	static handleNewDocument(form) {
		const fd = new FormData(form)

		const databaseName = document.body.dataset.databaseName
		const documentId = fd.get('documentId')

		if(databaseName === undefined) { throw new Error('invalid db name') }
		if(documentId === null) { throw new Error('invalid doc id') }
		if(documentId instanceof File) { throw new Error('doc id must be string') }

		form.reset()

		const emptyDoc = { }

		API.createDocument(databaseName, documentId, emptyDoc)
			.then(() => {
				Handler.handleLoadDocument(databaseName, documentId)
			})
			.catch(error => {
				UI.showToast('failure to create document', error)
			})
	}

	static handleSaveDocument() {
		UI.selectSection('progress')

		const databaseName = document.body.dataset.databaseName
		const documentId = document.body.dataset.documentId

		const doc = JSON.parse(UI.retrieveDocument())

		API.saveDocument(databaseName, documentId, doc)
			.then(() => {
				UI.selectSection('document')
			})
			.catch(e => {
				UI.showToast('Failed during document save', e)
			})
	}

	static handleDeleteDocument() {}

	static handleToggleAside() {
		document.body.toggleAttribute('data-collapse-aside')
	}
}

async function onContentLoadedAsync() {
	document.body.addEventListener('command', event => {
		const { command } = event

		if(command === '--toggle-aside') {
			Handler.handleToggleAside()
		}
		else {
			console.warn('unknown body command', command)
		}
	})

	const createDBForm = document.getElementById('CreateNewDBForm')
	if(createDBForm === null || !(createDBForm instanceof HTMLFormElement)) { throw new Error('missing new db form') }
	createDBForm.addEventListener('submit', event => {
		Handler.handleNewDatabase(createDBForm)
	})
	createDBForm.addEventListener('reset', event => {
		console.log('reset new database')
		const dialogElem = createDBForm.closest('dialog')
		dialogElem?.close()
	})

	const createNewDocumentForm = document.getElementById('CreateNewDocumentForm')
	if(createNewDocumentForm === null || !(createNewDocumentForm instanceof HTMLFormElement)) { throw new Error('missing new doc form') }
	createNewDocumentForm.addEventListener('submit', event => {
		Handler.handleNewDocument(createNewDocumentForm)
	})
	createNewDocumentForm.addEventListener('reset', event => {
		console.log('reset new document')
		const dialogElem = createNewDocumentForm.closest('dialog')
		dialogElem?.close()
	})

	const documentContainer = document.getElementById('DocumentContainer')
	if(documentContainer === null || !(documentContainer instanceof HTMLElement)) { throw new Error('missing doc container') }
	documentContainer.addEventListener('command', evnet =>{
		const { command } = event

		if(command === '--save-document') {
			Handler.handleSaveDocument()
		}
		else if(command === '--delete-document') {
			Handler.handleDeleteDocument()
		}
		else {
			console.warn('unknown document command', command)
		}
	})

	//
	const listingOptionsForm = document.getElementById('DocumentsListOptions')
	listingOptionsForm?.addEventListener('change', event => {
		console.log('form change', event)
		const databaseName = document.body.dataset.databaseName
		const viewSelect = listingOptionsForm.querySelector('select[name="ViewSelection"]')
		if(viewSelect === null || !(viewSelect instanceof HTMLSelectElement)) { throw new Error('invalid view selector') }
		const viewName = viewSelect.selectedOptions.item(0)?.value
		navigation.navigate(`#database/${databaseName}:${viewName}`)
	})

	//
	const documentSearchForm = document.getElementById('DocumentsListingSearchInput')
	if(documentSearchForm === null || !(documentSearchForm instanceof HTMLInputElement)) { throw new Error('invalid search input') }
	documentSearchForm.addEventListener('change', event => {
		console.log('change', event.target)
	})
	documentSearchForm.addEventListener('input', event => {
		console.log('input', event.target)
	})


	//
	const canvasFont = new FontFace('DMMono', 'url(./font/DM_Mono/DMMono-Regular.ttf)')
	document.fonts.add(canvasFont)
	await canvasFont.load()

	//
	if('connection' in navigator) {
		function updateNetworkConnection(event) {
			console.log('Network Connection Change', navigator.connection.type, navigator.connection.rtt)
			if(navigator.connection.type === 'none') {
				console.log('Network Offline')
			}
			API_OPTIONS.defaultTimeout = Math.min(Math.max(1000, 3 * navigator.connection.rtt), 10_000)
			console.log('API Timeout est', API_OPTIONS.defaultTimeout)
		}
		navigator.connection.addEventListener('change', updateNetworkConnection)
		updateNetworkConnection()
	}

	//
	window.addEventListener('online', e => { console.log('online event', e) })
	window.addEventListener('offline', e => { console.log('offline event', e)})


	//
	navigation.addEventListener('navigate', event => {
		if(!event.canIntercept) { return }
		if(event.downloadRequest) { return }
		// if(e.hashChange) { return }

		const { signal } = event
		const url = new URL(event.destination.url)

		event.intercept({
			async handler() {
				const [ prefix, databaseNameAndView, documentId ] = url.hash.split('/')
				console.log('Navigation', prefix, databaseNameAndView, documentId)

				if(prefix === '#settings') {

				}
				if(prefix === '#listing') {
					Handler.handleDatabaseListing()
				}
				else if(prefix === '#database') {
					const [ databaseName, viewName ] = databaseNameAndView.split(':')
					console.log('Navigation', databaseName, viewName)

					if(documentId === undefined) {
						Handler.handleDatabaseSelection(databaseName, viewName ?? 'all')
					}
					else {
						Handler.handleLoadDocument(databaseName, documentId)
					}
				}
				else {
					UI.showToast('unknown route')
					console.log('unknown route', url.hash)
				}

			}
		})
	})
	navigation.addEventListener('navigatesuccess', event => { })
	navigation.addEventListener('navigateerror', event => { console.log('navigation error', event) })


	//
	// const po = new PerformanceObserver((list) => {
	// 	for (const entry of list.getEntries()) {
	// 		console.log('Navigation Performance', entry.serverTiming)
	// 	}
	// })
	// po.observe({type: 'resource', buffered: true})

	//
	// Handler.handleLoadDocument('user:UY102c8Yj5uvmPLK7qcE')
	// Handler.handleLoadDocument('4a8fef8f-7c53-43cf-adbd-c56e2853f9e8')
	// Handler.handleDatabaseListing()
	// Handler.handleDatabaseSelection('export', 'all')
	// Handler.selectDatabase('export')
	// navigation.navigate('#listing')
}

function onContentLoaded() {
	onContentLoadedAsync()
		.catch(console.warn)
}

(document.readyState === 'loading') ?
	document.addEventListener('DOMContentLoaded', onContentLoaded) :
	onContentLoaded()