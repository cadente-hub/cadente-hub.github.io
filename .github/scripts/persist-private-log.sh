#!/usr/bin/env bash
set -euo pipefail

persist_private_build_log() {
  local log_file="$1"
  local label="$2"
  local repo_dir safe_workflow safe_job dest_dir dest_rel

  safe_workflow="$(printf '%s' "${GITHUB_WORKFLOW:-workflow}" | tr -cs 'A-Za-z0-9._-' '-')"
  safe_job="$(printf '%s' "${GITHUB_JOB:-job}" | tr -cs 'A-Za-z0-9._-' '-')"
  dest_rel=".cadente-build-logs/public-actions/${safe_workflow}/${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-0}/${safe_job}-${label}.log"

  if [ -z "${PRIVATE_LOG_TOKEN:-}" ]; then
    echo "::error::Public CI failed and no private log token is configured. Set CATARINA_PRIVATE_WRITE_TOKEN or CATARINA_PRIVATE_LOG_TOKEN on the public repo."
    if [ -f "$log_file" ]; then
      echo "::group::Last 80 build log lines"
      tail -80 "$log_file" || true
      echo "::endgroup::"
    fi
    return 0
  fi

  if [ ! -f "$log_file" ]; then
    echo "::error::Public CI failed before the private log could be stored: missing log file."
    return 0
  fi

  echo "::add-mask::${PRIVATE_LOG_TOKEN}"
  repo_dir="$(mktemp -d)"

  if ! git clone --depth=1 "https://x-access-token:${PRIVATE_LOG_TOKEN}@github.com/${PRIVATE_REPO}.git" "$repo_dir" >/dev/null 2>&1; then
    echo "::error::Public CI failed. Could not clone the private log repository."
    rm -rf "$repo_dir"
    return 0
  fi

  dest_dir="$repo_dir/$(dirname "$dest_rel")"
  mkdir -p "$dest_dir"
  cp "$log_file" "$repo_dir/$dest_rel"
  git -C "$repo_dir" config user.name "github-actions[bot]"
  git -C "$repo_dir" config user.email "github-actions[bot]@users.noreply.github.com"
  git -C "$repo_dir" add -f "$dest_rel"

  if git -C "$repo_dir" diff --cached --quiet; then
    echo "::error::Public CI failed. Private log already exists at ${dest_rel}."
    rm -rf "$repo_dir"
    return 0
  fi

  git -C "$repo_dir" commit -m "ci: store private public-action log for ${GITHUB_RUN_ID:-local} ${safe_job}" >/dev/null 2>&1

  for attempt in 1 2 3 4 5; do
    if git -C "$repo_dir" push >/dev/null 2>&1; then
      echo "::error::Public CI failed. Full log committed privately at ${dest_rel}."
      rm -rf "$repo_dir"
      return 0
    fi
    git -C "$repo_dir" pull --rebase --autostash >/dev/null 2>&1 || true
    sleep "$attempt"
  done

  echo "::error::Public CI failed. Could not push the private log after retries."
  rm -rf "$repo_dir"
}
