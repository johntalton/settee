import {
	SEC_FETCH_DEST_EMBED,
	SEC_FETCH_DEST_EMPTY,
	SEC_FETCH_DEST_IFRAME,
	SEC_FETCH_DEST_OBJECT,
	SEC_FETCH_MODE_CORS,
	SEC_FETCH_MODE_NAVIGATE,
	// SEC_FETCH_MODE_SAME_ORIGIN,
	// SEC_FETCH_SITE_CROSS_SITE,
	SEC_FETCH_SITE_NONE,
	SEC_FETCH_SITE_SAME_ORIGIN,
	SEC_FETCH_SITE_SAME_SITE,
} from '@johntalton/http-util/headers'

/** @import { SecFetchMetadata } from '@johntalton/http-core' */
/** @import { SecFetchDest } from '@johntalton/http-util/headers' */

/**
 * @typedef {Object} SecFetchPolicy Resource Isolation Policy {@link https://web.dev/articles/fetch-metadata}
 * @property {string|undefined} [method]
 * @property {boolean|undefined} [allowUnsupported]
 * @property {boolean|undefined} [allowSubdomains]
 * @property {boolean|undefined} [allowDirect]
 * @property {Array<SecFetchDest>|undefined} [supportedDestination]
 * @property {boolean|undefined} [allowCORSBypass]
 */

export const RESTRICTED_DEST = [
	SEC_FETCH_DEST_EMBED,
	SEC_FETCH_DEST_OBJECT,
	SEC_FETCH_DEST_IFRAME
]

/**
 * @param {SecFetchMetadata} secFetchMetadata
 * @param {SecFetchPolicy} resourceIsolationPolicy
 * @returns {boolean}
 */
export function matchSecFetchPolicy(secFetchMetadata, resourceIsolationPolicy) {
	const { site, mode, dest } = secFetchMetadata
	const {
		method,
		allowUnsupported,
		allowSubdomains,
		allowDirect,
		supportedDestination,
		// allowCORSBypass
	} = resourceIsolationPolicy

	const supportedDest = supportedDestination ?? [ SEC_FETCH_DEST_EMPTY ]
	if(dest !== undefined && !supportedDest.includes(dest)) { return false }

	if (site === undefined) { return allowUnsupported ?? false }

	if (site === SEC_FETCH_SITE_SAME_ORIGIN) { return true }
	if (site === SEC_FETCH_SITE_SAME_SITE) { return allowSubdomains ?? false }
	if (site === SEC_FETCH_SITE_NONE) { return allowDirect ?? false }

	if(mode === SEC_FETCH_MODE_CORS) {
		// if in AllowedOrigins return true
		// return allowCORSBypass
		return false
	}

	if (mode === SEC_FETCH_MODE_NAVIGATE && method === 'GET') {
		if(dest === undefined) { return true }
		if(RESTRICTED_DEST.includes(dest)) { return false }
		return true
	}

	// cross-site
	return false
}