# Claude Code prompt: publish report version 1.2 (Q3 addendum and correction)

How to run it:

1. Open Terminal.
2. Type `cd ~/nextchapter` and press Enter.
3. Type `claude` and press Enter.
4. If you have not yet run the version 1.1 and email-capture prompt, first type: `Read incoming-report/claude-code-report-v1.1-and-email-capture.md and do it.` and finish that.
5. Then type: `Read incoming-report/claude-code-report-v1.2.md and do it.` and press Enter.

---

You are publishing version 1.2 of the NextChapter Displacement Report (September 2026). Read `CLAUDE.md`, `AGENTS.md` and `design-principles.md` first. Show me the diff and screenshots before deploying.

1. **Replace the edition page.** The new source is `incoming-report/displacement-report-september-2026.html`. Port it into `src/app/reports/displacement-report-september-2026` exactly as earlier versions were ported: server-rendered text, scoped CSS (including the new `table.txt` rule), chart script via `next/script`. Keep the newsletter signup component in place of `#newsletter-slot`, and keep the pop-up and PDF email gate from the 1.1 prompt working.
2. **New sections in 1.2** (all must render and appear in the contents rail):
   - "What this report does and does not establish" box
   - Chapter 05 "What leading researchers are finding"
   - Q3 2026 quarterly addendum
   - Two features: the history of automation, and remote work
   - Future research agenda
   - Appendix D, the revision audit
   - The corrected Chapter 03, with its correction box
3. **Replace or add files in `public/reports/`:**
   - `displacement-report-2026-09.pdf` (new, 48 pages)
   - `displacement-report-2026-09-data.csv`
   - `sec-item205-ai-coding-2026.csv` (new)
   - `displacement-report-2026-q3-revenue-per-employee.csv` (new)
   - Keep `wc-index.csv` as is.
4. **Metadata:**
   - Set `dateModified` in the JSON-LD and `article:modified_time` to 2026-10-06.
   - Update the meta description to say "White-Collar Long-Term Unemployment Index" (the index was renamed; the URL stays the same).
   - Add a visible "Corrected October 6, 2026" note near the top of the page linking to the correction box in Chapter 03.
5. **Dataset JSON-LD:** add the two new CSVs as `distribution` entries.
6. **News tab:** add a short news item: "Correction and Q3 addendum: NextChapter Displacement Report v1.2", linking to the report. Use the existing `scripts/displacement/add-news-item.ts`.
7. **Checks:**
   - Run `npm run build` and `npm run lint`.
   - Run Lighthouse on the page; SEO and Accessibility must not drop.
   - Take screenshots of the Q3 addendum tables on desktop and phone width; tables must scroll sideways inside their box, not the page.
   - After I approve and you deploy, run the IndexNow script for the report URL and request re-indexing in Google Search Console.
