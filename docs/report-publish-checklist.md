# Report publish checklist

Run this every time a new monthly NextChapter report goes live.

1. Publish the report page and its data files (CSV, figures) under `src/app/reports/`.
2. Pull every statistic the report sources and note its source URL, date and evidence tag ([P] primary, [S] press, [L] vendor/self-reported).
3. Update the homepage hero stats in `src/app/page.tsx` (`heroStats`).
4. Update the "why stuck" stats in `src/components/home/ByTheNumbers.tsx`.
5. Check the sub-pages that cite report figures: `/unemployment-benefits`, `/layoffs/[state]`, `/outplacement`, `/insights/*`, `/reports` index, `/why-stuck`.
6. Refresh `src/app/llms.txt/route.ts` and `src/app/llms-full.txt/route.ts` so AI-readable summaries match the new figures.
7. Check the news feed and sitemap entries still point to live pages.
8. Replace any stat that cannot be sourced to the latest report with a marked "unverified" note, or remove it. Do not leave unsourced figures in place.
9. Use balanced wording: name both the bright spots and the concerns, and do not overstate a positive or hide a negative figure.
10. Run the test suite and a production build before pushing.
