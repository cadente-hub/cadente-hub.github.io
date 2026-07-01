#!/usr/bin/env python3
"""Validate Cadente release manifests and optional macOS app archives.

This is intentionally stdlib-only so it can run in GitHub Actions, local dev
machines, and the public release builder without dependency drift.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request
import urllib.error


EXPECTED_PLATFORM_URL_BITS = {
    "darwin-aarch64": "macos-arm64.app.tar.gz",
    "darwin-x86_64": "macos-x64.app.tar.gz",
    "linux-x86_64": "linux-x64.AppImage.tar.gz",
    "windows-x86_64": "windows-x64.nsis.zip",
}

EXPECTED_MACHO_ARCH = {
    "darwin-aarch64": "arm64",
    "darwin-x86_64": "x86_64",
}


def load_manifest(path: str | None, url: str | None) -> dict:
    if path:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    if url:
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError):
            curl_bin = shutil.which("curl")
            if not curl_bin:
                raise
            result = subprocess.run(
                [curl_bin, "-fsSL", url],
                check=True,
                text=True,
                stdout=subprocess.PIPE,
            )
            return json.loads(result.stdout)
    raise SystemExit("pass --manifest or --manifest-url")


def validate_manifest(manifest: dict) -> list[str]:
    errors: list[str] = []
    version = manifest.get("version")
    if not isinstance(version, str) or not version:
        errors.append("manifest must contain a non-empty version")
        version = ""
    expected_release_segment = f"/releases/download/v{version}/" if version else ""

    platforms = manifest.get("platforms")
    if not isinstance(platforms, dict):
        return ["manifest must contain a platforms object"]

    for platform, expected_url_bit in EXPECTED_PLATFORM_URL_BITS.items():
        entry = platforms.get(platform)
        if not isinstance(entry, dict):
            errors.append(f"missing platform entry: {platform}")
            continue
        url = entry.get("url", "")
        signature = entry.get("signature", "")
        if expected_release_segment and expected_release_segment not in url:
            errors.append(
                f"{platform} URL must point at release v{version}; got {url}"
            )
        if expected_url_bit not in url:
            errors.append(f"{platform} URL must contain {expected_url_bit}; got {url}")
        if not signature:
            errors.append(f"{platform} is missing updater signature")

    return errors


def validate_macos_archive(platform: str, archive_path: pathlib.Path) -> list[str]:
    errors: list[str] = []
    expected = EXPECTED_MACHO_ARCH[platform]
    if not archive_path.exists():
        return [f"{platform} archive missing: {archive_path}"]

    with tempfile.TemporaryDirectory() as tmpdir:
        with tarfile.open(archive_path, "r:gz") as archive:
            member = next(
                (
                    item
                    for item in archive.getmembers()
                    if item.name.endswith(".app/Contents/MacOS/cadente")
                ),
                None,
            )
            if member is None:
                return [f"{archive_path} does not contain Cadente.app/Contents/MacOS/cadente"]
            archive.extract(member, tmpdir)
            binary_path = pathlib.Path(tmpdir) / member.name

        file_bin = shutil.which("file")
        if not file_bin:
            return errors
        result = subprocess.run(
            [file_bin, str(binary_path)],
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        output = result.stdout.strip()
        if expected not in output:
            errors.append(f"{archive_path.name} must be {expected}; file(1) said: {output}")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest")
    parser.add_argument("--manifest-url")
    parser.add_argument("--macos-arm64-archive")
    parser.add_argument("--macos-x64-archive")
    args = parser.parse_args()

    manifest = load_manifest(args.manifest, args.manifest_url)
    errors = validate_manifest(manifest)

    if args.macos_arm64_archive:
        errors.extend(
            validate_macos_archive(
                "darwin-aarch64", pathlib.Path(args.macos_arm64_archive)
            )
        )
    if args.macos_x64_archive:
        errors.extend(
            validate_macos_archive("darwin-x86_64", pathlib.Path(args.macos_x64_archive))
        )

    if errors:
        for error in errors:
            print(f"::error::{error}")
        return 1

    version = manifest.get("version", "(unknown)")
    print(f"release asset guard passed for {version}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
