#!/usr/bin/env python3
"""Expose native portable releases to installed launchers without renaming signed assets."""
import json
import sys
from pathlib import Path


def manifest(feed):
    channel = feed["channel"]
    if channel not in {"stable", "beta", "nightly"}:
        raise ValueError("unsupported release channel")
    releases = feed["releases"]
    if not releases:
        raise ValueError("empty native feed")
    version = releases[0]["version"]
    platforms = {}
    expected = {"darwin-aarch64", "darwin-x86_64", "linux-x86_64", "windows-x86_64"}
    for release in releases:
        if release["version"] != version or release["channel"] != channel or release["product"] != "core":
            raise ValueError("mixed releases in native feed")
        platform = release["platform"]
        if platform not in expected or platform in platforms:
            raise ValueError("unknown or duplicate platform")
        if not release["artifactUrl"].startswith("https://") or not release["artifactSignature"]:
            raise ValueError("unsigned or insecure artifact")
        platforms[platform] = {
            "url": release["artifactUrl"],
            "signature": release["artifactSignature"],
            "sha256": release["artifactDigest"],
        }
    if set(platforms) != expected:
        raise ValueError("missing native platform")
    # Old Windows launchers only install a version from the portable key.
    platforms["windows-x86_64-portable"] = platforms["windows-x86_64"].copy()
    return {"version": version, "channel": channel, "platforms": platforms}


if __name__ == "__main__":
    source, target = map(Path, sys.argv[1:])
    previous = json.loads(target.read_text()) if target.exists() else {}
    result = manifest(json.loads(source.read_text()))
    # Preserve dedicated launcher updates independently of the selected Core.
    for key in ("launcher", "launcher_release"):
        if key in previous:
            result[key] = previous[key]
    target.write_text(json.dumps(result, indent=2) + "\n")
