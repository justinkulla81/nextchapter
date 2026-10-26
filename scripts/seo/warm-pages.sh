#!/usr/bin/env bash
# Warms the pages a crawler or visitor is most likely to hit first, after a deploy.
#
# Each deploy starts with empty page caches, and the first request to a data-heavy page (salaries, job titles, layoffs by
# state, workforce boards) takes 20 to 50 seconds while its data loads. This requests the key pages one at a time, so the
# next real visitor or crawler gets the cached page. It reads the sitemaps for the busiest titles and employers, waits
# between requests so it never looks like a crawl, and never fails the run: a page that errors is reported and skipped.
#
# usage: warm-pages.sh [BASE_URL]   (default https://launchyournextchapter.com)
BASE="${1:-https://launchyournextchapter.com}"
BASE="${BASE%/}"
UA="NextChapterWarmup/1.0 (post-deploy cache warm-up)"
PAUSE="${WARM_PAUSE:-1.5}"
TITLES="${WARM_TITLES:-25}"

get() { curl -s --max-time 120 -A "$UA" "$1"; }

urls=()
# 1. Hubs and tools
urls+=(/ /layoffs /unemployment-benefits /salaries /jobs/title /jobs /places /workforce-boards /rapid-response /higher-education /industries /functions /conferences /resources /topics /glossary /tools /tools/severance-calculator /tools/warn-act-checker /start/laid-off /coaching /funding)
for t in remote hybrid contract part-time interim; do urls+=("/jobs/type/$t"); done
# 2. The busiest states
for s in california texas new-york florida illinois pennsylvania ohio georgia; do
  urls+=("/layoffs/$s" "/unemployment-benefits/$s" "/places/$s" "/workforce-boards/$s" "/rapid-response/$s" "/higher-education/$s")
done
# 3. The most listed job titles (the salaries sitemap lists them most listed first)
salaries=$(get "$BASE/salaries/sitemap.xml" | grep -o "<loc>[^<]*/salaries/[^<]*" | sed -E 's#<loc>https?://[^/]+##' | head -n "$TITLES")
for p in $salaries; do urls+=("$p" "${p/salaries/jobs/title}"); done
# 4. A first slice of employers and company layoff pages
employers=$(get "$BASE/employers/sitemap/0.xml" | grep -o "<loc>[^<]*" | sed -E 's#<loc>https?://[^/]+##' | head -n 10)
for p in $employers; do urls+=("$p"); done
companies=$(get "$BASE/sitemap.xml" | grep -o "<loc>[^<]*/layoffs/company/[^<]*" | sed -E 's#<loc>https?://[^/]+##' | head -n 10)
for p in $companies; do urls+=("$p"); done

if [[ -n "$WARM_DRY" ]]; then printf '%s\n' "${urls[@]}"; echo "${#urls[@]} urls"; exit 0; fi

ok=0; bad=0; slow=0
for u in "${urls[@]}"; do
  out=$(curl -s -o /dev/null -w '%{http_code} %{time_total}' --max-time 180 -A "$UA" "$BASE$u")
  code=${out%% *}; secs=${out##* }
  if [[ "$code" == 200 ]]; then ok=$((ok+1)); else bad=$((bad+1)); fi
  if awk "BEGIN{exit !($secs > 10)}"; then slow=$((slow+1)); fi
  printf '%s %s %ss\n' "$code" "$u" "$secs"
  sleep "$PAUSE"
done
echo "warmed ${#urls[@]} pages: $ok ok, $bad not 200, $slow took over 10s"
exit 0
