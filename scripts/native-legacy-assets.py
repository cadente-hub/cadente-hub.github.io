#!/usr/bin/env python3
"""Package already-built macOS apps for installed launchers; never compile the app."""
import base64
import hashlib
import json
from pathlib import Path
import plistlib
import re
import subprocess
import sys
import tarfile
import tempfile

REPO = "cadente-hub/cadente-hub.github.io"

def run(*args):
    subprocess.run(args, check=True)

def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as stream:
        while block := stream.read(1024 * 1024):
            value.update(block)
    return value.hexdigest()

def build(tag, output):
    if not re.fullmatch(r"v\d+\.\d+\.\d+(?:-beta\.\d+)?", tag):
        raise ValueError("expected a published stable or beta tag")
    version = tag[1:]
    output = Path(output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    release = json.loads(subprocess.check_output(["gh", "release", "view", tag, "-R", REPO, "--json", "assets"], text=True))
    assets = {asset["name"]: asset for asset in release["assets"]}
    with tempfile.TemporaryDirectory(prefix="cadente-legacy-") as temporary:
        temporary = Path(temporary)
        run("gh", "release", "download", tag, "-R", REPO, "-p", "SHA256SUMS.txt", "-D", str(temporary))
        checksums = {parts[1].lstrip("*"): parts[0] for line in (temporary / "SHA256SUMS.txt").read_text().splitlines() if len(parts := line.split()) == 2}
        compatibility = {"version": version, "platforms": {}, "installers": {}}
        upload = []
        for platform, arch in [("darwin-aarch64", "arm64"), ("darwin-x86_64", "x64")]:
            dmg_name = f"cadente-{version}-macos-{arch}.dmg"
            archive_name = f"cadente-{version}-macos-{arch}.app.tar.gz"
            signature_name = archive_name + ".sig"
            archive, signature = output / archive_name, output / signature_name
            run("gh", "release", "download", tag, "-R", REPO, "-p", dmg_name, "-D", str(temporary))
            dmg = temporary / dmg_name
            if digest(dmg) != checksums[dmg_name]:
                raise ValueError("published DMG checksum mismatch")
            if (archive_name in assets) != (signature_name in assets):
                raise ValueError("incomplete previously published compatibility assets")
            if archive_name in assets:
                run("gh", "release", "download", tag, "-R", REPO, "-p", archive_name, "-p", signature_name, "-D", str(output))
            else:
                mount = temporary / arch
                mount.mkdir()
                run("hdiutil", "attach", "-readonly", "-nobrowse", "-mountpoint", str(mount), str(dmg))
                try:
                    app = mount / "Cadente.app"
                    info = plistlib.loads((app / "Contents/Info.plist").read_bytes())
                    if info["CFBundleShortVersionString"] != version or not (app / "Contents/MacOS" / info["CFBundleExecutable"]).is_file():
                        raise ValueError("DMG does not contain the expected Cadente.app")
                    with tarfile.open(archive, "w:gz") as writer:
                        writer.add(app, arcname="Cadente.app")
                finally:
                    run("hdiutil", "detach", str(mount))
                run("npx", "--yes", "@tauri-apps/cli@2", "signer", "sign", "--password", "", str(archive))
                upload.extend([archive, signature])
            encoded = signature.read_text().strip()
            if not base64.b64decode(encoded, validate=True).decode().startswith("untrusted comment:"):
                raise ValueError("Tauri signer did not produce a legacy signature")
            compatibility["platforms"][platform] = {"url": f"https://github.com/{REPO}/releases/download/{tag}/{archive_name}", "signature": encoded, "sha256": digest(archive)}
            compatibility["installers"][platform] = {"installerUrl": assets[dmg_name]["url"], "installerSha256": checksums[dmg_name]}
        for platform, name in [("linux-x86_64", f"cadente-{version}-linux-x64.AppImage"), ("windows-x86_64", f"cadente-{version}-windows-x64.exe")]:
            compatibility["installers"][platform] = {"installerUrl": assets[name]["url"], "installerSha256": checksums[name]}
        run("python3", "scripts/test-install-macos.py", str(temporary / f"cadente-{version}-macos-arm64.dmg"), version)
        # Append new immutable names; never replace the native updater's payloads.
        if upload:
            run("gh", "release", "upload", tag, "-R", REPO, *map(str, upload))
        (output / "compatibility.json").write_text(json.dumps(compatibility, indent=2) + "\n")

if __name__ == "__main__":
    build(*sys.argv[1:])
