const fs = require("fs");
const { META, C } = require("./content.js");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// same tokenizer as the Word builder: code / bold / italic, left to right
const inl = (s) => String(s).split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).map((t) => {
  if (/^\*\*[^*]+\*\*$/.test(t)) return "<strong>" + esc(t.slice(2, -2)) + "</strong>";
  if (/^`[^`]+`$/.test(t)) return "<code>" + esc(t.slice(1, -1)) + "</code>";
  if (/^\*[^*]+\*$/.test(t)) return "<em>" + esc(t.slice(1, -1)) + "</em>";
  return esc(t);
}).join("");
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

let html = "", toc = [], open = false;
for (const b of C) {
  switch (b.t) {
    case "h1": {
      const id = slug(b.text);
      if (open) html += "</section>";
      html += `<section class="chap" id="${id}"><h2>${inl(b.text)}</h2>`;
      open = true; toc.push({ id, text: b.text, subs: [] }); break;
    }
    case "h2": {
      const id = slug(b.text);
      html += `<h3 id="${id}">${inl(b.text)}</h3>`;
      toc[toc.length - 1].subs.push({ id, text: b.text }); break;
    }
    case "h3": html += `<h4>${inl(b.text)}</h4>`; break;
    case "p": html += `<p>${inl(b.text)}</p>`; break;
    case "bullets": html += "<ul>" + b.items.map((i) => `<li>${inl(i)}</li>`).join("") + "</ul>"; break;
    case "numbers": html += (b.start > 1 ? `<ol start="${b.start}">` : "<ol>") + b.items.map((i) => `<li>${inl(i)}</li>`).join("") + "</ol>"; break;
    case "table": html += `<div class="tw"><table><thead><tr>${b.head.map((h) => `<th>${inl(h)}</th>`).join("")}</tr></thead><tbody>` +
      b.rows.map((r) => "<tr>" + r.map((c) => `<td>${inl(c)}</td>`).join("") + "</tr>").join("") + "</tbody></table></div>"; break;
    case "code": html += `<pre><code>${esc(b.text)}</code></pre>`; break;
    case "note": html += `<aside class="call note"><b>Note</b><div>${inl(b.text)}</div></aside>`; break;
    case "warn": html += `<aside class="call warn"><b>Caution</b><div>${inl(b.text)}</div></aside>`; break;
    case "done": html += `<aside class="call done"><b>Done when</b><div>${inl(b.text)}</div></aside>`; break;
    case "refs": html += "<ul class='refs'>" + b.items.map(([t, u]) => `<li>${esc(t)}<br><a href="${u}" target="_blank" rel="noopener">${esc(u)}</a></li>`).join("") + "</ul>"; break;
  }
}
if (open) html += "</section>";

const tocHtml = toc.map((c) => `<li><a href="#${c.id}">${esc(c.text)}</a>${c.subs.length ? "<ul>" + c.subs.map((s) => `<li><a href="#${s.id}">${esc(s.text)}</a></li>`).join("") + "</ul>" : ""}</li>`).join("");

const page = `<meta charset="utf-8">
<title>BulkReg Admin Guide</title>
<style>
/* Layout: brand header band, then sticky contents rail + 72ch reading column; rail collapses to a drawer on phones */
:root{
  --bg:#F7F7FC; --surface:#FFFFFF; --fg:#14142B; --muted:#5B6275; --line:#DCE6F0;
  --teal:#17707F; --teal2:#2EC0CB; --blue:#0F5FDC; --thead:#17707F; --thead-fg:#FFFFFF; --alt:#F4F7FA;
  --code-bg:#ECF3F8; --code-fg:#0B3D7A; --note-bg:#E8F6F7; --warn-bg:#FFF4E0; --warn:#9A5B00; --ok:#1A7F37; --ok-bg:#EAF6EC;
  --band:linear-gradient(135deg,#0B1D3A 0%,#17707F 55%,#2EC0CB 100%);
  --font:Arial,"Helvetica Neue",Helvetica,sans-serif; --mono:ui-monospace,Consolas,"SFMono-Regular",Menlo,monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#0F141C; --surface:#161D27; --fg:#E7ECF3; --muted:#9AA6B8; --line:#2A3544;
  --teal:#4FC3CF; --teal2:#36D6D9; --blue:#7FB0FF; --thead:#17707F; --thead-fg:#FFFFFF; --alt:#1A222E;
  --code-bg:#1C2633; --code-fg:#9CC8FF; --note-bg:#132B30; --warn-bg:#2E2412; --warn:#F0B04A; --ok:#5CCB79; --ok-bg:#15281B; color-scheme:dark}}
:root[data-theme="dark"]{
  --bg:#0F141C; --surface:#161D27; --fg:#E7ECF3; --muted:#9AA6B8; --line:#2A3544;
  --teal:#4FC3CF; --teal2:#36D6D9; --blue:#7FB0FF; --thead:#17707F; --thead-fg:#FFFFFF; --alt:#1A222E;
  --code-bg:#1C2633; --code-fg:#9CC8FF; --note-bg:#132B30; --warn-bg:#2E2412; --warn:#F0B04A; --ok:#5CCB79; --ok-bg:#15281B; color-scheme:dark}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{background:var(--bg);color:var(--fg);font:15px/1.6 var(--font);margin:0}
.band{background:var(--band);color:#fff;padding:28px 16px 26px}
.band .in{max-width:1180px;margin:0 auto}
.eyebrow{font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.85;font-weight:700}
.band h1{font-size:clamp(26px,4vw,38px);line-height:1.15;margin:8px 0 6px;text-wrap:balance}
.band p{margin:0;max-width:70ch;opacity:.92}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.meta span{font-size:12.5px;border:1px solid rgba(255,255,255,.45);border-radius:20px;padding:3px 10px}
.wrap{max-width:1180px;margin:0 auto;padding-inline:16px;display:grid;grid-template-columns:270px minmax(0,1fr);gap:40px}
nav.toc{position:sticky;top:env(safe-area-inset-top,0px);align-self:start;max-height:100vh;overflow:auto;padding-block:24px}
.toc input{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--fg);font:inherit;font-size:14px;margin-bottom:12px}
.toc ul{list-style:none;margin:0;padding:0}
.toc>ul>li{margin:2px 0}
.toc a{display:block;color:var(--fg);text-decoration:none;font-size:13.5px;padding:4px 8px;border-radius:5px;border-left:3px solid transparent}
.toc a:hover,.toc a:focus-visible{background:var(--alt);outline:none}
.toc a.on{border-left-color:var(--teal2);color:var(--teal);font-weight:700}
.toc li ul a{font-size:12.5px;color:var(--muted);padding-left:20px}
main{min-width:0;padding-block:24px 64px}
.chap{max-width:900px;padding-top:8px;margin-bottom:28px;scroll-margin-top:12px}
.chap>h2{font-size:24px;color:var(--teal);margin:12px 0 14px;padding-bottom:8px;border-bottom:2px solid var(--teal2);text-wrap:balance}
h3{font-size:18px;color:var(--teal);margin:26px 0 8px;scroll-margin-top:12px}
h4{font-size:15px;color:var(--blue);margin:20px 0 6px}
p,li{max-width:76ch}
ul,ol{padding-left:22px}
li{margin:4px 0}
code{font-family:var(--mono);font-size:.88em;background:var(--code-bg);color:var(--code-fg);padding:1px 5px;border-radius:4px;overflow-wrap:anywhere}
pre{background:var(--code-bg);border:1px solid var(--line);border-radius:6px;padding:14px 16px;overflow-x:auto;font-size:12.5px;line-height:1.45}
pre code{background:none;padding:0;color:var(--fg);overflow-wrap:normal}
.tw{overflow-x:auto;margin:10px 0 18px;border:1px solid var(--line);border-radius:6px}
table{border-collapse:collapse;width:100%;font-size:13.5px;background:var(--surface)}
th{background:var(--thead);color:var(--thead-fg);text-align:left;padding:8px 10px;font-weight:700;white-space:nowrap}
td{padding:7px 10px;border-top:1px solid var(--line);vertical-align:top}
tbody tr:nth-child(even) td{background:var(--alt)}
.call{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;padding:12px 14px;border-radius:6px;margin:14px 0;border-left:4px solid var(--teal2);background:var(--note-bg)}
.call b{color:var(--teal);font-size:12px;text-transform:uppercase;letter-spacing:.08em;padding-top:2px}
.call.warn{border-left-color:var(--warn);background:var(--warn-bg)}
.call.warn b{color:var(--warn)}
.call.done{border-left-color:var(--ok);background:var(--ok-bg)}
.call.done b{color:var(--ok)}
.refs a{color:var(--blue);font-size:13px;overflow-wrap:anywhere}
.hidden-sec{display:none}
.menu{display:none}
footer{color:var(--muted);font-size:12.5px;border-top:1px solid var(--line);padding-top:14px;margin-top:30px;max-width:900px}
@media (max-width:860px){
  .wrap{grid-template-columns:minmax(0,1fr);gap:0}
  nav.toc{position:static;max-height:none;padding-block:12px 0}
  .menu{display:inline-block;margin-top:14px;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.6);border-radius:6px;padding:6px 12px;font:inherit;font-size:13.5px;cursor:pointer}
  nav.toc.closed ul{display:none}
}
</style>
<header class="band"><div class="in">
  <div class="eyebrow">HCL Software · ${esc(META.docType)}</div>
  <h1>${esc(META.title)}</h1>
  <p>${esc(META.subtitle)}</p>
  <div class="meta"><span>Version ${esc(META.version)}</span><span>${esc(META.date)}</span><span>${esc(META.status)}</span><span>${esc(META.classification)}</span><span>Author: ${esc(META.author)}</span></div>
  <button class="menu" id="menuBtn" aria-controls="toc" aria-expanded="false">Contents</button>
</div></header>
<div class="wrap">
  <nav class="toc closed" id="toc" aria-label="Contents">
    <input id="filter" type="search" placeholder="Filter sections…" aria-label="Filter sections">
    <ul>${tocHtml}</ul>
  </nav>
  <main id="doc">${html}
  <footer>${esc(META.title)} – ${esc(META.docType)} · v${esc(META.version)} · ${esc(META.classification)}. The same content is available as a Word document (BulkReg_Admin_Guide.docx) in the project folder.</footer>
  </main>
</div>
<script>
(function(){
  var btn=document.getElementById('menuBtn'),toc=document.getElementById('toc');
  btn.addEventListener('click',function(){var c=toc.classList.toggle('closed');btn.setAttribute('aria-expanded',String(!c));});
  toc.addEventListener('click',function(e){if(e.target.tagName==='A'&&window.innerWidth<=860){toc.classList.add('closed');btn.setAttribute('aria-expanded','false');}});
  var links=[].slice.call(toc.querySelectorAll('a')),secs=[].slice.call(document.querySelectorAll('.chap'));
  var f=document.getElementById('filter');
  f.addEventListener('input',function(){var q=f.value.trim().toLowerCase();
    secs.forEach(function(s){s.classList.toggle('hidden-sec',!!q&&s.textContent.toLowerCase().indexOf(q)<0);});
    toc.querySelectorAll(':scope>ul>li').forEach(function(li){var id=li.querySelector('a').getAttribute('href').slice(1);
      var s=document.getElementById(id);li.style.display=(s&&s.classList.contains('hidden-sec'))?'none':'';});
  });
  if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){
    links.forEach(function(a){a.classList.toggle('on',a.getAttribute('href')==='#'+e.target.id);});}});},{rootMargin:'0px 0px -75% 0px'});
    document.querySelectorAll('.chap,[id].chap h3, h3[id]').forEach(function(el){io.observe(el);});}
})();
</script>`;
fs.writeFileSync(process.argv[2] || "guide.html", page);
console.log("html written", page.length);
