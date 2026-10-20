#!/bin/sh
# Recreates scripts/perf/baseline-cold/: the shared board and breadth classifier as of a
# git ref (default: origin/main before the board snapshot change) — board-shortlist,
# board-light-rows and search-breadth-server, pointed at each other — for
# board-cold-parity.ts. Never committed (.gitignore).
set -e
REF=${1:-a476c1ca}
DIR=$(dirname "$0")/baseline-cold
mkdir -p "$DIR"
for f in board-shortlist board-light-rows search-breadth-server; do
  git show "$REF:src/lib/jobs/$f.ts" > "$DIR/$f.ts"
done
cd "$DIR"
sed -i.bak -e "s#'@/lib/jobs/board-light-rows'#'./board-light-rows'#; s#'@/lib/jobs/search-breadth-server'#'./search-breadth-server'#; s#^import 'server-only'##" ./*.ts
rm -f ./*.bak
echo "cold-start baseline from $REF in $DIR"
