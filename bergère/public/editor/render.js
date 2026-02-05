import { JSONTokenizer, TOKEN_WHITESPACE } from '@johntalton/json-tokenizer'

/**
 * @param {number} start
 * @param {number} end
 * @param {number} [step=1]
 */
export function* range(start, end, step = 1) {
	for(let i = start; i <= end; i += step) {
		yield i
	}
}
Iterator.range = range

/** @import { Token } from '@johntalton/json-tokenizer'*/

/**
 * @typedef {Object} CharCacheItem
 * @property {number} index
 * @property {number} lineNumber
 * @property {DOMRect} rect
 */
/**
 * @typedef {Object} Context
 * @property {HTMLCanvasElement} canvas
 * @property {CanvasRenderingContext2D} ctx
 * @property {Token} token
 * @property {boolean} showWhitespace
 * @property {number} lineHeight
 *
 * @property {number} lineNumber
 * @property {number} offsetX
 * @property {number} lineY
 *
 * @property {Array<CharCacheItem>} charCache
 * @property {number} index
 *
 * @property {boolean} debug
 */

/**
 * @typedef {Object} RenderResult
 * @property {Array<CharCacheItem>} charCache
 * @property {boolean} dirty
 */

const COLOR_MAP = new Map([
	[ 'null', 'oklab(0.52 -0.02 -0.05)'],
	[ 'true', 'oklab(0.52 -0.02 -0.05)'],
	[ 'false', 'oklab(0.52 -0.02 -0.05)'],
	[ 'number', 'oklab(0.82 -0.04 0.04)'],

	[ 'array-open', 'oklab(0.89 -0.02 0.18)' ],
	[ 'array-close', 'oklab(0.89 -0.02 0.18)' ],
	[ 'array-close-immediate', 'oklab(0.89 -0.02 0.18)' ],
	[ 'array-element-comma', 'white' ],

	[ 'object-open', 'yellow' ],
	[ 'object-close', 'yellow' ],
	[ 'object-close-immediate', 'yellow' ],
	[ 'object-member-comma', 'white' ],
	[ 'open-key-quote', 'lightblue' ],
	[ 'close-key-quote', 'lightblue' ],
	[ 'key', 'oklab(0.86 -0.05 -0.06)' ],
	[ 'colon', 'white' ],

	[ 'open-string-quote', 'orange'],
	[ 'string', 'oklab(0.71 0.06 0.06)' ],
	[ 'close-string-quote', 'orange' ],

	[ 'whitespace', 'rgb(from white r g b / 20%)' ],
	[ 'error', 'red' ],
	[ 'eof', '' ],
])

const FALLBACK_COLOR = 'black'

const PADDING_RIGHT = 20
const PADDING_LEFT = 50
const LINE_SPACING = 0
const TAB_WIDTH_MULTIPLIER = 2

const FONT_SIZE_STR = '1.25em'
const FONT_FACE = 'DMMono, ui-monospace, monospace'
const FONT_DEFINITION = `${FONT_SIZE_STR} ${FONT_FACE}`

const WHITESPACE_TAB_REPLACEMENT_CHAR = '➡'
const WHITESPACE_SPACE_REPLACEMENT_CHAR = '·'

const GUTTER_WIDTH = PADDING_LEFT - 10
const GUTTER_FONT = '.75em system-ui'


/**
 * @param {Array<CharCacheItem>} charCache
 * @param {number} x
 * @param {number} y
 */
export function canvasToSelectionPosition(charCache, x, y) {
	for(const item of charCache) {
		if((x > item.rect.x) &&
		(x < (item.rect.x + item.rect.width)) &&
		(y > item.rect.y) &&
		(y < (item.rect.y + item.rect.height))) {
			return {
				start: item.index,
				end: item.index
			}
		}
	}

	return undefined
}

/**
 * @param {CSSStyleDeclaration} computedStyle
 */
function refreshColorMap(computedStyle) {
	for(const key of COLOR_MAP.keys()) {
		const style = computedStyle.getPropertyValue(`--editor-${key}`)
		if(style === undefined || style === '') { continue }
		COLOR_MAP.set(key, style)
	}
}

/**
 * @param {Context} context
 * @param {number} selectionStart
 * @param {number} selectionEnd
 */
function renderGutter(context, selectionStart, selectionEnd) {
	const selectionInfoEnd = context.charCache[selectionEnd]

	context.ctx.save()

	context.ctx.strokeStyle = 'grey'
	context.ctx.moveTo(GUTTER_WIDTH, 0)
	context.ctx.lineTo(GUTTER_WIDTH, context.canvas.height)
	context.ctx.stroke()

	const x = GUTTER_WIDTH / 2

	context.ctx.textAlign = 'center'
	context.ctx.font = GUTTER_FONT

	for(const lineNum of Iterator.range(0, context.lineNumber)) {
		const y = lineNum * context.lineHeight
		const active = selectionInfoEnd.lineNumber === lineNum

		context.ctx.fillStyle = active ? 'black' : 'lightgray'
		context.ctx.fillText(lineNum, x, y)
	}

	context.ctx.restore()
}

/**
 * @param {Context} context
 * @param {string} tokenSegment
 * @param {number} selectionStart
 * @param {number} selectionEnd
 */
function renderTokenSegment(context, tokenSegment, selectionStart, selectionEnd) {
	const tokenSegmentReplacedTabs = tokenSegment.replaceAll('\t', Array.from({ length: TAB_WIDTH_MULTIPLIER }, v => ' ').join(''))
	const measure = context.ctx.measureText(tokenSegmentReplacedTabs)

	let lineAccumulator = ''
	let lineMeasurement = context.ctx.measureText(lineAccumulator)
	let segmentWidth = measure.width
	let characterOffset = 0

	for(const character of tokenSegment) {
		const measureChar = context.ctx.measureText(character)
		const characterHeight = measureChar.fontBoundingBoxAscent + measureChar.fontBoundingBoxDescent

		if(context.token.type === TOKEN_WHITESPACE) {
			context.ctx.fillStyle = COLOR_MAP.get(context.token.type) ?? FALLBACK_COLOR

			if(character === ' ') {
				if(context.showWhitespace) {
					context.ctx.fillText(WHITESPACE_SPACE_REPLACEMENT_CHAR, context.offsetX + characterOffset, context.lineY)
				}

				context.charCache[context.index] = {
					index: context.index,
					lineNumber: context.lineNumber,
					rect: DOMRect.fromRect({
						x: context.offsetX + characterOffset,
						y: context.lineY - measureChar.fontBoundingBoxAscent,
						width: measureChar.width,
						height: characterHeight
					})
				}
				context.index += 1

				characterOffset += measureChar.width
			}
			else if(character === '\t') {
				const measureSpace = context.ctx.measureText(' ')

				if(context.showWhitespace) {
					context.ctx.fillText(WHITESPACE_TAB_REPLACEMENT_CHAR, context.offsetX + characterOffset, context.lineY)
				}

				if(context.debug) {
					context.ctx.fillStyle = 'grey'
					context.ctx.fillRect(context.offsetX + characterOffset + 1, context.lineY - measureChar.fontBoundingBoxAscent, (measureSpace.width * TAB_WIDTH_MULTIPLIER) , 10)
				}

				context.charCache[context.index] = {
					index: context.index,
					lineNumber: context.lineNumber,
					rect: DOMRect.fromRect({
						x: context.offsetX + characterOffset,
						y: context.lineY - measureChar.fontBoundingBoxAscent,
						width: (measureSpace.width * TAB_WIDTH_MULTIPLIER),
						height: characterHeight
					})
				}
				context.index += 1

				characterOffset += (measureSpace.width * TAB_WIDTH_MULTIPLIER)
			}
			else if(character === '\n') {
				context.charCache[context.index] = {
					index: context.index,
					lineNumber: context.lineNumber,
					rect: DOMRect.fromRect({
						x: context.offsetX + characterOffset,
						y: context.lineY - measureChar.fontBoundingBoxAscent,
						width: Infinity, // measureChar.width,
						height: characterHeight
					})
				}
				context.index += 1

				characterOffset += 0 //measureChar.width
			}
			else {
				//
				console.error('unhandled whitespace char')
			}

			// lineAccumulator += character
		}
		else {
			lineMeasurement = context.ctx.measureText(lineAccumulator)
			const start = lineMeasurement.width

			lineAccumulator += character
			lineMeasurement = context.ctx.measureText(lineAccumulator)

			const end = lineMeasurement.width

			const lineHeight = lineMeasurement.fontBoundingBoxAscent + lineMeasurement.fontBoundingBoxDescent

			if(context.debug) {
				context.ctx.fillStyle = 'rgb(from yellow r g b / 10%)'
				context.ctx.fillRect(context.offsetX + start, context.lineY - lineMeasurement.fontBoundingBoxAscent, end - start, lineHeight)
			}

			context.charCache[context.index] = {
				index: context.index,
				lineNumber: context.lineNumber,
				rect: DOMRect.fromRect({
					x: context.offsetX + start,
					y: context.lineY - lineMeasurement.fontBoundingBoxAscent,
					width: end - start,
					height: lineHeight
				})
			}

			context.index += 1
		}
	}

	if(context.token.type === 'whitespace') {

	}
	else {
		context.ctx.fillStyle = COLOR_MAP.get(context.token.type) ?? FALLBACK_COLOR
		context.ctx.fillText(tokenSegment, context.offsetX, context.lineY)
	}


	if(context.debug) {
		context.ctx.strokeStyle = 'rgb(from red r g b / 25%)'
		context.ctx.strokeRect(context.offsetX, context.lineY - measure.fontBoundingBoxAscent, segmentWidth, measure.fontBoundingBoxAscent)
		context.ctx.strokeStyle = 'rgb(from orange r g b / 25%)'
		context.ctx.strokeRect(context.offsetX, context.lineY, segmentWidth, measure.fontBoundingBoxDescent)
	}

	context.offsetX += segmentWidth
}

/**
 * @param {HTMLCanvasElement} elem
 * @param {CSSStyleDeclaration} computedStyle
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} selectionStart
 * @param {number} selectionEnd
 *
 * @returns {RenderResult}
 */
export function render(elem, computedStyle, ctx, text, selectionStart, selectionEnd) {
	if(ctx === null) { return { dirty: false, charCache: [] } }

	refreshColorMap(computedStyle)

	const tokens = JSONTokenizer.tokenize(text)

	let dirty = false

	const measureM = ctx.measureText('M')
	const heightM = measureM.fontBoundingBoxAscent + measureM.fontBoundingBoxDescent + LINE_SPACING

	/** @type {Context} */
	const context = {
		canvas: elem,
		ctx,
		token: undefined,
		offsetX: PADDING_LEFT,
		lineY: heightM,
		lineHeight: heightM,
		showWhitespace: true,
		debug: false,
		charCache: [],
		index: 0,
		lineNumber: 1,
		nextSegmentIndex: 0
	}

	if(elem.height < context.lineY) {
		elem.height = 2 * context.lineY
		dirty = true
	}

	let maxHeight = elem.height
	let maxWidth = elem.width

	ctx.font = FONT_DEFINITION
	ctx.clearRect(0, 0, elem.width, elem.height)

	for(const token of tokens) {
		context.token = token
		const tokenSegments = token.value.split(/(\n)/)

		for(const tokenSegment of tokenSegments) {
			if(tokenSegment === '') { continue }
			renderTokenSegment(context, tokenSegment, selectionStart, selectionEnd)


			maxWidth = Math.max(maxWidth, context.offsetX)
			maxHeight = Math.max(maxHeight, context.lineY)

			if(tokenSegment === '\n') {
				context.lineNumber += 1
				context.lineY += context.lineHeight
				context.offsetX = PADDING_LEFT
			}
		}
	}


	// context.charCache.forEach((charCacheItem, index) => {
	// 	// console.log(charCacheItem, index)
	// 	const rect = charCacheItem.rect

	// 	ctx.strokeStyle = 'red'
	// 	ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
	// })



	const selectionInfoStart = context.charCache[selectionStart]
	const selectionInfoEnd = context.charCache[selectionEnd]

	// draw cursor
	ctx.fillStyle = 'grey'
	ctx.fillRect(selectionInfoEnd.rect.x, selectionInfoEnd.rect.y, 3, selectionInfoEnd.rect.height)

	// selection box
	ctx.fillStyle = 'rgb(from black r g b / 10%)'
	ctx.fillRect(selectionInfoStart.rect.x, selectionInfoStart.rect.y, selectionInfoEnd.rect.x - selectionInfoStart.rect.x, selectionInfoEnd.rect.height)

	// select line
	ctx.strokeStyle = 'lightgrey'
	ctx.strokeRect(PADDING_LEFT - 10, selectionInfoStart.rect.y, context.canvas.width, context.lineHeight)


	//
	renderGutter(context, selectionStart, selectionEnd)


	//
	maxWidth = Math.max(maxWidth, elem.parentElement?.clientWidth - 25)

	if(maxWidth > elem.width) {
		elem.width = maxWidth + PADDING_RIGHT
		ctx.font = FONT_DEFINITION
		dirty = true
	}

	if(elem.height < maxHeight) {
		elem.height = maxHeight + measureM.fontBoundingBoxDescent
		ctx.font = FONT_DEFINITION
		dirty = true
	}

	if(dirty) {
		requestAnimationFrame(() => render(elem, computedStyle, ctx, text, selectionStart, selectionEnd))
	}

	return {
		charCache: context.charCache,
		dirty
	}
}