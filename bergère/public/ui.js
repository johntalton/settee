import { JSONEditor } from './editor/editor.js'

/**
 * @typedef {Object} DatabaseInfo
 * @property {number} total_count
 * @property {number} size
 * @property {string} digestAlgo
 */

export class UI {

	/**
	 * @param {string} message
	 * @param {Error|undefined} [e]
	 */
	static showToast(message, e) {
		console.log('Toast', message)
		if(e !== undefined) { console.warn(e) }
		const toastElem = document.getElementById('Toast')
		if(!(toastElem instanceof HTMLDialogElement)) { throw new Error('invalid toast dialog') }

		const messageElem = toastElem.querySelector('[data-message]')
		messageElem.innerText = message

		toastElem.show()
	}

	/**
	 * @param {string|undefined} [databaseName]
	 * @param {string|undefined} [documentId]
	 */
	static setBreadcrumb(databaseName, documentId) {
		const breadcrumbOutputs = document.querySelectorAll('output[name="Breadcrumb"]')
		if(breadcrumbOutputs === null) { throw new Error('no breadcrumb outputs found') }

		for(const breadcrumbOutput of breadcrumbOutputs) {
			if(breadcrumbOutput === null || !(breadcrumbOutput instanceof HTMLOutputElement)) {
				console.warn()
				continue
			}

			if(databaseName === undefined) {
				breadcrumbOutput.value = ''
				continue
			}

			if(documentId === undefined) {
				breadcrumbOutput.value = `/${databaseName}`
				continue
			}

			breadcrumbOutput.value = `/${databaseName}/${documentId}`
		}
	}

	/**
	 * @param {string} navName
	 */
	static selectNavItem(navName) {
		const existingActiveNavElements = document.querySelectorAll('#MainNav li[data-active]')
		existingActiveNavElements.forEach(elem => elem.toggleAttribute('data-active', false))

		const liElem = document.querySelector(`#MainNav li[data-for-section="${navName}"]`)
		liElem?.toggleAttribute('data-active', true)
	}

	/**
	 * @param {string} sectionName
	 */
	static selectSection(sectionName) {
		const existingActiveSections = document.querySelectorAll('main section[data-active]')
		existingActiveSections.forEach(elem => elem.toggleAttribute('data-active', false))

		const sectionElem = document.querySelector(`main section[data-name="${sectionName}"]`)
		sectionElem?.toggleAttribute('data-active', true)
	}

	/**
	 * @param {Array<string>} databaseNames
	 */
	static insertDBListing(databaseNames) {
		const dbListingElement = document.getElementById('DBListing')
		if(dbListingElement === null) { throw new Error('missing DB listing') }

		const templateElement = dbListingElement.querySelector(':scope > template')
		if(templateElement === null) { throw new Error('missing db listing template') }
		if(!(templateElement instanceof HTMLTemplateElement)) { throw new Error('template is not a template') }

		const existingLis = dbListingElement.querySelectorAll('li')
		existingLis?.forEach(li => li.remove())

		dbListingElement.append(...databaseNames.map(databaseName => {
			const template = templateElement.content.cloneNode(true)
			if(!(template instanceof DocumentFragment)) { throw new Error('template clone is not doc fragment') }
			const li = template.querySelector('li')
			if(li === null) { throw new Error('li is not found in template') }

			li.dataset.databaseName = databaseName

			const aElem = li.querySelector('a')
			if(aElem !== null) {
				aElem.href = `#database/${databaseName}`
			}

			const nameOutput = li.querySelector('output[name="databaseName"]')
			if(nameOutput === null) { throw new Error('name output not found in li') }
			if(!(nameOutput instanceof HTMLOutputElement)) { throw new Error('output is not an output') }
			nameOutput.value = databaseName

			return li
		}))
	}

	/**
	 * @param {string} databaseName
	 * @param {DatabaseInfo} info
	 */
	static updateDBListingFor(databaseName, info) {
		const dbListingElement = document.getElementById('DBListing')
		if(dbListingElement === null) { throw new Error('missing DB listing') }

		const liElement = dbListingElement.querySelector(`li[data-database-name="${databaseName}"]`)
		if(liElement === null) { throw new Error('no db to update') }

		const sizeElem = liElement.querySelector('output[name="size"]')
		const countElem = liElement.querySelector('output[name="count"]')
		const digestElem = liElement.querySelector('output[name="digest"]')

		if(sizeElem === null || !(sizeElem instanceof HTMLOutputElement)) { throw new Error('invalid element') }
		if(countElem === null || !(countElem instanceof HTMLOutputElement)) { throw new Error('invalid element') }
		if(digestElem === null || !(digestElem instanceof HTMLOutputElement)) { throw new Error('invalid element') }

		const { size, total_count, digestAlgo } = info
		const sizeHuman = Math.round(size / 1024)

		sizeElem.value = `${sizeHuman} KB`
		countElem.value = `${total_count}`
		digestElem.value = `${digestAlgo}`
	}

	/**
	 *
	 */
	static clearDocuments() {
		const documentsListElem = document.getElementById('DocumentsList')
		if(documentsListElem === null || !(documentsListElem instanceof HTMLUListElement)) { throw new Error('missing doc list element') }

		const existingLis = documentsListElem.querySelectorAll('li')
		existingLis.forEach(li => li.remove())
	}

	/**
	 *
	 */
	static clearViewSelection() {
		const viewSelect = document.querySelector('select[name="ViewSelection"]')
		const existingOptions = viewSelect?.querySelectorAll('option')
		existingOptions?.forEach(o => o.remove())

		viewSelect.disabled = true
	}

	/**
	 * @param {Array<{ name: string }>} views
	 * @param {string|undefined} [current]
	 */
	static updateViewSelection(views, current) {
		const viewSelect = document.querySelector('select[name="ViewSelection"]')
		const existingOptions = viewSelect?.querySelectorAll('option')
		existingOptions?.forEach(o => o.remove())

		for(const { name } of views) {
			const option = document.createElement('option')
			option.value = name
			option.innerText = name
			if(name === current) {
				option.selected = true
			}
			viewSelect?.append(option)
		}

		viewSelect.disabled = false
	}

	/**
	 * @param {string} databaseName
	 * @param {Array<{ id: string, key: string, value: string }>} documentsList
	 */
	static insertDocuments(databaseName, documentsList) {
		const documentsListElem = document.getElementById('DocumentsList')
		if(documentsListElem === null || !(documentsListElem instanceof HTMLUListElement)) { throw new Error('missing doc list element') }

		const templateElement = documentsListElem.querySelector(':scope > template')
		if(templateElement === null || !(templateElement instanceof HTMLTemplateElement)) { throw new Error('missing template for document row') }

		for(const doc of documentsList) {
			const template = templateElement.content.cloneNode(true)
			if(!(template instanceof DocumentFragment)) { throw new Error('template clone is not doc fragment') }
			const li = template.querySelector('li')
			if(li === null) { throw new Error('failed to find li in template') }

			li.dataset.documentId = doc.id

			const aElem = li.querySelector('a')
			if(aElem !== null) {
				aElem.href = `#database/${databaseName}/${doc.id}`
			}

			const docIdOutputElement = li.querySelector('output[name="DocumentId"]')
			if(docIdOutputElement === null) { throw new Error('invalid document id output') }
			if(!(docIdOutputElement instanceof HTMLOutputElement)) { throw new Error('invalid document id output') }

			docIdOutputElement.value = `${doc.id}`

			const viewKeyElement = li.querySelector('output[name="ViewKey"]')
			if(viewKeyElement === null) { throw new Error('invalid view key output') }
			if(!(viewKeyElement instanceof HTMLOutputElement)) { throw new Error('invalid view key output') }

			const docKey = (typeof doc.key === 'object') ? JSON.stringify(doc.key) : doc.key
			viewKeyElement.value = docKey

			const viewValueElement = li.querySelector('output[name="ViewValue"]')
			if(viewValueElement === null) { throw new Error('invalid view value output') }
			if(!(viewValueElement instanceof HTMLOutputElement)) { throw new Error('invalid view value output') }

			const docValue = (typeof doc.value === 'object') ? JSON.stringify(doc.value) : doc.value
			viewValueElement.value = docValue


			documentsListElem.append(li)
		}
	}

	/**
	 * @param {Record<string, any>} doc
	 */
	static insertDocument(doc) {
		const jsonEditor = document.getElementById('JSONEditor')
		if(jsonEditor === null) { throw new Error('failed to find json editor') }
		if(!(jsonEditor instanceof HTMLCanvasElement)) { throw new Error('json editor not a canvas')}
		const ok = JSONEditor.bind(jsonEditor, JSON.stringify(doc, undefined, '\t'))

		const docContainerElem = document.getElementById('DocumentContainer')
		if(ok) {
			docContainerElem?.toggleAttribute('data-fallback', false)
		}
		else {
			// fallback to view only
			docContainerElem?.toggleAttribute('data-fallback', true)
			const outputElem = document.querySelector('output[name="documentView"]')
			outputElem.innerHTML = '\n' + JSON.stringify(doc, undefined, 3).trim()

		}
	}

	static retrieveDocument() {
		const jsonEditor = document.getElementById('JSONEditor')
		if(jsonEditor === null) { throw new Error('failed to find json editor') }
		if(!(jsonEditor instanceof HTMLCanvasElement)) { throw new Error('json editor not a canvas')}

		// todo: handle fallback


		return jsonEditor.editContext.text
	}
}