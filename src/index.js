import { Settee } from './settee.js'


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

	console.log(doc)
}


await main()