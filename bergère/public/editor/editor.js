import { render as renderBase, canvasToSelectionPosition } from './render.js'

/** @import { CharCacheItem } from './render.js'*/

let renderId = 0

export class JSONEditor {

	/** @param {HTMLCanvasElement} elm  */
	static bind(elm, initialText = '{}') {
		if(!('EditContext' in window)) { return false }
		if(elm.editContext !== null) {
			console.log('editor has existing context', elm.editContext)
			elm.editContext.updateText(0, elm.editContext.text.length, initialText)
			elm.editContext.updateSelection(0, 0)
			return true
		}


		const editContext = new EditContext({ text: initialText })
		elm.editContext = editContext

		/** @type {Array<CharCacheItem>} */
		let localCharCache = []

		/** @type {CanvasRenderingContext2D|null} */
		const ctx = elm.getContext('2d')
		if(ctx === null) { throw new Error('null canvas') }

		const computedStyle = window.getComputedStyle(elm)


		const rid = renderId
		renderId += 1

		/** @type { (text: string, start: number, end: number) => void} */
		const render = (text, start, end) => {
			console.log('render', rid)
			const { dirty, charCache } = renderBase(elm, computedStyle, ctx, text, start, end)
			localCharCache = charCache
			if(dirty) {
				updateControlBounds()
			}
		}

		function updateControlBounds() {
			console.log('update control bounds')
			const editorBounds = elm.getBoundingClientRect()
			editContext.updateControlBounds(editorBounds)

			render(editContext.text, editContext.selectionStart, editContext.selectionEnd)
		}

		window.addEventListener('resize', updateControlBounds)

		editContext.addEventListener('textupdate', event => {
			console.log('text update')
			render(editContext.text, event.selectionStart, event.selectionEnd)
		})

		editContext.addEventListener('textformatupdate', event => {
			const formats = event.getTextFormats()
			console.log('text formate update', formats)
		})

		editContext.addEventListener('characterboundsupdate', event => {
			console.log('char bounds update')
			console.log(event.rangeStart, event.rangeEnd)
			// editContext.updateCharacterBounds(e.rangeStart, charBounds)
		})

		document.addEventListener("selectionchange", () => {
    	const selection = document.getSelection()
			console.log('selection change', selection)
		})

		elm.addEventListener('keydown', event => {
			// magic IME code
			if (event.keyCode === 229) { return }

			console.log('key event', event)

			const start = editContext.selectionStart //Math.min(editContext.selectionStart, editContext.selectionEnd)
    	const end = editContext.selectionEnd //Math.max(editContext.selectionStart, editContext.selectionEnd)

			if(event.key === 'Escape') {
				editContext.updateSelection(end, end)
				render(editContext.text, editContext.selectionStart, editContext.selectionEnd)
			}
			else if(event.key === 'Home') {}
			else if(event.key === 'End') {}
			else if(event.key === 'PageUp') {}
			else if(event.key === 'PageDown') {}
			else if(event.key === 'ArrowLeft') {
				// console.log('go left')
				// console.log({ alt: e.altKey, ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey })
				// alt - jump token
				// shift select
				// meta - jump line start

				if(event.shiftKey) {
					const newPosition = Math.max(end - 1, 0)
					editContext.updateSelection(start, newPosition)
				}
				else {
					const newPosition = Math.max(start - 1, 0)
					editContext.updateSelection(newPosition, newPosition)
				}

				render(editContext.text, editContext.selectionStart, editContext.selectionEnd)
			}
			else if(event.key === 'ArrowRight') {
				if(event.shiftKey) {
					const newPosition = Math.min(end + 1, editContext.text.length)
					editContext.updateSelection(start, newPosition)
				}
				else {
					const newPosition = Math.min(end + 1, editContext.text.length)
					editContext.updateSelection(newPosition, newPosition)
				}

				render(editContext.text, editContext.selectionStart, editContext.selectionEnd)
			}
			else if(event.key === 'ArrowUp') {
				const item = localCharCache[editContext.selectionEnd]
				if(item.lineNumber === 1) { return }



			}
			else if(event.key === 'ArrowDown') {

			}
			else if(event.key === 'Tab') {
				event.preventDefault()
				editContext.updateText(start, end, '\t')
				editContext.updateSelection(start + 1, end + 1)

				render(editContext.text, editContext.selectionStart, editContext.selectionEnd)
			}
			else if(event.key === 'Enter') {
				event.preventDefault()
				editContext.updateText(start, end, '\n')
      	editContext.updateSelection(start + 1, end + 1)

				render(editContext.text, editContext.selectionStart, editContext.selectionEnd)
			}
		})

		elm.addEventListener('click', event => {
			// console.log('click', e.offsetX, e.offsetY)
			const result = canvasToSelectionPosition(localCharCache, event.offsetX, event.offsetY)
			if(result === undefined) { return }

			editContext.updateSelection(result.start, result.end)
			render(editContext.text, editContext.selectionStart, editContext.selectionEnd)
		})

		elm.addEventListener('dblclick', event => {

		})

		elm.addEventListener('cut', event => {
			console.log('Cut')

		})
		elm.addEventListener('copy', event => {
			console.log('Copy')
		})
		elm.addEventListener('paste', event => {
			console.log('Paste')
		})

		// kick off first render
		updateControlBounds()
		render(editContext.text, editContext.selectionStart, editContext.selectionEnd)

		return true
	}
}
