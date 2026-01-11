import { isValidDocId, Settee } from "@johntalton/settee"

export class ViewRoute {
	static async get(matches, state) {
		const { db, view } = matches

		if (db === undefined) { return { type: '404' } }
		if (view === undefined) { return { type: '404' } }

		const obj = await Settee.map(view, [])

		return {
			...state,
			type: 'json',
			obj
		}
	}
}
