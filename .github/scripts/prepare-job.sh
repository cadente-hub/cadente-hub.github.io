#!/usr/bin/env bash
# W6 (ADR 0082): the preparation of a job that compiles, side by side. The pinned Rust (its channel
# comes from `resolve`, which read rust-toolchain.toml) and, on Linux, the system libraries the image
# lacks install in the background while the private commit is cloned; one after the other they took
# 3 + 9 + 10 to 19 s on Linux and 5 + 12 s on Windows (runs 41621301507 and 41690859507). With
# NEXTEST=true, the latest cargo-nextest comes the same way, by nextest's own installer
# (get.nexte.st), instead of a step of its own after the cache (3 to 4 s). No background job sees the
# deploy key.
#
#   DEPLOY_KEY=<private key> PRIVATE_REPO=<owner/name> [NEXTEST=true] \
#     prepare-job.sh <40-hex sha> <toolchain channel> <targets, space-separated, or ""> [apt package...]
set -euo pipefail

sha="$1"
channel="$2"
target="$3"
shift 3
if ! printf '%s' "$channel" | grep -qE '^[0-9A-Za-z][0-9A-Za-z.-]*$'; then
  echo "::error::Invalid toolchain channel: $channel"
  exit 1
fi
logs="$RUNNER_TEMP/prepare"
mkdir -p "$logs"

# Y13 (ADR 0091): the steps that only fetch from the network try again, three times with a growing
# wait. A compile or a test never goes through here: a red one stays red.
retry() {
  local attempt=1
  until "$@"; do
    if [ "$attempt" -ge 3 ]; then return 1; fi
    echo "::warning::$1 failed (attempt $attempt of 3); trying again"
    sleep $((attempt * 10))
    attempt=$((attempt + 1))
  done
}

# One `-t` per target (the Mac job builds two). A string, not an array: the macOS bash (3.2) calls an
# empty array unbound under `set -u`.
target_flags=""
for one in $target; do
  printf '%s' "$one" | grep -qE '^[a-z0-9_]+(-[a-z0-9_]+)+$' || { echo "::error::Invalid target: $one"; exit 1; }
  target_flags="$target_flags -t $one"
done
# shellcheck disable=SC2086
retry env -u DEPLOY_KEY rustup toolchain install "$channel" --profile minimal -c rustfmt -c clippy $target_flags \
  --no-self-update > "$logs/rustup.log" 2>&1 &
rustup_pid=$!

apt_pid=""
if [ "$RUNNER_OS" = "Linux" ] && [ "$#" -gt 0 ]; then
  # apt only for what the image lacks; it hung once for over an hour on a mirror, so it retries the
  # download and gives up after 10 minutes.
  if ! dpkg -s "$@" > /dev/null 2>&1; then
    retry env -u DEPLOY_KEY bash -c 'timeout 600 sudo apt-get -o Acquire::Retries=3 update \
      && timeout 600 sudo apt-get -o Acquire::Retries=3 install -y "$@"' apt "$@" > "$logs/apt.log" 2>&1 &
    apt_pid=$!
  fi
fi

nextest_pid=""
if [ "${NEXTEST:-false}" = "true" ]; then
  case "$RUNNER_OS" in
    Linux) platform=linux ;;
    macOS) platform=mac ;;
    Windows) platform=windows-tar ;;
  esac
  mkdir -p "$RUNNER_TEMP/bin"
  # From inside the folder: GNU tar reads `D:` in `-C D:\a\...` as a remote host on Windows.
  retry env -u DEPLOY_KEY bash -c 'cd "$2" && curl -LsSf --retry 3 "https://get.nexte.st/latest/$1" | tar zxf -' \
    nextest "$platform" "$RUNNER_TEMP/bin" > "$logs/nextest.log" 2>&1 &
  nextest_pid=$!
  # Before ~/.cargo/bin, which rust-cache restores with whatever nextest it saved.
  echo "$RUNNER_TEMP/bin" >> "$GITHUB_PATH"
fi

bash "$RUNNER_TEMP/scripts/clone-private.sh" . "$sha"

if ! wait "$rustup_pid"; then
  cat "$logs/rustup.log"
  echo "::error::rustup could not install $channel"
  exit 1
fi
if [ -n "$apt_pid" ] && ! wait "$apt_pid"; then
  tail -40 "$logs/apt.log"
  echo "::error::apt could not install the system libraries"
  exit 1
fi
if [ -n "$nextest_pid" ] && ! wait "$nextest_pid"; then
  cat "$logs/nextest.log"
  echo "::error::cargo-nextest did not install"
  exit 1
fi
if [ "$(sed -n 's/^channel = "\(.*\)"/\1/p' rust-toolchain.toml)" != "$channel" ]; then
  echo "::error::rust-toolchain.toml does not pin $channel"
  exit 1
fi
rustup default "$channel" > /dev/null
rustc --version
if [ -n "$nextest_pid" ]; then "$RUNNER_TEMP/bin/cargo-nextest" nextest --version | head -1; fi
