# The 507 employers with no source: which job system each runs (first 70, 2026-11-13)

Follow-up to `go-direct-2026-11-13.md`. For the 70 largest not-found employers (by Jooble and Careerjet jobs), `career_site.py` looked for a career host and the job system behind it.

| Result | Employers | Aggregator jobs |
|---|---|---|
| No career host found by guessing from the name (needs a hand search, following the Apply links) | 41 | 7,764 |
| Phenom | 3: Honda Development & Manufacturing 215, Hibu 214, US Foods 126 | 555 |
| Eightfold | 2: Northrop Grumman 194, Lumen 73 | 267 |
| SuccessFactors | 2: Capgemini 107, Gainwell Technologies 94 | 201 |
| Taleo / Radancy | 1: LHC Group | 179 |
| Radancy and BrassRing | 1: Walgreens | 94 |

The other 20 of the 70 have a career host but no system link the probe recognises.

The crawler already has Phenom, Eightfold and SuccessFactors adapters (nextchapter-jobs README), so those employers need a source line, not a new adapter. The largest (Maximus 895, Saab 814, Yo AI Labs 726, Michael Page 653, Actalent 622, Deloitte 402, LHH 306, Kforce 294, EY 243, AECOM 203, Lockheed Martin 175, Siemens, Adecco) returned no readable career host from the name alone: follow the Apply links from their careers pages. Saab is already a Workday source in the crawler; Northrop, Lockheed, Deloitte, EY and AECOM already have direct rows from another source, so their Jooble remainder is a coverage gap in those sources.

ADP runs its own server-rendered site (`jobs.adp.com`, see `jooble-to-direct-phase2.md`); its adapter is still to be built.

Held in the crawler: 29 SmartRecruiters sources, because the `smartrecruiters_html` adapter stores no description (0 bytes in the dry run), so those jobs stay off Google. Fixing that adapter unlocks about 2,800 kept rows (Prosidian 1,738, Turner & Townsend 660, Eurofins 131, Hattori Hanzo Shears 47 and others).
