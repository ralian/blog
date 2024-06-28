async function loadmd(path) {
	let converter = new showdown.Converter();
	let resp = await fetch(path);
	let md = await resp.text();
	$('#content').html( converter.makeHtml(md) );
	
	for (block of $('code')) {
	  let len = block.textContent.split("\n").length;
	  if (len > 1) {
		let lineref = [...Array(len).keys()].slice(1).join("\n");
		$(`<code class="lineno">${lineref}</code>`).prependTo(block.parentElement);
	  }
	}
	
	if (window.location.hash !== "") {
		$(window.location.hash)[0].scrollIntoView()
	}
	
	try {MathJax.typeset();} catch(ex) {
		var script = document.querySelector('#MathJax-script');
		script.addEventListener('load', function() {
			MathJax.typeset();
		});
	}
}

async function loadmanifest(path) {
	let resp = await fetch(path);
	let manifest = await resp.json();
	for (item of manifest) {
		$(`<a href='${item.url}'>${item.name}</a>`).appendTo($('#posts')[0]);
	}
}
