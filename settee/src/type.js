
/** @import { SETTEE_INTERNAL_PROPERTIES } from './defs.js' */
/** @import { webcrypto } from 'node:crypto' */

/** @typedef {string & { readonly _brand: 'id' }} DocId */
/** @typedef {string & { readonly _brand: 'rev' }} RevisionId */

/** @typedef {'SHA-1'|'SHA-256'|'SHA-384'|'SHA-512'} KnownDigestAlgorithm */
/** @typedef {webcrypto.Algorithm|KnownDigestAlgorithm|string} DigestAlgorithm */

/**
 * @typedef {Object} SetteeOptionsResolved
 * @property {string} documentsRoot
 * @property {string} viewsRoot
 * @property {AbortSignal} signal
 * @property {DigestAlgorithm} digestAlgo
*/

/**
 * @typedef {Object} SetteeConstructionOptions
 * @property {string} db
 * @property {string} documentsDir
 * @property {string} viewsDir
 * @property {number} timeoutMs
 * @property {AbortSignal|undefined} [internal_signal] Overrides signal usage and creation
 */

/** @typedef {Partial<SetteeOptionsResolved> & Partial<SetteeConstructionOptions>} SetteeOptions */

/** @typedef {Record<string, any>} UserDocument */

/** @typedef {{ [SETTEE_INTERNAL_PROPERTIES.ID]: DocId,  [SETTEE_INTERNAL_PROPERTIES.REVISION]: RevisionId }} DocumentBase */
/**
 * @template {UserDocument} T
 * @typedef {DocumentBase & T } Document
 */

/**
 * @template K, V
 * @typedef {Array<[ K, V ]>|Iterable<[ K, V ]>} ViewFunctionResult
*/

/**
 * @template K, V
 * @typedef {Object} ViewFunctionRowResultItem
 * @property {DocId} id
 * @property {K} key
 * @property {V} value
 */

/**
 * @template K, V
 * @typedef {Object} ViewFunctionRowResult
 * @property {number} total_count
 * @property {Array<ViewFunctionRowResultItem<K, V>>} rows
 */

/**
 * @template {UserDocument} D, K, V
 * @typedef {(doc: Document<D>) => ViewFunctionResult<K, V>|undefined} ViewFunction
 */

export {}
