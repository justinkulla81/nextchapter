#!/bin/sh
# Vercel ignoreCommand: exit 0 = skip the build, exit 1 = build.
#
# Production deploys are batched. Every deploy starts with empty page caches, so each one re-renders and re-writes the
# long tail of pages (billed ISR writes, plus the post-deploy warm-up). A main push therefore builds only:
#   - inside the release window: minutes 00-29 of 01:00 and 13:00 UTC, when the deploy-batch cron (vercel.json) fires
#     the deploy hook; or
#   - when the head commit message contains [deploy-now], for an urgent fix.
# Other pushes to main are skipped and ship with the next window. Non-main branches never build.
# Inside the window, a build is skipped only when nothing but docs/scripts/markdown, CI workflows and tests changed.
# Any git error (or a missing previous SHA, as on a deploy-hook build) means build.
[ "$VERCEL_GIT_COMMIT_REF" != "main" ] && exit 0

case "$VERCEL_GIT_COMMIT_MESSAGE" in
  *"[deploy-now]"*) exit 1 ;;
esac

hour=$(date -u +%H)
minute=$(date -u +%M)
case "$hour" in
  01|13) [ "$minute" -lt 30 ] || exit 0 ;;
  *) exit 0 ;;
esac

[ -z "$VERCEL_GIT_PREVIOUS_SHA" ] && exit 1
git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . \
  ':(exclude)docs' ':(exclude)scripts' ':(exclude)extension' \
  ':(exclude)incoming-prompts' ':(exclude)incoming-report' ':(exclude)incoming-seo' \
  ':(exclude).github' ':(exclude)src/test' ':(exclude)*.test.ts' ':(exclude)*.test.tsx' \
  ':(exclude)*.md' 2>/dev/null
[ $? -eq 0 ] && exit 0
exit 1
