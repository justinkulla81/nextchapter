# Wave 3 recruiter research brief

You are building a list of real, named RECRUITERS for NextChapter (a job-transition platform). Your specific scope is in your task message; everything below applies to all scopes.

## Who counts
People who actually place candidates: executive search consultants, partners/principals/managing directors/practice leaders who run searches at search firms, professional and contingent recruiters, sourcers, and talent-acquisition recruiters AT recruiting/staffing/search firms. White-collar placements at all levels (not hourly/light-industrial).

EXCLUDE: assistants, coordinators, researchers, administrators, office managers, finance/operations/marketing/IT/HR/BD staff at those firms; in-house corporate recruiters at employers; board members who do not run searches. If a page lists a mixed staff, take only the recruiting people.

Capture each firm's WHOLE relevant recruiting roster from its team page, not one or two names. Prefer many people per firm over many one-person firms.

## Method
- WebSearch and WebFetch on firms' own public team/contact pages. No LinkedIn, no logins.
- Be economical: your search budget is limited (about 200 searches). Use searches to find firm team-page URLs, then WebFetch the pages, which cost nothing against the search budget. Finish the whole scope; do not spend everything on the first firm.
- Email/phone ONLY if the firm's page publishes it for that person; never guess or construct either.
- Every row needs a sourceUrl where that person is actually listed. Do not invent anyone. If a firm's site is dead, parked, blocked or lists no names, skip it and say so.
- State = the person's office state (two-letter) when stated; otherwise the firm's HQ state. Use "DC" for Washington DC.

## Output
Write a JSON array to the file path in your task message, in /Users/salitkulla/nextchapter/.claude/worktrees/recruiter-firms/data/recruiters/. Each element exactly:
{"fullName":"","title":"","firm":"","firmWebsite":"https://...","city":"","state":"TX","email":"(only if published, else omit)","phone":"(only if published, else omit)","sourceUrl":"https://...","industries":[...],"functions":[...],"coverageStates":["TX"]}
- fullName: the person's name only (no ", MD", credentials, or titles).
- industries from: technology, industrial, financial_services, healthcare, consumer, aerospace_defense, professional_services, education, life_sciences, government, energy, logistics, media, nonprofit, real_estate, agriculture, telecom.
- functions from: engineering, data_ai, it_security, product_design, sales, marketing, finance, hr, legal, operations, clinical, executive, customer, education, trades.
- Tag industries/functions from the person's or firm's stated practice area on the page, not guesses; leave empty if unstated.
- coverageStates: the states their office/practice covers; "NATIONAL" only if the page says they search nationally.
- No duplicates. Validate the file parses as JSON. Write the file even if you run short; partial results are fine.

Final reply under 100 words: rows, firms, firms skipped and why.
