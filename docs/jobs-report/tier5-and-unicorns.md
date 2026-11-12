# Tier 5 (large employers with no direct rows) and US unicorns, 2026-11-12

## Tier 5: 75 large employers that had no direct rows

Source list: the ENTERPRISE and MEGA companies with no employer-listed rows on the board (production, 2026-11-12). Matched by exact name,
so a company listed under another name (Ford / Ford Motor Company) can show as zero. Career sites only (`scripts/jobsreport/career_site.py`).

**Readable now (14 sources, `scripts/jobsreport/sources/jooble-tier5.json`):** Workday: U.S. Bank (1,224 jobs, all countries), Merck (826),
Toyota (117), Baxter (545), Regal Rexnord (592), Carrier (1,003), Intel (879), Micron (2,898), Cigna (548), Kyndryl (29: the early-careers site only,
find the full one). Oracle HCM: Ford, JPMorgan Chase, Uber. Jibe: AMD. BBVA's Workday board is Spain-only and was dropped.

**Career site found, system needs an adapter:** Phenom (GE Aerospace, Honda, Honeywell, ICF, PNC, Adobe, Thermo Fisher, BAE Systems, Southwest Airlines,
Lowe's, PPG, Philips), Eightfold (Qualcomm, Keurig Dr Pepper, Lumen), SAP SuccessFactors (Capgemini, CRH, PG&E, McDonald's, Dana), Radancy (Veolia, Munich Re,
Stellantis), Taleo/Avature (Victoria's Secret), BrassRing (Thermo Fisher).

**Career site found, system not identified from the page:** Aramark, Huntington, Johns Hopkins, Assa Abloy, Atlas Copco, Siemens Energy, Rexel, Legrand,
Magna, Dell, Best Buy, FedEx, Capital One, ADP, Dillard's, Hearst, BASF, IFF, BNY Mellon, HCA.

**No career host found by name:** Maximus, Omnicom, Schneider Electric, Healthcare Services Group, Samsung, Sodexo, Relx, Jacobs, KinderCare, Willis Towers Watson,
Urban Outfitters, Infosys, AIG, TCS, CBRE, Airbus, HSBC, Tesla, EY, Coca-Cola, UPS, General Dynamics, Acadia Healthcare, Linde, EMCOR, Rocket Companies,
Warner Bros. Discovery (the probe hit a university, not the company).

## US unicorns

`docs/jobs-report/us-unicorns.csv`: 278 companies whose country includes the United States, parsed from Wikipedia's "List of unicorn startup
companies" (644 unicorns worldwide). That list is incomplete next to CB Insights (about 1,300 worldwide), which is not readable without a subscription.
Treat the 278 as a floor.

`scripts/jobsreport/unicorn_probe.py` tried each name as a Greenhouse, Lever and Ashby board address (full name and no-suffix form only, no first-word
guesses). Result: 153 of 278 have a board (82 Greenhouse, 59 Ashby, 12 Lever) holding 14,577 jobs, all countries. Greenhouse matches are checked
against the board's own name. Lever and Ashby matches are by address only, so each needs its company name verified before import
(`sources/unicorns-us.json`, report in `out/unicorns-us-report.json`). The other 125 use another system (Workday, Rippling, Workable, custom) and need
`career_site.py`.
