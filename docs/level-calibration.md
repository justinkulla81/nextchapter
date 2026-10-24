# Job level calibration (2026-10-23)

Owner's principle: title alone isn't the level. A VP at Google is extremely senior; a VP
at an investment bank is a mid-career grade; a small company's CEO is not a Fortune 500
C-suite job, and a funded startup's CEO can be exactly that.

Two mechanisms, kept apart on purpose:

1. **Stored-level corrections** change `ExclusiveJobPosting.level` (and ncrawl's
   `jobs.level`). They are what the level mix reports count, so they must be real
   corrections. All are explicit allowlists in `ncrawl/taxonomy.py` (`calibrate_level`),
   exported to `src/lib/jobs/job-seniority-rules.generated.ts` and mirrored by
   `calibrateLevel` in `src/lib/jobs/job-seniority.ts` (parity fixture
   `src/test/fixtures/level-calibration-parity.json`).
2. **Level flex** never changes a stored level. It lets matching treat a job's level as a
   small range (`src/lib/jobs/level-flex.ts`), and it is the one mechanism for every
   "this title can read a level higher or lower" case. It changes fit scoring and level
   distance only, never which rows a member's stage window holds (so the level gate's
   wrong-level count cannot rise because of it).

## 1. Stored-level corrections

### Industry title ladders (employer allowlists, never a broad industry tag)

| Ladder | Employers | Title | Stored level |
|---|---|---|---|
| Bank / asset manager / fund | `BANK_LADDER_EMPLOYERS` (bulge-bracket and large foreign banks' corporate and investment arms, custody banks, elite boutiques, the big asset managers, PE and hedge funds) | Analyst, Associate | unchanged (early / mid rungs) |
| | | Assistant / Associate Vice President, AVP | MID_IC |
| | | Vice President | SENIOR_IC |
| | | Director, Executive Director, Senior Director, SVP | SR_MANAGER |
| | | Managing Director | DIRECTOR |
| | | any title naming the job too (Chief, Head, President, General Counsel, Treasurer, Controller, Senior Managing Director, Branch Manager) | unchanged |
| Consulting | `CONSULTING_EMPLOYERS` (MBB, Big 4 advisory and tax, the large advisory firms) | Analyst / Associate / Consultant | unchanged |
| | | Senior Consultant | MID_IC (unless 7+ years asked) |
| | | Manager / Senior Manager / Director | unchanged (MANAGER / SR_MANAGER / DIRECTOR) |
| | | Partner | unchanged (PARTNER) |
| Big 4 and large accounting firms (audit) | `ACCOUNTING_FIRMS` | Staff | unchanged (ENTRY / EARLY via STAFF_ENTRY) |
| | | Senior (Audit Senior, Senior Associate) | MID_IC |
| | | Manager / Senior Manager / Director / Partner | unchanged |
| | | Principal (a practice principal, not "Principal Consultant / Engineer") | PARTNER |

Regional US banks and insurers are not on the bank list: they use ordinary corporate
titles, and "financial_services" as an industry tag also covers them. Fidelity was taken
off the list after the labelled sample marked its VP rows as true VPs.

### Title conventions (every employer)

| Rule | Allowlist | Stored level | Matching flex |
|---|---|---|---|
| IC-style "Manager" | `IC_STYLE_MANAGER`: account, client, relationship, capture, sourcing, procurement, category, contract, channel, partner, alliance, product / field / regional marketing, territory / regional / district sales, program, project, case, supplier, grants, spend, customer success, technical account managers; never lead / head / director / group / team / people / PMO / "Manager, X" | SENIOR_IC, unless the posting talks about direct reports or leading a team (`TEAM_DESC`) | +1 (MANAGER) |
| Mid-level "Senior" | `SENIOR_MID_IC`: Senior Accountant / Auditor / Tax or Audit Associate, `<noun> III`, Staff `<X>` Analyst, Senior Associate outside law; Senior Consultant at a consulting firm | MID_IC, unless the posting asks 7+ years | +1 (SENIOR_IC) |
| Quota sales "Director" | `SALES_DIRECTOR_IC`: Account / Client / Business Development Director, Director of Strategic / Key / Enterprise Accounts, "Director, Account Manager" (never Director of Sales, fundraising or creative titles) | SENIOR_IC, unless the posting shows a team | +2 (MANAGER, SR_MANAGER) |

The R1-R4 years rule for IC managers asking 5 years or fewer runs first and is unchanged.

## 2. Level flex by employer scale (matching only)

Size comes from the curated static list, the permanent `CompanySizeLookup` cache and
`Company.sizeBand` (`loadBoardCompanySizes`, no LLM call). Unknown size: no change.

| Employer | Down flex |
|---|---|
| non-startup, under ~50 people (MICRO, SMALL) | 2 levels |
| non-startup, ~50-200 (SMALL_MID) | 1 level |
| startup (VC / PE portfolio board, YC / accelerator, startup source) of known size under ~200 | 1 level at most; a small headcount never makes a startup title less senior |
| mega-cap (`MEGA_CAP_EMPLOYERS`: big tech + Fortune 100) or MEGA band | never |

The stated level is always the top of a down flex. No size rule ever moves a title up.

## 3. Career high point (member side)

`src/lib/profile/career-high-point.ts`: the highest level a member reached, scaled by the
employer where they reached it, derived from work history (no LLM call) and stored on
`CandidateProfile.searchExpansion.careerHighPoint` (`derived`, and the member's own
correction `member`, which wins). Shown as one line under "Seniority — highest level
reached" on Search Strategy; editing it fires `career_high_point_edited`.

In matching (`job-fit-bucket.ts` level step, the board and Job Search Daily):

- peak at a non-startup employer under ~50: matches one level lower at scale (a VP there
  fits Director / Senior Manager roles), startup roles at the peak level still fit;
- peak at a non-startup employer of ~50-200: also fits one level lower;
- peak at a large employer (5,000+): startup and small-company roles one level up fit (a
  big-company VP is a startup CEO candidate), and big-company roles one level down fit;
- peak at a startup, a mid-size employer, or of unknown size: no change.

A derived point only counts when it names the member's stated level; a correction always counts.

## Gate

Every change runs through `~/nc-level-gate` (fresh base from origin/main): no member list
may get more wrong-level rows, and Job Search Daily stays at 0 wrong.
