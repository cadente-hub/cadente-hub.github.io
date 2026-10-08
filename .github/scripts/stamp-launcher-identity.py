#!/usr/bin/env python3
"""Stamps the launcher identity into a macOS bundle (Fat Bundle step).

The launcher is identified by a digest of the sources it is compiled from, not
by the build number: a newer build with the same launcher code carries the same
digest, so installed launchers never see it as an update. The algorithm mirrors
crates/cadente-launcher/build_support/digest.rs of the private repository.

  stamp-launcher-identity.py --source DIR --app Cadente.app --build VERSION [--bin BIN]

Writes Contents/SharedSupport/launcher.json ({"build","digest"}) inside the
bundle, so it is covered by the package signature. When the launcher binary can
run on this runner it is asked for its embedded digest and the two must agree.
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys

SOURCES = [
    "crates/cadente-launcher/src",
    "crates/cadente-launcher/ui",
    "crates/cadente-launcher/build.rs",
    "crates/cadente-launcher/build_support",
    "crates/cadente-launcher/Cargo.toml",
    "crates/cadente-launcher/Cargo.lock",
    "crates/cadente-updates/src",
    "crates/cadente-updates/Cargo.toml",
    "client/src/design-system/tokens/launcher.json",
]


def collect(path, out):
    if os.path.isfile(path):
        out.append(path)
        return
    for name in sorted(os.listdir(path)):
        if name == "target" or name.startswith("."):
            continue
        collect(os.path.join(path, name), out)


def source_digest(root):
    files = []
    for entry in SOURCES:
        collect(os.path.join(root, entry), files)
    # Rust sorts paths component by component.
    files.sort(key=lambda p: [part.encode() for part in os.path.relpath(p, root).split(os.sep)])
    h = hashlib.sha256()
    for f in files:
        data = open(f, "rb").read()
        h.update(os.path.relpath(f, root).replace(os.sep, "/").encode())
        h.update(b"\0")
        h.update(len(data).to_bytes(8, "little"))
        h.update(data)
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True)
    ap.add_argument("--app")
    ap.add_argument("--build", required=True)
    ap.add_argument("--bin")
    ap.add_argument("--print", action="store_true", help="only print the digest")
    args = ap.parse_args()

    digest = source_digest(args.source)
    if args.bin and os.path.isfile(args.bin):
        try:
            out = subprocess.run([args.bin, "--launcher-identity"], capture_output=True, text=True, timeout=30)
            embedded = json.loads(out.stdout.strip().splitlines()[-1])["digest"] if out.returncode == 0 else None
        except Exception:
            embedded = None  # cross-built binary that cannot run on this runner
        if embedded is not None and embedded != digest:
            sys.exit(f"launcher digest mismatch: script {digest} vs binary {embedded}")
    if args.print or not args.app:
        print(digest)
        return
    target = os.path.join(args.app, "Contents/SharedSupport")
    os.makedirs(target, exist_ok=True)
    with open(os.path.join(target, "launcher.json"), "w") as fh:
        json.dump({"build": args.build, "digest": digest}, fh)
    print(f"launcher identity {digest[:12]} stamped for build {args.build}")


if __name__ == "__main__":
    main()
