# Employer ranking snapshots

One JSON and one Markdown file per snapshot date, from the public pages at https://launchyournextchapter.com/top-employers
(`python3 scripts/reports/employer-rankings-from-live.py data/employer-rankings`). The database version
(`scripts/reports/employer-rankings-snapshot.ts`) needs a database connection; this one does not.

Rules for use in reports (owner, 2026-10-26): no layoffs by employer; staffing and search firms are excluded and the method note says so;
label figures "among jobs NextChapter tracks" and keep the frame separate from the Census white-collar frame; make no month-over-month or
year-over-year claim for any employer until there are 6+ monthly snapshots (employer history starts October 2026). Save one snapshot per month.
