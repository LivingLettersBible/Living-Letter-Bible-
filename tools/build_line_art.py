"""Build js/lineart.js from the line-art pages in art/hearts/ and art/drawn/.

For each page this finds every enclosed area between the ink lines, merges
specks into their neighbours, picks a number position inside each area, and
assigns colours. Hearts use a small per-picture art direction (zones by
position and size, neighbours differ, mirrored areas match on symmetric
designs). Gardens, Faith and Animals pages are drawn by tools/draw_pages.py and take each area's colour
from the matching <name>-plan.png render. Vintage pages (public domain, CC0)
use per-picture colour plans like the hearts.

    pip install pillow numpy scipy
    python3 tools/build_line_art.py
"""
import numpy as np, json, zlib, base64, io, math, os, colorsys
from PIL import Image
from scipy import ndimage as ndi

SIZE = 1000
MIN_AREA = 110

def pip(x, y, pts):
    inside = False
    j = len(pts) - 1
    for i in range(len(pts)):
        xi, yi = pts[i]; xj, yj = pts[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside

d = lambda a, b, x, y: math.hypot(x - a, y - b)

# ---------------- per-picture art direction ----------------
def wheat(f):
    x, y, A, dep = f['cx'], f['cy'], f['area'], f['depth']
    if dep < 0.028: return 'frame'
    if A > 0.03: return 'field'
    if d(0.66, 0.215, x, y) < 0.072: return 'sun'
    if d(0.66, 0.215, x, y) < 0.23 and y < 0.42 and x > 0.5: return 'rays'
    if d(0.29, 0.655, x, y) < 0.045 or d(0.53, 0.775, x, y) < 0.04: return 'rope'
    if (0.18 < x < 0.42 and 0.66 < y < 0.9) or (0.36 < x < 0.62 and y > 0.79): return 'straw'
    if A < 0.0045 and ((0.04 < x < 0.5 and 0.07 < y < 0.58) or (0.55 < x < 0.9 and 0.52 < y < 0.8)
                       or (0.48 < x < 0.66 and 0.1 < y < 0.36) or (0.84 < x < 0.95 and 0.3 < y < 0.52)
                       or (0.42 < x < 0.55 and 0.5 < y < 0.62)):
        return 'grain'
    return 'leaf' if A > 0.0012 else 'sky'
WHEAT = dict(fn=wheat, mirror=False, fam={
    'frame': ['#b3563a', '#e8b25c'], 'field': ['#fdf4df'], 'sun': ['#ffc53d'],
    'rays': ['#ffe08a', '#f6a93b'], 'rope': ['#8a5a2e'], 'straw': ['#d9b45a', '#b98c3c'],
    'grain': ['#e2a23a', '#f2cb66', '#c88430'], 'leaf': ['#95b86f', '#6e9a55'], 'sky': ['#a9d0e6', '#78aed2']})

MT_RIVER = [(0.47, 0.6), (0.6, 0.62), (0.56, 0.72), (0.52, 0.8), (0.47, 0.95), (0.33, 0.95), (0.37, 0.82), (0.45, 0.72)]
def mountains(f):
    x, y, A, dep = f['cx'], f['cy'], f['area'], f['depth']
    if dep < 0.075 and (y < 0.5 or y > 0.85): return 'deco'
    if d(0.25, 0.18, x, y) < 0.055 or d(0.72, 0.18, x, y) < 0.055: return 'sun'
    if y < 0.36 and A > 0.02: return 'sky'
    if (d(0.25, 0.18, x, y) < 0.15 or d(0.72, 0.18, x, y) < 0.15) and y < 0.24: return 'arc'
    if y < 0.33 and (0.05 < x < 0.95) and (y < 0.3 or A > 0.004) and (d(0.35, 0.2, x, y) < 0.09 or d(0.15, 0.25, x, y) < 0.1 or d(0.7, 0.24, x, y) < 0.15): return 'cloud'
    if pip(x, y, MT_RIVER): return 'river'
    tree = ((x < 0.34 and 0.4 < y < 0.75) or (x > 0.6 and 0.56 < y < 0.78) or (0.34 < x < 0.82 and 0.46 < y < 0.62)) and A < 0.0025
    if tree: return 'tree'
    if y < 0.52: return 'snow' if (A < 0.0012 and y < 0.42) else 'mount'
    return 'hill'
MOUNTAINS = dict(fn=mountains, mirror=True, mirror_max_y=0.45, fam={
    'deco': ['#2a9d8f', '#e9c46a', '#e76f51', '#264653'], 'sun': ['#ffd166'], 'sky': ['#cfe6f5'],
    'arc': ['#f4a261', '#f6c177', '#e76f51'], 'cloud': ['#eef3f8'], 'river': ['#4ea3dc', '#8ecae6'],
    'tree': ['#2f6b3f', '#4d8b58'], 'snow': ['#eef3f8'], 'mount': ['#8c7dbd', '#b7a9d8', '#6b5a9e', '#9fb3d6'],
    'hill': ['#a7c957', '#6a994e', '#cfe0a8', '#8fb85a']})

BIRD_POLY = [(0.37, 0.37), (0.47, 0.32), (0.57, 0.33), (0.63, 0.39), (0.59, 0.5), (0.53, 0.58), (0.42, 0.63), (0.3, 0.75), (0.25, 0.73), (0.33, 0.58), (0.35, 0.47)]
FLOWERS = [(0.2, 0.265), (0.5, 0.245), (0.785, 0.265), (0.1, 0.445), (0.875, 0.445)]
def bird(f):
    x, y, A, dep = f['cx'], f['cy'], f['area'], f['depth']
    if dep < 0.02: return 'frame'
    if A > 0.03: return 'field'
    if d(0.62, 0.385, x, y) < 0.022: return 'beak'
    if d(0.5, 0.925, x, y) < 0.03: return 'heart'
    if pip(x, y, BIRD_POLY):
        if abs((y - 0.64) - (-0.24) * (x - 0.35)) < 0.025 and x > 0.33: return 'branch'
        return 'breast' if (y < 0.47 and x > 0.44) else 'wing'
    for fx, fy in FLOWERS:
        dd = d(fx, fy, x, y)
        if dd < 0.018: return 'center'
        if dd < 0.07: return 'petal'
    if 0.0006 < A < 0.009: return 'leaf'
    return 'scroll'
BIRD = dict(fn=bird, mirror=True, mirror_skip=lambda f: pip(f['cx'], f['cy'], BIRD_POLY) or pip(1 - f['cx'], f['cy'], BIRD_POLY), fam={
    'frame': ['#c0395a'], 'field': ['#fff3ef'], 'beak': ['#f2a541'], 'heart': ['#e63946'], 'branch': ['#7a5236'],
    'breast': ['#e9b48c', '#d4926a'], 'wing': ['#8a5a44', '#b07556', '#6e4636'], 'center': ['#ffd166'],
    'petal': ['#f28bb0', '#f7b3cb', '#e0628f'], 'leaf': ['#7fb069', '#a3c98d', '#5a9168'], 'scroll': ['#b39ddb', '#9fc5e8']})

def lace(f):
    x, y, A, dep = f['cx'], f['cy'], f['area'], f['depth']
    if A > 0.03: return 'field'
    if dep < 0.055: return 'border'
    if d(0.5, 0.52, x, y) < 0.13: return 'core'
    if d(0.5, 0.52, x, y) < 0.24: return 'medal'
    return 'bloom'
LACE = dict(fn=lace, mirror=True, fam={
    'field': ['#fdf6ec'], 'border': ['#b5838d', '#e5989b', '#6d6875'], 'core': ['#355070', '#eaac8b', '#b56576'],
    'medal': ['#6d597a', '#88b7b5', '#e56b6f'], 'bloom': ['#e56b6f', '#eaac8b', '#88b7b5', '#a7c4a0', '#f2d0a4']})

def waves(f):
    x, y, A, dep = f['cx'], f['cy'], f['area'], f['depth']
    if A > 0.03: return 'field'
    if y > 0.74: return 'leafy'
    if A < 0.0007: return 'foam'
    return 'sea'
WAVES = dict(fn=waves, mirror=False, fam={
    'field': ['#f2fbff'], 'leafy': ['#2a9d8f', '#e9c46a', '#f4a261', '#8ab17d'], 'foam': ['#e6f6fb', '#b8e6f2'],
    'sea': ['#03558c', '#0a7bbd', '#48bfe3', '#90dbf4', '#1d3f72', '#5e9fd6']})

# ---------------- vintage public-domain art (art/vintage, CC0) ----------------
dc = lambda f: math.hypot(f['cx'] - 0.5, f['cy'] - 0.5)


def rose_window(f):
    d, A = dc(f), f['area']
    if d > 0.43: return 'rim'
    if d < 0.06: return 'core'
    if d < 0.17: return 'centre'
    return 'lobe' if A > 0.004 else 'leaf'
ROSE = dict(fn=rose_window, mirror=True, dir='vintage', category='Faith', fam={
    'rim': ['#c9a227', '#7a3b69'], 'core': ['#f2c14e'], 'centre': ['#2a6f97', '#8e2c48', '#61a5c2'],
    'lobe': ['#1d4e89', '#7a3b69', '#2a6f97'], 'leaf': ['#6a994e', '#a7c957', '#f2c14e']})


def star_medallion(f):
    d, A = dc(f), f['area']
    if f['depth'] < 0.03: return 'edge'
    if d < 0.05: return 'core'
    if A < 0.0006: return 'dot'
    if d < 0.28: return 'inner'
    return 'mid' if d < 0.4 else 'point'
STAR = dict(fn=star_medallion, mirror=True, dir='vintage', category='Vintage', fam={
    'edge': ['#c9a227', '#8e2c48'], 'core': ['#f2c14e'], 'dot': ['#f2c14e', '#e9d8a6'],
    'inner': ['#1d4e89', '#2a9d8f', '#8e2c48'], 'mid': ['#e76f51', '#264653', '#2a9d8f'], 'point': ['#8e2c48', '#1d4e89', '#c9a227']})


def celtic_ring(f):
    d, A, x, y = dc(f), f['area'], f['cx'], f['cy']
    if A > 0.05: return 'field'
    if d < 0.2 and y < 0.62: return 'knot'
    if (y > 0.66 and (x < 0.3 or x > 0.7)) or y < 0.15: return 'node'
    return 'outer' if d > 0.36 else 'ring'
CELTIC = dict(fn=celtic_ring, mirror=True, dir='vintage', category='Vintage', fam={
    'field': ['#f6ecd2'], 'knot': ['#2a9d8f', '#e9c46a', '#264653'], 'node': ['#e76f51', '#2a9d8f', '#e9c46a'],
    'outer': ['#264653', '#c65d3b'], 'ring': ['#c65d3b', '#e9c46a', '#2a9d8f']})


def cross_medallion(f):
    d, A, x, y = dc(f), f['area'], f['cx'], f['cy']
    if d < 0.25 and (abs(x - 0.5) < 0.06 or abs(y - 0.5) < 0.06): return 'cross'
    if A > 0.01: return 'field'
    return 'flower' if A < 0.0015 else 'leaf'
CROSS = dict(fn=cross_medallion, mirror=True, dir='vintage', category='Faith', fam={
    'cross': ['#c9a227', '#8e2c48'], 'field': ['#f3ead8'], 'flower': ['#e58ab8', '#9b6fd6', '#f2c14e'], 'leaf': ['#6a994e', '#a7c957']})


def greek_plate(f):
    A, y = f['area'], f['cy']
    if f['solid'] and 0.12 < y < 0.58: return 'bull'
    if f['depth'] < 0.035: return 'rim'
    if 0.58 < y < 0.66: return 'meander'
    if y > 0.66: return 'fan'
    return 'ground' if A > 0.02 else 'detail'
GREEK = dict(fn=greek_plate, mirror=False, dir='vintage', category='Vintage', fam={
    'bull': ['#8c5a3c'], 'rim': ['#c65d3b', '#8c5a3c'], 'meander': ['#c65d3b', '#f3e1c0'], 'fan': ['#c65d3b', '#e9b872', '#f3e1c0'],
    'ground': ['#e9b872'], 'detail': ['#c65d3b', '#2a9d8f', '#f3e1c0']})


def candlelight(f):
    A, x, y = f['area'], f['cx'], f['cy']
    if 0.33 < x < 0.64 and y < 0.24 and A < 0.003: return 'flame'
    if 0.33 < x < 0.64 and 0.15 < y < 0.53: return 'candle'
    if 0.3 < x < 0.7 and 0.52 < y < 0.72: return 'gold'
    if A > 0.03: return 'panel'
    if f['depth'] < 0.04: return 'frame'
    return 'acanthus' if y > 0.72 else 'wreath'
CANDLE = dict(fn=candlelight, mirror=True, dir='vintage', category='Faith', fam={
    'flame': ['#ffb703', '#fb8500'], 'candle': ['#fbf3dc', '#f6e7c1'], 'gold': ['#c9a227', '#e0b84a'],
    'panel': ['#d9c8ec'], 'frame': ['#7a4a8c', '#c9a227'], 'acanthus': ['#6a994e', '#a7c957'], 'wreath': ['#6a994e', '#a7c957', '#3f7d4e']})


def balloon(f):
    A, x, y = f['area'], f['cx'], f['cy']
    if y < 0.47 and 0.1 < x < 0.9 and A > 0.002 and not (0.15 < y < 0.3): return 'gore'
    return 'flower' if A < 0.0012 else 'leaf'
BALLOON = dict(fn=balloon, mirror=True, dir='vintage', category='Vintage', fam={
    'gore': ['#e76f51', '#f4a261', '#e9c46a', '#2a9d8f', '#a8dadc'], 'flower': ['#e58ab8', '#f6d24a', '#9b6fd6'],
    'leaf': ['#6a994e', '#a7c957']})

# ---------------- crowns and mandalas (art/crowns, high detail) ----------------
HI = dict(dir='crowns', size=1400, close=0, min_area=150)
CROWN_FAM = {
    'gold': ['#e0b84a', '#c9a227', '#f2d57e'], 'velvet': ['#8e2c48', '#6b2d5c', '#1d4e89'],
    'jewel': ['#c0392b', '#1d4e89', '#2e8b57', '#8e44ad', '#f2d57e'],
}


def crown_part(f):
    A = f['area']
    if A < 0.0003: return 'jewel'
    return 'velvet' if A > 0.004 else 'gold'


def crowns_sheet(f):
    return crown_part(f)
CROWNS = dict(HI, fn=crowns_sheet, mirror=False, category='Crowns', fam=CROWN_FAM)

CROWN_POLY = [(0.44, 0.05), (0.56, 0.05), (0.6, 0.3), (0.85, 0.35), (0.92, 0.6), (0.9, 0.9), (0.1, 0.9), (0.08, 0.6), (0.15, 0.35), (0.4, 0.3)]


def crown_mandala(f):
    return crown_part(f) if pip(f['cx'], f['cy'], CROWN_POLY) else 'back'
CROWN_MANDALA = dict(HI, fn=crown_mandala, mirror=True, category='Crowns', fam=dict(
    CROWN_FAM, back=['#cfe3f5', '#b8d4ea', '#e3d5f0', '#d9ecd9', '#a9cbe6']))

PAGE_POLY = [(0.45, 0.02), (0.55, 0.02), (0.6, 0.3), (0.95, 0.4), (0.98, 0.75), (0.95, 0.98), (0.05, 0.98), (0.02, 0.75), (0.05, 0.4), (0.4, 0.3)]


def crown_page(f):
    x, y = f['cx'], f['cy']
    if pip(x, y, PAGE_POLY) and y > 0.3: return crown_part(f)
    if abs(x - 0.5) < 0.08 and y < 0.35: return crown_part(f)
    return 'leaf' if y < 0.5 and f['area'] > 0.0006 else 'back'
CROWN_PAGE = dict(HI, fn=crown_page, mirror=True, category='Crowns', fam=dict(
    CROWN_FAM, leaf=['#6a994e', '#a7c957', '#3f7d4e'], back=['#f7c6d6', '#e3d5f0', '#fbe3c4']))


def stars_page(f):
    A = f['area']
    if A > 0.01: return 'sky'
    return 'star' if A > 0.0008 else 'spark'
STARS = dict(HI, fn=stars_page, mirror=False, category='Faith', fam={
    'sky': ['#1f3163', '#2a4480'], 'star': ['#f2c14e', '#f6d98a', '#e9a23b', '#7fb3e0'], 'spark': ['#f6d98a', '#cfe3f5', '#9b6fd6']})


def heart_mandala(f):
    x, y = f['cx'], f['cy']
    if heart_shape(x, y):
        return 'centre' if math.hypot(x - 0.5, y - 0.5) < 0.03 else 'heart'
    d = dc(f)
    return 'ring1' if d < 0.35 else 'ring2' if d < 0.5 else 'ring3'
heart_shape = lambda x, y: ((lambda u, v: (u * u + v * v - 1) ** 3 - u * u * v ** 3 <= 0)((x - 0.5) / 0.17, -(y - 0.5) / 0.17))
HEART_MANDALA = dict(HI, fn=heart_mandala, mirror=True, category='Hearts', fam={
    'centre': ['#f2c14e'], 'heart': ['#e63957', '#ff6f8a', '#ffc2cf'], 'ring1': ['#f7b2c9', '#c8a6ea', '#fbd3e0'],
    'ring2': ['#9fd4c7', '#b8e0d2', '#c8a6ea'], 'ring3': ['#f6d98a', '#f2c14e', '#9fd4c7']})

GARDEN = dict(dir='drawn', category='Gardens', plan=True)
FAITH = dict(dir='drawn', category='Faith', plan=True)
ANIMALS = dict(dir='drawn', category='Animals', plan=True)

PICS = [
    ('garden-mushrooms', 'Mushroom Garden', 'mushrooms', GARDEN),
    ('garden-wisteria', 'Wisteria Path', 'wisteria', GARDEN),
    ('garden-tea', 'Garden Tea Party', 'tea', GARDEN),
    ('garden-poppies', 'Poppy Garden', 'poppies', GARDEN),
    ('garden-arbor', 'Lantern Arbor', 'arbor', GARDEN),
    ('faith-cross', 'Sunrise Cross', 'cross', FAITH),
    ('faith-dove', 'Dove of Peace', 'dove', FAITH),
    ('faith-ark', "Noah's Ark", 'ark', FAITH),
    ('faith-loaves', 'Loaves and Fishes', 'loaves', FAITH),
    ('faith-bethlehem', 'Star of Bethlehem', 'bethlehem', FAITH),
    ('animal-lamb', 'Little Lamb', 'lamb', ANIMALS),
    ('animal-kitty', 'Ginger Kitty', 'kitty', ANIMALS),
    ('animal-butterfly', 'Butterfly', 'butterfly', ANIMALS),
    ('crown-royal', 'Royal Crown', 'crown-page', CROWN_PAGE),
    ('crown-mandala', 'Crown Mandala', 'crown-mandala', CROWN_MANDALA),
    ('crown-collection', 'Crown Collection', 'crowns', CROWNS),
    ('heart-mandala', 'Heart Mandala', 'heart-mandala', HEART_MANDALA),
    ('faith-stars', 'Heavenly Stars', 'stars', STARS),
    ('vintage-rose-window', 'Rose Window', 'rose-window', ROSE),
    ('vintage-candlelight', 'Candlelight', 'candlelight', CANDLE),
    ('vintage-cross', 'Cross Medallion', 'cross-medallion', CROSS),
    ('vintage-star', 'Star Medallion', 'star-medallion', STAR),
    ('vintage-celtic', 'Celtic Ring', 'celtic-ring', CELTIC),
    ('vintage-balloon', 'Flower Balloon', 'balloon', BALLOON),
    ('vintage-greek', 'Greek Plate', 'greek-plate', GREEK),
    ('heart-bird', 'Songbird Heart', 'bird', BIRD),
    ('heart-wheat', 'Harvest Heart', 'wheat', WHEAT),
    ('heart-mountains', 'Mountain Heart', 'mountains', MOUNTAINS),
    ('heart-waves', 'Ocean Heart', 'waves', WAVES),
    ('heart-lace', 'Lace Heart', 'lace', LACE),
]

MIN_LIGHTNESS = 0.45


def no_black(hx):
    """No black or near-black fills: raise dark colours to a mid shade of the same hue."""
    r, g_, b = [int(hx[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    h, l, s_ = colorsys.rgb_to_hls(r, g_, b)
    if l >= MIN_LIGHTNESS:
        return hx
    r, g_, b = colorsys.hls_to_rgb(h, MIN_LIGHTNESS, s_)
    return '#%02x%02x%02x' % tuple(round(v * 255) for v in (r, g_, b))


def colours_from_plan(plan_path, lab, R, max_colours=24):
    """Each region takes the most common colour of the plan image under it;
    near-identical colours are merged so the palette stays manageable."""
    H, W = lab.shape
    plan = np.array(Image.open(plan_path).convert('RGB').resize((W, H), Image.NEAREST)).astype(np.int64)
    key = (plan[..., 0] << 16) | (plan[..., 1] << 8) | plan[..., 2]
    m = lab > 0
    u, cnt = np.unique(lab[m].astype(np.int64) * (1 << 24) + key[m], return_counts=True)
    best = {}
    for pr, c in zip(u.tolist(), cnt.tolist()):
        k, col = pr >> 24, pr & 0xFFFFFF
        if c > best.get(k, (0, 0))[0]:
            best[k] = (c, col)
    raw = [best.get(k, (0, 0xFFFFFF))[1] for k in range(1, R + 1)]
    rgb = lambda c: np.array([(c >> 16) & 255, (c >> 8) & 255, c & 255], float)
    freq = {}
    for c in raw:
        freq[c] = freq.get(c, 0) + 1
    thresh = 14
    while True:
        kept, mapping = [], {}
        for c in sorted(freq, key=lambda c: -freq[c]):
            near = next((k for k in kept if np.linalg.norm(rgb(k) - rgb(c)) < thresh), None)
            mapping[c] = near if near is not None else c
            if near is None:
                kept.append(c)
        if len(kept) <= max_colours:
            break
        thresh += 6
    return [None] + ['#%06x' % mapping[c] for c in raw]


def process(pid, title, src, cfg):
    art = os.path.join(ROOT, 'art', cfg.get('dir', 'hearts'))
    im = Image.open(os.path.join(art, src + '.png')).convert('L')
    s = cfg.get('size', SIZE) / max(im.size)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    g = np.array(im).astype(np.float32)
    H, W = g.shape
    # No solid black: hollow out thick ink shapes so they become colourable areas
    # (a 3px outline is kept).
    r_thick = max(2, round(7 * W / 1000))
    solid = ndi.binary_erosion(ndi.binary_opening(g < 128, iterations=r_thick), iterations=3)
    g[solid] = 255
    close = cfg.get('close', 1)
    wall = ndi.binary_dilation(g < 175, iterations=close) if close else g < 175
    lab, n = ndi.label(~wall)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    areas = ndi.sum(np.ones_like(lab), lab, index=np.arange(n + 1))
    outside = np.isin(lab, list(border))
    lab[outside] = 0
    # merge tiny regions into their most common neighbour
    grown = ndi.grey_dilation(lab, size=5)
    small = [i for i in range(1, n + 1) if i not in border and areas[i] < cfg.get('min_area', MIN_AREA)]
    objs = ndi.find_objects(lab)
    for i in small:
        sl = objs[i - 1]
        if sl is None: continue
        sl2 = tuple(slice(max(0, a.start - 4), a.stop + 4) for a in sl)
        m = ndi.binary_dilation(lab[sl2] == i, iterations=3) & (lab[sl2] != i) & (lab[sl2] != 0)
        nb = lab[sl2][m]
        nb = nb[np.isin(nb, small, invert=True)]
        lab[sl2][lab[sl2] == i] = np.bincount(nb).argmax() if nb.size else 0
    ids = [i for i in np.unique(lab) if i != 0]
    remap = np.zeros(n + 1, np.int32)
    for k, i in enumerate(ids): remap[i] = k + 1
    lab = remap[lab]
    R = len(ids)
    # label points: deepest point of each region (distance to real lines)
    dt = ndi.distance_transform_edt(g >= 175)
    pos = ndi.maximum_position(dt, lab, index=np.arange(1, R + 1))
    rad = ndi.maximum(dt, lab, index=np.arange(1, R + 1))
    cent = ndi.center_of_mass(np.ones_like(lab), lab, index=np.arange(1, R + 1))
    ar = ndi.sum(np.ones_like(lab), lab, index=np.arange(1, R + 1))
    depth_map = ndi.distance_transform_edt(~outside)
    solid_frac = ndi.mean(solid.astype(np.float32), lab, index=np.arange(1, R + 1))
    feats = []
    for k in range(R):
        py, px = pos[k]
        feats.append(dict(solid=bool(solid_frac[k] > 0.5), cx=cent[k][1] / W, cy=cent[k][0] / H, area=ar[k] / (W * H),
                          depth=depth_map[py, px] / W, lx=int(px), ly=int(py), r=float(rad[k])))
    if cfg.get('plan'):
        plan_colour = colours_from_plan(os.path.join(art, src + '-plan.png'), lab, R)
    # extend fills under the lines so no white halo shows between fill and ink
    inside = ~outside
    idx = ndi.distance_transform_edt(lab == 0, return_distances=False, return_indices=True)
    filled = lab[idx[0], idx[1]]
    lab = np.where(inside, filled, 0).astype(np.uint16)
    # adjacency
    adj = [set() for _ in range(R + 1)]
    for dy, dx in [(0, 6), (6, 0), (4, 4), (4, -4)]:
        a = lab[max(0, -dy):H - max(0, dy), max(0, -dx):W - max(0, dx)]
        b = lab[max(0, dy):, max(0, dx):][:a.shape[0], :a.shape[1]]
        m = (a != b) & (a > 0) & (b > 0)
        for u, v in set(zip(a[m].tolist(), b[m].tolist())):
            adj[u].add(v); adj[v].add(u)
    # colour assignment
    fam = cfg.get('fam', {})
    colour = plan_colour if cfg.get('plan') else [None] * (R + 1)
    order = [] if cfg.get('plan') else sorted(range(1, R + 1), key=lambda k: -feats[k - 1]['area'])
    for k in order:
        if colour[k]: continue
        f = feats[k - 1]
        shades = fam[cfg['fn'](f)]
        used = [colour[v] for v in adj[k] if colour[v]]
        colour[k] = min(shades, key=lambda s_: (used.count(s_), (shades.index(s_) + k) % len(shades)))
        if cfg.get('mirror') and f['cy'] < cfg.get('mirror_max_y', 2) and not (cfg.get('mirror_skip') and cfg['mirror_skip'](f)):
            mx = W - 1 - f['lx']
            j = lab[f['ly'], mx]
            if j and not colour[j] and 0.6 < feats[j - 1]['area'] / f['area'] < 1.65:
                colour[j] = colour[k]
    colour = [None] + [no_black(c) for c in colour[1:]]
    palette = []
    for c in colour[1:]:
        if c not in palette: palette.append(c)
    def hue_key(hx):
        r, g_, b = [int(hx[i:i + 2], 16) / 255 for i in (1, 3, 5)]
        h, l, s_ = colorsys.rgb_to_hls(r, g_, b)
        return (0 if s_ > 0.15 else 1, round(h * 12), -l)
    palette.sort(key=hue_key)
    regions = [[f['lx'], f['ly'], round(f['r'], 1), palette.index(colour[k + 1])] for k, f in enumerate(feats)]
    # line art as black ink with alpha
    alpha = np.clip((235 - g) * (255 / 175), 0, 255)
    alpha = (np.round(alpha / 255 * 15) * 17).astype(np.uint8)
    ink = np.zeros((H, W, 2), np.uint8); ink[..., 1] = alpha
    buf = io.BytesIO(); Image.fromarray(ink, 'LA').save(buf, 'PNG', optimize=True)
    lines = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
    labels = base64.b64encode(zlib.compress(lab.astype('<u2').tobytes(), 9)).decode()
    if PREVIEW:
        pal = np.array([[255, 255, 255]] + [[int(c[i:i + 2], 16) for i in (1, 3, 5)] for c in colour[1:]], np.uint8)
        rgb = pal[lab].astype(np.float32) * (1 - alpha[..., None] / 255.0)
        Image.fromarray(rgb.astype(np.uint8)).save(os.path.join(PREVIEW, pid + '-preview.png'))
    print(pid, W, H, 'regions', R, 'colors', len(palette), 'lines KB', len(lines) // 1024, 'labels KB', len(labels) // 1024)
    return dict(id=pid, title=title, category=cfg.get('category', 'Hearts'), kind='lines', w=W, h=H, palette=palette,
                regions=regions, lines=lines, labels=labels)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = os.environ.get('PREVIEW_DIR')

out = [process(*p) for p in PICS]
with open(os.path.join(ROOT, 'js', 'lineart.js'), 'w') as fh:
    fh.write('// Generated by tools/build_line_art.py from art/. Do not edit by hand.\n')
    fh.write('window.LINE_ART = ' + json.dumps(out, separators=(',', ':')) + ';\n')
