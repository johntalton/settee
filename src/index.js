import { Settee } from '@johntalton/settee'


async function main() {
	console.log('Settee')

	const ok = await Settee.set('42', {
		name: 'test',
		colors: [ 'red', 'green', 'blue' ]
	})

	if(!ok) {
		throw new Error('not ok')
	}

	const has = await Settee.has('42')
	if(!has) {
		throw new Error('incorrect has')
	}

	const doc = await Settee.get('42')
	if(doc === undefined) { throw new Error('doc not found') }

	console.log('initial', doc)

	if(await Settee.isModified('42', doc['settee:revision'])) {
		throw new Error('modified')
	}

	const updatedDoc = {
		...doc,
		name: 'test2'
	}

	const updatedDocResult = await Settee.update(updatedDoc)
	console.log('results in', updatedDocResult)

	const latestDoc = await Settee.get('42')
	console.log('latest', latestDoc)


	await Settee.delete('42', latestDoc['settee:revision'])
}


await main()