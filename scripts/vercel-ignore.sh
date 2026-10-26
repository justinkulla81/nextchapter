#!/bin/bash
# Vercel "ignoreCommand": exit 0 skips the build, exit 1 builds.
# Builds only on main, and skips when the only changes since the previous deploy are docs, scripts, the extension, incoming-* folders or markdown.
# When the diff cannot be computed (no previous SHA, shallow clone), build. vercel.json limits ignoreCommand to 256 characters, hence this file.
[ "$VERCEL_GIT_COMMIT_REF" != "main" ] && exit 0
git diff --quiet "${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}" HEAD -- . ':(exclude)docs' ':(exclude)scripts' ':(exclude)extension' ':(exclude)incoming-prompts' ':(exclude)incoming-report' ':(exclude)incoming-seo' ':(exclude)*.md' 2>/dev/null
[ $? -eq 0 ] && exit 0
exit 1
