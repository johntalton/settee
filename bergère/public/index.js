



async function onContentLoadedAsync() {
	// const response = await fetch('https://canape.next.local:6095/tic/42', {
	// 	method: 'GET'
	// })

	// const document = await response.json()
	// console.log(document)
}

function onContentLoaded() {
	onContentLoadedAsync()
		.catch(console.warn)
}

(document.readyState === 'loading') ?
	document.addEventListener('DOMContentLoaded', onContentLoaded) :
	onContentLoaded()