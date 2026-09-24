"""Draw the Gardens line-art pages as SVG files in art/gardens/.

Every shape is drawn with a black outline and filled with the colour it
should end up as. tools/render_svg.js then renders two images per page:
the outlines on white (what you colour in) and the fills without outlines
(the colour plan). tools/build_line_art.py turns those into the app data.

    python3 tools/gardens.py
"""
import math
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'art', 'gardens')

INK = 'stroke="#111" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"'


def f(v):
    return f'{v:.1f}'


def path(d, fill='none', extra=''):
    ink = INK.replace('stroke-width="3.5" ', '') if 'stroke-width' in extra else INK
    return f'<path d="{d}" fill="{fill}" {ink} {extra}/>'


def circle(cx, cy, r, fill):
    return f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{fill}" {INK}/>'


def ellipse(cx, cy, rx, ry, fill, rot=0):
    t = f' transform="rotate({f(rot)} {f(cx)} {f(cy)})"' if rot else ''
    return f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" fill="{fill}" {INK}{t}/>'


def rect(x, y, w, h, fill, r=0):
    return f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" rx="{f(r)}" fill="{fill}" {INK}/>'


def poly(pts, fill):
    return f'<polygon points="{" ".join(f"{f(x)},{f(y)}" for x, y in pts)}" fill="{fill}" {INK}/>'


def line(x0, y0, x1, y1, w=3.5):
    return f'<line x1="{f(x0)}" y1="{f(y0)}" x2="{f(x1)}" y2="{f(y1)}" stroke="#111" stroke-width="{w}" stroke-linecap="round"/>'


def scallop(cx, cy, rx, ry, n, depth, fill, rng, flat_bottom=False):
    """A bumpy blob (bush, tree canopy, cloud)."""
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        k = 1 + rng.uniform(-0.06, 0.06)
        pts.append((cx + rx * k * math.cos(a), cy + ry * k * math.sin(a)))
    d = f'M{f(pts[0][0])},{f(pts[0][1])}'
    for i in range(n):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % n]
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        ox, oy = mx - cx, my - cy
        L = math.hypot(ox, oy) or 1
        if flat_bottom and my > cy + ry * 0.55:
            d += f' L{f(x1)},{f(y1)}'
        else:
            d += f' Q{f(mx + ox / L * depth)},{f(my + oy / L * depth)} {f(x1)},{f(y1)}'
    return path(d + ' Z', fill)


def flower(cx, cy, r, petal, centre, n=5, rot=0):
    out = []
    for i in range(n):
        a = rot + 2 * math.pi * i / n
        out.append(ellipse(cx + math.cos(a) * r * 0.62, cy + math.sin(a) * r * 0.62, r * 0.55, r * 0.36, petal, math.degrees(a)))
    out.append(circle(cx, cy, r * 0.32, centre))
    return ''.join(out)


def leaf(cx, cy, length, angle, fill):
    a = math.radians(angle)
    dx, dy = math.cos(a) * length, math.sin(a) * length
    nx, ny = -dy * 0.35, dx * 0.35
    x1, y1 = cx + dx, cy + dy
    d = (f'M{f(cx)},{f(cy)} Q{f(cx + dx / 2 + nx)},{f(cy + dy / 2 + ny)} {f(x1)},{f(y1)} '
         f'Q{f(cx + dx / 2 - nx)},{f(cy + dy / 2 - ny)} {f(cx)},{f(cy)} Z')
    return path(d, fill) + line(cx, cy, cx + dx * 0.8, cy + dy * 0.8, 2.2)


def tuft(x, y, h, fill, rng, blades=5):
    out = []
    for i in range(blades):
        bx = x + (i - blades / 2) * h * 0.14
        tip = (bx + rng.uniform(-0.35, 0.35) * h, y - h * rng.uniform(0.6, 1.0))
        out.append(poly([(bx - h * 0.06, y), tip, (bx + h * 0.06, y)], fill))
    return ''.join(out)


def sunburst(cx, cy, n, colours, r=1500):
    """Alternating wedges radiating from a point: a decorative sky."""
    out = []
    for i in range(n):
        a0 = 2 * math.pi * i / n
        a1 = 2 * math.pi * (i + 1) / n
        out.append(poly([(cx, cy), (cx + r * math.cos(a0), cy + r * math.sin(a0)), (cx + r * math.cos(a1), cy + r * math.sin(a1))], colours[i % len(colours)]))
    return ''.join(out)


def pebbles(y0, y1, colours, rng, size=34):
    out = []
    y = y0
    row = 0
    while y < y1:
        x = -20 + (row % 2) * size * 0.6
        while x < 1020:
            w = size * rng.uniform(0.8, 1.3)
            out.append(ellipse(x + w / 2, y, w / 2, size * 0.36, rng.choice(colours), rng.uniform(-12, 12)))
            x += w + 6
        y += size * 0.78
        row += 1
    return ''.join(out)


def bed(x0, x1, y, rows, colours, rng, r=18):
    out = []
    for j in range(rows):
        x = x0 + (j % 2) * r
        while x < x1:
            out.append(flower(x, y + j * r * 1.4, r * rng.uniform(0.85, 1.15), rng.choice(colours), '#f7b733', rot=rng.random()))
            x += r * 2.1
    return ''.join(out)


FRAME_OUT = 'M50,975 L50,500 A450,450 0 0 1 950,500 L950,975 Z'
FRAME_IN = 'M76,949 L76,500 A424,424 0 0 1 924,500 L924,949 Z'


def page(body, border):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
<rect width="1000" height="1000" fill="#ffffff"/>
<path d="{FRAME_OUT}" fill="{border}" stroke="#111" stroke-width="5"/>
<clipPath id="c"><path d="{FRAME_IN}"/></clipPath>
<g clip-path="url(#c)">{body}</g>
<path d="{FRAME_IN}" fill="none" stroke="#111" stroke-width="5"/>
</svg>'''


# ---------------------------------------------------------------- scenes

def mushroom_garden():
    rng = random.Random(7)
    o = [rect(0, 0, 1000, 1000, '#cfe7f2')]
    o.append(sunburst(500, 170, 24, ['#cfe7f2', '#e3f1f8']))
    o.append(circle(500, 170, 60, '#ffd76a'))
    # fence boards
    boards = ['#c9584b', '#b44a3f', '#d46a5c']
    for i, x in enumerate(range(80, 940, 62)):
        top = 170 + (i % 2) * 18
        o.append(poly([(x, 640), (x, top + 20), (x + 29, top), (x + 58, top + 20), (x + 58, 640)], boards[i % 3]))
    o.append(rect(70, 330, 880, 22, '#9c3b33'))
    o.append(rect(70, 520, 880, 22, '#9c3b33'))
    # plates on the fence
    for x, y, r, c in [(760, 260, 46, '#3f8fd2'), (660, 300, 34, '#f28a3c'), (845, 390, 38, '#f2b53c')]:
        o.append(circle(x, y, r, c))
        o.append(circle(x, y, r * 0.55, '#fdf1dc'))
    # back shrubs
    for x, y, rx, ry, c in [(170, 520, 150, 130, '#5f9e5a'), (420, 560, 150, 110, '#78b36b'), (880, 560, 120, 110, '#4f8c55')]:
        o.append(scallop(x, y, rx, ry, 14, 18, c, rng))
    # ground
    o.append(path('M0,640 Q300,600 520,650 T1000,630 L1000,1000 L0,1000 Z', '#b98f63'))
    o.append(pebbles(655, 760, ['#c9a47c', '#a67c55', '#d8bb94'], rng, 30))
    o.append(path('M0,760 Q250,720 500,770 T1000,750 L1000,1000 L0,1000 Z', '#8fbf6a'))
    # mushrooms, back to front: (x, ground, height, cap width, cap, spots, stem)
    shrooms = [
        (300, 560, 250, 170, '#f2c12e', '#fff4d6', '#efe6d2'),
        (560, 575, 230, 150, '#e8743b', '#ffe3b3', '#f3ead8'),
        (720, 600, 260, 190, '#3f7fc4', '#e9f3ff', '#e6e0cf'),
        (170, 700, 180, 150, '#6a5acd', '#f2eeff', '#f1ead9'),
        (420, 760, 280, 230, '#d9483b', '#fff1e6', '#f5ecd9'),
        (690, 800, 300, 260, '#e86a2c', '#fff0d0', '#f2c94c'),
        (250, 880, 190, 170, '#4a90c8', '#fdf6e3', '#efe7d4'),
        (860, 900, 170, 150, '#c2477a', '#ffe8f1', '#f3ead8'),
    ]
    for x, g, h, w, cap, spot, stem in shrooms:
        sw = w * 0.22
        capy = g - h
        o.append(path(f'M{f(x - sw / 2)},{f(g)} Q{f(x - sw * 0.7)},{f(capy + h * 0.5)} {f(x - sw * 0.45)},{f(capy + 12)} '
                      f'L{f(x + sw * 0.45)},{f(capy + 12)} Q{f(x + sw * 0.7)},{f(capy + h * 0.5)} {f(x + sw / 2)},{f(g)} Z', stem))
        o.append(ellipse(x, capy + 10, w * 0.46, 16, '#e9dcc0'))
        o.append(path(f'M{f(x - w / 2)},{f(capy + 10)} Q{f(x - w / 2)},{f(capy - h * 0.45)} {f(x)},{f(capy - h * 0.48)} '
                      f'Q{f(x + w / 2)},{f(capy - h * 0.45)} {f(x + w / 2)},{f(capy + 10)} '
                      f'Q{f(x)},{f(capy - 8)} {f(x - w / 2)},{f(capy + 10)} Z', cap))
        placed = []
        for _ in range(60):
            sx = x + rng.uniform(-0.38, 0.38) * w
            sy = capy - rng.uniform(0.05, 0.36) * h
            sr = rng.uniform(0.045, 0.075) * w
            if ((sx - x) / (w * 0.48)) ** 2 + ((sy - capy + 4) / (h * 0.44)) ** 2 > 0.62:
                continue
            if any(math.hypot(sx - px, sy - py) < sr + pr + 6 for px, py, pr in placed):
                continue
            placed.append((sx, sy, sr))
            if len(placed) >= 7:
                break
        for sx, sy, sr in placed:
            o.append(circle(sx, sy, sr, spot))
    # stones and plants in front
    for x, y, rx, ry, c in [(90, 930, 70, 40, '#a9a3b8'), (520, 960, 90, 45, '#c79a8a'), (980, 960, 80, 45, '#8e9aaf'), (360, 975, 60, 30, '#b8b2a4')]:
        o.append(ellipse(x, y, rx, ry, c, rng.uniform(-10, 10)))
    for x in (130, 330, 560, 800, 950):
        o.append(tuft(x, 985, 70, '#4f9a4a', rng))
    for x, y, c in [(470, 900, '#b98bd8'), (120, 810, '#f5d547'), (600, 930, '#9ab8f0'), (960, 840, '#f5d547'), (50, 650, '#e46c8f')]:
        o.append(flower(x, y, 26, c, '#f7b733'))
    return page(''.join(o), '#6a8f4e')


def wisteria_path():
    rng = random.Random(11)
    o = [rect(0, 0, 1000, 1000, '#fbe7b5')]
    o.append(sunburst(500, 470, 28, ['#fbe7b5', '#fcd89a']))
    o.append(circle(500, 470, 120, '#ffd76a'))
    o.append(circle(500, 470, 70, '#fff3c4'))
    # distant bushes and hedges
    for x, y, rx, ry, c in [(330, 560, 130, 80, '#7fae6a'), (680, 560, 130, 80, '#6a9d5c'), (180, 640, 150, 110, '#5c8f52'), (830, 640, 150, 110, '#4f8a4c')]:
        o.append(scallop(x, y, rx, ry, 13, 16, c, rng))
    o.append(path('M0,600 Q500,560 1000,600 L1000,1000 L0,1000 Z', '#9ccc7a'))
    # stepping stones in perspective along a gentle S curve
    for i in range(11):
        t = i / 10
        y = 960 - t * 390
        s = 1 - t * 0.78
        x = 500 + math.sin(t * 3.2) * 110 * s
        for dx in ((-1, 1) if s > 0.45 else (0,)):
            cx = x + dx * 70 * s if s > 0.45 else x
            o.append(ellipse(cx, y, (95 if s > 0.45 else 120) * s, 34 * s, rng.choice(['#d8d2c4', '#c9c2b2', '#e4dfd3']), rng.uniform(-6, 6)))
    # side flower beds
    o.append(bed(60, 330, 680, 6, ['#b784d9', '#9a6bc4', '#d99bd3', '#f28fb5'], rng, 27))
    o.append(bed(680, 960, 680, 6, ['#b784d9', '#9a6bc4', '#d99bd3', '#f6d24a'], rng, 27))
    # wisteria canopy: vines, leaves, hanging clusters
    clusters = []
    o.append(scallop(500, 40, 520, 120, 26, 22, '#5f9e4f', rng))
    for i in range(13):
        x = 80 + i * 70 + rng.uniform(-8, 8)
        edge = abs(x - 500) / 420
        clusters.append((x, 90 + rng.uniform(0, 30), 200 + edge * 330 + rng.uniform(-20, 30)))
    for x, y0, L in clusters:
        o.append(leaf(x - 8, y0 - 5, 80, 160, '#6aa84f'))
        o.append(leaf(x + 8, y0 - 5, 80, 20, '#88c06a'))
        rows = int(L / 30)
        for r in range(rows):
            y = y0 + r * 30
            width = 64 * (1 - r / rows) + 10
            n = max(1, int(width / 22))
            for j in range(n):
                cx = x - width / 2 + (j + 0.5) * width / n + (r % 2) * 6
                o.append(circle(cx, y, 17 * (1 - r / rows * 0.45), ['#8e5cc8', '#b388e0', '#d7b6f0', '#7446b0'][(r + j) % 4]))
    for x, y, c in [(120, 880, '#f6d24a'), (880, 900, '#f28fb5'), (70, 760, '#f28fb5'), (930, 770, '#f6d24a')]:
        o.append(flower(x, y, 28, c, '#e07b39'))
    return page(''.join(o), '#7446b0')


def lantern_arbor():
    rng = random.Random(3)
    o = [rect(0, 0, 1000, 1000, '#23452f')]
    # back hedge & lawn
    o.append(scallop(500, 470, 380, 150, 22, 20, '#2f6b44', rng))
    o.append(path('M0,560 Q500,520 1000,560 L1000,1000 L0,1000 Z', '#5a9e4b'))
    # arches
    for k, (w, c) in enumerate([(700, '#3b3b3b'), (520, '#4a4a4a'), (360, '#5a5a5a')]):
        top = 150 + k * 70
        o.append(path(f'M{f(500 - w / 2)},{f(620 + k * 10)} L{f(500 - w / 2)},{f(top + w / 2)} '
                      f'A{f(w / 2)},{f(w / 2)} 0 0 1 {f(500 + w / 2)},{f(top + w / 2)} L{f(500 + w / 2)},{f(620 + k * 10)}', 'none',
                      'stroke-width="14"'))
    # string lights
    for k in range(2):
        y = 260 + k * 60
        d = f'M150,{y} Q500,{y + 150} 850,{y}'
        o.append(path(d, 'none'))
        for i in range(1, 12):
            t = i / 12
            x = (1 - t) ** 2 * 150 + 2 * (1 - t) * t * 500 + t ** 2 * 850
            yy = (1 - t) ** 2 * y + 2 * (1 - t) * t * (y + 150) + t ** 2 * y
            o.append(circle(x, yy + 8, 9, '#ffe27a'))
    # birdcage lanterns
    for x, y, s in [(330, 330, 1.0), (500, 380, 1.2), (670, 330, 1.0), (415, 440, 0.8), (590, 440, 0.8)]:
        o.append(line(x, 150, x, y - 60 * s, 2.5))
        o.append(path(f'M{f(x - 40 * s)},{f(y + 40 * s)} L{f(x - 40 * s)},{f(y - 15 * s)} Q{f(x)},{f(y - 75 * s)} '
                      f'{f(x + 40 * s)},{f(y - 15 * s)} L{f(x + 40 * s)},{f(y + 40 * s)} Z', '#f6d58b'))
        o.append(circle(x, y + 8 * s, 18 * s, '#ffb347'))
        for dx in (-26, -13, 13, 26):
            o.append(line(x + dx * s, y - 30 * s, x + dx * s, y + 40 * s, 2.2))
        o.append(rect(x - 46 * s, y + 38 * s, 92 * s, 14 * s, '#c89b4b', 4))
    # stepping stones
    for i in range(8):
        t = i / 7
        o.append(ellipse(500 + math.sin(t * 2.5) * 30, 960 - t * 360, 70 - t * 45, 22 - t * 13, '#cfc6b3'))
    # sofas
    for side in (-1, 1):
        cx = 500 + side * 300
        o.append(rect(cx - 130, 640, 260, 90, '#f2c94c', 30))
        o.append(rect(cx - 150, 700, 300, 70, '#e8b93c', 18))
        o.append(rect(cx - 170, 680, 50, 110, '#f2c94c', 20))
        o.append(rect(cx + 120, 680, 50, 110, '#f2c94c', 20))
        for k in (-1, 1):
            px = cx + k * 55
            o.append(rect(px - 42, 655, 84, 60, '#f7a1b4', 14))
            o.append(flower(px, 685, 17, '#e0485f', '#f6d24a'))
        o.append(line(cx - 140, 770, cx - 150, 810, 6))
        o.append(line(cx + 140, 770, cx + 150, 810, 6))
    # ottomans
    for x, y in [(380, 830), (620, 830)]:
        o.append(rect(x - 55, y - 10, 110, 80, '#f9d2dc', 10))
        o.append(ellipse(x, y - 10, 55, 18, '#fbe3ea'))
        for dx, dy in [(-28, 20), (0, 45), (28, 20)]:
            o.append(flower(x + dx, y + dy, 13, '#e0485f', '#f6d24a'))
    # flower beds
    for side in (-1, 1):
        for i in range(12):
            x = 500 + side * rng.uniform(250, 480)
            y = rng.uniform(820, 990)
            o.append(flower(x, y, rng.uniform(20, 30), rng.choice(['#d62839', '#f6d24a', '#9b5de5', '#f28fb5']), '#f7b733', rot=rng.random()))
    for x, y in [(90, 600), (910, 600), (120, 470), (880, 470)]:
        o.append(flower(x, y, 26, '#d62839', '#f6d24a'))
    return page(''.join(o), '#b8860b')


def poppy_garden():
    rng = random.Random(5)
    o = [rect(0, 0, 1000, 1000, '#8fd0f5')]
    o.append(scallop(270, 190, 90, 40, 9, 12, '#ffffff', rng))
    o.append(scallop(720, 160, 110, 45, 10, 12, '#ffffff', rng))
    # blossom trees
    for x, y, r, c in [(150, 330, 130, '#f59ac3'), (360, 300, 110, '#b67ee0'), (560, 290, 100, '#fbfbfb'), (740, 300, 120, '#f58a5c'),
                       (900, 340, 130, '#f59ac3')]:
        o.append(rect(x - 12, y + r * 0.5, 24, 140, '#8a5a3b', 4))
        o.append(scallop(x, y, r, r * 0.8, 12, 16, c, rng))
    # lawn, beds and pond
    o.append(path('M0,430 L1000,430 L1000,1000 L0,1000 Z', '#8ccf5a'))
    beds = ['#e84a5f', '#ffd23f', '#b56fe0', '#ff8fb8', '#ff9f1c']
    o.append(bed(0, 1010, 450, 4, beds, rng, 25))
    o.append(ellipse(500, 560, 150, 40, '#4fb3e8'))
    o.append(ellipse(500, 560, 90, 20, '#a5dcf7'))
    # path
    o.append(path('M760,1000 Q700,780 560,600 L610,600 Q800,780 900,1000 Z', '#d9c7a5'))
    for i in range(7):
        y = 640 + i * 55
        x0 = 575 + (y - 600) * 0.55
        o.append(line(x0, y, x0 + 60 + i * 12, y, 2.5))
    # poppies in front
    stems = []
    for x, y, r in [(90, 740, 60), (230, 690, 50), (360, 780, 70), (190, 880, 80), (470, 900, 60), (80, 960, 55), (320, 960, 50), (600, 950, 55)]:
        stems.append(path(f'M{f(x)},{f(y + r * 0.3)} Q{f(x + 20)},{f(y + 150)} {f(x + 5)},1000', 'none', 'stroke-width="6"'))
    o += stems
    for x, y, r in [(150, 800, 20), (420, 830, 18), (540, 860, 16), (260, 790, 18)]:
        o.append(ellipse(x, y, r * 0.7, r, '#5e9e3a'))
    for x, y, r in [(90, 740, 60), (230, 690, 50), (360, 780, 70), (190, 880, 80), (470, 900, 60), (80, 960, 55), (320, 960, 50), (600, 950, 55)]:
        for k in range(5):
            a = 2 * math.pi * k / 5 + rng.random()
            o.append(ellipse(x + math.cos(a) * r * 0.45, y + math.sin(a) * r * 0.4, r * 0.62, r * 0.5, ['#e3242b', '#f0403c'][k % 2], math.degrees(a)))
        o.append(circle(x, y, r * 0.22, '#2b2b2b'))
    for x in (40, 280, 520, 680):
        o.append(tuft(x, 1000, 90, '#4c8f35', rng, 6))
    return page(''.join(o), '#e3242b')


def tea_garden():
    rng = random.Random(9)
    o = [rect(0, 0, 1000, 1000, '#cfe5f7')]
    o.append(sunburst(500, 520, 30, ['#cfe5f7', '#e4f0fa']))
    # far garden through the arch
    for x, y, rx, c in [(330, 600, 110, '#8f63c4'), (500, 580, 130, '#b18bd9'), (670, 600, 110, '#9b6fd6')]:
        o.append(scallop(x, y, rx, 90, 12, 16, c, rng))
    for i in range(9):
        x = 300 + i * 50
        for r in range(6):
            o.append(circle(x + (r % 2) * 8 - 4, 260 + r * 30, 15 - r * 1.2, ['#8e5cc8', '#b388e0', '#d7b6f0'][(r + i) % 3]))
    # stone arch built from blocks
    stones = ['#b9ad95', '#a89c84', '#cbbfa6']
    for k in range(16):
        a0 = math.pi + math.pi * k / 16
        a1 = math.pi + math.pi * (k + 1) / 16
        r0, r1 = 250, 320
        cx, cy = 500, 470
        o.append(poly([(cx + r0 * math.cos(a0), cy + r0 * math.sin(a0)), (cx + r1 * math.cos(a0), cy + r1 * math.sin(a0)),
                       (cx + r1 * math.cos(a1), cy + r1 * math.sin(a1)), (cx + r0 * math.cos(a1), cy + r0 * math.sin(a1))], stones[k % 3]))
    for side in (-1, 1):
        for j in range(5):
            x = 500 + side * 285
            o.append(rect(x - 35, 470 + j * 60, 70, 60, stones[j % 3]))
    # climbing roses and wisteria over the arch
    for i in range(22):
        a = math.pi + math.pi * i / 21
        x, y = 500 + 300 * math.cos(a), 470 + 300 * math.sin(a)
        if i % 3 == 0:
            o.append(leaf(x, y, 45, math.degrees(a) + 90, '#6aa84f'))
        o.append(flower(x + rng.uniform(-20, 20), y + rng.uniform(-20, 20), 24, rng.choice(['#e58ab8', '#c678d6', '#f2b3d6']), '#f7d56b', rot=rng.random()))
    for x in (160, 230, 770, 840):
        for r in range(7):
            o.append(circle(x + (r % 2) * 10 - 5, 150 + r * 34, 16 - r, ['#8e5cc8', '#b388e0', '#d7b6f0'][r % 3]))
    # ground of flowers
    o.append(path('M0,760 Q500,720 1000,760 L1000,1000 L0,1000 Z', '#7fae6a'))
    for _ in range(30):
        o.append(flower(rng.uniform(20, 980), rng.uniform(800, 990), rng.uniform(18, 28), rng.choice(['#9b6fd6', '#c8a6ea', '#7c4dbd', '#e58ab8']), '#f7d56b', rot=rng.random()))
    # table with cloth
    o.append(rect(395, 700, 18, 160, '#9c7a55'))
    o.append(rect(587, 700, 18, 160, '#9c7a55'))
    o.append(poly([(330, 640), (670, 640), (720, 700), (280, 700)], '#e9dcf5'))
    o.append(poly([(360, 700), (500, 800), (640, 700)], '#b18bd9'))
    for x in (400, 450, 500, 550, 600):
        o.append(flower(x, 680, 11, '#8e5cc8', '#f7d56b'))
    # teapot, cups, lantern, vase
    o.append(ellipse(430, 610, 48, 36, '#f3eefb'))
    o.append(ellipse(430, 574, 20, 8, '#c8a6ea'))
    o.append(path('M475,605 Q505,590 510,570', 'none', 'stroke-width="9"'))
    o.append(path('M385,595 Q360,610 385,630', 'none', 'stroke-width="8"'))
    o.append(flower(430, 612, 16, '#b18bd9', '#f7d56b'))
    for x in (530, 610):
        o.append(path(f'M{x - 22},630 L{x + 22},630 Q{x + 18},660 {x},660 Q{x - 18},660 {x - 22},630 Z', '#f3eefb'))
        o.append(ellipse(x, 663, 30, 7, '#c8a6ea'))
    o.append(rect(560, 560, 36, 60, '#f7d56b', 4))
    o.append(poly([(552, 560), (578, 538), (604, 560)], '#c89b4b'))
    o.append(circle(578, 590, 10, '#ffb347'))
    o.append(rect(488, 590, 24, 40, '#a5d6e8', 8))
    for dx, dy in [(-18, -12), (0, -24), (18, -12)]:
        o.append(flower(500 + dx, 590 + dy, 12, '#9b6fd6', '#f7d56b'))
    # chairs with swirl backs
    for side in (-1, 1):
        x = 500 + side * 250
        o.append(path(f'M{x - 45},720 Q{x - 50},600 {x},580 Q{x + 50},600 {x + 45},720', 'none', 'stroke-width="6"'))
        o.append(path(f'M{x - 20},690 Q{x - 20},630 {x},625 Q{x + 22},630 {x + 15},660 Q{x + 5},675 {x - 5},660', 'none', 'stroke-width="4"'))
        o.append(ellipse(x, 730, 70, 22, '#efe6d6'))
        for dx in (-50, 50):
            o.append(line(x + dx, 740, x + dx * 1.1, 850, 6))
    return page(''.join(o), '#7c4dbd')


SCENES = {
    'mushrooms': mushroom_garden,
    'wisteria': wisteria_path,
    'arbor': lantern_arbor,
    'poppies': poppy_garden,
    'tea': tea_garden,
}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, fn in SCENES.items():
        with open(os.path.join(OUT, name + '.svg'), 'w') as fh:
            fh.write(fn())
        print('wrote', name)
