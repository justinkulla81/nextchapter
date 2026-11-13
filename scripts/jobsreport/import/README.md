# Bulk job import scripts (2026-11-13)

Fetch jobs straight from employers' job systems and post them to `/api/admin/jobs/import` in batches of 100. Needs the key in the `K`
environment variable (`NC_ATS_API_KEY` or `NC_IMPORT_KEY_CLOUD`). Never run `finalizeSync`: it archives every crawler row the run did not send.

- `ats2_import.py <source files> [adapter]`: Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Recruitee, Breezy, BambooHR, from `../sources/*.json`.
- `sitemap_import.py <sitemap> <match> <name>`: governmentjobs.com and EDJOIN (JSON-LD on each page).
- `import_workable.py real|dry [limit]`: the Workable jobs file.

Re-running a script updates existing rows (upsert on url) and stamps `lastVerifiedAt`, which keeps them live.
