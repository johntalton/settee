import { H2CoreServer } from '@johntalton/http-core'

import config from './config.json' with { type: 'json' }
import { route } from './route.js'
import { ROUTES } from './routes/index.js'

/** @import { Router, Config } from '@johntalton/http-core' */
/** @import { DigestAlgorithm } from '@johntalton/settee' */

/**
 * @typedef {Object} CanapeConfigDatabaseItem
 * @property {string} name
 * @property {string} db
 * @property {string} [documentDir]
 * @property {string} [viewDir]
 * @property {DigestAlgorithm} [digestAlgo]
 * @property {number} [timeoutMs]
 */

/**
 * @typedef {Object} CanapeConfigBase
 * @property {Array<CanapeConfigDatabaseItem>} dbs
 */

/** @typedef {Config & CanapeConfigBase} CanapeConfig */

const IPV6_ONLY = process.env['CANAPE_IPV6_ONLY'] === 'true'
const HOST = process.env['CANAPE_HOST'] ?? ''
const PORT = Number.parseInt(process.env['CANAPE_PORT'] ?? '6095')
const CREDENTIALS_HOST = (process.env['CANAPE_CREDENTIALS'] ?? '').split(',').map(c => c.trim()).filter(c => c.length > 0)
const SERVER_NAME = process.env['CANAPE_SERVER_NAME']

const ALLOWED_ORIGINS = (process.env['ALLOWED_ORIGINS'] ?? '').split(',').map(s => s.trim()).filter(s => s.length > 0)
const ALLOW_TRACE = process.env['ALLOW_TRACE'] === 'true'


/** @type {Router<CanapeConfig>} */
const router = state => route(ROUTES, state)

const server = new H2CoreServer(router, config, {
  ipv6Only: IPV6_ONLY,
  host: HOST,
  port: PORT,
  credentials: CREDENTIALS_HOST,
  serverName: SERVER_NAME,
  allowedOrigins: ALLOWED_ORIGINS,
  allowTrace: ALLOW_TRACE
})

server.listen()

// 'SIGTERM', 'SIGKILL' 'SIGHUP
process.on('SIGINT', () => {
	if(server.closed) { process.exit() }
	server.close()
})
