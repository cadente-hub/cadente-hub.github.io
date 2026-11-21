#!/usr/bin/env bash
# Runs may finish in any order (one native-ci run per commit), so `publish` asks before it moves the
# release list, the beta feed or the Homebrew cask: is this version newer than every beta already out?
# Usage: beta-is-newest.sh <X.Y.Z-beta.N>, with the versions already out on stdin, one per line (a `v`
# prefix and lines that are not betas are ignored). Exit 0 = newest, publish; 1 = the same or a newer
# beta is out, publish nothing; 2 = bad argument.
set -euo pipefail
mine="${1:?usage: beta-is-newest.sh <X.Y.Z-beta.N>}"
re='^[0-9]+\.[0-9]+\.[0-9]+-beta\.[0-9]+$'
printf '%s' "$mine" | grep -qE "$re" || { echo "beta-is-newest: not a beta version: $mine" >&2; exit 2; }
others="$(sed 's/^v//' | grep -E "$re" || true)"
top="$( { printf '%s\n' "$others"; echo "$mine"; } | grep -v '^$' | sort -V | tail -1)"
[ "$top" = "$mine" ] && ! printf '%s\n' "$others" | grep -qxF "$mine"
