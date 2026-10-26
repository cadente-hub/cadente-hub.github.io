#!/usr/bin/env python3
"""Expose separately signed desktop bundles to installed launchers."""
import base64
import json
import sys
from pathlib import Path


def manifest(feed, compatibility):
    channel = feed["channel"]
    if channel not in {"stable", "beta", "nightly"}:
        raise ValueError("unsupported release channel")
    releases = feed["releases"]
    if not releases:
        raise ValueError("empty native feed")
    version = releases[0]["version"]
    if compatibility["version"] != version:
        raise ValueError("compatibility assets belong to another release")
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
        raw_signature = release["artifactSignature"]
        if not raw_signature.startswith("untrusted comment:"):
            raise ValueError("native artifact must have a raw Minisign signature")
        entry = {
            "url": release["artifactUrl"],
            "signature": base64.b64encode(raw_signature.encode()).decode(),
            "sha256": release["artifactDigest"],
        }
        if platform.startswith("darwin-"):
            entry = compatibility["platforms"][platform].copy()
            if not entry["url"].endswith(".app.tar.gz"):
                raise ValueError("installed macOS launchers require an app bundle archive")
            signature = base64.b64decode(entry["signature"], validate=True).decode()
            if not signature.startswith("untrusted comment:"):
                raise ValueError("legacy signature must be base64 of Minisign text")
        if not entry["url"].startswith("https://github.com/cadente-hub/cadente-hub.github.io/releases/download/v" + version + "/"):
            raise ValueError("compatibility artifact belongs to another release")
        if len(entry["sha256"]) != 64 or any(c not in "0123456789abcdef" for c in entry["sha256"]):
            raise ValueError("invalid artifact digest")
        entry.update(compatibility["installers"].get(platform, {}))
        platforms[platform] = entry
    if set(platforms) != expected:
        raise ValueError("missing native platform")
    # Old Windows launchers only install a version from the portable key.
    platforms["windows-x86_64-portable"] = platforms["windows-x86_64"].copy()
    return {"version": version, "channel": channel, "platforms": platforms}


if __name__ == "__main__":
    source, target, compatibility = map(Path, sys.argv[1:])
    previous = json.loads(target.read_text()) if target.exists() else {}
    result = manifest(json.loads(source.read_text()), json.loads(compatibility.read_text()))
    # Preserve dedicated launcher updates independently of the selected Core.
    for key in ("launcher", "launcher_release"):
        if key in previous:
            result[key] = previous[key]
    target.write_text(json.dumps(result, indent=2) + "\n")
