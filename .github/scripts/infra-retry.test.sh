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
# Only `perf` failed: a measurement the code has to fix, nothing to rerun.
echo '{"jobs":[{"name":"perf aarch64-apple-darwin full","conclusion":"failure","steps":[{"name":"Measure","conclusion":"failure"}]}]}' > "$T/perf.json"
expect code "$T/perf.json"

# `perf` failed and the queue cancelled macOS jobs that never got a runner: the cancelled ones run again.
echo '{"jobs":[{"name":"perf aarch64-apple-darwin full","conclusion":"failure","steps":[{"name":"Measure","conclusion":"failure"}]},{"name":"lint macos-15","conclusion":"cancelled","steps":[]},{"name":"tests macos-15","conclusion":"cancelled","steps":[]}]}' > "$T/queue.json"
expect retry "$T/queue.json"

# A test failed next to the cancelled ones: the test decides.
echo '{"jobs":[{"name":"lint macos-15","conclusion":"cancelled","steps":[]},{"name":"ruler windows-latest","conclusion":"failure","steps":[{"name":"Run from the archive (cargo nextest)","conclusion":"failure"}]}]}' > "$T/queue-test.json"
expect code "$T/queue-test.json"
# A run a person cancelled: its jobs had a runner, so it is not run again.
echo '{"jobs":[{"name":"tests macos-15","conclusion":"cancelled","runner_name":"GitHub Actions 5","steps":[{"name":"cargo nextest run","conclusion":"cancelled"}]}]}' > "$T/by-hand.json"
expect code "$T/by-hand.json"
# A perf job the queue cancelled before it had a runner runs again.
echo '{"jobs":[{"name":"perf aarch64-apple-darwin full","conclusion":"cancelled","steps":[]}]}' > "$T/perf-queue.json"
expect retry "$T/perf-queue.json"
# A package or bridge-extension job cancelled by concurrency on a superseded beta does not trigger retry.
echo '{"jobs":[{"name":"package aarch64-apple-darwin","conclusion":"cancelled","steps":[]}]}' > "$T/pkg-cancel.json"
expect code "$T/pkg-cancel.json"
echo "infra-retry: ok"
