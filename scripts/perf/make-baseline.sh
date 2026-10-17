#!/bin/sh
# Recreates scripts/perf/baseline/: the board shortlist and fit scorer as of a
# git ref (default c8fcb7f3, before the BoardLightRow / prepared-scorer change),
# for board-parity.ts and bucket-parity.ts. The copy reads closed-posting counts
# through today's ghost-risk-data (same values) and, with BASELINE_SORT=1,
# sorts its rows by id so exact ranking ties fall the same way.
set -e
REF=${1:-c8fcb7f3}
DIR=${BASELINE_DIR:-$(dirname "$0")/baseline}
mkdir -p "$DIR"
for f in board-shortlist email-fit-scoring job-fit-bucket; do
  git show "$REF:src/lib/jobs/$f.ts" > "$DIR/$f.ts"
done
cd "$DIR"
sed -i.bak -e "s#'@/lib/jobs/job-fit-bucket'#'./job-fit-bucket'#; s#'@/lib/jobs/email-fit-scoring'#'./email-fit-scoring'#; s#^import 'server-only'##" ./*.ts
perl -pi -e 's#^(    const all = await prisma\.exclusiveJobPosting\.findMany\(\{ where: liveBoardWhere\(where\), select: LIGHT_SELECT \}\))$#$1\n    if (process.env.BASELINE_SORT === "1") all.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))#' board-shortlist.ts
rm -f ./*.bak
echo "baseline from $REF in $DIR"
