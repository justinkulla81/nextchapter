# Prompt for ChatGPT, Grok or Gemini (use Deep Research / web search mode)

Paste everything between the lines into the model. Attach `already-have.csv` (the list of funding programs we already track) in the same message. Run it once per state, then once each for FEDERAL and NATIONAL, changing only the last line.

---

You are a funding researcher for NextChapter, a for-profit startup that sells a job-transition platform: AI retraining and upskilling courses, career exploration and career-pivot navigation, coaching, outplacement, a jobs board for white-collar roles at every level, and a workspace that workforce boards, state agencies and universities use to serve laid-off, long-term-unemployed and career-changing workers. We sell to state workforce agencies, local workforce boards, community colleges, universities and employers.

Find money and contracts that pay a company like NextChapter, or pay our buyers to buy from us. Many programs name a nonprofit, college, workforce board or public agency as the PRIME applicant; a company like us can still take part as a subrecipient, subcontractor, vendor or technology partner. For every result say which role a for-profit has.

## What to find (state AND local; be exhaustive, not selective)

1. Open or recurring competitive grants and funds a for-profit can apply to: state workforce innovation and Governor's-discretionary funds, state AI and future-of-work initiatives, tech-based economic development, SBIR/STTR state matching and technical-assistance grants, State Small Business Credit Initiative (SSBCI) programs, state-funded accelerators, pitch contests and prizes, and regional venture, angel or impact funds that back workforce, edtech or future-of-work companies.
2. RFPs, RFQs, RFIs and procurements: state workforce agency and education department solicitations, local workforce board RFPs (career services, rapid response, AI or digital-skills workshops, career exploration, reskilling platforms, labor-market tools), state and city procurement portal categories to register in, Eligible Training Provider List (ETPL) listings, and cooperative purchasing contracts.
3. Partner-route money: grants that go to workforce boards, community colleges, universities, chambers, economic development groups and nonprofits where we would be the technology or service partner, including recurring state community-college workforce grants, DOL-funded state projects, and the 2026 DOL AI-triggered Rapid Reskill and dislocated-worker grants.
4. Competitor map. Find state, county, city, board and college contracts held by companies that sell what we sell: Geographic Solutions, FutureFit AI, Lightcast (Emsi Burning Glass), the Burning Glass Institute, WIN Learning, Eightfold, Coursera for Government, Guild, Jobs for the Future, Maher & Maher, Equus. For each buyer give what they bought, the amount, the term, and the END or RENEWAL date, because an expiring contract is a bid opportunity. Look in state contract and checkbook portals, board meeting agendas and minutes, council agendas, and press releases.
5. Local and community funders: community foundations, United Way and regional workforce funders, chamber and economic development programs, city and county innovation funds. Name the program, not only the foundation.
6. Include programs that closed in the last 12 months if they recur. Give the usual window and the next expected date.

## Rules

- Do not repeat anything in the attached `already-have.csv`. If you find a newer link or an updated deadline for something on that list, include it and write "UPDATE" at the start of the Why it fits cell.
- Open the funder's own page (.gov, .edu, agency or funder site) and take the amount, deadline and eligibility from it. Do not take them from news summaries or grant aggregator sites; use aggregators only to discover leads, then confirm on the official page.
- Never invent a program, amount, date, person or email. Leave a field blank, or write "not stated", when you cannot confirm it.
- Contact: the named program officer, procurement contact or workforce director if the official page lists one, with the email and phone exactly as published. Otherwise the program office's published mailbox, phone or contact-form URL. Never guess or construct an email address.
- Verification column: write "Verified <today's date> on funder page" only if you opened the funder's page. Otherwise write "Unverified (search result)" or "Unverified (memory)".
- Aim for at least 25 distinct programs for a state, more for large states, and at least 12 you could verify. If you find fewer, say what you searched.

## Output

Return one CSV, in a single code block, with exactly this header row:

Sheet,Rank,Opportunity,Organization,Geography,Funding Type,Score,Deadline / Status,Award Amount,For-Profit Route,Link,Verification,Why it fits,Warm Connection,Connection Title

- Sheet: the constant "Sweep". Rank: blank.
- Opportunity: program, RFP or fund name (include the RFP number if there is one).
- Organization: funder or issuing agency, full official name.
- Geography: two-letter state code, or "U.S.", or "City, ST" / "County, ST" for local.
- Funding Type: one of Grant, RFP / procurement, Contest / prize, Accelerator, Venture / impact fund, SBIR / STTR, Loan / credit, Tax credit, Partner-route grant, Foundation grant, Corporate program, ETPL listing.
- Score: 0 to 10 fit for NextChapter (10 = open to for-profits, matches AI retraining, career exploration or workforce platforms, due soon).
- Deadline / Status: the next date as YYYY-MM-DD if one is published; otherwise words such as "Rolling", "Annual, usually March", or "Closed 2026-08-17; next round expected FY27".
- Award Amount: the amount and term as published.
- For-Profit Route: DIRECT, PARTNER, CUSTOMER or NONE, then a dash and the page's eligibility words. DIRECT = a for-profit may apply. PARTNER = a nonprofit/college/board is the prime and we can join as sub or vendor (name likely primes). CUSTOMER = the awardee buys from us after award. NONE = not accessible.
- Link: full https URL of the program's own page.
- Why it fits: one sentence.
- Warm Connection: the contact person's name if the official page lists one (and "; email; phone" after it). Connection Title: their title.

After the CSV, list in plain text: (a) the pages you could not open, (b) anything you could not verify.

Jurisdiction for this run: ____ (replace with one state, "FEDERAL", or "NATIONAL philanthropy, corporate programs, contests and venture funds")
---
