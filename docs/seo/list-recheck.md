# Weekly re-check of conference employer and speaker lists

Every Sunday evening (ET) a scheduled task (`conference-list-recheck`) reads the sponsor, exhibitor and speaker pages of
conferences whose lists are still empty or whose site changed, and loads only new rows. Rules: `src/lib/conferences/list-recheck.ts`.

- **Due:** published, dates confirmed, official site on file, starting within 120 days (top tier, importance 1, within 240). A conference with lists is re-read only when its site's content hash changed since the last read (state in TopicSnapshot key `listrecheck:v1`). At most 20 a run, top tier first, soonest first.
- **Rows:** names read on the event's own pages; the page states the year; an https source page for every row; no image-file or logo-label names; at most 30 organizations and 25 people per conference. Loaded additively (`createMany skipDuplicates`) into `ConferenceEmployer` and `ConferenceSpeaker`; nothing is updated or deleted.
- **Run:** `scripts/events/list-recheck.sh setup | plan | load | cleanup`. One request at a time per host, Sonnet subagents, 60-minute cap, no email. Skipped when the weekly usage meter is above 90%.
