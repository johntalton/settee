# Settee

A set of Library, Service and UI to expose and support a Document Store.

- [Settee](#settee-library) - Embeddable Library
- [Canapé](#canapé-service) - RESTfull Service API
- [Bergère](#ui) - Web base UI

## Settee Library

A naïve implementation of a Document DB using file-per-document layout stored as JSON [see](./settee/README.md).

```js
import { Settee } from '@johntalton/settee'

const id = crypto.randomUUID()
if(!isValidDocId(id)) { return }

const doc = await Settee.set(id, {
  name: 'frank',
  type: 'user.v1',
  colors: [ 'pink', 'green', 'blue' ]
}, {
  db: 'store/users',
  signal: AbortSignal.timeout(100)
})
```

### Armoire

Extension to core library to provide a multi-threaded (`Worker`) bases `map` function for loading and running `Views`.

```js
// ./store/users/views/users_by_color.js
export default function usersByColor(document) {
  const { name, colors, type } = document
  if(type !== 'user.v1') { return }

  return colors.map(color => [ color, name ])
}
```
```js
// ./application.js
import { Armoire } from '@johntalton/settee'

const results = await Armoire.map('users_by_color',
  [ 'pink' ], {
    db: 'store/users',
    signal: AbortSignal.timeout(1_000 * 5)
  })
```

### Chifforobe

Extension to core library to aid in storing, retrieving and modifying results of 'map` function to reduce overhead.

## Canapé Service

A simplified HTTP/2 RESTfull API for interacting with a single Settee instance.


```bash
GET https://${hostname}:6095/${db}/${documentId}
```

```bash
GET https://${hostname}:6095/${db}/view/${viewName}
```

## Bergère UI

Interface over top of service API to interact with data, configuration and views.