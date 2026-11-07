# Cadu C, the star mascot (ADR 0087 §4.3 of the app)

`python3 -I scripts/cadu/caduframes.py` draws the sprite sheets from signed distance fields (the body, four
limbs smoothly joined) and pixel templates (the face), and writes `js/cadu.sprites.json` (32×32, with the
5×3 look grid) and `js/cadu16.sprites.json` (16×16, with its own face). Needs `numpy` and `Pillow` is not
used here. Then `node scripts/brand-assets.mjs` redraws the logo, favicons and share card, and the app copies
the same two sheets to `crates/app/assets/brand/`.

Poses are parameters of `Pose` in `caduframes.py`; `variants.py` holds the body shape (variant C).

`python3 -B scripts/cadu/sideframes.py` writes `js/cadu-side.sprites.json`: the five short sidebar
acts from ADR 0090. It imports the same variant C and reuses the approved Chat wave, sleep and
twinkle frames byte for byte; it is deliberately unrelated to the plugin generator mascot.
