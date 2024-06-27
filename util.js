async function loadmd(path) {
	let converter = new showdown.Converter();
	let resp = await fetch(path);
	let md = await resp.text();
	$('body').html( converter.makeHtml(md) );
	if (window.location.hash !== "") {
		$(window.location.hash)[0].scrollIntoView()
	}
	
	for (block of $('code')) {
	  let len = block.textContent.split("\n").length;
	  if (len > 1) {
		let lineref = [...Array(len).keys()].slice(1).join("\n");
		$(`<code class="lineno">${lineref}</code>`).prependTo(block.parentElement);
	  }
	}
}

async function loadmanifest(path) {
	let resp = await fetch(path);
	let manifest = await resp.json();
	for (item of manifest) {
		$(`<a href='${item.url}'>${item.name}</a>`).appendTo($('#posts')[0]);
	}
}
