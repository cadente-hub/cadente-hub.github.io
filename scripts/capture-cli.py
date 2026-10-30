"""Records a real agent CLI (Claude Code, Codex, agy) for the site's Terminal demo.

Runs the CLI in a pseudo-terminal, plays the keystrokes of scripts/cli-scripts/<name>.json and saves snapshots of the
screen as a terminal emulator (pyte) sees it: every character, colour and attribute. Then
`node scripts/import-cli-recordings.mjs <outdir>` turns them into js/v4-site/recordings.json.

Run it from your own terminal, signed in to the CLI (Claude Code reads its login from the keychain, which a
background session cannot open). The CLI does a real, small task in a throwaway repository ($CADENTE_DEMO, created
if missing), so it uses a little of your plan.

  python3 -m venv /tmp/ttyvenv && /tmp/ttyvenv/bin/pip install pyte
  /tmp/ttyvenv/bin/python scripts/capture-cli.py claude 64 22 /tmp/clicap -- claude --permission-mode manual
  /tmp/ttyvenv/bin/python scripts/capture-cli.py codex 64 22 /tmp/clicap -- codex -a on-request -s read-only
  /tmp/ttyvenv/bin/python scripts/capture-cli.py agy 64 22 /tmp/clicap -- agy
  node scripts/import-cli-recordings.mjs /tmp/clicap

Script steps: ["wait", secs] · ["send", text with <enter>, <esc>, <down>…] · ["until", regex, timeout] ·
["snap", label] · ["film", label, secs, every]. Labels: welcome, typed, work, ask, after, done.
"""
import fcntl, json, os, re, select, signal, struct, subprocess, sys, termios, time
import pyte

name, cols, rows, outdir = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
cmd = sys.argv[sys.argv.index('--') + 1:]
script = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cli-scripts', f'{name}.json')))
demo = os.environ.get('CADENTE_DEMO', '/tmp/cadente-demo')
os.makedirs(outdir, exist_ok=True)


def make_demo():
    # A tiny Rust workspace with the pane and layout code the demo talks about.
    if os.path.isdir(demo):
        return
    src = os.path.join(demo, 'crates', 'cadente-ui', 'src')
    os.makedirs(src)
    files = {
        'Cargo.toml': '[workspace]\nmembers = ["crates/cadente-ui"]\nresolver = "2"\n',
        'crates/cadente-ui/Cargo.toml': '[package]\nname = "cadente-ui"\nversion = "0.1.0"\nedition = "2021"\n',
        'crates/cadente-ui/src/lib.rs': 'pub mod layout;\npub mod pane;\n',
        'crates/cadente-ui/src/pane.rs': open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cli-scripts', 'pane.rs')).read(),
        'crates/cadente-ui/src/layout.rs': open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cli-scripts', 'layout.rs')).read(),
    }
    for rel, text in files.items():
        with open(os.path.join(demo, rel), 'w') as f:
            f.write(text)
    subprocess.run(['git', 'init', '-q', '-b', 'main'], cwd=demo, check=True)
    subprocess.run(['git', 'add', '-A'], cwd=demo, check=True)
    subprocess.run(['git', '-c', 'user.name=demo', '-c', 'user.email=demo@example.invalid', 'commit', '-qm', 'demo'], cwd=demo, check=True)


make_demo()

master, slave = os.openpty()
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', rows, cols, 0, 0))
env = dict(os.environ, TERM='xterm-256color', COLORTERM='truecolor', COLUMNS=str(cols), LINES=str(rows), FORCE_COLOR='3')
proc = subprocess.Popen(cmd, stdin=slave, stdout=slave, stderr=slave, cwd=demo, env=env, start_new_session=True)
os.close(slave)


class Screen(pyte.Screen):
    # Answers the terminal queries a TUI sends at start (cursor position, device attributes).
    def write_process_input(self, data):
        os.write(master, data.encode())


screen = Screen(cols, rows)
stream = pyte.ByteStream(screen)
raw = open(os.path.join(outdir, f'{name}.raw'), 'wb')


def pump(secs):
    end = time.time() + secs
    while time.time() < end:
        r, _, _ = select.select([master], [], [], 0.05)
        if r:
            try:
                data = os.read(master, 65536)
            except OSError:
                return
            raw.write(data)
            # OSC 11 (background colour) and kitty keyboard queries get the answers a dark terminal gives.
            if b'\x1b]11;?' in data:
                os.write(master, b'\x1b]11;rgb:0000/0000/0000\x1b\\')
            if b'\x1b[?u' in data:
                os.write(master, b'\x1b[?0u')
            # Sequences pyte does not know would print their final letter (kitty keyboard flags, for one).
            stream.feed(re.sub(rb'\x1b\[[<>=?][0-9;]*u', b'', data))


def text():
    return '\n'.join(screen.display)


def snapshot(label):
    out = []
    for y in range(rows):
        line, runs, cur = screen.buffer[y], [], None
        for x in range(cols):
            c = line[x]
            st = (c.fg, c.bg, c.bold, c.italics, c.underscore, c.reverse)
            if cur and cur[1] == st:
                cur[0] += c.data
            else:
                cur = [c.data, st]
                runs.append(cur)
        out.append([[t, *st] for t, st in runs])
    return {'label': label, 't': round(time.time() - t0, 2), 'cursor': [screen.cursor.x, screen.cursor.y, not screen.cursor.hidden], 'rows': out}


t0 = time.time()
snaps = []
def save():
    json.dump({'name': name, 'cols': cols, 'rows': rows, 'snaps': snaps}, open(os.path.join(outdir, f'{name}.json'), 'w'))
import atexit
atexit.register(save)
for step in script:
    kind = step[0]
    if kind == 'wait':
        pump(step[1])
    elif kind == 'send':
        KEYS = {'<enter>': b'\r', '<esc>': b'\x1b', '<ctrl-c>': b'\x03', '<down>': b'\x1b[B', '<up>': b'\x1b[A', '<tab>': b'\t', '<1>': b'1', '<2>': b'2', '<3>': b'3', '<y>': b'y'}
        for part in re.split(r'(<[a-z0-9-]+>)', step[1]):
            if part in KEYS:
                try: os.write(master, KEYS[part])
                except OSError: break
                pump(0.25)
            else:
                for ch in part.encode():
                    try: os.write(master, bytes([ch]))
                    except OSError: break
                    pump(0.05)
    elif kind == 'until':
        end = time.time() + step[2]
        while time.time() < end and not re.search(step[1], text()):
            pump(0.2)
        if not re.search(step[1], text()):
            print(f'{name}: timeout waiting for {step[1]!r}', file=sys.stderr)
    elif kind == 'snap':
        pump(0.3)
        snaps.append(snapshot(step[1]))
    elif kind == 'film':
        end = time.time() + step[2]
        i = 0
        while time.time() < end:
            pump(step[3])
            snaps.append(snapshot(f'{step[1]}.{i}'))
            i += 1
json.dump({'name': name, 'cols': cols, 'rows': rows, 'snaps': snaps}, open(os.path.join(outdir, f'{name}.json'), 'w'))
print(f'{name}: {len(snaps)} snapshots')
print(text())
try:
    os.killpg(proc.pid, signal.SIGTERM)
except (ProcessLookupError, PermissionError):
    proc.terminate()
