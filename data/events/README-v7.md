# Regional events brief

Same schema, vocabularies and verification standard as data/events/README.md, README-v2.md and README-v3.md (read all three). FOCUS: credible
professional conferences, summits and annual meetings that are tied to a PLACE: state and regional association conventions (state bar,
state hospital and medical associations, state teachers' and school-board associations, state CPA societies, state bankers and credit
union leagues, state chambers and economic-development summits, state municipal leagues, state realtor and builder associations,
state nonprofit associations, state bar of other professions), flagship events of regional chapters of national bodies, metro business and
innovation weeks, regional startup and founder events, university-run regional professional conferences, and regional trade shows with a real
professional program. Credible = named organizer, working official site, recurring.

- Set `state` (2 letters) and `city` on every row, `country` "US". Tag `segments` and `roles` from data/events/slices.json (exact segment names) and
  `industries`, `functions`, `seniorities`, `journeys` as usual. `importance` is 2 or 3 unless it is the flagship event of that state's profession.
- Do not repeat events already in the catalog: skim data/events/_existing.txt and the names in data/events/v2, v3 and the top-level data/events/*.json (a
  small script or grep over the "name" fields is fine; write scripts only under your focus name in the scratch area).
- Next edition must not have ended before 2026-10-24; if unannounced keep `startDate` null with `typicalMonth` when the site shows it recurs.
- Read the registration and speaker pages for price, cheaperWays and speaking as in round 2; unknown stays null. Never write a URL from memory. One request at a time per host.
- Write the output with the Write tool only: data/events/v3/<focus id>.json, 30 to 45 rows. Write it early and append as you go.
- Reply with rows, verified count, states covered and gaps. Do not paste the JSON.
