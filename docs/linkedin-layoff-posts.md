# LinkedIn layoff posts

How suggested LinkedIn posts about layoffs are made, and the rules for rewriting them.

## Pipeline

1. `runLinkedInDraftSweep` (`src/lib/linkedin/layoff-post-sweep.ts`) runs at the end of the
   layoff-news cron, every three hours. No model call.
2. A layoff gets a draft only if it is credible (`credibilityOf` in `layoff-post-rules.ts`):
   a state WARN filing, an SEC filing, or news from two publishers or one trusted outlet; 100 jobs
   or more; first filed in the last 10 days; not dismissed. At most five new drafts in any seven days,
   biggest first.
3. Each draft gets a template post, a first comment holding the tracked link, an image card, tag
   suggestions, and a staggered weekday slot (8:15, 12:10, 17:20 ET; at most one a day).
4. The queue is https://launchyournextchapter.com/support/admin/linkedin-drafts. An admin can post a draft with one
   click (as the NextChapter page, with the link as the first comment), or copy it and post by hand.
5. Scheduled posting (`runScheduledLinkedInPosting` in `src/lib/linkedin/scheduled-posting.ts`) runs from the hourly
   layoff-news cron (the project is at Vercel's cron limit), so a draft due at 8:15 ET goes out at 8:20. It is off unless
   `LINKEDIN_AUTOPOST=on`. Rules: one post per run and none within six hours of another post; only drafts from a state
   WARN filing or an SEC filing (news-sourced drafts wait for a person); a draft more than 24 hours past its slot is left
   alone; a failure puts the draft back and the next run retries until it goes stale. It needs a live page connection
   (connect at https://launchyournextchapter.com/api/admin/linkedin/start). LinkedIn issues no refresh token, so the
   connection lapses after about 60 days and must be reconnected; the cron sends `linkedin_connection_expiring` to PostHog
   in the last seven days and `linkedin_autopost_not_connected` when there is none.

## Rewrite rules (the morning task)

Rewrite only drafts with `rewrittenAt` null and status DRAFT, soonest slot first. Keep every fact:
employer, job count, place, source type, dates. Add nothing the facts do not say: no cause for the
layoff, no names of affected people, no guess at who is to blame. Never claim anything about price or
what NextChapter provides beyond helping people plan and find roles.

Written to be reposted and tagged:

- The first line stands alone and says the news in under 140 characters, before LinkedIn's "see more".
- Short paragraphs, one idea each, no emojis, no hashtags in the middle, three hashtags at the end.
- One concrete, useful thing the reader can act on (a first-week step, a number, a date).
- A closing ask that gives a reader something specific to do: tag someone at the employer, say if
  you are hiring, or repost for the people affected. Rotate which ask is used.
- No link in the post. The link stays in the first comment.
- Plain, confident voice. Say "laid off", not "impacted" or "transitioning".
- Do not sound like the last post. Read the five most recent posted drafts and use a different
  opening shape, length and closing.
- Tone is for the people affected, never about the employer's failure.

After rewriting set `body`, `firstComment` if changed, and `rewrittenAt = now()`.
