#!/usr/bin/env python3
"""
Turn a geo's numbers into a finished leave-behind: report.html (standalone, print-ready) and report.pdf.
No model involved. Run geo_report.py first.

  python3 scripts/jobsreport/publish.py --geo pittsburgh [--brand "NextChapter Research"]
"""
import argparse, json, os, subprocess, sys, glob, html as H
HERE = os.path.dirname(os.path.abspath(__file__))
CSS = """
:root{--ink:#1f2933;--muted:#5b6770;--accent:#1d4ed8;--line:#e5e9ee;--bg:#fff}
@media (prefers-color-scheme:dark){:root{--ink:#e8edf2;--muted:#9aa7b2;--accent:#7aa2ff;--line:#2a343d;--bg:#10151a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:860px;margin:0 auto;padding:32px 16px 64px}
h1{font-size:2rem;line-height:1.2;margin:0 0 8px}h2{font-size:1.25rem;margin:40px 0 8px;padding-top:8px;border-top:1px solid var(--line)}
.sub{color:var(--muted);margin:0 0 24px}
table{border-collapse:collapse;width:100%;margin:16px 0;font-size:.92rem;display:block;overflow-x:auto}
th,td{padding:8px 12px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}
th{font-weight:600;color:var(--muted);font-size:.8rem;text-transform:none}td:not(:first-child),th:not(:first-child){text-align:right}
li{margin:4px 0}strong{font-weight:600}.foot{margin-top:48px;color:var(--muted);font-size:.85rem}
@media print{body{background:#fff;color:#000}h2{break-after:avoid}table{display:table}tr{break-inside:avoid}}
"""
def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--geo", required=True); ap.add_argument("--brand", default="NextChapter Research")
    a = ap.parse_args()
    import markdown
    geos = json.load(open(f"{HERE}/geos.json")); label = geos[a.geo]["label"]
    body = subprocess.run([sys.executable, f"{HERE}/doc_body.py", "--geo", a.geo], capture_output=True, text=True, check=True).stdout
    data = json.load(open(f"{HERE}/out/{a.geo}/report-data.json"))[0]
    when = str(data["crawl"]["last_crawl"])[:10]
    inner = markdown.markdown(body, extensions=["tables"])
    page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{H.escape(label)} white-collar jobs report</title><style>{CSS}</style></head><body><main>
<h1>{H.escape(label)}: white-collar jobs and employment</h1>
<p class="sub">Prepared by {H.escape(a.brand)} · career-site data as of {when}</p>
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
