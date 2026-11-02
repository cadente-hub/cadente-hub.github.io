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
      echo "log completo de ${label} no repositório privado: ci-logs/${dest_rel}"
      rm -rf "$repo_dir"
      return 0
    fi
    git -C "$repo_dir" pull --rebase origin ci-logs >/dev/null 2>&1 || true
    sleep "$attempt"
  done

  echo "falhou em ${step}; reproduza localmente"
  rm -rf "$repo_dir"
}

# Copies every file of <src_dir> into <dest_rel> of the private ci-logs branch, in one commit.
#   persist_private_files <src_dir> <dest_rel> <label>
persist_private_files() {
  local src_dir="$1"
  local dest_rel="$2"
  local label="$3"
  local repo_dir

  if [ -z "${PRIVATE_LOG_TOKEN:-}" ] || [ ! -d "$src_dir" ] || [ -z "$(ls -A "$src_dir" 2>/dev/null)" ]; then
    return 0
  fi

  echo "::add-mask::${PRIVATE_LOG_TOKEN}"
  repo_dir="$(mktemp -d)"
  # Only the destination folder: the branch keeps every run's logs, and a full checkout grows with them.
  if ! git clone --depth=1 --filter=blob:none --sparse --branch ci-logs "https://x-access-token:${PRIVATE_LOG_TOKEN}@github.com/${PRIVATE_REPO}.git" "$repo_dir" >/dev/null 2>&1 \
    || ! git -C "$repo_dir" sparse-checkout set "$dest_rel" >/dev/null 2>&1; then
    echo "::warning::could not store ${label} in the private repository"
    rm -rf "$repo_dir"
    return 0
  fi
  git -C "$repo_dir" config user.name "github-actions[bot]"
  git -C "$repo_dir" config user.email "github-actions[bot]@users.noreply.github.com"

  for attempt in 1 2 3 4 5; do
    mkdir -p "$repo_dir/$dest_rel"
    cp "$src_dir"/* "$repo_dir/$dest_rel/"
    git -C "$repo_dir" add -f "$dest_rel"
    if git -C "$repo_dir" diff --cached --quiet; then
      rm -rf "$repo_dir"
      return 0
    fi
    git -C "$repo_dir" commit -m "ci: store ${label} for ${GITHUB_RUN_ID:-local}" >/dev/null 2>&1
    if git -C "$repo_dir" push origin ci-logs >/dev/null 2>&1; then
      echo "${label} no repositório privado: ci-logs/${dest_rel}"
      rm -rf "$repo_dir"
      return 0
    fi
    git -C "$repo_dir" fetch --depth=1 origin ci-logs >/dev/null 2>&1 || true
    git -C "$repo_dir" reset --hard origin/ci-logs >/dev/null 2>&1 || true
    sleep "$attempt"
  done
  echo "::warning::could not store ${label} in the private repository"
  rm -rf "$repo_dir"
}
