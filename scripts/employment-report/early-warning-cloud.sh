#!/usr/bin/env bash
# Monthly early-warning refresh for environments with no .env.local and no database connection (the Claude cloud
# environment). Pulls the two secrets it needs from Vercel, fetches the layoff inputs from the layoff-ai-export
# Supabase function, then runs the normal refresh.
#
#   bash scripts/employment-report/early-warning-cloud.sh 2026-10
#
# Needs VERCEL_TOKEN, VERCEL_PROJECT_ID and VERCEL_ORG_ID in the environment. Writes .env.local (git-ignored,
# mode 600) containing only CENSUS_API_KEY. Never prints a secret. See docs/jobs-report/early-warning-cloud-run.md.
set -euo pipefail
edition="${1:?usage: early-warning-cloud.sh YYYY-MM}"
: "${VERCEL_TOKEN:?VERCEL_TOKEN is not set}" "${VERCEL_PROJECT_ID:?VERCEL_PROJECT_ID is not set}" "${VERCEL_ORG_ID:?VERCEL_ORG_ID is not set}"

vercel_env() { # name -> value (encrypted variables only; the value is read per variable id)
  python3 -I - "$1" <<'PY'
import json, os, sys, urllib.request
name = sys.argv[1]
base = f"https://api.vercel.com/%s/projects/{os.environ['VERCEL_PROJECT_ID']}/env"
q = f"teamId={os.environ['VERCEL_ORG_ID']}"
h = {"Authorization": "Bearer " + os.environ["VERCEL_TOKEN"]}
def get(url): return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=30))
envs = get(f"{base % 'v9'}?{q}")["envs"]
match = [e for e in envs if e["key"] == name]
if not match: sys.exit(f"{name} is not set in the Vercel project")
v = get(f"{base % 'v1'}/{match[0]['id']}?{q}").get("value")
if not v: sys.exit(f"{name} exists but its value cannot be read (type {match[0].get('type')}); it must be an 'encrypted' variable")
print(v)
PY
}

CENSUS_API_KEY="$(vercel_env CENSUS_API_KEY)"
export_token="$(vercel_env REPORT_EXPORT_TOKEN)"

umask 077
printf 'CENSUS_API_KEY=%s\n' "$CENSUS_API_KEY" > .env.local

tmp="$(mktemp -t layoff-export.XXXXXX.json)"
trap 'rm -f "$tmp"' EXIT
base="${SUPABASE_FUNCTIONS_BASE:-https://uvoulytrsrxasqzutlmq.supabase.co}"
code="$(curl -sS -m 120 -o "$tmp" -w '%{http_code}' -H "x-export-token: $export_token" "$base/functions/v1/layoff-ai-export")"
[ "$code" = "200" ] || { echo "layoff-ai-export returned HTTP $code" >&2; exit 1; }
echo "layoff inputs: $(python3 -I -c "import json,sys; d=json.load(open(sys.argv[1])); print(len(d['mentions']),'mentions,',len(d['notices']),'notices, since',d['since'])" "$tmp")"

AI_LAYOFFS_JSON="$tmp" npm run report:early-warning -- --edition "$edition"
