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

## Workday refresh from another machine

Workday rate-limits one address hard (HTTP 429 after a few requests), so a refresh of all 1,718 sites needs a machine that has not been
throttled. `REFRESH=1` lists each site, confirms the job links with one narrow call, and fetches a job's full text only when the server did not
hold it. `WD_GAP` (default 0.9 s) is the pause between Workday requests; `T` is the number of sites in parallel.

    K=<import key> REFRESH=1 T=4 WD_GAP=0.9 python3 scripts/jobsreport/import/ats3_import.py \
      workday-all-unique.json,workday-sec.json,workday-universities.json,workday-hospitals.json,workday-nonprofits-top8000.json,workday-nonprofits-next8000.json,workday-company-sized.json,workday-jooble-top-employers.json workday
