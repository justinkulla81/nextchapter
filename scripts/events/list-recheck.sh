#!/bin/bash
# One step per call for the weekly conference list re-check (docs/seo/list-recheck.md). Runs from a throwaway worktree off
# origin/main. The only database writes are the additive row inserts in `load`; nothing is updated, deleted, emailed or pushed.
#   bash scripts/events/list-recheck.sh setup | plan | load | cleanup
set -e
W="$(cd "$(dirname "$0")/../.." && pwd)"
R=/Users/salitkulla/nextchapter
OUT=/Users/salitkulla/nc-list-recheck-out
cd "$W"
mkdir -p "$OUT"
envload() { set -a; . "$R/.env.local" >/dev/null 2>&1; set +a; }
case "$1" in
  setup)
    ln -sfn "$R/node_modules" "$W/node_modules"
    "$R/node_modules/.bin/prisma" generate >/dev/null 2>&1
    echo "ready: $W; results go in $OUT"
    ;;
  plan)
    envload
    rm -f "$OUT"/result-*.json
    "$R/node_modules/.bin/tsx" scripts/events/list-recheck.ts plan "$OUT/plan.json"
    ;;
  load)
    envload
    "$R/node_modules/.bin/tsx" scripts/events/list-recheck.ts load "$OUT/plan.json" "$OUT"/result-*.json
    ;;
  cleanup)
    cd "$R"
    git worktree remove --force "$W"
    echo cleaned
    ;;
  *) echo "usage: $0 setup|plan|load|cleanup"; exit 2 ;;
esac
