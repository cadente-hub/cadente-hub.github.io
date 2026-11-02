#!/usr/bin/env bash
# Clones the private repository at one commit with the read-only deploy key (CATARINA_PRIVATE_DEPLOY_KEY)
# and leaves no credential behind: the key file is deleted and the clone has no remote. Jobs that compile
# third-party crates use this instead of a token, so a build script that steals what its job holds gets
# read access to one repository and nothing it can write.
#
#   DEPLOY_KEY=<private key> PRIVATE_REPO=<owner/name> clone-private.sh <directory> <40-hex sha>
set -euo pipefail

dest="$1"
sha="$2"
: "${PRIVATE_REPO:?PRIVATE_REPO is not set}"
if [ -z "${DEPLOY_KEY:-}" ]; then
  echo "::error::CATARINA_PRIVATE_DEPLOY_KEY is not set"
  exit 1
fi
if ! printf '%s' "$sha" | grep -qE '^[0-9a-f]{40}$'; then
  echo "::error::Invalid SHA (must be 40 hex digits)"
  exit 1
fi

ssh_dir="$(mktemp -d)"
trap 'rm -rf "$ssh_dir"' EXIT
(umask 077 && printf '%s\n' "$DEPLOY_KEY" > "$ssh_dir/key")
# GitHub's published host keys (api.github.com/meta): a spoofed github.com is refused.
cat > "$ssh_dir/known_hosts" <<'KEYS'
github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl
github.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrbo5wAdT/y6v0mKV0U2w0WZ2YB/++Tpockg=
github.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCj7ndNxQowgcQnjshcLrqPEiiphnt+VTTvDP6mHBL9j1aNUkY4Ue1gvwnGLVlOhGeYrnZaMgRK6+PKCUXaDbC7qtbW8gIkhL7aGCsOr/C56SJMy/BCZfxd1nWzAOxSDPgVsmerOBYfNqltV9/hWCqBywINIR+5dIg6JTJ72pcEpEjcYgXkE2YEFXV1JHnsKgbLWNlhScqb2UmyRkQyytRLtL+38TGxkxCflmO+5Z8CSSNY7GidjMIZ7Q4zMjA2n1nGrlTDkzwDCsw+wqFPGQA179cnfGWOWRVruj16z6XyvxvjJwbz0wQZ75XK5tKSb7FNyeIEs4TT4jk+S4dhPeAUC5y+bDYirYgM4GC7uEnztnZyaVWQ7B381AK4Qdrwt51ZqExKbQpTUNn+EjqoTwvqNj4kqx5QUCI0ThS/YkOxJCXmPUWZbhjpCg56i+2aB6CmK2JGhn57K5mj0MNdBXA4/WnwH6XoPWJzK5Nyu2zB3nAZp+S5hpQs+p1vN1/wsjk=
KEYS
export GIT_SSH_COMMAND="ssh -i '$ssh_dir/key' -o IdentitiesOnly=yes -o UserKnownHostsFile='$ssh_dir/known_hosts' -o StrictHostKeyChecking=yes -o BatchMode=yes"
export GIT_TERMINAL_PROMPT=0

# Only the commit, without history (ADR 0082 W6): nothing that builds or tests reads the checkout's git
# history, and the full clone took 10 to 13 s on Windows.
mkdir -p "$dest"
git init --quiet "$dest"
git -C "$dest" remote add origin "git@github.com:${PRIVATE_REPO}.git"
if ! git -C "$dest" fetch --quiet --depth=1 origin "$sha" >/dev/null 2>&1; then
  echo "::error::Could not fetch commit $sha from the private repository with the deploy key"
  exit 1
fi
git -C "$dest" checkout --quiet --detach FETCH_HEAD >/dev/null 2>&1
git -C "$dest" remote remove origin
