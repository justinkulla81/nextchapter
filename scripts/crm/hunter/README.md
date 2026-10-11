# Hunter passes

Scripts used for the 2026-10-09/10 Hunter.io pass over the CRM. All are read-only
against the database; they write CSVs into the current directory, and
`scripts/crm/hunter-import.ts` puts the results into the CRM (dry run by default).

Run from the repo root with `HUNTER_API_KEY` and `DATABASE_URL` in `.env.local`:

| Script | What it does | Hunter credits |
|---|---|---|
| `verify-emails.cjs [cap]` | Verifies guessed and real addresses, guessed first, then by priority. Skips addresses listed in the earlier result CSVs named in its `done` set. | 1 verification each |
| `find-emails.cjs [floor]` | Email Finder for people with no email, by role bucket then priority score; stops when searches fall to `floor`. Skips ids already in the earlier find CSVs. | 1 search per email found |
| `domain-search.cjs [orgs] [reserve]` | Domain Search on outplacement, funder and employer organizations with a domain. | 1 search per organization |
| `warn-hr-search.cjs [searches] [people]` | HR and people leaders at employers with a WARN notice in the last 90 days. | 1 search per employer |

These were run in sequence with the earlier CSVs sitting beside them as state, so
the `done`/`prior` file names inside each script are the ones from that pass.
Edit them for a new pass. Only `valid` results with confidence 70 or more should
ever become an address; `accept_all` is risky and is recorded, not used.
