import http2 from 'node:http2'

import { HTTP_METHOD_QUERY }  from '@johntalton/http-util/response'

import { DatabaseRoute } from './database.js'
import { DocumentRoute } from './document.js'
import { InfoRoute } from './info.js'
import { SSERoute } from './sse.js'
import { ViewRoute } from './view.js'

const {
	HTTP2_METHOD_GET,
	HTTP2_METHOD_HEAD,
	HTTP2_METHOD_POST,
	// HTTP2_METHOD_PUT
} = http2.constants

/** @import { Routes } from '../route.js' */
/** @import { CanapeConfig } from '../index.js' */

const INFO_PATH = new URLPattern({ pathname: '/' })
const DB_PATH = new URLPattern({ pathname: '/:db' })
// biome-ignore lint/security/noSecrets: Regex is complex sometimes
const DOCUMENT_PATH = new URLPattern({ pathname: '/:db/:id([_\\-:!a-zA-Z\\d]+(?<!sse|view))' })
const VIEW_INFO = new URLPattern({ pathname: '/:db/view' })
const VIEW_PATH = new URLPattern({ pathname: '/:db/view/:view' })
const SSE_PATH = new URLPattern({ pathname: '/:db/sse' })

/** @type {Routes<CanapeConfig>} */
export const ROUTES = [
	{
		pattern: VIEW_INFO,
		methods: {
			[HTTP2_METHOD_GET]: InfoRoute.getView
		}
	},
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
			[HTTP2_METHOD_HEAD]: DocumentRoute.head,
			[HTTP2_METHOD_POST]: DocumentRoute.post,
		}
	},
	{
		pattern: DB_PATH,
		methods: {
			[HTTP2_METHOD_POST]: DatabaseRoute.create,
			[HTTP2_METHOD_GET]: InfoRoute.getDB,
			[HTTP_METHOD_QUERY]: DatabaseRoute.query
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
