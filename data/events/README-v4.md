# Events review brief (resolve unverified leads)

You are the reviewer so that the owner does not have to be. `data/events/review-input/chunk-N.json` (your chunk is named in your prompt) lists
events found by earlier research that could NOT be confirmed. For each one, decide, with evidence, and write a decision file
`data/events/review/chunk-N.json`: an array with one object per input row:

```
{ "id": "<same id>", "action": "publish" | "drop" | "jumpball",
  "reason": "one sentence with the evidence (what page you read and what it showed)",
  "patch": { ...fields to set, only for publish... } }
```

## How to decide

1. Find the event's OWN site (organizer or event domain). Try in this order, one request at a time per host: the `url` in the row (`curl -sL -m 20 -A "Mozilla/5.0" URL`
   works on many sites that block WebFetch), then WebSearch for the event name + 2027 (or 2026), then `site:` searches. Read the page text for dates, place, price,
   program and speaker information. Do not rely on aggregator listings (Eventbrite clones, 10times, allevents, conferencealerts); use them only to find the organizer's domain.
2. **publish** when the event's own site shows it is real and recurring AND you can state the next edition's dates (fill `startDate`, `endDate`, `datesConfirmed: true`)
   or, if the next edition is not announced, its usual month (`typicalMonth`) with evidence the event recurs. Put the correct organizer page in `patch.url`.
   Fill in `patch` everything you learned: city, state, country, access, costLow/costHigh/costNote, cheaperWays, speaking (OPEN_CFP only with a public call; BY_INVITE;
   NONE; else UNKNOWN), speakingUrl, speakingDeadline, speakingNote, applyUrl, and `programFormats` (any of KEYNOTE, PANEL, WORKSHOP, BREAKOUT, EXPO, NETWORKING, read from the
   agenda or program page; this matters because any session format means outside speakers exist). Also set `verified: true`, `checkedAt: "2026-10-23"`,
   `source: "official site"` or `"official domain search"`.
3. **drop** when: the event is defunct, cancelled, a one-off, paused, a lead-generation page, a pure webinar series, an aggregator-only listing with no organizer site,
   a duplicate of another event, hourly-worker oriented, outside the US with no US-professional relevance, or you can find no evidence it exists. Say which in `reason`.
4. **jumpball** ONLY when a person must decide something you cannot: a real event whose status is genuinely contradictory (two official pages disagree on whether it will run),
   a membership-gated event where eligibility changes who should see it, or a sensitive/quasi-political event. Not for "I could not load the site": try harder, or drop.
   Expect fewer than 1 in 10 rows to be jump balls. Put the question for the owner in `reason`.
5. Today is 2026-10-23. Events already over with no announced next edition: publish with `startDate: null` and a usual month only if the organizer's site says the event continues;
   otherwise drop.
6. Never write a URL from memory. Work economically: about 4 page opens per row. Write the decision file after every ~10 rows so nothing is lost. Use unique scratch names
   prefixed with your chunk name. Reply with counts of publish / drop / jumpball and the jump ball ids; do not paste the file.
