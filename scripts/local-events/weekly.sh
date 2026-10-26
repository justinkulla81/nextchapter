#!/bin/zsh
# Weekly local-events crawl: reads chamber / workforce board / EDO / state agency / college event feeds and imports them to production.
# Run by the scheduled task "local-events-weekly-crawl" (Mondays, 5 AM ET). Capped at 60 minutes; never waits on a prompt.
set -u
cd ~/nextchapter || exit 1
git pull -q --ff-only origin main 2>&1 | tail -1
npx prisma generate >/dev/null 2>&1
set -a; . ./.env.local; . ~/nextchapter-jobs/.env.weekly-sync; set +a
POST="${NC_ATS_API_URL%/jobs/import}/local-events/import"
perl -e 'alarm 3600; exec @ARGV' npx tsx scripts/local-events/crawl.ts --kinds=WORKFORCE_BOARD,ECON_DEV,STATE_AGENCY,CHAMBER,COLLEGE --post="$POST" --out="$HOME/nc-local-events-last.json"
