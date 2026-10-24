# Early-warning monthly run, no setup needed

Every White Collar Employment Report edition from October 2026 on carries the early-warning section. The refresh script
(`npm run report:early-warning -- --edition YYYY-MM`) needs two things a cloud session does not have: a Census API key and a
database connection. Direct database connections are impossible from the cloud sandbox (only HTTPS goes out), so the layoff inputs
come through an HTTPS function instead.

## One command
```
bash scripts/employment-report/early-warning-cloud.sh YYYY-MM
```
It needs `VERCEL_TOKEN`, `VERCEL_PROJECT_ID` and `VERCEL_ORG_ID` in the environment (already set in the cloud environment). It:
1. Reads `CENSUS_API_KEY` and `REPORT_EXPORT_TOKEN` from the Vercel project's encrypted variables and writes `.env.local` (git-ignored, mode 600) with the Census key only.
2. Fetches the layoff inputs from the Supabase function `layoff-ai-export` (token-gated; returns news mentions that may mention AI plus the WARN notices they point to; public-source data).
3. Runs the normal refresh with `AI_LAYOFFS_JSON` pointing at that file, so `ai-layoffs-monthly.ts` reads it instead of the database.

## What was set up (2026-10-24)
- `CENSUS_API_KEY`: free key requested for justin@launchyournextchapter.com, activated, stored as an **encrypted** Vercel variable (encrypted variables can be read back through the API; "sensitive" ones cannot, which is why the existing database variables cannot be used). Not used by the web app.
- `REPORT_EXPORT_TOKEN`: random token, stored the same way. The function holds only its SHA-256.
- `layoff-ai-export`: Supabase edge function, `verify_jwt` off, 401 without the token. Reads `LayoffNewsMention` and `WarnNotice` with the service role inside Supabase and returns the rows the script needs. To change the token: store a new value under the same Vercel name and redeploy the function with the new hash.

## When it cannot run
- The Census CPS file for the edition month is not out yet (it follows the month by a few weeks): the script stops; say so.
- A Vercel variable is missing or unreadable: the helper says which; do not work around it.
