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
   suggestions, and a staggered weekday slot (8:15, 12:10, 17:20 ET; at most two a day, three hours
   apart).
4. The queue is https://launchyournextchapter.com/support/admin/linkedin-drafts. Posting is by hand:
   copy the post, download the image, paste the link as the first comment, mark as posted.

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
