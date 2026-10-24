# Price pass brief

`data/events/price-input/chunk-N.json` (named in your prompt) lists events that have confirmed upcoming dates but no attendee price on file.
Find the real price on the event's OWN site and write `data/events/patches/price-N.json`: an array with ONE object per event where you
found something (skip events where you found nothing):

```
{ "id": "<same id>",
  "patch": { "costLow": 995, "costHigh": 1895, "costNote": "Early bird $995 until Jan 31; standard $1,495; onsite $1,895. Member rates $200 less.",
             "cheaperWays": "Student pass $149; volunteer passes; expo-only pass $99." } }
```

Rules:
- Prices are USD whole dollars for a standard individual attendee pass: `costLow` is the cheapest paid tier (early bird counts), `costHigh` the highest standard or onsite tier. Not exhibitor, VIP, workshop add-ons or group rates. If the price is in another currency, leave costLow/High out and put it in `costNote`.
- Only use the organizer's own domain: the registration, tickets, pricing, FAQ or "attend" page (a domain-restricted search result counts). Never use ticket resellers or listing sites. If the site blocks automated reads (403, bot check, JS wall), do NOT work around it: skip that event.
- If the page says the event is free, set `"access": "FREE"` and no cost. If it says invitation only or application, set `"access": "INVITE"` or `"APPLY"` with `applyUrl` when shown. If a price is not yet posted for this edition, skip it (do not copy last year's price into costLow/High; you may mention "2026 price was $X" in `costNote` only if the page shows it).
- Also record `cheaperWays` when the same page shows student, new-professional, job-seeker, nonprofit, government, retiree, volunteer, scholarship or expo-only options.
- One request at a time per host; roughly 3 page opens per event at most. Write the file after every ~10 events. Never guess or use memory for a price.
- Reply with: events checked, how many got a price, how many were free/invite/apply, how many sites blocked. Do not paste the JSON.
