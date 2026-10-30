#!/bin/sh
# Vercel ignoreCommand: exit 0 = skip the build, exit 1 = build.
# Skips non-main branches, and main pushes that touch only docs/scripts/markdown, CI workflows and tests.
# Any git error (e.g. previous SHA missing from the shallow clone) means build.
[ "$VERCEL_GIT_COMMIT_REF" != "main" ] && exit 0
git diff --quiet "${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}" HEAD -- . \
  ':(exclude)docs' ':(exclude)scripts' ':(exclude)extension' \
  ':(exclude)incoming-prompts' ':(exclude)incoming-report' ':(exclude)incoming-seo' \
  ':(exclude).github' ':(exclude)src/test' ':(exclude)*.test.ts' ':(exclude)*.test.tsx' \
  ':(exclude)*.md' 2>/dev/null
[ $? -eq 0 ] && exit 0
exit 1
