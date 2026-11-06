"""Cadu v2: a chubby four-point star drawn from signed distance fields, quantized to the sprite sheet's roles."""
import numpy as np, json, math
from dataclasses import dataclass, field

ROLE_CH = {'body': 'G', 'light': 'H', 'shade': 'S', 'deep': 'D', 'glow': 'L', 'ink': 'K', 'blush': 'B', 'spark': 'E', 'dust': 'd', 'alert': 'R'}

def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)

def capsule(px, py, r1, r2, h):
    px = np.abs(px)
    b = (r1 - r2) / h; a = math.sqrt(1 - b * b)
    k = -b * px + a * py
    return np.where(k < 0, np.hypot(px, py) - r1, np.where(k > a * h, np.hypot(px, py - h) - r2, a * px + b * py - r1))

@dataclass
class Pose:
    lift: float = 0.0          # units, negative is up
    squash: float = 1.0        # <1 flattens, >1 stretches
    tilt: float = 0.0          # degrees, whole body
    top: tuple = (0, 1.0)      # (angle offset deg, length scale)
    right: tuple = (0, 1.0)
    bottom: tuple = (0, 1.0)
    left: tuple = (0, 1.0)
    eyes: str = 'open'         # open, happy, closed, wide, x, focus, down
    open_l: float = 1.0
    open_r: float = 1.0
    glance: tuple = (0.0, 0.0)
    mouth: str = 'smile'       # none, smile, o, w, flat, wobble
    trail: int = 0
    sparks: list = field(default_factory=list)   # (x, y, size) in units
    zz: int = 0
    bang: bool = False
    dots: int = 0
    shake: float = 0.0

# name: (base x, base y, angle deg, length, base radius, tip radius); angles in screen space, y down.
LIMBS = {'top': (0.0, -0.75, -90, 0.88, 0.31, 0.15), 'right': (0.85, 0.16, 12, 0.64, 0.28, 0.14),
         'bottom': (0.0, 0.80, 90, 0.62, 0.29, 0.15), 'left': (-0.85, 0.16, 168, 0.64, 0.28, 0.14)}
BODY = (1.06, 0.98)
WIDE = 0.06    # wider at the bottom (a mochi sitting down)
SUPER = 2.0    # 2 is an ellipse; below 2 the sides curve in toward the points, like ✦
# eye highlights in pixels from the eye's centre (a pixel corner): (dx, dy, width, height)
HIGHLIGHTS = [(-0.5, -1.5, 1, 1)]
SMOOTH = 0.13

def body_sdf(x, y, p):
    t = math.radians(p.tilt)
    x, y = x - p.shake, y - p.lift
    xr = x * math.cos(t) + y * math.sin(t); yr = -x * math.sin(t) + y * math.cos(t)
    sy = p.squash; sx = 1 / math.sqrt(sy)
    xr, yr = xr / sx, (yr - (1 - sy) * 0.9) / sy   # squash toward the floor
    # a little wider at the bottom, like a mochi sitting down
    wide = 1 + WIDE * np.clip(yr, -1, 1)
    ax, ay = np.abs(xr / (BODY[0] * wide)), np.abs(yr / BODY[1])
    d = (ax ** SUPER + ay ** SUPER) ** (1 / SUPER) - 1.0
    for name, (bx, by, ang, length, r1, r2) in LIMBS.items():
        off, scale = getattr(p, name)
        a = math.radians(ang + off)
        ux, uy = xr - bx, yr - by
        ly = ux * math.cos(a) + uy * math.sin(a); lx = -ux * math.sin(a) + uy * math.cos(a)
        d = smin(d, capsule(lx, ly, r1, r2, length * scale), SMOOTH)
    return d * min(sx, sy), (xr, yr, t, sx, sy)

def face_xy(fx, fy, p):
    """A point of the face, in body space, back to canvas space (the face follows tilt, squash and lift)."""
    t = math.radians(p.tilt); sy = p.squash; sx = 1 / math.sqrt(sy)
    xr, yr = fx * sx, fy * sy + (1 - sy) * 0.9
    x = xr * math.cos(t) - yr * math.sin(t); y = xr * math.sin(t) + yr * math.cos(t)
    return x + p.shake, y + p.lift

def render(p, n, span=2.35, ss=4, face=None, smooth=False, shade_w=1.0):
    face = face or {}
    ex, ey, erx, ery = face.get('ex', 0.34), face.get('ey', 0.10), face.get('erx', 0.165), face.get('ery', 0.27)
    m = n * ss
    c = (np.arange(m) + 0.5) / m * 2 * span - span
    X, Y = np.meshgrid(c, c)
    d, _ = body_sdf(X, Y, p)
    inside = d < 0
    # Pixel-art light: a flat bright body, a highlight up and to the left, and shade only on the rim
    # that faces away from the light (bottom right), so the silhouette stays round on black and on white.
    upp = 2 * span / n
    gy, gx = np.gradient(d)
    g = np.hypot(gx, gy) + 1e-9
    ux, uy = gx / g, gy / g                     # outward normal
    away = ux * 0.62 + uy * 0.78                # >0 faces bottom right
    rim = -d / upp                              # pixels from the edge
    hx, hy = face_xy(-0.38, -0.42, p)
    spec = ((X - hx) / 0.42) ** 2 + ((Y - hy) / 0.30) ** 2 < 1
    roles = np.full((m, m), '', dtype=object)
    roles[inside] = 'body'
    roles[inside & spec] = 'light'
    roles[inside & (rim < 1.0 * shade_w) & (away < -0.35)] = 'light'
    roles[inside & (rim < 2.2 * shade_w) & (away > 0.05)] = 'shade'
    roles[inside & (rim < 1.0 * shade_w) & (away > 0.30)] = 'deep'
    def paint(mask, role):
        roles[mask & inside] = role
    def paint_any(mask, role):
        roles[mask] = role
    small = True  # the face is drawn from pixel templates after downsampling
    def snap(x, y):
        return round((x + span) / upp) * upp - span, round((y + span) / upp) * upp - span
    # eyes
    gx_, gy_ = p.glance
    for side, op in (() if small else ((-1, p.open_l), (1, p.open_r))):
        cx, cy = snap(*face_xy(side * ex + gx_, ey + gy_, p))
        if p.eyes in ('open', 'wide', 'focus', 'down'):
            ry = ery * (1.12 if p.eyes == 'wide' else 0.72 if p.eyes == 'focus' else 1.0)
            ry = max(ry * op, 0.055)
            rx = erx * (1.1 if p.eyes == 'wide' else 1.0)
            eye = ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2 < 1
            paint(eye, 'ink')
            if op > 0.5 and n >= 24:
                # one pixel of light up and to the left of the pupil, and a speck below for the wide eyes
                for hx_, hy_, hw, hh in HIGHLIGHTS:
                    hx, hy = cx + hx_ * upp, cy + hy_ * upp
                    paint((np.abs(X - hx) < hw * 0.5 * upp) & (np.abs(Y - hy) < hh * 0.5 * upp) & (op > 0.8), 'glow')
        elif p.eyes == 'happy':   # ^ ^
            rr = erx * 1.15
            r = np.hypot(X - cx, Y - (cy + rr * 0.55))
            paint((np.abs(r - rr) < 0.075) & (Y < cy + rr * 0.45), 'ink')
        elif p.eyes == 'closed':  # u u, resting
            rr = erx * 1.1
            r = np.hypot(X - cx, Y - (cy - rr * 0.35))
            paint((np.abs(r - rr) < 0.07) & (Y > cy - rr * 0.1), 'ink')
        elif p.eyes == 'x':
            u, v = X - cx, Y - cy
            paint(((np.abs(u - v) < 0.08) | (np.abs(u + v) < 0.08)) & (np.abs(u) < erx * 1.1) & (np.abs(v) < erx * 1.1), 'ink')
    # cheeks
    for side in (() if small else (-1, 1)):
        cx, cy = snap(*face_xy(side * (ex + 0.27) + gx_ * 0.6, ey + 0.30, p))
        paint(((X - cx) / 0.16) ** 2 + ((Y - cy) / 0.085) ** 2 < 1, 'blush')
    # mouth
    mx, my = snap(*face_xy(gx_ * 0.8, ey + 0.30 + gy_ * 0.5, p))
    if small:
        pass
    elif p.mouth == 'smile':
        r = np.hypot(X - mx, Y - (my - 0.14))
        paint((np.abs(r - 0.17) < 0.055) & (Y > my - 0.07), 'ink')
    elif p.mouth == 'w':
        for s in (-1, 1):
            r = np.hypot(X - (mx + s * 0.075), Y - (my - 0.05))
            paint((np.abs(r - 0.075) < 0.04) & (Y > my - 0.04), 'ink')
    elif p.mouth == 'o':
        paint(((X - mx) / 0.075) ** 2 + ((Y - (my + 0.02)) / 0.095) ** 2 < 1, 'ink')
    elif p.mouth == 'flat':
        paint((np.abs(Y - my) < 0.04) & (np.abs(X - mx) < 0.09), 'ink')
    elif p.mouth == 'wobble':
        paint((np.abs(Y - my - 0.035 * np.sin((X - mx) * 40)) < 0.04) & (np.abs(X - mx) < 0.14), 'ink')
    # trail: a falling star leaves dust behind it, up and to the left
    if p.trail:
        ox, oy = face_xy(0, 0, p)
        a = math.radians(-152)
        ly = (X - ox) * math.cos(a) + (Y - oy) * math.sin(a); lx = -(X - ox) * math.sin(a) + (Y - oy) * math.cos(a)
        ln = [0, 1.55, 1.8, 2.05][p.trail]
        tt = np.clip((ly - 0.5) / ln, 0, 1)
        width = 0.40 * (1 - tt) ** 1.15
        tail = (ly > 0.5) & (ly < 0.5 + ln) & (np.abs(lx) < width)
        paint_any(tail & (roles == '') & (tt < 0.72), 'dust')
        paint_any(tail & (roles == '') & (tt < 0.38) & (np.abs(lx) < width * 0.42), 'spark')
        # the end of the tail breaks into dust
        for k, (f, o) in enumerate([(0.80, 0.0), (0.92, 0.22), (0.70, -0.30)]):
            f2 = f + 0.05 * ((p.trail + k) % 3 - 1)
            cx_, cy_ = ox + math.cos(a) * (0.5 + ln * f2) - math.sin(a) * o, oy + math.sin(a) * (0.5 + ln * f2) + math.cos(a) * o
            paint_any((np.hypot(X - cx_, Y - cy_) < 0.09) & (roles == ''), 'dust')
    for sx_, sy_, sz in p.sparks:
        u, v = X - sx_, Y - sy_
        paint_any((((np.abs(u) < sz) & (np.abs(v) < 0.07)) | ((np.abs(v) < sz) & (np.abs(u) < 0.07))) & (roles == ''), 'spark')
    for i in range(p.zz):
        zx, zy, zs = [(1.12, -1.30, 0.24), (1.58, -1.68, 0.18)][i]
        u, v = X - zx, Y - zy
        z = ((np.abs(v + zs) < 0.06) | (np.abs(v - zs) < 0.06) | (np.abs(u + v) < 0.075)) & (np.abs(u) < zs) & (np.abs(v) < zs + 0.06)
        paint_any(z & (roles == ''), 'spark')
    for i in range(p.dots):
        u, v = X - (1.02 + i * 0.30), Y + 1.02 + i * 0.27
        paint_any((np.hypot(u, v) < 0.12 + 0.03 * i) & (roles == ''), 'spark')
    # downsample: majority role per cell, empty when the shape covers less than half
    out = []
    order = ['ink', 'glow', 'blush', 'alert', 'spark', 'dust', 'light', 'body', 'shade', 'deep']
    for j in range(n):
        row = ''
        for i in range(n):
            cell = roles[j * ss:(j + 1) * ss, i * ss:(i + 1) * ss].ravel()
            filled = cell[cell != '']
            if len(filled) < ss * ss * 0.5:
                # small marks (eyes, sparks) still win a cell they mostly own
                feats = [r for r in ('ink', 'glow', 'spark', 'dust', 'alert') if (cell == r).sum() >= ss * ss * 0.4]
                row += ROLE_CH[feats[0]] if feats else '.'
                continue
            counts = {r: (filled == r).sum() for r in order}
            pick = None
            for r in ('ink', 'glow', 'blush', 'alert', 'spark'):
                if counts[r] >= ss * ss * (0.3 if r in ('ink', 'glow') else 0.4):
                    pick = r; break
            if pick is None:
                pick = max(('light', 'body', 'shade', 'deep', 'dust'), key=lambda r: counts[r])
            row += ROLE_CH[pick]
        out.append(row)
    out = template_face(out, p, n, span, face)
    if p.bang:
        g = [list(r) for r in out]
        w = 2 if n >= 32 else 1
        x0 = n - 2 - w
        bar = range(1, 6) if n >= 32 else range(0, 3)
        dot = range(7, 9) if n >= 32 else range(4, 5)
        for y in list(bar) + list(dot):
            for x in range(x0, x0 + w):
                if g[y][x] == '.':
                    g[y][x] = 'R'
        out = [''.join(r) for r in g]
    return out

def small_face(rows, p, n, span, ey):
    g = [list(r) for r in rows]
    fx, fy = face_xy(p.glance[0] * 0.8, ey + p.glance[1], p)
    cx = int(round((fx + span) / (2 * span) * n - 0.5)); cy = int(round((fy + span) / (2 * span) * n - 0.5))
    def put(x, y, ch):
        if 0 <= y < n and 0 <= x < n and g[y][x] != '.':
            g[y][x] = ch
    for side in (-1, 1):
        ex_ = cx - 2 if side < 0 else cx + 1
        if p.eyes in ('open', 'focus', 'down'):
            put(ex_, cy - 1, 'K'); put(ex_, cy, 'K')
            if p.eyes == 'focus':
                put(ex_, cy - 1, 'G')
        elif p.eyes == 'wide':
            put(ex_, cy - 1, 'K'); put(ex_, cy, 'K'); put(ex_ + side, cy - 1, 'K'); put(ex_ + side, cy, 'K')
        elif p.eyes == 'happy':
            put(ex_ - 1 if side < 0 else ex_, cy, 'K'); put(ex_ if side < 0 else ex_ + 1, cy - 1, 'K')
            put(ex_ + 1 if side < 0 else ex_ + 2, cy, 'K')
        elif p.eyes == 'closed':
            put(ex_ - 1 if side < 0 else ex_, cy - 1, 'K'); put(ex_ if side < 0 else ex_ + 1, cy, 'K')
        elif p.eyes == 'x':
            put(ex_, cy - 1, 'K'); put(ex_, cy, 'K')
        put(cx - 3 if side < 0 else cx + 2, cy + 1, 'B')
    if p.mouth in ('o', 'wobble'):
        put(cx, cy + 2, 'K') if False else put(cx - 1 if cx > 0 else cx, cy + 1, 'K')
    return [''.join(r) for r in g]


# Pixel templates of the face. Each eye is drawn for the left side and mirrored for the right one.
T32 = {
    'open':   ['.KK.', 'KLKK', 'KKKK', 'KKKK', '.KK.'],
    'blink':  ['....', '....', 'KKKK', '....', '....'],
    'happy':  ['.KK.', 'K..K'],
    'closed': ['K..K', '.KK.'],
    'wide':   ['.KKK.', 'KLKKK', 'KKKKK', 'KKKLK', '.KKK.'],
    'focus':  ['KKKK', 'KLKK', '.KK.'],
    'down':   ['KKK.', 'KLKK', '.KKK'],
    'x':      ['K..K', '.KK.', '.KK.', 'K..K'],
}
M32 = {'smile': ['K..K', '.KK.'], 'w': ['K.K.K', '.K.K.'], 'o': ['.K.', 'K.K', '.K.'], 'flat': ['KKK'], 'wobble': ['.K.K.', 'K.K.K'], 'none': []}
CHEEK32 = ['BBB']
T16 = {'open': ['K', 'K'], 'blink': ['K'], 'happy': ['.K.', 'K.K'], 'closed': ['K.K', '.K.'], 'wide': ['KK', 'KK'], 'focus': ['K'], 'down': ['K'], 'x': ['K', 'K']}
M16 = {'smile': ['K'], 'w': ['K'], 'o': ['K'], 'flat': ['K'], 'wobble': ['K'], 'none': []}
CHEEK16 = ['B']

def template_face(rows, p, n, span, face):
    g = [list(r) for r in rows]
    upp = 2 * span / n
    big = n >= 24
    T, M, C = (T32, M32, CHEEK32) if big else (T16, M16, CHEEK16)
    ex, ey = face.get('ex', 0.4), face.get('ey', 0.12)
    def corner(x, y):
        return round((x + span) / upp), round((y + span) / upp)
    def stamp(tpl, cx, cy, mirror=False):
        h = len(tpl)
        if not h:
            return
        w = len(tpl[0])
        x0, y0 = cx - w // 2, cy - h // 2
        for j, line in enumerate(tpl):
            if mirror:
                line = line[::-1]
            for i, ch in enumerate(line):
                x, y = x0 + i, y0 + j
                if ch != '.' and 0 <= x < n and 0 <= y < n and g[y][x] in 'GHSD':
                    g[y][x] = ch
    gx, gy = p.glance
    style = p.eyes
    for side, op in ((-1, p.open_l), (1, p.open_r)):
        st = 'blink' if (style == 'open' and op < 0.3) else style
        tpl = T[st]
        if st == 'open' and side > 0 and big:
            tpl = tpl  # the highlight stays on the left of both pupils: the light comes from the top left
        cx, cy = corner(*face_xy(side * ex + gx, ey + gy, p))
        stamp(tpl, cx, cy, mirror=(side > 0 and st not in ('open', 'wide', 'focus', 'down')))
        k = corner(*face_xy(side * (ex + (0.27 if big else 0.32)) + gx * 0.6, ey + (0.28 if big else 0.30), p))
        stamp(C, *k)
    mc = corner(*face_xy(gx * 0.8, ey + (0.33 if big else 0.36) + gy * 0.5, p))
    if big or p.mouth in ('o', 'wobble'):
        stamp(M[p.mouth if p.mouth in M else 'none'], *mc)
    return [''.join(r) for r in g]
