# Positioning line

**Default: "the leading job transition platform."** Justin approved the "leading" claim on 2026-10-20 and we are building a new category, so the line should be the same everywhere. The source of truth is `POSITIONING` and `FACTS.tagline` in `src/lib/seo/facts.ts`.

## Use it once, at a natural intro

- Site and page meta descriptions, JSON-LD, `llms.txt`.
- The first mention on a page or in a first-contact message: cold outreach, search-firm pitches, a reference invite to someone who has never heard of us, the onboarding welcome.
- Not in every paragraph, every email, or on pages that are already inside the product. Make the point once and move on.

## The exception: B2B pages aimed at a specific budget

"Career platform", "career exploration", "career coaching", "career services" and similar are allowed on a B2B page or pitch only when the buyer's money is earmarked for that area: college career services, WIOA career and training services, a coaching budget, an employer's career-growth (Growth program) spend. Everywhere else use "job transition".

Even there, name the platform once with the standard line, then use the buyer's budget language for the offer. Example: the workforce page says "NextChapter, the leading job transition platform" in its description and "career services that include AI training" in the body.

## Search terms in titles and headings

Owner decision 2026-10-26: we want to rank for the phrases people actually search, including "career coach", "career exploration", "career change", "career pivot" and "professional coach". Those phrases may appear in titles, headings and body copy of any public page that answers that search (the map is `docs/seo/keyword-map.md`). The rule above still governs how we describe NextChapter itself: it is "the leading job transition platform", not a "career platform". A page about career coaching says what the coach does; it does not rename the company.

## Retired wording

"Career-transition platform" and "AI-powered career-transition platform" are retired. `src/test/positioning.test.ts` fails if they come back in source.

## Substantiation

"Leading" is a market-position claim. It is tracked in `docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md` (row 17) with a review date. Keep the claim off any page that compares us to a named competitor on a number we have not verified.
