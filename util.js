function renderGraphs() {
	for (c of $('code.graphviz')) {
		let p = document.createElement("p");
		p.innerHTML = Viz(c.innerText, {format: 'svg'});
		p.className = 'graph';
		let pre = c.parentElement
		pre.replaceWith(p);
	}
}

async function loadmd(path) {
	let converter = new showdown.Converter();
	let resp = await fetch(path);
	let md = await resp.text();
	$('#article').html( converter.makeHtml(md) );
	
	for (block of $('code:not(.graphviz)')) {
	  let len = block.textContent.split("\n").length;
	  if (len > 1) {
		let lineref = [...Array(len).keys()].slice(1).join("\n");
		$(`<code class="lineno">${lineref}</code>`).prependTo(block.parentElement);
	  }
	}
	
	if (window.location.hash !== "") {
		$(window.location.hash)[0].scrollIntoView()
	}
	
	// Mathjax may or may not have loaded yet
	try {MathJax.typeset();} catch(ex) {
		var script_jax = document.querySelector('#MathJax-script');
		script_jax.addEventListener('load', function() {
			MathJax.typeset();
		});
	}
	
	// Same with Highlight
	try {hljs.highlightAll();} catch(ex) {
		var highlight = document.querySelector('#Highlight-script');
		highlight.addEventListener('load', function() {
			hljs.highlightAll();
		});
	}
	
	try {renderGraphs();} catch(ex) {
		var script_viz = document.querySelector('#GraphViz-script');
		script_viz.addEventListener('load', function() {
			renderGraphs();
		});
	}
}

function m_archive(manifest) {
	let nestedByDate = {};
	for (item of manifest) {
		let cdate = new Date(item.created);
		let y = cdate.getFullYear();
		let m = cdate.getMonth();
		let d = cdate.getDate();
		nestedByDate = {...nestedByDate,
			[y]: {...nestedByDate[y],
				[m]: {...(nestedByDate[y]? nestedByDate[y][m] : undefined),
					[d]: item
				}
			}
		};
	}
	
	let htmlStr = "";
	let suffix = " open";
	const dateOpts = {weekday: "long", year: "numeric", month: "long", day: "numeric"};
	Object.keys(nestedByDate).sort().reverse().forEach(function(y, yi) {
		htmlStr += `<blockquote><details${suffix}><summary>${y}</summary>`;
		Object.keys(nestedByDate[y]).sort().reverse().forEach(function(m, mi) {
			let mName = new Date(2000, m, 01).toLocaleString('default', { month: 'long' }); // Localize the numeric month
			htmlStr += `<blockquote><details${suffix}><summary>${mName}</summary>`;
			Object.keys(nestedByDate[y][m]).sort().reverse().forEach(function(d, i) {
				let dateStr = new Date(nestedByDate[y][m][d].created).toLocaleString('default', dateOpts);
				htmlStr += `<p>${dateStr}: <a href='${nestedByDate[y][m][d].url}'>${nestedByDate[y][m][d].name}</a></p>`;
			});
			htmlStr += "</details></blockquote>";
			suffix = "";
		});
		htmlStr += "</details></blockquote>";
	});
	
	$(htmlStr).appendTo($("#article")[0]);
};

let m_search_manifest = {}
function m_search_change() {
	let s = $("#search")[0].value;
	$("#results")[0].innerHTML = "";
	for (item of m_search_manifest) {
		if (item.name.toLowerCase().includes(s.toLowerCase()) || item.tags.toLowerCase().includes(s.toLowerCase()))
			$(`<p>${item.created}: <a href='${item.url}'>${item.name}</a></p>`).appendTo($("#results")[0]);
	}
}

function m_search(manifest) {
	m_search_manifest = manifest;
	$("#article")[0].innerHTML = "<input id='search' type='text' onchange='m_search_change()'><div id='results'>";
}

async function loadmanifest(path, opts) {
	let resp = await fetch(path);
	let manifest = await resp.json();
	
	if (opts === "search") m_search(manifest);
	else m_archive(manifest);
}
