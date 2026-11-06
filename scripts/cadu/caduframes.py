import sys, json
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cadu2 import Pose, render
F32 = {'ex': 0.40, 'ey': 0.10}
F16 = {'ex': 0.40, 'ey': 0.08}
FLY = dict(tilt=9, left=(20, 0.9), right=(-16, 0.9), glance=(0.07, 0.04), mouth='smile', shake=0.26, lift=0.26)
UP = dict(left=(58, 1.0), right=(-58, 1.0))
DOWN = dict(left=(-28, 0.9), right=(28, 0.9))
FRAMES = {
    'rest': Pose(),
    'bob': Pose(lift=-0.05, squash=1.015),
    'float': Pose(lift=-0.10, squash=1.03, top=(-4, 1.02)),
    'blink': Pose(open_l=0.12, open_r=0.12),
    'float_tw1': Pose(lift=-0.08, squash=1.02, top=(10, 1.0)),
    'float_tw2': Pose(lift=-0.08, squash=1.02, top=(-10, 1.0)),
    'twinkle_1': Pose(sparks=[(0.62, -1.42, 0.13)]),
    'twinkle_2': Pose(sparks=[(0.62, -1.42, 0.24)]),
    'look_l': Pose(glance=(-0.07, 0.0)),
    'look_r': Pose(glance=(0.07, 0.0)),
    'wave_a': Pose(right=(-72, 1.1), eyes='happy', mouth='smile', tilt=-5),
    'wave_b': Pose(right=(-38, 1.1), eyes='happy', mouth='smile', tilt=-3),
    'happy': Pose(eyes='happy', mouth='w'),
    'think_0': Pose(right=(-112, 0.95), glance=(0.07, -0.08), mouth='flat', dots=1),
    'think_3': Pose(right=(-112, 0.95), glance=(0.07, -0.08), mouth='flat', dots=0),
    'think_up_1': Pose(right=(-118, 0.95), glance=(0.08, -0.09), mouth='flat', dots=2, lift=-0.03),
    'think_up_2': Pose(right=(-118, 0.95), glance=(0.08, -0.09), mouth='flat', dots=3, lift=-0.03, open_l=0.85, open_r=0.85),
    'pulse_1': Pose(eyes='focus', mouth='flat', left=(-22, 1.0), right=(8, 1.0), lift=-0.03),
    'pulse_2': Pose(eyes='focus', mouth='flat', left=(8, 1.0), right=(-22, 1.0), lift=0.0),
    'fly_0': Pose(trail=1, **FLY),
    'fly_1': Pose(trail=2, **dict(FLY, lift=0.22)),
    'fly_2': Pose(trail=3, **dict(FLY, lift=0.24)),
    'cheer_crouch': Pose(eyes='happy', mouth='w', squash=0.84, **DOWN),
    'cheer_a': Pose(eyes='happy', mouth='o', squash=1.08, lift=-0.22, **UP),
    'cheer_b': Pose(eyes='happy', mouth='o', squash=1.04, lift=-0.30, sparks=[(-1.45, -1.25, 0.2), (1.5, -1.35, 0.16)], **UP),
    'cheer_c': Pose(eyes='happy', mouth='w', lift=-0.12, sparks=[(-1.6, -1.55, 0.14), (1.65, -1.6, 0.22), (-1.55, 0.95, 0.15)], **UP),
    'error_bang': Pose(eyes='wide', mouth='o', bang=True, shake=0.06, **UP),
    'error': Pose(eyes='down', mouth='wobble', open_l=0.75, open_r=0.75, top=(18, 0.9), **DOWN),
    'sleep_high_z': Pose(eyes='closed', mouth='o', squash=0.9, zz=2, top=(35, 0.85), **DOWN),
    'sleep_high_zfade': Pose(eyes='closed', mouth='o', squash=0.9, zz=1, top=(35, 0.85), **DOWN),
    'sleep_low_z': Pose(eyes='closed', mouth='o', squash=0.87, zz=1, top=(38, 0.85), left=(-34, 0.9), right=(34, 0.9), lift=0.04),
}
ANIMS = {
    'idle': {'loop': True, 'steps': [['rest', 6], ['bob', 3], ['float', 6], ['bob', 3], ['rest', 4], ['blink', 1], ['rest', 3], ['twinkle_1', 1], ['twinkle_2', 2], ['twinkle_1', 1], ['rest', 2], ['bob', 3], ['float', 3], ['float_tw1', 2], ['float_tw2', 2], ['float_tw1', 1], ['float', 2], ['bob', 3], ['rest', 3], ['look_l', 6], ['rest', 2], ['look_r', 6], ['rest', 3], ['blink', 1], ['rest', 2], ['blink', 1], ['rest', 8]]},
    'wave': {'loop': False, 'steps': [['wave_a', 2], ['wave_b', 2], ['wave_a', 2], ['wave_b', 2], ['wave_a', 2], ['happy', 4], ['rest', 1]]},
    'thinking': {'loop': True, 'steps': [['think_3', 4], ['think_0', 4], ['think_up_1', 4], ['think_up_2', 4]]},
    'working': {'loop': True, 'steps': [['pulse_1', 2], ['pulse_2', 2]]},
    'loading': {'loop': True, 'steps': [['fly_0', 2], ['fly_1', 2], ['fly_2', 2], ['fly_1', 2]]},
    'celebrate': {'loop': False, 'steps': [['happy', 2], ['cheer_crouch', 2], ['cheer_a', 1], ['cheer_b', 3], ['cheer_c', 3], ['cheer_a', 1], ['cheer_crouch', 2], ['happy', 4], ['rest', 2]]},
    'error': {'loop': False, 'steps': [['error_bang', 6], ['error', 10], ['rest', 2]]},
    'sleep': {'loop': True, 'steps': [['sleep_low_z', 6], ['sleep_high_zfade', 4], ['sleep_high_z', 8], ['sleep_high_zfade', 4]]},
}
PALETTE = {'G': 'body', 'H': 'light', 'S': 'shade', 'D': 'deep', 'L': 'glow', 'K': 'ink', 'B': 'blush', 'E': 'spark', 'd': 'dust', 'R': 'alert'}
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'js')
SPAN = 2.02
def sheet(n, span=None):
    span = span or SPAN
    face = F32 if n == 32 else F16
    frames = {name: render(p, n, span=span, face=face, shade_w=1.0 if n == 32 else 0.6) for name, p in FRAMES.items()}
    out = {'schemaVersion': 1, 'name': 'cadu', 'size': n, 'tickMs': 100, 'palette': PALETTE, 'frames': frames, 'animations': ANIMS}
    if n == 32:
        # The frames that look toward the pointer: a grid of 5 by 3, one pixel of glance per step.
        upp = 2 * span / n
        for i in range(5):
            for j in range(3):
                fx, fy = i - 2, j - 1
                pose = Pose(glance=(fx * upp, fy * upp), top=(fx * 6, 1.0), tilt=fx * 1.5)
                frames[f'look_{i}_{j}'] = render(pose, n, span=span, face=face)
        out['look'] = {'nx': 5, 'ny': 3, 'prefix': 'look_'}
    return out
if __name__ == '__main__':
    import variants
    variants.apply(variants.C)
    SPAN = variants.C['span']
    for n in (32, 16):
        json.dump(sheet(n, SPAN), open(os.path.join(OUT, f'cadu{"" if n == 32 else "16"}.sprites.json'), 'w'), separators=(',', ':'))
    print('frames', len(FRAMES))
