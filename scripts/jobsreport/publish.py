#!/usr/bin/env python3
"""
Turn a geo's numbers into a finished leave-behind: report.html (standalone, print-ready) and report.pdf.
No model involved. Run geo_report.py first.

  python3 scripts/jobsreport/publish.py --geo pittsburgh [--brand "NextChapter Research"]
"""
import argparse, json, os, subprocess, sys, glob, html as H
HERE = os.path.dirname(os.path.abspath(__file__))
CSS = """
:root{--ink:#18222d;--muted:#5b6770;--accent:#1d4ed8;--tint:#eef3ff;--line:#e1e6ec;--bg:#fff;--band:#0f2a5c}
@media (prefers-color-scheme:dark) and (min-width:1px){:root{--ink:#e8edf2;--muted:#9aa7b2;--accent:#8fb0ff;--tint:#16203a;--line:#2a343d;--bg:#10151a;--band:#0b1c3d}}
@page{size:Letter;margin:0.55in}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
main{max-width:900px;margin:0 auto;padding:0 16px 48px}
header.top{background:var(--band);color:#fff;margin:0 -16px 24px;padding:32px 32px 24px}
header.top h1{font-size:1.9rem;line-height:1.2;margin:0 0 8px;color:#fff}header.top .sub{color:#cdd8ee;margin:0;font-size:.92rem}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:0 0 8px}
.kpi{background:var(--tint);border-left:4px solid var(--accent);border-radius:6px;padding:12px 14px}
.kpi b{display:block;font-size:1.55rem;line-height:1.15;color:var(--accent)}.kpi span{font-size:.78rem;color:var(--muted)}
h2{font-size:1.2rem;margin:36px 0 10px;padding:0 0 6px;border-bottom:2px solid var(--accent);color:var(--ink);break-after:avoid}
h3{font-size:1rem;margin:22px 0 4px;color:var(--accent);break-after:avoid}
p{margin:8px 0}li{margin:4px 0}strong{font-weight:600}
table{border-collapse:collapse;width:100%;margin:12px 0 18px;font-size:.88rem}
th,td{padding:6px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
thead th{background:var(--tint);color:var(--ink);font-weight:600;font-size:.8rem;border-bottom:2px solid var(--accent)}
tbody tr:nth-child(even){background:color-mix(in srgb,var(--tint) 45%,transparent)}
td:not(:first-child),th:not(:first-child){text-align:right}
.foot{margin-top:40px;color:var(--muted);font-size:.8rem;border-top:1px solid var(--line);padding-top:10px}
@media (max-width:640px){.kpis{grid-template-columns:repeat(2,1fr)}table{display:block;overflow-x:auto}}
@media print{h2{break-after:avoid}tr{break-inside:avoid}table{break-inside:auto}}
"""
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--geo", required=True); ap.add_argument("--brand", default="NextChapter Research"); ap.add_argument("--for", dest="for_", default="", help="prospect or audience name for the byline")
    a = ap.parse_args()
    import markdown
    geos = json.load(open(f"{HERE}/geos.json")); label = geos[a.geo]["label"]
    body = subprocess.run([sys.executable, f"{HERE}/doc_body.py", "--geo", a.geo], capture_output=True, text=True, check=True).stdout
    data = json.load(open(f"{HERE}/out/{a.geo}/report-data.json"))[0]
    when = str(data["crawl"]["last_crawl"])[:10]
    o, sg = data["overview"], data["signals"]; lvl = {x["level"]: x["n"] for x in data["levels"]}; wc = o["wc_in_county"]
    kp = [(f"{wc:,}", "white-collar postings read"), (str(o["employers"]), "employers read"), (f"{100*lvl.get('ENTRY',0)/wc:.0f}%" if wc else "n/a", "entry-level share"), (f"${sg['median_annual_pay']:,.0f}" if sg.get("median_annual_pay") else "n/a", "median stated annual pay")]
    kpis = '<div class="kpis">' + "".join(f'<div class="kpi"><b>{v}</b><span>{k}</span></div>' for v, k in kp) + "</div>"
    inner = markdown.markdown(body, extensions=["tables"])
    page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{H.escape(label)} white-collar jobs report</title><style>{CSS}</style></head><body><main>
<header class="top"><h1>{H.escape(label)}: white-collar jobs and employment</h1>
<p class="sub">{("Prepared for " + H.escape(a.for_) + " by ") if a.for_ else "Prepared by "}{H.escape(a.brand)} · career-site data as of {when} · draft</p></header>
{kpis}
{inner}
<p class="foot">Sources: employers' own career sites; U.S. Bureau of Labor Statistics (LAUS, CES); O*NET. Figures describe the employers listed, not every opening in the area.</p>
</main></body></html>"""
    out = f"{HERE}/out/{a.geo}"
    open(f"{out}/report.html", "w").write(page)
    try:
        import asyncio
        from playwright.async_api import async_playwright
        exe = os.environ.get("CHROMIUM_PATH") or next(iter(sorted(glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome"))), None)
        async def pdf():
            async with async_playwright() as p:
                b = await p.chromium.launch(executable_path=exe, args=["--no-sandbox"]); pg = await b.new_page()
                await pg.goto(f"file://{out}/report.html"); await pg.pdf(path=f"{out}/report.pdf", format="Letter", margin={"top": "0.6in", "bottom": "0.6in", "left": "0.6in", "right": "0.6in"}, print_background=True)
                await b.close()
        asyncio.run(pdf()); print(f"{out}/report.pdf")
    except Exception as e:
        print("PDF skipped:", e, file=sys.stderr)
    print(f"{out}/report.html")
if __name__ == "__main__":
    main()
