import http2 from 'node:http2'

import { DocumentRoute } from './document.js'
import { ViewRoute } from './view.js'
import { SSERoute } from './sse.js'
import { InfoRoute } from './info.js'

const {
	HTTP2_METHOD_GET,
	HTTP2_METHOD_HEAD,
	HTTP2_METHOD_POST
} = http2.constants

const INFO_PATH = new URLPattern({ pathname: '/' })
const DB_PATH = new URLPattern({ pathname: '/:db' })
const DOCUMENT_PATH = new URLPattern({ pathname: '/:db/:id([_\\-:!a-zA-Z\\d]+(?<!sse|view))' })
const VIEW_PATH = new URLPattern({ pathname: '/:db/view/:view' })
const SSE_PATH = new URLPattern({ pathname: '/:db/sse' })

export const ROUTES = [
	{
		pattern: VIEW_PATH,
		methods: {
			[HTTP2_METHOD_GET]: ViewRoute.get
		}
	},
	{
		pattern: DOCUMENT_PATH,
		methods: {
			[HTTP2_METHOD_GET]: DocumentRoute.get,
			[HTTP2_METHOD_HEAD]: DocumentRoute.head
		}
	},
	{
		pattern: DB_PATH,
		methods: {
			[HTTP2_METHOD_POST]: DocumentRoute.post,
			[HTTP2_METHOD_GET]: InfoRoute.getDB
		}
	},
	{
		pattern: SSE_PATH,
		methods: {
			[HTTP2_METHOD_GET]: SSERoute.get
		}
	},
	{
		pattern: INFO_PATH,
		methods: {
			[HTTP2_METHOD_GET]: InfoRoute.getRoot
		}
	}
]
