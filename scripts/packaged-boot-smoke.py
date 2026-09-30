#!/usr/bin/env python3
"""Run a packaged Cadente app long enough to catch startup panics."""

from __future__ import annotations

import argparse
import os
import pathlib
import plistlib
import subprocess
import tempfile
import time


def macos_binary(app_path: pathlib.Path) -> pathlib.Path:
    info_path = app_path / "Contents" / "Info.plist"
    with info_path.open("rb") as file:
        executable = plistlib.load(file).get("CFBundleExecutable")
    if executable != "cadente":
        raise SystemExit(f"Cadente app must declare CFBundleExecutable=cadente; got {executable!r}")
    binary = app_path / "Contents" / "MacOS" / executable
    if not binary.is_file() or not os.access(binary, os.X_OK):
        raise SystemExit(f"missing macOS app binary: {binary}")
    return binary


def run_smoke(command: list[str], timeout_secs: int, component: str = "core") -> int:
    env = os.environ.copy()
    env["CADENTE_BOOT_SMOKE"] = "1"
    env["RUST_BACKTRACE"] = "full"
    env["NO_AT_BRIDGE"] = "1"

    with tempfile.TemporaryDirectory(prefix="cadente-boot-smoke-") as tmpdir:
        env["CADENTE_HOME"] = str(pathlib.Path(tmpdir) / "launcher")
        env["CADENTE_DATA_DIR"] = str(pathlib.Path(tmpdir) / "app")
        proc = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            env=env,
        )
        try:
            output, _ = proc.communicate(timeout=timeout_secs)
        except subprocess.TimeoutExpired:
            proc.kill()
            output, _ = proc.communicate(timeout=10)
            print(output, end="")
            print(f"::error::packaged app did not exit within {timeout_secs}s")
            return 1

    print(output, end="")
    if proc.returncode != 0:
        print(f"::error::packaged app exited with code {proc.returncode}")
        return proc.returncode or 1

    if "panicked at" in output or "thread caused non-unwinding panic" in output:
        print("::error::packaged app emitted a Rust panic during boot")
        return 1

    marker = f"cadente {component} boot smoke passed"
    if marker not in output:
        print(f"::error::packaged {component} did not confirm its initialization")
        return 1

    print(f"packaged {component} boot smoke passed")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--macos-app")
    parser.add_argument("--timeout-secs", type=int, default=20)
    args = parser.parse_args()

    if args.macos_app:
        app_path = pathlib.Path(args.macos_app)
        binary = macos_binary(app_path)
        core = app_path / "Contents" / "MacOS" / "cadente-core"
        if core.exists():
            if not core.is_file() or not os.access(core, os.X_OK):
                raise SystemExit(f"missing executable packaged core: {core}")
            commands = [("launcher", [str(binary)]), ("core", [str(core)])]
        else:
            # A plain Tauri bundle has no launcher. A fat bundle missing its
            # core fails below because launcher output cannot satisfy this role.
            commands = [("core", [str(binary)])]
    else:
        raise SystemExit("pass --macos-app")

    start = time.monotonic()
    code = 0
    for component, command in commands:
        code = run_smoke(command, args.timeout_secs, component)
        if code != 0:
            break
    elapsed = time.monotonic() - start
    print(f"packaged boot smoke elapsed: {elapsed:.1f}s")
    return code


if __name__ == "__main__":
    raise SystemExit(main())
