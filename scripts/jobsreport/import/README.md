# Bulk job import scripts (2026-11-13)

Fetch jobs straight from employers' job systems and post them to `/api/admin/jobs/import` in batches of 100. Needs the key in the `K`
environment variable (`NC_ATS_API_KEY` or `NC_IMPORT_KEY_CLOUD`). New rows are tagged `addedBy = 'bulk_import'`, which the crawler's
full-sync finalize leaves alone. Never run `finalizeSync` from these scripts.

- `ats3_import.py <source files> [adapter]`: Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Recruitee, Breezy, BambooHR, Oracle, Eightfold, from `../sources/*.json`.
- `phenom_import.py`: the Phenom career sites in `../sources/phenom-found.json`.
- `icims_urls.py <out>` then `urls_import.py iCIMS <out>`: iCIMS job pages (JSON-LD).
- `sitemap_import.py <sitemap> <match> <name>`: governmentjobs.com and EDJOIN (JSON-LD on each page).
- `import_workable.py real|dry [limit]`: the Workable jobs file.

## Keeping the jobs fresh (a job is live for 14 days after `lastVerifiedAt`)

Run any script with `REFRESH=1`. Each batch first sends its urls as `confirmUrls`: the server stamps the rows it already holds confirmed (and
brings back ones it had archived as removed) with one narrow UPDATE that reads no posting text, and answers with the urls it held. Only the
rest are posted in full. Jobs the employer no longer lists are simply not confirmed, and the hourly `direct-reverify` cron archives them
once they are 14 to 30 days old. Do not run the scripts without `REFRESH=1` again for a refresh: every batch reads each existing row with its description.
