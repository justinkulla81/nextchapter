Goal: size how many Google (Alphabet) US jobs our crawler captures versus what Google's own career site lists, and say which filter drops the rest. Read-only analysis. Do not change code, do not push, do not run the import against production.

Context
- NextChapter's board (repo justinkulla81/nextchapter, Supabase table "ExclusiveJobPosting") currently holds about 230 live Google jobs from Google's own career site (host www.google.com, sourceCategory 'employer'). Another ~1,200 "Google" rows are really Careerjet (jobviewtrack.com), Jooble, anitab and Accel board links. Google's own career site lists many more US openings than 230.
- We want direct employer career-site jobs, not aggregator copies. Jobs reports cover all white-collar jobs at every level, entry-level included (Census major occupation groups 1 and 2). The crawler's import screen currently keeps only manager-and-up and senior individual roles, plus a rank floor and a posted-date window.
- Of the Google career-site rows we ever stored, 392 are archived (closeReason 'removed' or 'aged_out'), which hints the crawl does not read the full listing.

Do this
1. Find how ncrawl reads Google's career site (source config, adapter, page or API used, pagination, any result cap or timeout). Say which file and lines.
2. Get the real number of US Google openings from that same source today (count the listing the crawler would read, and note the total Google shows if it differs). Give the count and how you got it.
3. Run the crawl for Google only, in whatever dry-run or no-upload mode ncrawl supports, and count the funnel:
   - listed on the site
   - fetched (list and detail)
   - dropped as non-US
   - dropped by the seniority/title screen (ncrawl/taxonomy.py, screen_job_title and the import floor)
   - dropped by the rank floor
   - dropped by the posted-date window
   - dropped as duplicate or other
   - kept and exported
   Break the seniority drops down by level (entry, early IC, mid, etc.) and list 15 example titles dropped at entry or early level.
4. Compare the kept count with the ~230 live Google rows on our board and say why they differ.
5. Check whether any filter would drop a white-collar entry-level job, and name the setting that would stop that (rank floor, window, title screen).
6. Repeat step 2 and 3 quickly for Apple (jobs.apple.com) so we know if Google is typical.

Report back
A table of the funnel for Google and Apple, the file and line of each filter, and a recommendation ranked by jobs recovered. Mark anything you could not measure. Do not guess numbers.
