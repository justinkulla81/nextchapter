#!/bin/bash
# Vercel "Ignored Build Step" (vercel.json ignoreCommand). Exit 0 = skip this build, exit 1 = build.
# Only main is built, and a main commit that changes nothing but docs, scripts, the extension, incoming drops or
# markdown is skipped. vercel.json limits ignoreCommand to 256 characters, hence this file. If git cannot compare
# (shallow clone, unknown previous commit) the answer is to build, never to fail the deploy.
[ "$VERCEL_GIT_COMMIT_REF" != "main" ] && exit 0
git diff --quiet "${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}" HEAD -- . ':(exclude)docs' ':(exclude)scripts' ':(exclude)extension' ':(exclude)incoming-prompts' ':(exclude)incoming-report' ':(exclude)incoming-seo' ':(exclude)*.md' && exit 0
exit 1
