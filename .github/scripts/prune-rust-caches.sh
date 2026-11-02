#!/usr/bin/env bash
# Keeps one generation of each Rust cache of main and deletes the older ones.
#
# rust-cache names a cache `<kind>-<toolchain and env hash>-<Cargo.lock and manifests hash>`, e.g.
# `v0-rust-tests-Linux-x64-01b81e85-90d8437f`. Every change to a manifest saves a new generation beside
# the old one; with 10 GB per repository, two generations of every kind made GitHub evict caches that
# were still in use. The newest cache of each kind stays: a job restores it by prefix and rebuilds only
# what changed.
#
#   GH_TOKEN=<token with actions: write> GITHUB_REPOSITORY=<owner/name> prune-rust-caches.sh
set -euo pipefail
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is not set}"

list="$(mktemp)"
trap 'rm -f "$list"' EXIT
gh api --paginate "repos/${GITHUB_REPOSITORY}/actions/caches?ref=refs/heads/main&per_page=100" \
  --jq '.actions_caches[] | select(.key | startswith("v0-rust-")) | [.id, .key, .created_at, .size_in_bytes] | @tsv' \
  > "$list"

# Newest first: the first cache of each kind stays, every later one goes.
sort -t $'\t' -k3,3r "$list" |
  awk -F '\t' '{ kind = $2; sub(/-[0-9a-f]+-[0-9a-f]+$/, "", kind); if (seen[kind]++) print $1 "\t" $2 "\t" $4 }' |
  while IFS=$'\t' read -r id key size; do
    if gh api -X DELETE "repos/${GITHUB_REPOSITORY}/actions/caches/${id}" >/dev/null 2>&1; then
      echo "deleted ${key} ($((size / 1048576)) MB)"
    else
      echo "::warning::could not delete cache ${key}"
    fi
  done

gh api "repos/${GITHUB_REPOSITORY}/actions/cache/usage" \
  --jq '"cache in use: \(.active_caches_size_in_bytes / 1048576 | floor) MB in \(.active_caches_count) caches"'
