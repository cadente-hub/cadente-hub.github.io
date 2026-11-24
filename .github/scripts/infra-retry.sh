#!/usr/bin/env bash
# Y13 (ADR 0091 T12): a run in which only the infrastructure failed runs its failed jobs once more.
# Reads the jobs of a run as the API gives them (`{"jobs": [...]}`) and says `retry` when every job
# that did not succeed failed only in an infrastructure step (clone, toolchain, apt, cache, download,
# upload) or never ran a step that failed (cancelled by the runner). A test, clippy, ruler, build or
# signature step that fails is the code's: it says `code` and the run stays red.
#
#   infra-retry.sh classify <jobs.json>     prints retry | code | green
#   infra-retry.sh run                      classifies the current run and reruns its failed jobs
set -euo pipefail

# The steps that are infrastructure. A step the list does not name counts as the code's.
INFRA='(checkout|clone|fetch|download|upload|artifact|cache|restore|toolchain|rustup|install|apt|dpkg|setup (builder|node|rust|python|sccache)|set up (job|runner)|post |complete job|runner)'

classify() {
  python3 -I - "$1" "$INFRA" <<'PY'
import json, re, sys
jobs = json.load(open(sys.argv[1]))["jobs"]
infra = re.compile(sys.argv[2])
bad = [j for j in jobs if j.get("conclusion") not in (None, "success", "skipped")]
# `perf` is a measurement of the frame budget, worked on apart (P2): its failure is the code's, not the
# infrastructure's, and it does not decide whether the jobs the queue cancelled run again.
# A `perf` job the queue cancelled before it had a runner is not a failed measurement: it runs again.
others = [
    j for j in bad
    if (
        not j.get("name", "").startswith("perf ")
        or (j.get("conclusion") == "cancelled" and not j.get("runner_name"))
    )
    and not (
        j.get("conclusion") == "cancelled"
        and (j.get("name", "").startswith("package ") or j.get("name") == "bridge-extension")
    )
]
# A job cancelled after it had a runner was cancelled by a person (the queue's timeout cancels jobs that
# never got one, `runner_name` empty): that run stays cancelled.
by_hand = [j for j in others if j.get("conclusion") == "cancelled" and j.get("runner_name")]
if not bad:
    print("green")
elif not others or by_hand:
    print("code")
else:
    code = [s for j in others for s in j.get("steps", [])
            if s.get("conclusion") == "failure" and not infra.search(s["name"].lower())]
    print("code" if code else "retry")
PY
}

case "${1:-}" in
  classify) classify "$2" ;;
  run)
    : "${GH_TOKEN:?}" "${GITHUB_REPOSITORY:?}" "${GITHUB_RUN_ID:?}"
    JOBS="$(mktemp)"
    # The jobs a queue timeout cancels may still read as unfinished in the seconds after the run
    # completes (run 44126820245: `green` for a run that ended with three cancelled jobs), so a run
    # that did not end successfully but reads green is read again, up to five times, 15 s apart.
    for TRY in 1 2 3 4 5; do
      gh api --paginate --slurp "repos/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}/jobs?per_page=100" \
        | python3 -I -c 'import json,sys; print(json.dumps({"jobs": [j for page in json.load(sys.stdin) for j in page["jobs"]]}))' > "$JOBS"
      VERDICT="$(classify "$JOBS")"
      [ "$VERDICT" = green ] || break
      [ "$(gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}" --jq .conclusion)" = success ] && break
      sleep "${REREAD_WAIT:-15}"
    done
    echo "infra-retry: $VERDICT"
    if [ "$VERDICT" = "retry" ]; then
      sleep "${RETRY_WAIT:-0}"
      gh run rerun "$GITHUB_RUN_ID" --repo "$GITHUB_REPOSITORY" --failed
    fi
    ;;
  *) echo "usage: infra-retry.sh classify <jobs.json> | run" >&2; exit 2 ;;
esac
