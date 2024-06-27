async function loadmd(path) {
	let converter = new showdown.Converter();
	let resp = await fetch(path, {cache: 'no-store'});
	let md = await resp.text();
	$('body').html( converter.makeHtml(md) );
	if (window.location.hash !== "") {
		$(window.location.hash)[0].scrollIntoView()
	}
}
