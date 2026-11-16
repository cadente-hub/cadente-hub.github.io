#!/usr/bin/env bash
# The Cadente extension for Chromium browsers (ADR 0097 §3.5) is Rust compiled to WebAssembly: the
# bundle that follows carries it beside the app. `wasm-bindgen` makes its loader, and its version
# must be the one of the `wasm-bindgen` crate in Cargo.lock, so the prebuilt tool of that release is
# downloaded instead of compiled in every job (a `cargo install` took minutes).
# A failure here never stops the release: the package then ships without the extension, and
# `cadente-user-browsers connect` says so.
set -uo pipefail
OUT="target/bridge-extension/chromium"
[ -f "$OUT/manifest.json" ] && { echo "Resultado: OK (already built)"; exit 0; }

echo "Passo: the browser extension (WebAssembly)"
VER="$(awk '/^name = "wasm-bindgen"$/ { getline; gsub(/"/, "", $3); print $3; exit }' Cargo.lock)"
case "${RUNNER_OS:-}/${RUNNER_ARCH:-}" in
  macOS/ARM64) TARGET=aarch64-apple-darwin ;;
  macOS/X64) TARGET=x86_64-apple-darwin ;;
  Linux/X64) TARGET=x86_64-unknown-linux-musl ;;
  Windows/X64) TARGET=x86_64-pc-windows-msvc ;;
  *) TARGET="" ;;
esac
if [ -z "$VER" ] || [ -z "$TARGET" ]; then
  echo "::warning::no wasm-bindgen for ${RUNNER_OS:-?}/${RUNNER_ARCH:-?} (version '${VER}'): the package ships without the extension"
  echo "Resultado: PULADO"
  exit 0
fi
DIR="$RUNNER_TEMP/wasm-bindgen-$VER-$TARGET"
mkdir -p "$RUNNER_TEMP"
ok=false
for attempt in 1 2 3; do
  if curl -fsSL "https://github.com/wasm-bindgen/wasm-bindgen/releases/download/$VER/wasm-bindgen-$VER-$TARGET.tar.gz" | tar xz -C "$RUNNER_TEMP"; then ok=true; break; fi
  sleep $((attempt * 10))
done
if ! $ok; then
  echo "::warning::wasm-bindgen $VER did not download: the package ships without the extension"
  echo "Resultado: PULADO"
  exit 0
fi
export PATH="$DIR:$PATH"
if rustup target add wasm32-unknown-unknown >/dev/null 2>&1 \
  && cargo build --quiet -p xtask \
  && ./target/debug/xtask bridge-extension; then
  echo "Resultado: OK"
else
  echo "::warning::the browser extension did not build: the package ships without it"
  echo "Resultado: PULADO"
fi
exit 0
