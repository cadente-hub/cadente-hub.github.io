#!/usr/bin/env python3
"""Exercise a real published DMG without launching or changing /Applications."""
import hashlib
import json
import os
from pathlib import Path
import plistlib
import subprocess
import sys
import tempfile

DMG = Path(sys.argv[1]).resolve()
ROOT = Path(__file__).resolve().parents[1]
VERSION = "1.1.0-beta.1" if len(sys.argv) < 3 else sys.argv[2]
BASE = f"https://github.com/cadente-hub/cadente-hub.github.io/releases/download/v{VERSION}"
NAME = f"cadente-{VERSION}-macos-arm64.dmg"
value = hashlib.sha256()
with DMG.open("rb") as stream:
    while block := stream.read(1024 * 1024):
        value.update(block)
SHA = value.hexdigest()

with tempfile.TemporaryDirectory(prefix="cadente-install-test-") as directory:
    root = Path(directory)
    tools = root / "tools"
    tools.mkdir()
    (tools / "curl").write_text('''#!/usr/bin/env python3
import os,shutil,sys
from pathlib import Path
args=sys.argv[1:]; url=next(v for v in args if v.startswith("https://")); dest=args[args.index("-o")+1]
root=Path(os.environ["INSTALL_FIXTURE"])
source=root/"manifest.json" if url.endswith("update-beta.json") else root/"checksums" if url.endswith("SHA256SUMS.txt") else Path(os.environ["INSTALL_FIXTURE_DMG"])
shutil.copyfile(source,dest)
''')
    (tools / "uname").write_text('#!/bin/sh\nif [ "$1" = -s ]; then echo Darwin; else echo arm64; fi\n')
    (tools / "pkill").write_text('#!/bin/sh\nexit 0\n')
    (tools / "open").write_text('#!/bin/sh\necho "installer unexpectedly launched app" >&2\nexit 1\n')
    for tool in tools.iterdir():
        tool.chmod(0o755)
    (root / "checksums").write_text(f"{SHA}  {NAME}\n")
    for case in ["desktop", "older-feed", "bad-checksum", "bare-payload"]:
        target = root / case
        target.mkdir()
        previous = target / "Cadente.app"
        previous.mkdir()
        (previous / "old.marker").write_text("preserved")
        entry = {"installerUrl": f"{BASE}/{NAME}", "installerSha256": SHA}
        if case == "older-feed":
            entry = {"url": f"{BASE}/cadente-{VERSION}-darwin-aarch64.tar.gz"}
        if case == "bad-checksum":
            entry["installerSha256"] = "0" * 64
        if case == "bare-payload":
            entry["installerUrl"] = f"{BASE}/cadente-{VERSION}-darwin-aarch64.tar.gz"
        (root / "manifest.json").write_text(json.dumps({"version": VERSION, "platforms": {"darwin-aarch64": entry}}))
        result = subprocess.run(["bash", str(ROOT / "install.sh")], env={**os.environ, "PATH": f"{tools}:{os.environ['PATH']}", "INSTALL_FIXTURE": str(root), "INSTALL_FIXTURE_DMG": str(DMG), "CADENTE_INSTALL_DIR": str(target), "CADENTE_INSTALL_NO_LAUNCH": "1"}, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if case in ["desktop", "older-feed"]:
            assert result.returncode == 0, (case, result.stdout, result.stderr)
            info = plistlib.loads((previous / "Contents/Info.plist").read_bytes())
            assert info["CFBundleShortVersionString"] == VERSION
            assert (previous / "Contents/MacOS" / info["CFBundleExecutable"]).is_file()
            assert not (previous / "old.marker").exists()
        else:
            assert result.returncode != 0, (case, result.stdout, result.stderr)
            assert (previous / "old.marker").read_text() == "preserved"
            assert sorted(p.name for p in target.iterdir()) == ["Cadente.app"]
        print("PASS", case)
