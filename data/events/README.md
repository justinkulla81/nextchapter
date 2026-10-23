# Events research brief

Goal: the important conferences, trade shows and summits a US professional should attend (to network, learn,
or speak) for each industry, function and seniority. Each row says what it costs, whether there is a cheaper
way in, how to speak, and whether it is invitation-only or apply-to-attend. Candidates see the rows the CRM
publishes, so every fact must come from the event's OWN site, not from memory.

Today is 2026-10-23. We want the NEXT edition that has not ended yet (dates after 2026-10-23).

## Output

Write ONE JSON file (array of rows) to `data/events/<your-slice>.json`. Row shape (all keys required; use null for unknown):

```
{
  "id": "slug-of-event-name",            // lowercase-hyphen, no year, e.g. "sxsw", "money2020-usa"
  "name": "Money20/20 USA",
  "organizer": "Ascential" | null,
  "url": "https://...",                  // the event's own home page (required; skip the event if you cannot find it)
  "kind": "CONFERENCE" | "TRADE_SHOW" | "SUMMIT" | "WORKSHOP",
  "format": "IN_PERSON" | "VIRTUAL" | "HYBRID",
  "startDate": "2027-03-14" | null,      // next edition, ISO date
  "endDate": "2027-03-18" | null,
  "datesConfirmed": true | false,        // true ONLY if the official site shows these exact dates
  "typicalMonth": "March" | null,        // always fill when you know it, even if dates are confirmed
  "city": "Las Vegas" | null, "state": "NV" | null, "country": "US",
  "industries": [..],                    // EXACT names from the list below; [] = every industry
  "functions": [..],                     // EXACT names from the list below; [] = every function
  "seniorities": [..],                   // any of EARLY, MID, SENIOR, EXECUTIVE; [] = every level
  "importance": 1 | 2 | 3,               // 1 flagship (the event of its field), 2 major, 3 niche but worth it
  "whyAttend": "One plain sentence on the networking value: who is in the room.",
  "access": "PAID" | "FREE" | "INVITE" | "APPLY" | "MIXED",
  "costLow": 799 | null, "costHigh": 2499 | null,   // USD whole dollars, cheapest and priciest standard attendee pass
  "costNote": "Early-bird until Jan 31; exhibitors extra." | null,
  "speaking": "OPEN_CFP" | "BY_INVITE" | "NONE" | "UNKNOWN",
  "speakingUrl": "https://..." | null,
  "speakingDeadline": "2027-01-15" | null,
  "speakingNote": "Panels chosen by committee; 30-minute breakouts." | null,
  "cheaperWays": "Volunteer crew gets a free pass; $99 expo-only pass; student rate $149." | null,
  "applyUrl": "https://..." | null,      // application or invitation page when access is INVITE or APPLY
  "applyDeadline": null,
  "published": <same as verified>,
  "verified": true | false,              // true ONLY if you opened the official site this session and the facts above come from it
  "checkedAt": "2026-10-23" | null,      // set when verified
  "source": "official site" | "official site + press",
  "kindNote": null
}
```

(Leave out `kindNote`; it is not a column.)

## Exact names

Functions: Operations, Marketing, Finance, Sales, Engineering, Product, Design, Human Resources, Administration, Legal, Customer Success, Data & Analytics, Executive Leadership.
Industries: Venture Capital & Private Equity; Financial Services & Banking; Insurance; Accounting & Audit; Legal Services; Professional Services & Consulting; Technology & Software; Telecommunications; Healthcare & Hospital Systems; Pharmaceuticals & Biotech; Medical Devices; Retail & E-commerce; Consumer Packaged Goods; Hospitality, Travel & Food Service; Agriculture & Food Production; Manufacturing & Industrial; Automotive & Mobility; Aerospace & Defense; Energy & Utilities; Construction & Real Estate; Transportation & Logistics; Media & Entertainment; Advertising, Marketing & PR; Education & EdTech; Government & Public Sector; Nonprofit & Social Impact; Staffing & Human Capital.

## Rules

1. Facts come from the official site (open it with WebFetch; find it with WebSearch). A fact you could not confirm is null (or "UNKNOWN" for speaking), never a guess. A row where you confirmed the event exists and the url but not the details is still useful: set `verified` false and `published` false.
2. `verified: true` needs: the official page opened, the next edition's dates (or the usual month) read from it, and the access/cost line read from it (or an explicit "price not published"). Do not mark verified from search snippets or memory.
3. Cost: `costLow` / `costHigh` are USD for a standard individual attendee pass (not exhibitor, not VIP-only). If pricing is behind a form, leave null and say so in `costNote`. FREE events: access FREE, costs null. Free expo but paid sessions: MIXED.
4. Speaking: OPEN_CFP only if the site has a public call for speakers/proposals (give the link and deadline). BY_INVITE if speakers are curated/invited and the site says how to be considered. NONE if clearly no external speakers. Otherwise UNKNOWN.
5. `cheaperWays`: volunteer programs, scholarships, student/early-career/job-seeker/unemployed rates, expo-only passes, press passes, virtual passes, free regional/local chapters. Only what the site states.
6. INVITE vs APPLY: INVITE = people cannot buy a ticket (invite only, member only). APPLY = a ticket exists but an application/approval is required. Put the page in `applyUrl`.
7. Professional audiences only (white-collar and professional roles at every level). No hourly-worker job fairs. Include a mix: flagships plus smaller high-signal events. Aim for 25 to 35 rows. Skip events that have ended or been cancelled, and defunct ones. Prefer in-person or hybrid events in the US; include a few virtual and international flagships if they matter to the field.
8. Tag honestly: `seniorities` is who the programming is pitched at (an executive-only forum is ["EXECUTIVE"] or ["SENIOR","EXECUTIVE"]; a big broad show is [] or all four). `importance` 1 only for the true flagship of a field.
9. Do not run more than one request at a time against the same host. Do not open more than ~120 pages total.
10. When finished, reply with a count of rows, how many verified, and anything you could not find. Do not paste the JSON in the reply.
