async function loadmd(path) {
	let converter = new showdown.Converter();
	let resp = await fetch(path);
	let md = await resp.text();
	$('body').html( converter.makeHtml(md) );
	if (window.location.hash !== "") {
		$(window.location.hash)[0].scrollIntoView()
	}
}

async function loadmanifest(path) {
	let resp = await fetch(path);
	let manifest = await resp.json();
	for (item of manifest) {
		$(`<a href='${item.url}'>${item.name}</a>`).appendTo($('#posts')[0]);
	}
}
