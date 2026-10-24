# Competitor deep read (runs on Justin's Claude plan, no API cost)

Free mode only sorts headlines by keyword and flags changed websites. For the top ~20 direct competitors you can
get a real read (what changed, whether it matters, matrix answers) by running a Claude Code session on your plan
instead of the paid API path. Never scheduled; run it by hand when you want it, about once a month.

Start a Claude Code session in a fresh worktree of the repo and paste:

> Deep-read the top 20 DIRECT competitors on the Competitors page (https://launchyournextchapter.com/support/admin/vision/competitors),
> starting with cards that have a "Website changed" event or `needsReview`. For each: open its site and the pages the
> free watch flagged, read the last 30 days of news, then in the admin UI or with a script using the Supabase connector:
> add what is new to the card (never delete), add sourced `CompetitorEvent` rows (kind, title, url, dedupeKey
> `KIND:normalized-title`), and add `CompetitorCellProposal` rows (state PENDING, https evidenceUrl) for capability
> answers you can support from a page you read. Do not change any matrix cell directly; I confirm proposals on the page.
> Report what changed per competitor in plain language. No paid API calls: use only web tools in this session.

Why a session and not the app: a session reads pages with your plan's usage, so the model cost is $0 per card, but it
needs a person to start it and it is slower. The app cannot run it by itself.
