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
if not bad:
    print("green")
else:
    code = [s for j in bad for s in j.get("steps", [])
            if s.get("conclusion") == "failure" and not infra.search(s["name"].lower())]
    print("code" if code else "retry")
PY
}

case "${1:-}" in
  classify) classify "$2" ;;
  run)
    : "${GH_TOKEN:?}" "${GITHUB_REPOSITORY:?}" "${GITHUB_RUN_ID:?}"
    JOBS="$(mktemp)"
    gh api --paginate --slurp "repos/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}/jobs?per_page=100" \
      | python3 -I -c 'import json,sys; print(json.dumps({"jobs": [j for page in json.load(sys.stdin) for j in page["jobs"]]}))' > "$JOBS"
    VERDICT="$(classify "$JOBS")"
    echo "infra-retry: $VERDICT"
    if [ "$VERDICT" = "retry" ]; then
      gh run rerun "$GITHUB_RUN_ID" --repo "$GITHUB_REPOSITORY" --failed
    fi
    ;;
  *) echo "usage: infra-retry.sh classify <jobs.json> | run" >&2; exit 2 ;;
esac
