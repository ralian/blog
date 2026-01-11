function sortNum(a, b) {
	return a - b;
}

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

function archive(manifest) {
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
	Object.keys(nestedByDate).sort(sortNum).reverse().forEach(function(y, yi) {
		htmlStr += `<blockquote><details${suffix}><summary>${y}</summary>`;
		Object.keys(nestedByDate[y]).sort(sortNum).reverse().forEach(function(m, mi) {
			let mName = new Date(2000, m, 1).toLocaleString('default', { month: 'long' }); // Localize the numeric month
			htmlStr += `<blockquote><details${suffix}><summary>${mName}</summary>`;
			Object.keys(nestedByDate[y][m]).sort(sortNum).reverse().forEach(function(d, i) {
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

let search_manifest = {}

function hide_search_results() {
	$(".search-results")[0].classList.remove("show");
}

function search_change() {
	let s = $(".search")[0].value;
	$(".search-results")[0].innerHTML = "";
	for (item of search_manifest) {
		if (item.name.toLowerCase().includes(s.toLowerCase()) || item.tags.toLowerCase().includes(s.toLowerCase()))
			$(`<div class="search-result" onclick="window.location.href='${item.url}'"><div class="search-result-title">${item.name}</div><div class="search-result-snippet">${item.tags}</div><div class="search-result-date">${item.created}</div></div>`).appendTo($("#search-results")[0]);
	}
	$(".search-results")[0].classList.add("show");
}

// Add event listeners for hiding search results
document.addEventListener('DOMContentLoaded', function() {
	// Escape key listener
	document.addEventListener('keydown', function(event) {
		if (event.key === 'Escape') {
			hide_search_results();
		}
	});
	
	// Click outside listener
	document.addEventListener('click', function(event) {
		const searchContainer = document.querySelector('.search-container');
		const searchResults = document.querySelector('.search-results');
		
		// Check if click is outside search container and results
		if (!searchContainer.contains(event.target) && !searchResults.contains(event.target)) {
			hide_search_results();
		}
	});
});

async function populate_manifest(path) {
	let resp = await fetch(path);
	search_manifest = await resp.json();
}

async function load_manifest(path, opts) {
	await populate_manifest(path);
	archive(search_manifest);
}
