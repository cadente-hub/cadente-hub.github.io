#!/usr/bin/env bash
# W1 (ADR 0082): writes the run summary from the public numbers each job recorded (preparation,
# cache, compile, tests, archive transfer) and the job durations of the API, and keeps one line per
# main run in the private ci-logs branch, from which it takes the p50 and p90 of the last 20 runs.
# Names of the private code never reach this summary: the cargo --timings reports stay sealed.
#
#   GH_TOKEN=... GITHUB_REPOSITORY=... GITHUB_RUN_ID=... METRICS_DIR=<dir of metrics-*/metrics.env>
#   HISTORY_DIR=<checkout of ci-logs or empty> SHA=... CHANNEL=... COMPILED=true|false
#   TOOLCHAIN_CHANGED=true|false ci-summary.sh > summary.md
set -euo pipefail
: "${GITHUB_REPOSITORY:?}" "${GITHUB_RUN_ID:?}" "${METRICS_DIR:?}"

jobs_json="$(mktemp)"
gh api --paginate "repos/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}/attempts/${GITHUB_RUN_ATTEMPT:-1}/jobs" \
  --jq '.jobs[]' | jq -s '.' > "$jobs_json"
run_json="$(gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}")"
run_start="$(printf '%s' "$run_json" | jq -r '.run_started_at | fromdate')"
run_created="$(printf '%s' "$run_json" | jq -r '.created_at | fromdate')"
now="$(date +%s)"

min() { awk -v s="$1" 'BEGIN { if (s == "" || s == "-") print "—"; else printf "%d min %02d s", s / 60, s % 60 }'; }

# metrics value of one job: metric <label> <key>
metric() {
  local file="$METRICS_DIR/metrics-$1/metrics.env"
  [ -f "$file" ] || { echo ""; return; }
  sed -n "s/^$2=//p" "$file" | tail -1
}

echo "## native-ci ${SHA:0:12} (${CHANNEL:-beta})"
echo
if [ "${COMPILED:-true}" != "true" ]; then
  echo "Sem código desde o último commit verde: nada compilou e não sai beta."
  echo
fi
if [ "${TOOLCHAIN_CHANGED:-false}" = "true" ]; then
  echo "**Troca de toolchain:** este run recompila tudo e fica fora do p50 e do p90 (ADR 0082, decisão 3)."
  echo
fi

# "Fila" is the wait for a runner (the macOS pool is 5 jobs for the organization), apart from the job.
echo "| Job | Fila | Duração | Preparação | Cache | Compilar | Testes | Arquivo de testes | Esperou o arquivo |"
echo "|---|---|---|---|---|---|---|---|---|"
jq -r '.[] | select(.conclusion != "skipped" and .started_at != null) |
  [.name, ((.completed_at // (now | todate)) | fromdate) - (.started_at | fromdate), .conclusion // "em andamento",
   (.started_at | fromdate) - (.created_at | fromdate)] | @tsv' "$jobs_json" |
  while IFS=$'\t' read -r name duration conclusion queued; do
    label="$(printf '%s' "$name" | tr ' /' '--' | tr -cd 'A-Za-z0-9._-')"
    t0="$(metric "$label" t0)"; work="$(metric "$label" work_start)"
    prep=""; [ -n "$t0" ] && [ -n "$work" ] && prep=$((work - t0))
    cache="$(metric "$label" cache)"
    hits="$(metric "$label" sccache_hits)"
    [ -n "$hits" ] && cache="${cache} · sccache ${hits} acertos, $(metric "$label" sccache_misses) faltas, $(metric "$label" sccache_mb) MB"
    compile="$(metric "$label" compile_s)"; tests="$(metric "$label" test_s)"
    up="$(metric "$label" upload_s)"; down="$(metric "$label" download_s)"; size="$(metric "$label" archive_mb)"
    wait="$(metric "$label" wait_s)"
    archive="—"
    [ -n "$up" ] && archive="enviou ${size:-?} MB em ${up} s"
    [ -n "$down" ] && archive="baixou ${size:-?} MB em ${down} s"
    status=""; [ "$conclusion" != "success" ] && status=" ($conclusion)"
    echo "| ${name}${status} | $(min "$queued") | $(min "$duration") | $(min "$prep") | ${cache:-—} | $(min "$compile") | $(min "$tests") | ${archive} | $(min "$wait") |"
  done
echo

publish_end="$(jq -r '[.[] | select(.name == "publish" and .conclusion == "success") | .completed_at | fromdate] | max // empty' "$jobs_json")"
duration=$((now - run_start))
# W10 (ADR 0082): the beta's time, from the dispatch to the end of publish, and the runner queue on its
# critical path: from publish back, each step goes to the job that ended last before it was created,
# and each job of that chain adds its wait for a runner.
publish_s=""; queue_s=""
if [ -n "$publish_end" ]; then
  publish_s=$((publish_end - run_created))
  # `perf` and the cache guard hold nothing, so they are not links of the chain.
  queue_s="$(jq -r '[.[] | select(.started_at != null and .completed_at != null and .conclusion != "skipped")
      | select((.name | startswith("perf")) or .name == "cache guard" | not)
      | {name, c: (.created_at | fromdate), s: (.started_at | fromdate), e: (.completed_at | fromdate)}] as $j
    | def walk_back($cur; $q):
        ($j | map(select(.name != $cur.name and .e <= $cur.c + 10)) | max_by(.e)) as $prev
        | if $prev == null then $q + ($cur.s - $cur.c) else walk_back($prev; $q + ($cur.s - $cur.c)) end;
      ($j | map(select(.name == "publish")) | first) as $p | if $p == null then "" else walk_back($p; 0) end' "$jobs_json")"
  echo "Do disparo ao fim do publish: $(min "$publish_s"), dos quais $(min "$queue_s") de fila por runner no caminho crítico; sem a fila, $(min $((publish_s - queue_s)))."
fi
echo "Duração do run até este resumo: $(min "$duration")."
echo

cache_none="$(jq -r '.[] | select(.conclusion != "skipped") | .name' "$jobs_json" |
  while read -r name; do
    label="$(printf '%s' "$name" | tr ' /' '--' | tr -cd 'A-Za-z0-9._-')"
    if [ "$(metric "$label" cache)" = "nenhum" ]; then echo "$name"; fi
  done | wc -l | tr -d ' ')"

# One line per main run in ci-logs (metrics/runs.tsv): run, sha, start, duration, compiled,
# toolchain change, jobs without cache. The p50 and p90 count the runs that compiled and did not
# change the toolchain.
if [ -n "${HISTORY_DIR:-}" ] && [ -d "$HISTORY_DIR" ]; then
  history="$HISTORY_DIR/metrics/runs.tsv"
  mkdir -p "$(dirname "$history")"
  touch "$history"
  if [ "${RECORD_HISTORY:-false}" = "true" ]; then
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$GITHUB_RUN_ID" "$SHA" "$run_start" "$duration" \
      "${COMPILED:-true}" "${TOOLCHAIN_CHANGED:-false}" "$cache_none" "$publish_s" "$queue_s" >> "$history"
  fi
  counted="$(awk -F'\t' '$5 == "true" && $6 == "false"' "$history" | tail -20)"
  n="$(printf '%s' "$counted" | grep -c . || true)"
  if [ "$n" -gt 0 ]; then
    stats="$(printf '%s\n' "$counted" | cut -f4 | sort -n | awk '{ a[NR] = $1 } END {
      p50 = a[int((NR - 1) * 0.5) + 1]; i = (NR - 1) * 0.9; lo = int(i) + 1; hi = (lo < NR) ? lo + 1 : lo;
      p90 = a[lo] + (a[hi] - a[lo]) * (i - int(i)); printf "%d %d", p50, p90 }')"
    p50="${stats% *}"; p90="${stats#* }"
    cold="$(printf '%s\n' "$counted" | awk -F'\t' '$7 > 0 { printf "%s%s", sep, $1; sep = ", " }')"
    docs="$(awk -F'\t' '$5 == "false"' "$history" | tail -20 | grep -c . || true)"
    tool="$(awk -F'\t' '$6 == "true"' "$history" | tail -20 | grep -c . || true)"
    echo "### Rodadas de main"
    echo
    echo "p50 $(min "$p50") e p90 $(min "$p90") nas últimas ${n} rodadas que compilaram (meta: p90 de até 10 min)."
    echo "Fora da conta: ${docs} sem código e ${tool} com troca de toolchain, entre as 20 últimas de cada tipo."
    echo "Rodadas com algum job sem cache: ${cold:-nenhuma}."
  fi
  # W10: the runs that published a beta (columns 8 and 9 since W10), from the dispatch to publish, minus
  # the runner queue on the critical path; the toolchain change stays out.
  beta="$(awk -F'\t' '$6 == "false" && $8 != "" && $9 != "" { print $1 "\t" ($8 - $9) }' "$history" | tail -20)"
  nb="$(printf '%s' "$beta" | grep -c . || true)"
  if [ "$nb" -gt 0 ]; then
    stats="$(printf '%s\n' "$beta" | cut -f2 | sort -n | awk '{ a[NR] = $1 } END {
      p50 = a[int((NR - 1) * 0.5) + 1]; i = (NR - 1) * 0.9; lo = int(i) + 1; hi = (lo < NR) ? lo + 1 : lo;
      p90 = a[lo] + (a[hi] - a[lo]) * (i - int(i)); printf "%d %d", p50, p90 }')"
    echo "Do disparo ao publish, sem a fila por runner: p50 $(min "${stats% *}") e p90 $(min "${stats#* }") nas últimas ${nb} rodadas que publicaram beta (meta: p90 de até 10 min; runs $(printf '%s\n' "$beta" | cut -f1 | paste -sd, -))."
  fi
fi
