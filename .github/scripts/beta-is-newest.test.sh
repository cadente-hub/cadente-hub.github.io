#!/usr/bin/env bash
# The order in which beta-is-newest.sh lets a run publish.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
check() { # want version out...
  local want="$1" mine="$2"; shift 2
  local got=0
  printf '%s\n' "$@" | bash "$HERE/beta-is-newest.sh" "$mine" || got=$?
  [ "$got" = "$want" ] || { echo "FAIL: wanted $want for $mine against [$*], got $got"; exit 1; }
}
check 0 1.1.0-beta.2900 v1.1.0-beta.220 v1.1.0-beta.2899
check 1 1.1.0-beta.2890 v1.1.0-beta.2899        # an older commit that finished late
check 1 1.1.0-beta.2899 v1.1.0-beta.2899        # the same commit again
check 0 1.1.0-beta.9 v1.1.0-beta.10x v1.1.0 v1.0.0-beta.4000   # lines that are not betas of the order
check 0 1.2.0-beta.5 v1.1.0-beta.2899           # a version bump outranks a higher count
check 0 1.1.0-beta.1 ""                          # nothing out yet
got=0; echo | bash "$HERE/beta-is-newest.sh" not-a-beta 2>/dev/null || got=$?
[ "$got" = 2 ] || { echo "FAIL: a non-beta argument must exit 2, got $got"; exit 1; }
echo "ok"
