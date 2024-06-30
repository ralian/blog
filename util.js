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
	
	// Mathjax may or may not have loaded yet
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
	
	let nestedByDate = {};
	for (item of manifest) {
		let cdate = new Date(item.created);
		let y = cdate.getFullYear();
		let m = cdate.getMonth();
		let d = cdate.getDay();
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
			Object.keys(nestedByDate[y][m]).sort().forEach(function(d, i) {
				let dateStr = new Date(nestedByDate[y][m][d].created).toLocaleString('default', dateOpts);
				htmlStr += `<p>${dateStr}: <a href='${nestedByDate[y][m][d].url}'>${nestedByDate[y][m][d].name}</a></p>`;
			});
			htmlStr += "</details></blockquote>";
			suffix = "";
		});
		htmlStr += "</details></blockquote>";
	});
	
	$(htmlStr).appendTo($("#posts")[0]);
}
