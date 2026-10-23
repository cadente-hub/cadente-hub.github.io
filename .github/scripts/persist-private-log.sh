#!/usr/bin/env bash
set -euo pipefail

persist_private_build_log() {
  local log_file="$1"
  local label="$2"
  local step="${3:-desconhecido}"
  local repo_dir dest_dir dest_rel

  dest_rel="public-actions/${GITHUB_RUN_ID:-local}/${label}.log"

  if [ -z "${PRIVATE_LOG_TOKEN:-}" ]; then
    echo "falhou em ${step}; reproduza localmente"
    return 0
  fi

  if [ ! -f "$log_file" ]; then
    echo "falhou em ${step}; reproduza localmente"
    return 0
  fi

  echo "::add-mask::${PRIVATE_LOG_TOKEN}"
  repo_dir="$(mktemp -d)"

  if ! git clone --depth=1 --branch ci-logs "https://x-access-token:${PRIVATE_LOG_TOKEN}@github.com/${PRIVATE_REPO}.git" "$repo_dir" >/dev/null 2>&1; then
    echo "falhou em ${step}; reproduza localmente"
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
    rm -rf "$repo_dir"
    return 0
  fi

  git -C "$repo_dir" commit -m "ci: store private public-action log for ${GITHUB_RUN_ID:-local} ${label}" >/dev/null 2>&1

  for attempt in 1 2 3 4 5; do
    if git -C "$repo_dir" push origin ci-logs >/dev/null 2>&1; then
      rm -rf "$repo_dir"
      return 0
    fi
    git -C "$repo_dir" pull --rebase origin ci-logs >/dev/null 2>&1 || true
    sleep "$attempt"
  done

  echo "falhou em ${step}; reproduza localmente"
  rm -rf "$repo_dir"
}
