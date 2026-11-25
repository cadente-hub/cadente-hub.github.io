"""Compare Chrome profile paths and parity's isolated Windows home."""
import json
import msvcrt
import os
import queue
import subprocess
import tempfile
import threading
from pathlib import Path


def version_from_pipe(fd, results):
    response = bytearray()
    try:
        while b"\0" not in response:
            chunk = os.read(fd, 4096)
            if not chunk:
                results.put(("eof", None))
                return
            response.extend(chunk)
        packet = json.loads(response.split(b"\0", 1)[0])
        results.put(("response", packet))
    except (OSError, ValueError) as error:
        results.put(("error", str(error)))


def probe(chrome, home, extended=False):
    print(f"home={home}, extended={extended}", flush=True)
    with tempfile.TemporaryDirectory(prefix="cadente-pipe-") as directory:
        root = Path(directory)
        profile = root / "data" / "browser" / "profile"
        profile.mkdir(parents=True)
        profile_arg = str(profile)
        if extended:
            profile_arg = "\\\\?\\" + profile_arg
        env = os.environ.copy()
        if home != "runner":
            fake_home = root / "home"
            if home == "created":
                fake_home.mkdir()
            env.update(HOME=str(fake_home), USERPROFILE=str(fake_home))
        child_read, write = os.pipe()
        read, child_write = os.pipe()
        try:
            handles = [msvcrt.get_osfhandle(fd) for fd in (child_read, child_write)]
            for handle in handles:
                os.set_handle_inheritable(handle, True)
            startup = subprocess.STARTUPINFO(lpAttributeList={"handle_list": handles})
            pipe_switch = f"--remote-debugging-io-pipes={handles[0]},{handles[1]}"
            args = [
                str(chrome), "--headless=new", "--remote-debugging-pipe",
                "--no-first-run", "--no-default-browser-check", "--disable-background-networking",
                "--disable-component-update", "--disable-sync", "--disable-default-apps",
                "--disable-extensions", "--disable-breakpad",
                "--disable-features=Translate,MediaRouter,OptimizationHints",
                "--force-color-profile=srgb", "--mute-audio",
                f"--user-data-dir={profile_arg}", "--enable-logging=stderr",
            ]
            args.extend(["about:blank", pipe_switch])
            with (root / "chrome.log").open("wb") as log:
                process = subprocess.Popen(args, startupinfo=startup, stdin=subprocess.DEVNULL,
                                           stdout=subprocess.DEVNULL, stderr=log,
                                           creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
                                           env=env, cwd=root)
            os.close(child_read)
            os.close(child_write)
            child_read = child_write = None
            results = queue.Queue()
            reader = threading.Thread(target=version_from_pipe, args=(read, results), daemon=True)
            reader.start()
            try:
                os.write(write, b'{"id":1,"method":"Browser.getVersion","params":{}}\0')
                print(results.get(timeout=15), flush=True)
            except (OSError, queue.Empty) as error:
                print("No version response", type(error).__name__, process.poll(), flush=True)
            finally:
                if process.poll() is None:
                    subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=8)
                process.wait(timeout=5)
                reader.join(timeout=3)
            print((root / "chrome.log").read_text(errors="replace")[-2200:], flush=True)
        finally:
            for fd in (child_read, child_write, read, write):
                if fd is not None:
                    os.close(fd)


candidates = [
    Path(env) / Path(*suffix)
    for suffix in [("Google", "Chrome", "Application", "chrome.exe"),
                   ("Chromium", "Application", "chrome.exe"),
                   ("Microsoft", "Edge", "Application", "msedge.exe")]
    for name in ("PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA")
    if (env := os.environ.get(name))
]
chrome = next((path for path in candidates if path.is_file()), None)
assert chrome is not None, "No supported Chromium executable on the Windows runner"
print(chrome, flush=True)
probe(chrome, "runner")
probe(chrome, "missing")
probe(chrome, "created")
probe(chrome, "runner", extended=True)
