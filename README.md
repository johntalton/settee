# 🛋️ Settee DB<sup>*</sup>

An attempt to baseline the most naïve implementation of a NoSQL JSON document store inspired by other furniture based solutions.

<sub>* and by DB, we mean not-at-all a DB</sub>

## Concept

Settee store documents as raw JSON under individually named files by `id`. with the addition of `"settee:id"` and `"settee:revision"` properties.

All function operate directly on the File System (FS) via standard OS calls, allowing for other tools to operate on the data (tools like `grep` or `jq` etc).

Crafting `id` values is left up to the caller and no internal concept exists.

Versioning is handled via the `revision` tag which is passed to any function which need to modify the data (a `base64` encoded `SHA-1` of the data).

## Overview

This package exports a singular static class `Settee`.

A set of standard `Promise` based functions can be found: `get`, `set`, `update`, `delete`, `has`, `isModified`.

Each function takes a mix of `id`, `revision`, `document` and an `options`

The `options` object allow customization of the directory/file storage location (per function), as well as `timeoutMs` and `signal` (The timeout signal will always be applied regardless of user supplied `signal`, though not all function support signaling).

If `options` are not specified, `process.env` values are used as a fallback.


## Example


```js
import { Settee } from '@johntalton/settee'

// override default and process.env values
const options = {
  db: 'data/example',
  timeoutMs: 10,
}

// some id we choose
const id = crypto.randomUUID()

//
const has = await Settee.has(id, options) // false

// create a new document
const doc = await Settee.set(id, {
  type: 'example.v1',
  name: 'fav-colors',
  color: [ 'red', 'yellow', 'orange' ]
}, options)

// cache of the assigned revision for later
const revision = doc['settee:revision']

// check if the file has been modified (aka revision match)
const modified = await Settee.isModified(
  id,
  revision,
  options)

// cleanup
await Settee.delete(id, revision, options)
```

## Map

Mapping currently exists as a full scan via the `map` function.

The callback map function should return `Array<[ key, value ]>` or `undefined`.

The map function can take in a `string|Array<string>|undefined` as a key Filter to be performed during the map.

```js
const result = await Settee.map(function (doc)  {
  if(doc.type !== 'example.v1') { return }

  const colors = doc.colors ?? []
  return colors.map(color => [ color, 1 ])
})
/*
{
  rows: [
    { key: 'yellow', value: 1, settee:id: ... },
    { key: 'green', value: 1, settee:id: ... },
    // ...
  ]
}
*/
```