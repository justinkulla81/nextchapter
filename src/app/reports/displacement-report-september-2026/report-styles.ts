// AUTO-SCOPED from the authored report HTML's <style> blocks: every selector
// prefixed with .ncr so the report's CSS styles only the report document and
// never the site chrome. :root/body/* fold onto .ncr; the two font tokens
// point at the site's next/font variables. Regenerate with
// scripts/displacement/port-report.mjs.
export const REPORT_CSS = `/* Layout: industry research report — cover band, disclosure, executive summary, numbered chapters with labeled exhibits, appendix; sticky contents rail on wide screens; print/PDF styles. */
.ncr{
  /* NextChapter brand tokens (from launchyournextchapter.com globals.css). Single light theme by design. */
  --bg:#f7f9fa; --paper:#ffffff; --fg:#0a0a0a; --navy:#0b2545; --muted:#4a5568; --line:#e2e8f0;
  --accent:#1d4e89; --accent-soft:#eaf1f8; --light-blue:#2980d4; --cta:#2e7d5b; --cta-hover:#3f9b72;
  --neg:#c4574a; --neg-soft:#f8e9e7; --pos:#2e7d5b; --pos-soft:#e6f2ec; --ink-band:#ffffff; --on-band:#0b2545;
  --display:var(--font-source-serif),"Source Serif 4",Georgia,"Times New Roman",serif;
  --body:var(--font-inter),"Inter",system-ui,-apple-system,"Segoe UI",sans-serif;
  --mono:var(--font-inter),"Inter",system-ui,-apple-system,"Segoe UI",sans-serif;
  color-scheme:light;
}
.ncr *{box-sizing:border-box}
.ncr{background:var(--bg);color:var(--fg);font-family:var(--body);font-size:16px;line-height:1.6;margin:0}
.ncr a{color:var(--accent);text-underline-offset:2px}
.ncr a:focus-visible,.ncr button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.ncr h1,.ncr h2,.ncr h3{font-family:var(--display);font-weight:600;text-wrap:balance;line-height:1.2;margin:0;color:var(--navy)}
.ncr h3{font-family:var(--body);font-size:1.02rem!important;font-weight:600}
.ncr p{margin:0;max-width:70ch}
.ncr .mono{font-family:var(--mono)}
.ncr .eyebrow{font-family:var(--body);font-size:.72rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--accent)}

/* cover */
.ncr .cover{background:var(--paper);color:var(--navy);padding-inline:20px;padding-block:0 36px;border-bottom:1px solid var(--line)}
.ncr .cover::before{content:"";display:block;height:6px;background:var(--navy);margin-inline:-20px;margin-bottom:26px}
.ncr .cover-in{max-width:1160px;margin:0 auto;display:flex;flex-direction:column;gap:22px}
.ncr .cover-top{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px 24px;align-items:center}
.ncr .brand{font-family:var(--mono);font-size:.82rem;letter-spacing:.1em;text-transform:uppercase}
.ncr .brand-wrap{display:flex;align-items:baseline;gap:10px}
.ncr .wordmark{font-family:var(--body);font-weight:700;letter-spacing:-.02em;color:var(--navy);font-size:1.9rem;line-height:1}
.ncr .brand-sub{font-family:var(--body);font-size:1.05rem;color:var(--muted);font-weight:500}
.ncr .newsbox{background:var(--paper);border:1px solid var(--line);border-top:3px solid var(--cta);border-radius:6px;padding:22px;display:flex;flex-direction:column;gap:10px;align-items:flex-start}
.ncr .brand b{color:var(--accent);font-weight:600}
.ncr .cover .eyebrow{color:var(--muted)}
.ncr .cover h1{font-size:clamp(2.1rem,5vw,3.4rem);max-width:20ch;letter-spacing:-.01em;color:var(--navy)}
.ncr .cover .dek{font-size:1.12rem;color:var(--muted);max-width:62ch}
.ncr .cover-meta{display:flex;flex-wrap:wrap;gap:6px 22px;font-size:.86rem;color:var(--muted)}
.ncr .cover-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-top:3px solid var(--accent);border-radius:4px;overflow:hidden;margin-top:6px}
.ncr .cover-stats div{background:var(--bg);padding:14px 16px;display:flex;flex-direction:column;gap:4px;min-width:0}
.ncr .cover-stats .v{font-family:var(--body);font-size:1.9rem;font-weight:600;line-height:1.1;font-variant-numeric:tabular-nums;color:var(--navy)}
.ncr .cover-stats .l{font-size:.8rem;color:var(--muted);line-height:1.35}
.ncr .actions{display:flex;flex-wrap:wrap;gap:10px}
.ncr .btn{display:inline-flex;align-items:center;gap:8px;font:inherit;font-size:.9rem;font-weight:600;padding:9px 18px;border-radius:8px;cursor:pointer;text-decoration:none;border:1px solid var(--cta);color:#fff;background:var(--cta)}
.ncr .btn:hover{background:var(--cta-hover);border-color:var(--cta-hover)}
.ncr .btn.ghost{background:var(--paper);color:var(--navy);border-color:var(--line);font-weight:500}
.ncr .btn.ghost:hover{background:var(--bg)}

.ncr .btn svg{width:16px;height:16px}
.ncr .status{font-size:.8rem;color:var(--muted);min-height:1.2em}

/* layout */
.ncr .wrap{max-width:1160px;margin:0 auto;padding-inline:20px;padding-block:28px 64px}
.ncr .grid{display:grid;grid-template-columns:1fr;gap:40px}
@media (min-width:1000px){.ncr .grid{grid-template-columns:210px minmax(0,1fr)}}
.ncr .toc{display:none}
@media (min-width:1000px){.ncr .toc{display:block;position:sticky;top:calc(env(safe-area-inset-top,0px) + 20px);align-self:start}}
.ncr .toc ol{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:5px;font-size:.84rem}
.ncr .toc a{color:var(--muted);text-decoration:none}
.ncr .toc a:hover{color:var(--fg)}
.ncr .toc .n{font-family:var(--mono);font-size:.7rem;margin-right:6px}
.ncr main{min-width:0;display:flex;flex-direction:column;gap:48px}
.ncr section{display:flex;flex-direction:column;gap:16px;scroll-margin-top:20px}
.ncr .chapter-head{display:flex;flex-direction:column;gap:6px;padding-top:10px;border-top:2px solid var(--navy)}
.ncr .chapter-head h2{font-size:clamp(1.55rem,2.6vw,2rem)}
.ncr h3{font-size:1.15rem;margin-top:6px}
.ncr .lead{font-size:1.06rem}

/* boxes */
.ncr .box{background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:20px 22px;display:flex;flex-direction:column;gap:10px}
.ncr .box.disclose{border-left:4px solid var(--navy);background:var(--paper)}
.ncr .box ul,.ncr .box ol{margin:0;padding-left:1.2rem;display:flex;flex-direction:column;gap:8px;max-width:74ch}
.ncr .findings{display:grid;grid-template-columns:1fr;gap:16px}
@media (min-width:760px){.ncr .findings{grid-template-columns:1fr 1fr}}
.ncr .findings>div{min-width:0;background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:18px 20px;display:flex;flex-direction:column;gap:10px}
.ncr .findings h3{font-family:var(--mono);font-size:.76rem;font-weight:500;letter-spacing:.1em;text-transform:uppercase;margin:0}
.ncr .findings .up h3{color:var(--pos)} .ncr .findings .down h3{color:var(--neg)}
.ncr .findings ul{margin:0;padding-left:1.1rem;display:flex;flex-direction:column;gap:8px;font-size:.94rem}

/* exhibits */
.ncr .exhibit{background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:16px 18px 12px;display:flex;flex-direction:column;gap:8px;position:relative;break-inside:avoid}
.ncr .ex-label{font-size:.7rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--accent)}
.ncr .ex-title{font-size:1rem;font-weight:600;line-height:1.35}
.ncr .ex-note{font-size:.76rem;color:var(--muted);line-height:1.5}
.ncr .tbl{overflow-x:auto}
.ncr table{border-collapse:collapse;width:100%;font-size:.88rem;font-variant-numeric:tabular-nums}
.ncr th,.ncr td{padding:8px 10px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap}
.ncr th:first-child,.ncr td:first-child{text-align:left;white-space:normal;min-width:170px}
.ncr td.l,.ncr th.l{text-align:left;white-space:normal}
.ncr thead th{font-family:var(--mono);font-size:.68rem;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);font-weight:500;vertical-align:bottom}
.ncr tbody tr:last-child td{border-bottom:0}
.ncr td.neg{color:var(--neg)} .ncr td.pos{color:var(--pos)}
.ncr .sig{font-family:var(--mono);font-size:.68rem;padding:1px 6px;border-radius:999px;background:var(--neg-soft);color:var(--neg);margin-left:6px}
.ncr .ns{font-family:var(--mono);font-size:.68rem;color:var(--muted);margin-left:6px}
.ncr .cells{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:6px;overflow:hidden}
.ncr .cell{background:var(--paper);padding:14px 16px;display:flex;flex-direction:column;gap:4px;min-width:0}
.ncr .cell .lbl{font-size:.78rem;color:var(--muted);line-height:1.35}
.ncr .cell .val{font-family:var(--display);font-size:1.85rem;font-weight:600;line-height:1.1;font-variant-numeric:tabular-nums}
.ncr .cell .chg{font-family:var(--mono);font-size:.74rem;color:var(--muted)}
.ncr .two{display:grid;grid-template-columns:1fr;gap:16px}
@media (min-width:760px){.ncr .two{grid-template-columns:1fr 1fr}}
.ncr .two>*{min-width:0}

/* charts */
.ncr .chart svg{display:block;width:100%;height:auto;overflow:visible}
.ncr .chart text{font-family:var(--body);font-size:11px;fill:var(--muted)}
.ncr .chart .vlabel{fill:var(--fg);font-weight:500}
.ncr .chart .grid line{stroke:var(--line);stroke-width:1}
.ncr .chart .base{stroke:var(--muted);stroke-width:1}
.ncr .bar{fill:var(--accent)} .ncr .bar.neg{fill:var(--neg)} .ncr .bar.dim{fill:var(--accent);opacity:.45}
.ncr .band{fill:var(--light-blue);opacity:.15}
.ncr .tip{position:absolute;pointer-events:none;background:var(--fg);color:var(--bg);font-family:var(--mono);font-size:.74rem;padding:5px 8px;border-radius:4px;white-space:nowrap;transform:translate(-50%,-110%)}

/* research list */
.ncr .items{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;border-top:1px solid var(--line)}
.ncr .items li{padding:13px 0;border-bottom:1px solid var(--line);display:grid;grid-template-columns:1fr;gap:4px}
@media (min-width:700px){.ncr .items li{grid-template-columns:200px minmax(0,1fr);gap:20px}}
.ncr .items .who{font-family:var(--mono);font-size:.76rem;color:var(--muted);line-height:1.45}
.ncr .items p{font-size:.95rem}
.ncr .note{font-size:.86rem;color:var(--muted);max-width:74ch}
.ncr .fn{font-size:.72rem;vertical-align:super;line-height:0;font-family:var(--mono);color:var(--accent);text-decoration:none}
.ncr .watch{display:grid;border-top:1px solid var(--line)}
.ncr .watch div{display:grid;grid-template-columns:110px minmax(0,1fr);gap:16px;padding:10px 0;border-bottom:1px solid var(--line);font-size:.95rem}
.ncr .watch .d{font-family:var(--mono);font-size:.8rem;color:var(--accent);padding-top:2px}
.ncr details{border-top:1px solid var(--line);padding:12px 0}
.ncr details:last-child{border-bottom:1px solid var(--line)}
.ncr summary{cursor:pointer;font-weight:600}
.ncr details p{margin-top:8px;font-size:.95rem}
.ncr .sources{font-size:.8rem;color:var(--muted);padding-left:1.4rem;margin:0;columns:1;column-gap:32px}
@media (min-width:800px){.ncr .sources{columns:2}}
.ncr .sources li{break-inside:avoid;margin-bottom:6px;word-break:break-word}
.ncr .cite code{font-family:var(--mono);font-size:.8rem;line-height:1.55;display:block;white-space:normal;word-break:break-word}
.ncr .btn2{align-self:flex-start;font:inherit;font-size:.84rem;padding:6px 14px;border:1px solid var(--accent);background:transparent;color:var(--accent);border-radius:4px;cursor:pointer}
.ncr .btn2:hover{background:var(--accent);color:var(--paper)}
.ncr .appendix .chapter-head{border-top-style:dashed}
.ncr .about{background:var(--paper);border:1px solid var(--line);border-top:3px solid var(--navy);border-radius:6px;padding:20px 22px;display:flex;flex-direction:column;gap:10px}
.ncr footer{margin-top:48px;padding-top:18px;border-top:1px solid var(--line);font-size:.8rem;color:var(--muted);display:flex;flex-direction:column;gap:4px}
@media (prefers-reduced-motion:reduce){.ncr *{transition:none!important;animation:none!important}}

/* print / PDF */
@media print{
  .ncr{--bg:#fff;--paper:#fff}
  .ncr .cover::before{margin-inline:0;margin-bottom:1.1in}
  .ncr .cover{justify-content:flex-start;border-bottom:0}
  .ncr .cover-stats div{background:#f7f9fa}
  .ncr{font-size:10.5pt;background:#fff}
  .ncr .toc,.ncr .actions,.ncr .status,.ncr .no-print{display:none!important}
  .ncr .cover{padding:0 0 18pt;break-after:page;min-height:9.4in;display:flex;flex-direction:column;justify-content:space-between}
  .ncr .cover-in{gap:16pt}
  .ncr .wordmark{font-size:30pt}
  .ncr .brand-sub{font-size:14pt}
  .ncr .newsbox .btn{display:none}
  .ncr .cover-stats{grid-template-columns:repeat(2,1fr)}
  .ncr .cover h1{font-size:40pt}
  .ncr .wrap{padding:0;max-width:none}
  .ncr .grid{display:block}
  .ncr main{gap:22pt}
  .ncr .chapter-head{break-before:page}
  .ncr .no-break-before .chapter-head{break-before:auto}
  .ncr .exhibit,.ncr .box,.ncr .cells,.ncr .findings>div,.ncr tr,.ncr .items li{break-inside:avoid}
  .ncr h2,.ncr h3{break-after:avoid}
  .ncr a{color:inherit;text-decoration:none}
  .ncr details{display:block} .ncr details>summary{list-style:none} .ncr details p{display:block}
  .ncr .tbl{overflow:visible}
  .ncr th,.ncr td{padding:4pt 6pt}
}
.ncr table.txt td,.ncr table.txt th{white-space:normal;text-align:left;vertical-align:top}.ncr table.txt td:first-child{min-width:130px}@media print{.ncr table.txt{font-size:7.6pt}}@media print{.ncr thead th{white-space:normal!important;word-break:normal}}.ncr .lbl{display:inline-block;font-family:var(--body);font-size:.64rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:2px 8px;border-radius:999px;vertical-align:middle;line-height:1.6}.ncr .lbl.m{background:#e7eef7;color:#0b2545}.ncr .lbl.o{background:#eef1f4;color:#4a5568}.ncr .lbl.i{background:#e6f2ec;color:#2e7d5b}.ncr .lbl-row{margin:-4px 0 -6px}.ncr .src{font-size:.72rem;color:var(--muted);text-decoration:none;border-bottom:1px dotted var(--muted);margin-left:4px;white-space:nowrap}
.ncr,.ncr{margin:0}`
