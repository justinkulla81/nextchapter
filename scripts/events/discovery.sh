#!/bin/bash
# One step of the monthly events discovery per call, so each Bash call is a single simple command.
#   bash scripts/events/discovery.sh setup | batch | build | test | commit YYYY-MM | pr YYYY-MM "<counts text>" | wait | rerun | merge | cleanup
# Runs from inside the throwaway worktree the task creates off origin/main. Never touches the database,
# merges only its own data-only PR (see merge), never pushes to main. See data/events/DISCOVERY.md.
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
  wait)
    # Polls the PR's CI for up to 9 minutes; prints PASSED, FAILED or PENDING (call again on PENDING, at most 3 times).
    for i in $(seq 1 54); do
      s=$(gh pr view --json statusCheckRollup --jq '[.statusCheckRollup[]?|select(.name=="checks")|.status][0]')
      r=$(gh pr view --json statusCheckRollup --jq '[.statusCheckRollup[]?|select(.name=="checks")|.conclusion][0]')
      if [ "$s" = "COMPLETED" ]; then
        if [ "$r" = "SUCCESS" ]; then echo PASSED; else echo "FAILED ($r)"; fi
        exit 0
      fi
      sleep 10
    done
    echo PENDING
    ;;
  rerun)
    # CI's type checker sometimes runs out of memory on the runner; one rerun of the failed job is allowed.
    id=$(gh run list --branch "$(git rev-parse --abbrev-ref HEAD)" --workflow CI --limit 1 --json databaseId --jq '.[0].databaseId')
    gh run rerun "$id" --failed
    echo "rerun requested"
    ;;
  merge)
    # Refuses unless every changed file is event data and CI passed. Never merges anything else.
    bad=$(gh pr diff --name-only | grep -vE '^(data/events/|src/lib/events/catalog\.json$)' || true)
    if [ -n "$bad" ]; then echo "REFUSED: PR touches files outside event data:"; echo "$bad"; exit 3; fi
    r=$(gh pr view --json statusCheckRollup --jq '[.statusCheckRollup[]?|select(.name=="checks")|.conclusion][0]')
    if [ "$r" != "SUCCESS" ]; then echo "REFUSED: CI is not green ($r)"; exit 4; fi
    gh pr merge --squash
    echo "merged"
    ;;
  cleanup)
    git -C "$R" worktree remove --force "$W" 2>/dev/null || true
    echo "worktree removed (branch kept)"
    ;;
  *) echo "usage: discovery.sh setup|batch|build|test|commit YYYY-MM|pr YYYY-MM \"counts\"|wait|rerun|merge|cleanup"; exit 2 ;;
esac
