#!/bin/bash
# One step of the monthly events discovery per call, so each Bash call is a single simple command.
#   bash scripts/events/discovery.sh setup | batch | build | test | commit YYYY-MM | pr YYYY-MM "<counts text>" | cleanup
# Runs from inside the throwaway worktree the task creates off origin/main. Never touches the database,
# never merges, never pushes to main. See data/events/DISCOVERY.md.
set -e
W="$(cd "$(dirname "$0")/../.." && pwd)"
R=/Users/salitkulla/nextchapter
cd "$W"
case "$1" in
  setup)
    ln -sfn "$R/node_modules" "$W/node_modules"
    "$R/node_modules/.bin/prisma" generate >/dev/null 2>&1
    echo "ready: $W on $(git rev-parse --abbrev-ref HEAD)"
    ;;
  batch) "$R/node_modules/.bin/tsx" scripts/events/discovery-batch.ts ;;
  build) "$R/node_modules/.bin/tsx" scripts/events/build-catalog.ts 2>&1 | tail -5 ;;
  test)  "$R/node_modules/.bin/vitest" run src/test/events.test.ts src/test/events-headsup.test.ts src/test/events-refresh.test.ts 2>&1 | grep -E "Tests|Test Files|FAIL" ;;
  commit)
    git add data/events src/lib/events/catalog.json
    git commit -q -m "Events: monthly discovery $2

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
    git push -q -u origin "$(git rev-parse --abbrev-ref HEAD)"
    echo "pushed $(git rev-parse --abbrev-ref HEAD)"
    ;;
  pr)
    gh pr create --title "Events: monthly discovery $2" --body "$3

Data-only: files under data/events/ and src/lib/events/catalog.json. Not merged automatically.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
    ;;
  cleanup)
    git -C "$R" worktree remove --force "$W" 2>/dev/null || true
    echo "worktree removed (branch kept)"
    ;;
  *) echo "usage: discovery.sh setup|batch|build|test|commit YYYY-MM|pr YYYY-MM \"counts\"|cleanup"; exit 2 ;;
esac
