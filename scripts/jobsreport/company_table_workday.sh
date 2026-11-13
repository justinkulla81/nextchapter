#!/usr/bin/env bash
# Run the Workday finder on every name in the Company table (about 105,000), on a machine that can reach the database and the internet
# (the cloud session cannot read Company: no database connection, and the anon key is blocked by row-level security).
#   DATABASE_URL=postgres://... bash scripts/jobsreport/company_table_workday.sh
# Reads Company names once (one bounded read, ~5 MB), skips names already searched, runs workday_discover.py at 100 threads (about 200 names a minute), then packs the result.
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=scripts/jobsreport/out; mkdir -p "$OUT"
psql "$DATABASE_URL" -X -A -t -c "select distinct name from \"Company\" where name is not null and length(name) > 2 order by 1" > "$OUT/company-names.txt"
wc -l "$OUT/company-names.txt"
python3 scripts/jobsreport/workday_discover.py --names "$OUT/company-names.txt" --out "$OUT/workday-company-table.jsonl" --threads 100
python3 scripts/jobsreport/pack_workday_sources.py "$OUT/workday-company-table.jsonl" scripts/jobsreport/sources/workday-company-table.json
