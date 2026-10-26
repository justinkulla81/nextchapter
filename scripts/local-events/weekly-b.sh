#!/bin/zsh
# Weekly local-events crawl, part B: city governments (Wikidata list) and the SBA events listing (SBDC / SCORE / WBC / VBOC events).
# Run by the scheduled task "local-events-weekly-crawl-b" (Mondays, 4 AM ET), before part A. Capped at 55 minutes in total.
set -u
cd ~/nextchapter || exit 1
git pull -q --ff-only origin main 2>&1 | tail -1
npx prisma generate >/dev/null 2>&1
set -a; . ./.env.local; . ~/nextchapter-jobs/.env.weekly-sync; set +a
POST="${NC_ATS_API_URL%/jobs/import}/local-events/import"
perl -e 'alarm 1500; exec @ARGV' npx tsx scripts/local-events/crawl-sba.ts --post="$POST" --out="$HOME/nc-local-events-sba.json"
perl -e 'alarm 1800; exec @ARGV' npx tsx scripts/local-events/crawl.ts --kinds=CITY --post="$POST" --out="$HOME/nc-local-events-cities.json"
