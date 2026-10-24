# Events research brief, round 2 (full mapping)

Read `data/events/README.md` first: it defines the row schema, the exact industry/function names, and the verification rules.
This round replaces its "aim for 25 to 35 rows" and adds the fields below.

## Your slice

`data/events/slices.json` is a list of slices. Yours is the one whose `id` you were given. It names an industry and 3 to 4
**segments** (sub-industries or communities), each with the **specific jobs** found there. Your goal is the full set of
credible conferences, trade shows, summits and annual meetings that those specific people would attend: at least 6 per segment
where they exist (more is welcome), 25 to 40 rows in all. Write them to `data/events/v2/<slice id>.json`.

`data/events/_existing.txt` lists events already in the catalog (`id | name`). Do not re-add those; skip any you find that match.
(If an existing event also fits your segment, ignore it; the merge handles that.)

## What counts

- **Niche is welcome; small is fine; but credible.** Credible means: run by a recognized association, society, publisher, company or
  institution; a working official website with a named organizer; a real recurring event (not a one-off webinar or a lead-gen page).
  Include state and regional association conventions when they are substantial (for example a state teachers' association convention,
  a regional bankers' association meeting) and user conferences of major vendors when the audience is a specific job (ERP, CRM, EHR).
- US-first. Include a few international flagships only when American professionals in that segment routinely attend.
- Professional audiences only. No hourly-worker job fairs, no pure trade-buyer shows with no professional content for the roles listed.
- The next edition must not have ended before 2026-10-23. If the current edition just ended and the next is unannounced, keep the row with
  `startDate` null, `datesConfirmed` false and `typicalMonth` set, as long as the event clearly recurs.

## Extra fields on every row (in addition to README.md)

- `segments`: array of segment names copied EXACTLY from your slice (one or more; an event can span segments in the same industry).
- `roles`: array of the specific jobs from your slice's role lists that the event is aimed at (lower-case, exactly as listed there).
  Add others only if they are real job titles for the audience. Use [] only if the event is for the whole segment with no narrower job.
- `journeys`: array from LAID_OFF, EXPLORING_MOVE, GROWING, PROMOTION, CAREER_CHANGE, STUDENT_NEW_GRAD, RETURNING, NEXT_ACT, ENTREPRENEUR, FRACTIONAL
  for journeys the event especially suits (a startup-founders event: ENTREPRENEUR; a retired-executive board forum: NEXT_ACT). [] if any.
- `industries`: the slice's industry name. For the slice industry "Business Ownership & Entrepreneurship" (not an app industry) use [].
- `functions`: only functions the event is clearly for (exact names); [] if for the whole profession.

## Fill cost and speaking in the same pass

For each row read the registration/pricing page and the speaker / call-for-proposals page: set `costLow`/`costHigh` (USD, standard individual
pass), `costNote`, `access`, `cheaperWays` (volunteer, scholarship, student/new-professional rates, job-seeker or unemployed rates, member rates,
expo-only pass), `speaking`, `speakingUrl`, `speakingDeadline`, `speakingNote`. Unknown stays null / UNKNOWN; never guess.

## Verification standard (relaxed from round 1, still honest)

`verified: true` when the event's OWN domain shows the next edition's dates or usual month and what it is. You may read the official domain
through a WebSearch result restricted to that domain (`site:example.org ...`) when a direct fetch returns 403. Put which you used in `source`
("official site" or "official domain search"). Anything you only found on third-party listing sites stays `verified: false` (kept as a lead).

## Working rules

- Load WebSearch and WebFetch via ToolSearch (query "select:WebSearch,WebFetch"). Do not run git. Write only your one output file.
- One request at a time per host. About 150 page opens or searches is plenty. Be efficient: search for "<segment> annual conference <job>",
  "<association name> annual meeting 2027", then open each official site once.
- Reply with: rows, verified count, segments with fewer than 4 rows, and anything notable. Do not paste the JSON.
