export const SETTEE_ENV = {
	DB_ROOT: 'SETTEE_DB',
	DOCUMENTS_DIRECTORY: 'SETTEE_DOCS_DIR',
	VIEWS_DIRECTORY: 'SETTEE_VIEWS_DIR',
	TIMEOUT_MS: 'SETTEE_TIMEOUT_MS',
	DIGEST_ALGO: 'SETTEE_DIGEST_ALGORITHM',
	NEW_DATABASE_ROOT: 'SETTEE_NEW_DB'
}

export const SETTEE_DEFAULT = {
	RESOLVE_PREFIX: '.',
	DB: 'db',
	DOCS: 'docs',
	VIEWS: 'views',

	DIGEST_ALGO: 'SHA-1',
	TIMEOUT_MS: '100',

	/** @type {BufferEncoding} */
	FILE_ENCODING: 'utf-8',

	FILE_EXTENSION: 'json',
	VIEW_EXTENSION: 'js',

	IGNORE_PREFIX: '.'
}

export const FILE_FLAGS = {
	DOC_GET: 'r',
	DOC_SET: 'ax',
	DOC_UPDATE: 'w',
	MAP_PROCESS: 'r'
}
export const FILE_MODE = 0o600


export const SETTEE_INTERNAL_PROPERTIES = /** @type {const} */ ({
	ID: 'settee:id',
	REVISION: 'settee:revision'
})

/** @type {''} */
export const EMPTY_STRING = ''
