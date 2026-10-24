#!/usr/bin/env python3
"""
Builds the self-contained HTML versions of the 4.5.0 playbook, deployment steps and the two short guides from their Markdown sources.

    python3 scripts/build_docs_html.py

Source of truth stays the .md files; edit those and run this again.
  PLAYBOOK-post-deploy-4.5.0.md -> docs/BulkReg_PostDeploy_Playbook_4.5.0.html
  DEPLOY-4.5.0.md               -> docs/BulkReg_Deploy_4.5.0.html
A line  <!--include:scripts/windows/X.ps1-->  in a .md file becomes a collapsible, copyable listing of that file.
Needs: python3 with the 'markdown' package (pip install markdown). Output has no external requests.
"""
import html
import pathlib
import re
import sys

import markdown

ROOT = pathlib.Path(__file__).resolve().parent.parent
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()

DOCS = [
    ("PLAYBOOK-post-deploy-4.5.0.md", "docs/BulkReg_PostDeploy_Playbook_4.5.0.html", "Post-deploy playbook"),
    ("DEPLOY-4.5.0.md", "docs/BulkReg_Deploy_4.5.0.html", "Deployment steps"),
    ("GUIDE-merge-to-single-machine.md", "docs/BulkReg_Guide_Merge_To_Single_Machine.html", "Guide: merge to one machine"),
    ("GUIDE-reconcile-duplicates.md", "docs/BulkReg_Guide_Reconcile_Duplicates.html", "Guide: reconcile and duplicates"),
    ("SOP-recover-failed-users.md", "docs/BulkReg_SOP_Recover_Failed_Users.html", "SOP: recover failed users"),
]
LINKS = {  # file names mentioned in the text -> the HTML version next to it
    "PLAYBOOK-post-deploy-4.5.0.md": "BulkReg_PostDeploy_Playbook_4.5.0.html",
    "DEPLOY-4.5.0.md": "BulkReg_Deploy_4.5.0.html",
    "GUIDE-merge-to-single-machine.md": "BulkReg_Guide_Merge_To_Single_Machine.html",
    "GUIDE-reconcile-duplicates.md": "BulkReg_Guide_Reconcile_Duplicates.html",
    "SOP-recover-failed-users.md": "BulkReg_SOP_Recover_Failed_Users.html",
}

CSS = """
:root{
  --bg:#F7F7FC; --surface:#FFFFFF; --fg:#14142B; --muted:#5B6275; --line:#DCE6F0;
  --teal:#17707F; --teal2:#2EC0CB; --blue:#0F5FDC; --thead:#17707F; --thead-fg:#FFFFFF; --alt:#F4F7FA;
  --code-bg:#ECF3F8; --code-fg:#0B3D7A; --note-bg:#E8F6F7; --warn-bg:#FFF4E0; --warn:#9A5B00;
  --band:linear-gradient(135deg,#0B1D3A 0%,#17707F 55%,#2EC0CB 100%);
  --font:Arial,"Helvetica Neue",Helvetica,sans-serif; --mono:ui-monospace,Consolas,"SFMono-Regular",Menlo,monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#0F141C; --surface:#161D27; --fg:#E7ECF3; --muted:#9AA6B8; --line:#2A3544;
  --teal:#4FC3CF; --teal2:#36D6D9; --blue:#7FB0FF; --alt:#1A222E;
  --code-bg:#1C2633; --code-fg:#9CC8FF; --note-bg:#132B30; --warn-bg:#2E2412; --warn:#F0B04A; color-scheme:dark}}
:root[data-theme="dark"]{
  --bg:#0F141C; --surface:#161D27; --fg:#E7ECF3; --muted:#9AA6B8; --line:#2A3544;
  --teal:#4FC3CF; --teal2:#36D6D9; --blue:#7FB0FF; --alt:#1A222E;
  --code-bg:#1C2633; --code-fg:#9CC8FF; --note-bg:#132B30; --warn-bg:#2E2412; --warn:#F0B04A; color-scheme:dark}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{background:var(--bg);color:var(--fg);font:15px/1.6 var(--font);margin:0}
.band{background:var(--band);color:#fff;padding:28px 16px 26px}
.band .in{max-width:1180px;margin:0 auto}
.eyebrow{font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.85;font-weight:700}
.band h1{font-size:clamp(26px,4vw,38px);line-height:1.15;margin:8px 0 8px;text-wrap:balance}
.band p{margin:0;max-width:76ch;opacity:.94}
.band a{color:#fff}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.meta span{font-size:12.5px;border:1px solid rgba(255,255,255,.45);border-radius:20px;padding:3px 10px}
.wrap{max-width:1180px;margin:0 auto;padding-inline:16px;display:grid;grid-template-columns:270px minmax(0,1fr);gap:40px}
nav.toc{position:sticky;top:0;align-self:start;max-height:100vh;overflow:auto;padding-block:24px}
.toc input{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--fg);font:inherit;font-size:14px;margin-bottom:12px}
.toc ul{list-style:none;margin:0;padding:0}
.toc>ul>li{margin:2px 0}
.toc a{display:block;color:var(--fg);text-decoration:none;font-size:13.5px;padding:4px 8px;border-radius:5px;border-left:3px solid transparent}
.toc a:hover,.toc a:focus-visible{background:var(--alt);outline:none}
.toc a.on{border-left-color:var(--teal2);color:var(--teal);font-weight:700}
.toc li ul a{font-size:12.5px;color:var(--muted);padding-left:20px}
.toc .other{margin-top:14px;font-size:13px}
.toc .other a{display:inline;padding:0;border:0;color:var(--blue)}
main{min-width:0;padding-block:24px 64px;max-width:900px}
h2{font-size:24px;color:var(--teal);margin:34px 0 14px;padding-bottom:8px;border-bottom:2px solid var(--teal2);text-wrap:balance;scroll-margin-top:12px}
h3{font-size:18px;color:var(--teal);margin:26px 0 8px;scroll-margin-top:12px}
h4{font-size:15px;color:var(--blue);margin:20px 0 6px}
p,li{max-width:80ch}
ul,ol{padding-left:22px}
li{margin:4px 0}
a{color:var(--blue)}
code{font-family:var(--mono);font-size:.88em;background:var(--code-bg);color:var(--code-fg);padding:1px 5px;border-radius:4px;overflow-wrap:anywhere}
.cb{margin:12px 0}
pre{background:var(--code-bg);border:1px solid var(--line);border-radius:6px;padding:14px 16px;overflow-x:auto;font-size:12.5px;line-height:1.45;margin:0}
pre code{background:none;padding:0;color:var(--fg);overflow-wrap:normal;white-space:pre}
.cp{display:block;margin:0 0 4px auto;font:600 12px var(--font);background:var(--surface);color:var(--teal);border:1px solid var(--line);border-radius:5px;padding:3px 9px;cursor:pointer}
.cp:hover,.cp:focus-visible{border-color:var(--teal2);outline:none}
.cp.ok{color:#1A7F37;border-color:#1A7F37}
details.script{border:1px solid var(--line);border-radius:6px;background:var(--surface);margin:12px 0}
details.script>summary{cursor:pointer;padding:10px 14px;font-weight:700;color:var(--teal);list-style-position:inside}
details.script>summary span{font-weight:400;color:var(--muted);font-size:12.5px;margin-left:8px}
details.script .cb{margin:0;padding:0 10px 10px}
.tw{overflow-x:auto;margin:10px 0 18px;border:1px solid var(--line);border-radius:6px}
table{border-collapse:collapse;width:100%;font-size:13.5px;background:var(--surface)}
th{background:var(--thead);color:var(--thead-fg);text-align:left;padding:8px 10px;font-weight:700}
td{padding:7px 10px;border-top:1px solid var(--line);vertical-align:top}
tbody tr:nth-child(even) td{background:var(--alt)}
.call{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;padding:12px 14px;border-radius:6px;margin:14px 0;border-left:4px solid var(--teal2);background:var(--note-bg)}
.call b.l{color:var(--teal);font-size:12px;text-transform:uppercase;letter-spacing:.08em;padding-top:2px}
.call.warn{border-left-color:var(--warn);background:var(--warn-bg)}
.call.warn b.l{color:var(--warn)}
.call p{margin:0 0 6px}
.call p:last-child{margin:0}
.tools{display:flex;gap:8px;margin-top:16px}
.tools button,.menu{font:inherit;font-size:13px;color:#fff;background:transparent;border:1px solid rgba(255,255,255,.6);border-radius:6px;padding:5px 12px;cursor:pointer}
.menu{display:none}
footer{color:var(--muted);font-size:12.5px;border-top:1px solid var(--line);padding-top:14px;margin-top:30px;max-width:900px}
@media (max-width:860px){
  .wrap{grid-template-columns:minmax(0,1fr);gap:0}
  nav.toc{position:static;max-height:none;padding-block:12px 0}
  .menu{display:inline-block}
  nav.toc.closed ul,nav.toc.closed input{display:none}
}
@media print{
  .band{background:#fff;color:#000;padding:0 0 10px}.band *{color:#000!important;border-color:#999!important}
  nav.toc,.tools,.cp,.menu{display:none!important}.wrap{display:block}
  details.script{display:block}details.script>*{display:block}
  pre{white-space:pre-wrap}h2{break-after:avoid}.tw,pre,.call{break-inside:avoid}
}
"""

JS = """
(function(){
  // copy buttons on every code block
  document.querySelectorAll('.cb').forEach(function(box){
    var b=document.createElement('button'); b.type='button'; b.className='cp'; b.textContent='Copy';
    b.addEventListener('click',function(){
      var t=box.querySelector('code').innerText;
      var done=function(){b.textContent='Copied'; b.classList.add('ok'); setTimeout(function(){b.textContent='Copy'; b.classList.remove('ok');},1600);};
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(done,fallback);} else {fallback();}
      function fallback(){var a=document.createElement('textarea'); a.value=t; document.body.appendChild(a); a.select(); try{document.execCommand('copy'); done();}catch(e){b.textContent='Select + Ctrl+C';} document.body.removeChild(a);}
    });
    box.insertBefore(b,box.firstChild);
  });
  // contents: filter + current section
  var toc=document.querySelector('nav.toc'), q=toc.querySelector('input'), links=[].slice.call(toc.querySelectorAll('li a[href^="#"]'));
  q.addEventListener('input',function(){var v=q.value.toLowerCase(); links.forEach(function(a){a.parentNode.style.display=(!v||a.textContent.toLowerCase().indexOf(v)>-1)?'':'none';});});
  var map={}; links.forEach(function(a){map[a.getAttribute('href').slice(1)]=a;});
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){links.forEach(function(a){a.classList.remove('on');}); var a=map[e.target.id]; if(a){a.classList.add('on');}}});},{rootMargin:'0px 0px -75% 0px'});
    document.querySelectorAll('main h2[id],main h3[id]').forEach(function(h){io.observe(h);});
  }
  var m=document.querySelector('.menu'); if(m){m.addEventListener('click',function(){toc.classList.toggle('closed');}); if(window.innerWidth<=860){toc.classList.add('closed');}}
  var pr=document.getElementById('print'); if(pr){pr.addEventListener('click',function(){document.querySelectorAll('details.script').forEach(function(d){d.open=true;}); window.print();});}
})();
"""


def expand_includes(md_text: str) -> str:
    def repl(m):
        rel = m.group(1).strip()
        p = ROOT / rel
        if not p.exists():
            sys.exit(f"include not found: {rel}")
        body = html.escape(p.read_text(encoding="utf-8"))
        n = body.count("\n") + 1
        return (
            f'\n<details class="script"><summary>{html.escape(rel)}<span>{n} lines - click to open, then Copy</span></summary>'
            f'<div class="cb"><pre><code class="language-powershell">{body}</code></pre></div></details>\n'
        )

    return re.sub(r"<!--include:([^>]+?)-->", repl, md_text)


def wrap_code_blocks(h: str) -> str:
    # python-markdown fenced blocks -> .cb wrapper (the copy button is added by script); skip the ones already wrapped
    def repl(m):
        return f'<div class="cb">{m.group(0)}</div>'

    parts = re.split(r'(<div class="cb">.*?</div>)', h, flags=re.S)
    for i, seg in enumerate(parts):
        if not seg.startswith('<div class="cb">'):
            parts[i] = re.sub(r"<pre>.*?</pre>", repl, seg, flags=re.S)
    return "".join(parts)


def blockquotes_to_callouts(h: str) -> str:
    def repl(m):
        inner = m.group(1)
        warn = bool(re.search(r"<strong>(Status|Warning|Known limit)", inner))
        label = "Read first" if "<strong>Status" in inner else "Note"
        return f'<div class="call{" warn" if warn else ""}"><b class="l">{label}</b><div>{inner}</div></div>'

    return re.sub(r"<blockquote>(.*?)</blockquote>", repl, h, flags=re.S)


def toc_html(tokens, others) -> str:
    out = ['<ul>']
    for t in tokens:
        if t["level"] == 1:
            continue
        # tokens nest: level 2 with children level 3
        out.append(f'<li><a href="#{t["id"]}">{html.escape(t["name"])}</a>')
        kids = [c for c in t.get("children", []) if c["level"] == 3]
        if kids:
            out.append("<ul>")
            for c in kids:
                out.append(f'<li><a href="#{c["id"]}">{html.escape(c["name"])}</a></li>')
            out.append("</ul>")
        out.append("</li>")
    out.append("</ul>")
    out.append('<div class="other">Also: ' + " &middot; ".join(f'<a href="{l}">{html.escape(t)}</a>' for l, t in others) + '</div>')
    return "".join(out)


def flatten_h1(tokens):
    # python-markdown nests h2 under the h1; lift them
    res = []
    for t in tokens:
        if t["level"] == 1:
            res.extend(t.get("children", []))
        else:
            res.append(t)
    return res


def build(src_name: str, out_name: str, title_kind: str, other):
    src = ROOT / src_name
    text = expand_includes(src.read_text(encoding="utf-8"))
    md = markdown.Markdown(extensions=["tables", "fenced_code", "toc", "sane_lists"], extension_configs={"toc": {"toc_depth": "2-3"}})
    body = md.convert(text)
    tokens = flatten_h1(md.toc_tokens)

    m = re.search(r"<h1[^>]*>(.*?)</h1>\s*(<p>.*?</p>)?", body, flags=re.S)
    h1 = m.group(1) if m else title_kind
    lead = m.group(2) if (m and m.group(2)) else ""
    if m:
        body = body.replace(m.group(0), "", 1)

    body = wrap_code_blocks(body)
    body = blockquotes_to_callouts(body)
    body = body.replace("<table>", '<div class="tw"><table>').replace("</table>", "</table></div>")
    for fn, target in LINKS.items():
        body = body.replace(f"<code>{fn}</code>", f'<a href="{target}"><code>{fn}</code></a>')

    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BulkReg {html.escape(title_kind)} {VERSION}</title>
<style>{CSS}</style>
</head>
<body>
<header class="band"><div class="in">
  <div class="eyebrow">HCL Software &middot; BulkReg {VERSION}</div>
  <h1>{h1}</h1>
  {lead}
  <div class="meta"><span>Version {VERSION}</span><span>October 2026</span><span>Internal &ndash; confidential</span><span>Not yet tested against Domino</span></div>
  <div class="tools"><button type="button" class="menu">Contents</button><button type="button" id="print">Print / save as PDF</button></div>
</div></header>
<div class="wrap">
<nav class="toc" aria-label="Contents"><input type="search" placeholder="Filter contents" aria-label="Filter contents">{toc_html(tokens, other)}</nav>
<main>
{body}
<footer>BulkReg {VERSION} &middot; {html.escape(title_kind)} &middot; generated from <code>{src_name}</code> by <code>scripts/build_docs_html.py</code>. Edit the Markdown file and rebuild. Contains internal procedures: keep on approved internal storage.</footer>
</main>
</div>
<script>{JS}</script>
</body>
</html>
"""
    out = ROOT / out_name
    out.write_text(page, encoding="utf-8")
    print(f"wrote {out_name}  ({len(page)//1024} KB, {len(tokens)} sections)")


def main():
    for i, (src, out, kind) in enumerate(DOCS):
        others = [(pathlib.Path(o_out).name, o_kind) for j, (_, o_out, o_kind) in enumerate(DOCS) if j != i]
        build(src, out, kind, others)


if __name__ == "__main__":
    main()
