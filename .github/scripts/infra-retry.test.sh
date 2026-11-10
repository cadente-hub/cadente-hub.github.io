#!/usr/bin/env bash
# The verdicts of infra-retry.sh over runs as the API shows them.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
T="$(mktemp -d)"
verdict() { bash "$HERE/infra-retry.sh" classify "$1"; }
expect() { [ "$(verdict "$2")" = "$1" ] || { echo "FAIL: wanted $1 for $2, got $(verdict "$2")"; exit 1; }; }

echo '{"jobs":[{"conclusion":"success","steps":[]},{"conclusion":"skipped","steps":[]}]}' > "$T/green.json"
expect green "$T/green.json"

# A clone that failed once.
echo '{"jobs":[{"conclusion":"failure","steps":[{"name":"Fetch the private repository","conclusion":"failure"},{"name":"cargo nextest run","conclusion":"skipped"}]}]}' > "$T/clone.json"
expect retry "$T/clone.json"

# A job the runner cancelled: no step failed.
echo '{"jobs":[{"conclusion":"cancelled","steps":[{"name":"cargo nextest run","conclusion":"cancelled"}]}]}' > "$T/cancel.json"
expect retry "$T/cancel.json"

# A test that failed stays red.
echo '{"jobs":[{"conclusion":"failure","steps":[{"name":"cargo nextest run","conclusion":"failure"}]}]}' > "$T/test.json"
expect code "$T/test.json"

# One infrastructure job and one test job: the test decides.
echo '{"jobs":[{"conclusion":"failure","steps":[{"name":"Install the toolchain","conclusion":"failure"}]},{"conclusion":"failure","steps":[{"name":"Run the ruler","conclusion":"failure"}]}]}' > "$T/mixed.json"
expect code "$T/mixed.json"

# A smoke that failed is the code's, not infrastructure.
echo '{"jobs":[{"conclusion":"failure","steps":[{"name":"Smoke of the package","conclusion":"failure"}]}]}' > "$T/smoke.json"
expect code "$T/smoke.json"
echo "infra-retry: ok"
