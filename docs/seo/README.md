# SEO: how pages get their titles and keywords

Source of truth: `src/lib/seo/keywords.ts`. It lists every search phrase NextChapter wants to rank for, grouped in clusters, with one owning page per cluster. `docs/seo/keyword-map.md` is generated from it (`npm run seo:keyword-map`).

- **Single pages** (home, pricing, a `/start/<situation>` page, a `/resources/<guide>`, a `/topics/<topic>`): the cluster holds the title, description and (when the page's own headline does not carry the phrase) the H1. The page calls `pageMetadata('/path')` and `pageH1('/path', fallback)`.
- **Page families** (state, employer, job, board, company pages): wording lives in `src/lib/seo/templates.ts`.
- **Topics with no other home** (severance, resume tips, job search strategy, career pivot, career exploration, executive recruiters, reverse recruiter) are `/topics/<slug>`, written in `src/lib/seo/topics.ts`.
- **Internal links**: `ANCHORS` and `RELATED` in `keywords.ts` drive the "Related" block on guide, situation and topic pages.

Adding a page: add or extend a cluster, give the page its title and description from it, add it to `src/app/sitemap.ts`, run `npm run seo:keyword-map`, and run `npx vitest run src/test/seo-keyword-map.test.ts`. The test fails when a phrase has two owners, an owner page does not exist, a sitemap page has no cluster, or a title or description is the wrong length.

Rules: one owner per phrase; plain, factual wording; "the leading job transition platform" only on home, About and How it works; no claims the company cannot back.
