# Events research brief, round 3 (gap fill by journey, function and region)

Same rules, schema and verification standard as `data/events/README.md` and `data/events/README-v2.md` (read both first). The difference:
your assignment is a FOCUS (given in your prompt) rather than a slice. Write `data/events/v3/<focus id>.json`, 25 to 40 rows.

- `data/events/slices.json` holds the whole taxonomy: every industry, each segment's exact name and its specific jobs. For every row choose
  the best-fitting `segments` (exact names, any industry) and `roles` (lower-case jobs from those lists; add real job titles if none fit).
  An event can match several industries; list them all in `industries`.
- Avoid duplicates: `data/events/_existing.txt` lists the original catalog (`id | name`); also run
  `cat data/events/v2/*.json | grep -o '"name": "[^"]*"' | sort -u` (or an equivalent small script) and skip names already there, unless the
  event serves your focus audience in a way the existing row's tags do not (then still skip; the merge will combine tags if the name matches).
- Tag `journeys` carefully; it is the point of rounds like this: LAID_OFF, EXPLORING_MOVE, GROWING, PROMOTION, CAREER_CHANGE,
  STUDENT_NEW_GRAD, RETURNING, NEXT_ACT, ENTREPRENEUR, FRACTIONAL. And `seniorities` (EARLY, MID, SENIOR, EXECUTIVE).
- Prefer events a professional can realistically attend and that lead to introductions, jobs, clients or speaking: associations' annual
  meetings, regional chapters of national bodies with flagship local events, university-run professional conferences, and well-run
  independent conferences. Skip job-board "virtual fairs" with no content and anything pay-to-play with no program.
- For price and speaking, read the registration and speaker pages as in round 2. For `cheaperWays` look specifically for: new-professional,
  student, job-seeker/unemployed, veteran, retiree/55+, volunteer, scholarship and member rates.
- Never write a URL from memory. Use unique scratch file names prefixed with your focus id; write only your one output file.
- Reply with: rows, verified count, notable gaps. Do not paste the JSON.
