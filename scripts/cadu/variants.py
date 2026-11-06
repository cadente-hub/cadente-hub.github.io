import sys, json, importlib
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cadu2
from cadu2 import Pose, render
BASE = dict(LIMBS=dict(cadu2.LIMBS), BODY=cadu2.BODY, SMOOTH=cadu2.SMOOTH, WIDE=0.06, SUPER=2.0, span=2.02)
B = dict(LIMBS={'top': (0.0, -0.72, -90, 1.02, 0.34, 0.13), 'right': (0.84, 0.08, 5, 0.80, 0.31, 0.13),
                'bottom': (0.0, 0.76, 90, 0.80, 0.32, 0.13), 'left': (-0.84, 0.08, 175, 0.80, 0.31, 0.13)},
         BODY=(1.04, 0.98), SMOOTH=0.14, WIDE=0.0, SUPER=2.0, span=2.12)
C = dict(B, BODY=(1.05, 0.99), SMOOTH=0.16, SUPER=1.76)
VAR = {'A · atual': BASE, 'B · pontas maiores': B, 'C · ✦ laterais côncavas': C}
def apply(v):
    cadu2.LIMBS, cadu2.BODY, cadu2.SMOOTH, cadu2.WIDE, cadu2.SUPER = v['LIMBS'], v['BODY'], v['SMOOTH'], v['WIDE'], v['SUPER']
F32 = {'ex': 0.40, 'ey': 0.10}; F16 = {'ex': 0.40, 'ey': 0.08}
UP = dict(left=(58, 1.0), right=(-58, 1.0)); DOWN = dict(left=(-28, 0.9), right=(28, 0.9))
