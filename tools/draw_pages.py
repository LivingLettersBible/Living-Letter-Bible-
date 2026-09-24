"""Draw the original line-art pages (Gardens, Faith, Animals) as SVG files in art/drawn/.

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
OUT = os.path.join(ROOT, 'art', 'drawn')

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


# A pointed, stained-glass style window for the Faith pages.
GOTHIC_OUT = 'M50,975 L50,470 Q50,150 500,40 Q950,150 950,470 L950,975 Z'
GOTHIC_IN = 'M76,949 L76,472 Q76,172 500,70 Q924,172 924,472 L924,949 Z'


def page(body, border, gothic=False):
    out_d, in_d = (GOTHIC_OUT, GOTHIC_IN) if gothic else (FRAME_OUT, FRAME_IN)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
<rect width="1000" height="1000" fill="#ffffff"/>
<path d="{out_d}" fill="{border}" stroke="#111" stroke-width="5"/>
<clipPath id="c"><path d="{in_d}"/></clipPath>
<g clip-path="url(#c)">{body}</g>
<path d="{in_d}" fill="none" stroke="#111" stroke-width="5"/>
</svg>'''


_clip_ids = [0]


def clipped(d, content):
    """Draw content only inside outline d (scales, weave, wool...), then the outline itself."""
    _clip_ids[0] += 1
    cid = f'k{_clip_ids[0]}'
    return f'<clipPath id="{cid}"><path d="{d}"/></clipPath><g clip-path="url(#{cid})">{content}</g>' + path(d)


def rect_d(x, y, w, h):
    return f'M{f(x)},{f(y)} h{f(w)} v{f(h)} h{f(-w)} Z'


def ellipse_d(cx, cy, rx, ry):
    return f'M{f(cx - rx)},{f(cy)} A{f(rx)},{f(ry)} 0 1 0 {f(cx + rx)},{f(cy)} A{f(rx)},{f(ry)} 0 1 0 {f(cx - rx)},{f(cy)} Z'


def star(cx, cy, r_out, r_in, n, fill, rot=-90):
    pts = []
    for i in range(n * 2):
        a = math.radians(rot + 180 * i / n)
        r = r_out if i % 2 == 0 else r_in
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return poly(pts, fill)


def waves(y0, bands, colours, amp=28, length=110):
    """Stacked wavy bands of water from y0 down to the bottom."""
    out = []
    for k in range(bands):
        y = y0 + k * 55
        shift = (k % 2) * length / 2
        d = f'M-120,{f(y)}'
        x = -120 + shift
        while x < 1120:
            d += f' Q{f(x + length / 2)},{f(y - amp)} {f(x + length)},{f(y)}'
            x += length
        d += ' L1120,1000 L-120,1000 Z'
        out.append(path(d, colours[k % len(colours)]))
    return ''.join(out)


def ring_band(cx, cy, r0, r1, fill):
    return path(f'M{f(cx - r1)},{f(cy)} A{f(r1)},{f(r1)} 0 0 1 {f(cx + r1)},{f(cy)} L{f(cx + r0)},{f(cy)} '
                f'A{f(r0)},{f(r0)} 0 0 0 {f(cx - r0)},{f(cy)} Z', fill)


def fish(cx, cy, L, body, scale_colours, tail, direction=1):
    x = lambda v: cx + direction * v
    nose, join = x(L / 2), x(-L * 0.32)
    d = (f'M{f(nose)},{f(cy)} Q{f(x(L * 0.05))},{f(cy - L * 0.34)} {f(join)},{f(cy)} '
         f'Q{f(x(L * 0.05))},{f(cy + L * 0.3)} {f(nose)},{f(cy)} Z')
    o = [poly([(x(-L * 0.2), cy - L * 0.12), (x(-L * 0.02), cy - L * 0.3), (x(L * 0.12), cy - L * 0.14)], tail)]
    o.append(poly([(x(-L * 0.3), cy), (x(-L * 0.58), cy - L * 0.2), (x(-L * 0.5), cy), (x(-L * 0.58), cy + L * 0.2)], tail))
    scales = []
    r = L * 0.065
    for row in range(-4, 5):
        for col in range(-6, 7):
            sx = cx + col * r * 1.5 + (row % 2) * r * 0.75
            sy = cy + row * r * 1.1
            scales.append(circle(sx, sy, r, scale_colours[(row + col) % len(scale_colours)]))
    o.append(path(d, body))
    o.append(clipped(d, ''.join(scales)))
    o.append(path(f'M{f(x(L * 0.3))},{f(cy - L * 0.2)} Q{f(x(L * 0.24))},{f(cy)} {f(x(L * 0.3))},{f(cy + L * 0.2)} '
                  f'Q{f(x(L * 0.5))},{f(cy)} {f(x(L * 0.3))},{f(cy - L * 0.2)} Z', body))
    o.append(circle(x(L * 0.37), cy - L * 0.05, L * 0.035, '#ffffff'))
    return ''.join(o)


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



# ---------------------------------------------------------------- faith

def sunrise_cross():
    rng = random.Random(21)
    o = [sunburst(500, 560, 32, ['#ffd29a', '#ffb870', '#ffe3b8'])]
    o.append(circle(500, 560, 215, '#ffe9a8'))
    o.append(circle(500, 560, 150, '#ffd45c'))
    for x, y in [(200, 260), (250, 300), (760, 230)]:
        o.append(path(f'M{x - 26},{y} Q{x - 13},{y - 16} {x},{y} Q{x + 13},{y - 16} {x + 26},{y}', 'none'))
    o.append(path('M0,700 Q250,600 500,680 T1000,650 L1000,1000 L0,1000 Z', '#a7d37f'))
    o.append(path('M0,780 Q300,700 600,770 T1000,740 L1000,1000 L0,1000 Z', '#7fbc62'))
    # wooden cross with grain
    grain_v = ''.join(path(f'M{x},190 Q{x + 8},400 {x},600 T{x},830', 'none', 'stroke-width="2.5"') for x in (489, 511))
    o.append(clipped(rect_d(468, 190, 64, 640), rect(468, 190, 64, 640, '#8b5a33') + grain_v))
    grain_h = ''.join(path(f'M340,{y} Q500,{y + 8} 660,{y}', 'none', 'stroke-width="2.5"') for y in (341, 361))
    o.append(clipped(rect_d(340, 320, 320, 62), rect(340, 320, 320, 62, '#9c6a3f') + grain_h))
    o.append(path('M0,860 Q250,790 500,840 T1000,820 L1000,1000 L0,1000 Z', '#5e9e4f'))
    # lilies
    for x, y, s in [(200, 850, 1.0), (800, 850, 1.0), (330, 915, 0.8), (670, 915, 0.8)]:
        o.append(line(x, y + 40 * s, x, 1000, 6))
        o.append(leaf(x, y + 90 * s, 70 * s, 200, '#6aa84f'))
        o.append(leaf(x, y + 110 * s, 70 * s, -20, '#88c06a'))
        o.append(flower(x, y, 50 * s, '#fdf6e3', '#f2c14e', n=6))
    for x in (90, 420, 580, 910):
        o.append(tuft(x, 1000, 70, '#4c8f3f', rng))
    return page(''.join(o), '#c9922e', gothic=True)


def dove():
    o = [rect(0, 0, 1000, 1000, '#cfe8fb'), sunburst(500, -40, 30, ['#cfe8fb', '#b7dcf7', '#e3f2fd'])]
    rng = random.Random(4)
    o.append(scallop(190, 330, 120, 55, 11, 16, '#f4f9ff', rng))
    o.append(scallop(830, 260, 110, 50, 10, 16, '#f4f9ff', rng))
    o.append(waves(770, 4, ['#4f9fd8', '#3b86c4', '#6bb6e6', '#2f6fa8']))
    # tail
    for i in range(5):
        a = math.radians(160 + i * 10)
        o.append(ellipse(390 + math.cos(a) * 80, 540 + math.sin(a) * 80, 80, 22, ['#eef1f6', '#dfe5ee'][i % 2], math.degrees(a)))
    # far wing
    for i in range(6):
        a = math.radians(-150 + i * 9)
        L = 170 - i * 8
        o.append(ellipse(470 + math.cos(a) * L / 2, 440 + math.sin(a) * L / 2, L / 2, 22, '#d7deea', math.degrees(a)))
    o.append(ellipse(520, 490, 175, 80, '#fbfcfe', -12))
    o.append(circle(665, 410, 58, '#fbfcfe'))
    # near wing: primaries, then coverts, then shoulder
    for i in range(7):
        a = math.radians(-160 + i * 9)
        L = 250 - i * 14
        o.append(ellipse(545 + math.cos(a) * L / 2, 450 + math.sin(a) * L / 2, L / 2, 25, ['#ffffff', '#eef3f9'][i % 2], math.degrees(a)))
    for i in range(6):
        a = math.radians(-150 + i * 11)
        o.append(ellipse(545 + math.cos(a) * 60, 450 + math.sin(a) * 60, 62, 23, '#f4f7fb', math.degrees(a)))
    o.append(ellipse(550, 455, 75, 42, '#fbfcfe', -10))
    o.append(poly([(715, 400), (760, 414), (715, 426)], '#f4a340'))
    o.append(circle(680, 398, 8, '#222222'))
    # olive branch
    o.append(path('M728,418 Q770,480 805,560', 'none', 'stroke-width="7"'))
    for k, (x, y) in enumerate([(742, 440), (758, 468), (774, 497), (790, 528)]):
        o.append(leaf(x, y, 58, 160 if k % 2 else 10, ['#7fa650', '#98bd68'][k % 2]))
    for x, y in [(768, 505), (752, 455)]:
        o.append(ellipse(x, y, 9, 13, '#3e6b35'))
    return page(''.join(o), '#3b86c4', gothic=True)


def noahs_ark():
    rng = random.Random(8)
    o = [rect(0, 0, 1000, 1000, '#d5ecf8')]
    colours = ['#ef5350', '#ffa726', '#ffee58', '#66bb6a', '#42a5f5', '#7e57c2']
    for i, c in enumerate(colours):
        o.append(ring_band(500, 660, 440 - (i + 1) * 45, 440 - i * 45, c))
    o.append(scallop(130, 640, 120, 60, 11, 18, '#ffffff', rng))
    o.append(scallop(870, 640, 120, 60, 11, 18, '#ffffff', rng))
    # giraffe peeking over the roof
    neck = rect_d(600, 280, 40, 260)
    spots = ''.join(circle(605 + (k % 2) * 28, 300 + k * 38, 13, '#c9822e') for k in range(7))
    o.append(clipped(neck, rect(600, 280, 40, 260, '#f2c14e') + spots))
    o.append(ellipse(640, 285, 48, 26, '#f2c14e', -15))
    o.append(ellipse(600, 262, 18, 9, '#f2c14e', -40))
    for dx in (0, 16):
        o.append(line(628 + dx, 262, 624 + dx, 232, 4))
        o.append(circle(624 + dx, 228, 7, '#8b5a33'))
    o.append(circle(655, 278, 5, '#222222'))
    # cabin and roof
    o.append(rect(320, 520, 360, 120, '#d9a066'))
    for x in (380, 455, 545, 620):
        o.append(circle(x, 575, 24, '#fbe7b5'))
    shingles = ''.join(path(f'M280,{y} L720,{y}', 'none', 'stroke-width="2.5"') for y in (465, 490, 512))
    roof = 'M300,528 L500,436 L700,528 Z'
    o.append(clipped(roof, path(roof, '#b5543c') + shingles))
    # hull with planks
    hull = 'M180,640 L820,640 Q780,780 700,790 L300,790 Q220,780 180,640 Z'
    planks = ''.join(path(f'M150,{y} L850,{y}', 'none', 'stroke-width="2.5"') for y in (675, 710, 745))
    planks += ''.join(line(x + (i % 2) * 60, y, x + (i % 2) * 60, y + 35, 2.5) for i, y in enumerate((640, 675, 710, 745)) for x in range(260, 760, 120))
    o.append(clipped(hull, path(hull, '#9a6236') + planks))
    o.append(rect(170, 625, 660, 20, '#7a4a28', 6))
    o.append(waves(800, 4, ['#4f9fd8', '#3b86c4', '#6bb6e6', '#2f6fa8'], amp=30, length=120))
    for x, y in [(220, 250), (270, 280), (800, 300)]:
        o.append(path(f'M{x - 24},{y} Q{x - 12},{y - 14} {x},{y} Q{x + 12},{y - 14} {x + 24},{y}', 'none'))
    return page(''.join(o), '#7e57c2', gothic=True)


def loaves_fishes():
    o = [sunburst(500, 600, 30, ['#fbe9c6', '#f6dcaa'])]
    # checked cloth
    for r in range(6):
        for c in range(15):
            o.append(rect(c * 70 - 20, 720 + r * 60, 70, 60, ['#e8b4a4', '#fbefe6'][(r + c) % 2]))
    # basket
    o.append(ellipse(500, 610, 300, 70, '#b97a3d'))
    body = 'M200,620 Q215,860 330,900 L670,900 Q785,860 800,620 Z'
    weave = ''.join(path(f'M150,{y} L850,{y}', 'none', 'stroke-width="2.5"') for y in range(650, 900, 40))
    weave += ''.join(line(x + (k % 2) * 40, y, x + (k % 2) * 40, y + 40, 2.5) for k, y in enumerate(range(610, 900, 40)) for x in range(170, 850, 80))
    o.append(clipped(body, path(body, '#d9a25f') + weave))
    # loaves
    for x, y, rx, ry in [(360, 580, 100, 58), (640, 580, 100, 58), (500, 560, 105, 62), (420, 625, 95, 50), (590, 628, 95, 50)]:
        d = ellipse_d(x, y, rx, ry)
        cuts = ''.join(path(f'M{x + dx - 18},{y - 30} Q{x + dx},{y} {x + dx + 18},{y + 30}', 'none', 'stroke-width="2.5"') for dx in (-40, 0, 40))
        o.append(clipped(d, path(d, '#e3a65b') + cuts))
    o.append(fish(360, 700, 300, '#8fb8d8', ['#a9cbe6', '#7ea9cc', '#c3dcef'], '#5f8fb8', 1))
    o.append(fish(650, 735, 290, '#9ec7a8', ['#b7d8bd', '#89b894', '#cfe6d2'], '#6a9f78', -1))
    return page(''.join(o), '#b97a3d', gothic=True)


def bethlehem():
    rng = random.Random(12)
    o = [sunburst(500, 250, 28, ['#1f2f5c', '#2a3d73'])]
    o.append(circle(500, 250, 115, '#3f5596'))
    o.append(star(500, 250, 120, 36, 8, '#ffd96a'))
    o.append(star(500, 250, 62, 20, 8, '#fff2b3'))
    for _ in range(14):
        x, y = rng.uniform(120, 880), rng.uniform(120, 560)
        if math.hypot(x - 500, y - 250) > 170:
            o.append(star(x, y, rng.uniform(14, 22), 7, 5, '#fff6d0'))
    o.append(path('M0,690 Q250,610 520,670 T1000,650 L1000,1000 L0,1000 Z', '#2e3f6e'))
    # town on the hill
    for x, y, w, h, roof in [(110, 600, 90, 110, 'tri'), (215, 620, 80, 90, 'dome'), (650, 600, 90, 100, 'tri'), (760, 585, 70, 120, 'dome'), (850, 615, 80, 90, 'tri')]:
        o.append(rect(x, y, w, h, '#44548a'))
        if roof == 'tri':
            o.append(poly([(x - 8, y), (x + w / 2, y - 45), (x + w + 8, y)], '#56669c'))
        else:
            o.append(path(f'M{x},{y} A{w / 2},{w / 2} 0 0 1 {x + w},{y} Z', '#56669c'))
        o.append(rect(x + w / 2 - 12, y + 25, 24, 30, '#ffcf6b', 4))
    # stable
    o.append(rect(0, 870, 1000, 130, '#24345f'))
    o.append(circle(500, 700, 150, '#fff1b8'))
    o.append(poly([(260, 610), (500, 470), (740, 610)], '#8a5a3b'))
    for x in (290, 690):
        o.append(rect(x, 600, 24, 290, '#6e4630'))
    o.append(rect(270, 600, 460, 22, '#6e4630'))
    o.append(poly([(400, 800), (600, 800), (570, 880), (430, 880)], '#a0703f'))
    for k in range(9):
        x = 410 + k * 22
        o.append(poly([(x, 802), (x + 11, 772 - (k % 3) * 8), (x + 22, 802)], '#f2c14e'))
    o.append(ellipse(500, 790, 60, 22, '#fbf5ea'))
    o.append(circle(470, 782, 18, '#f3d6b6'))
    return page(''.join(o), '#c9a227', gothic=True)


# ---------------------------------------------------------------- animals

def little_lamb():
    rng = random.Random(15)
    o = [sunburst(820, 200, 28, ['#d7eefc', '#e8f6ff'])]
    o.append(circle(820, 200, 75, '#ffd76a'))
    o.append(scallop(250, 220, 110, 45, 10, 14, '#ffffff', rng))
    o.append(path('M0,560 Q300,480 600,560 T1000,540 L1000,1000 L0,1000 Z', '#b4dc8a'))
    o.append(path('M0,700 Q300,640 650,700 T1000,690 L1000,1000 L0,1000 Z', '#8cc56a'))
    for x in (390, 440, 530, 580):
        o.append(rect(x, 640, 26, 170, '#4a3b35', 8))
        o.append(rect(x - 2, 800, 30, 22, '#2e2420', 6))
    body = 'M250,610 Q240,480 360,460 Q470,420 580,460 Q690,480 690,590 Q700,700 580,720 Q470,745 360,720 Q240,710 250,610 Z'
    curls = ''.join(circle(260 + c * 52 + (r % 2) * 26, 450 + r * 48, 27, ['#fbf8f1', '#f1ebdd'][(r + c) % 2]) for r in range(7) for c in range(9))
    o.append(clipped(body, path(body, '#fbf8f1') + curls))
    o.append(scallop(250, 600, 32, 28, 7, 8, '#fbf8f1', rng))
    o.append(ellipse(655, 500, 48, 18, '#4a3b35', 30))
    o.append(ellipse(745, 490, 48, 18, '#4a3b35', -30))
    o.append(ellipse(700, 540, 62, 78, '#4a3b35'))
    o.append(scallop(700, 470, 58, 32, 8, 10, '#fbf8f1', rng))
    for x in (678, 722):
        o.append(circle(x, 535, 13, '#ffffff'))
        o.append(circle(x + 2, 537, 6, '#1a1a1a'))
    o.append(ellipse(700, 585, 16, 10, '#e58a9a'))
    o.append(bed(40, 960, 880, 3, ['#f28fb5', '#f6d24a', '#b784d9', '#ffffff'], rng, 26))
    for x, y, c in [(180, 420, '#f6a6c1'), (860, 460, '#9fc5e8')]:
        o.append(ellipse(x - 18, y - 10, 20, 14, c, -30))
        o.append(ellipse(x + 18, y - 10, 20, 14, c, 30))
        o.append(ellipse(x - 14, y + 12, 14, 10, c, 30))
        o.append(ellipse(x + 14, y + 12, 14, 10, c, -30))
        o.append(ellipse(x, y, 5, 20, '#4a3b35'))
    return page(''.join(o), '#6a994e')


def ginger_kitty():
    rng = random.Random(6)
    o = [rect(0, 0, 1000, 1000, '#f6ead8')]
    for x in range(0, 1000, 80):
        o.append(rect(x, 0, 40, 1000, '#efdcc2'))
    # window with curtains
    o.append(rect(230, 130, 540, 360, '#cfe9f7'))
    o.append(scallop(420, 400, 170, 70, 12, 14, '#8cc56a', rng))
    o.append(scallop(640, 420, 150, 60, 12, 14, '#6aa84f', rng))
    o.append(line(500, 130, 500, 490, 8))
    o.append(line(230, 310, 770, 310, 8))
    o.append(rect(210, 480, 580, 30, '#c9925a', 6))
    for side in (-1, 1):
        x0 = 500 + side * 330
        o.append(path(f'M{x0},100 L{x0 - side * 120},100 Q{x0 - side * 60},300 {x0 - side * 130},520 L{x0},520 Z', '#e58ab8'))
        for k in (1, 2):
            xx = x0 - side * 35 * k
            o.append(path(f'M{xx},105 Q{xx - side * 15},300 {xx - side * 10},515', 'none', 'stroke-width="2.5"'))
    o.append(rect(80, 90, 840, 26, '#a0703f', 10))
    # cushion
    o.append(ellipse(500, 900, 320, 75, '#9b6fd6'))
    for k in range(7):
        o.append(poly([(260 + k * 80, 900), (300 + k * 80, 875), (340 + k * 80, 900), (300 + k * 80, 925)], '#c8a6ea'))
    # tail, body with stripes, chest
    o.append(path('M650,860 Q860,860 840,720 Q830,650 780,660 Q810,720 780,800 Q740,840 640,830 Z', '#f5a25d'))
    body = 'M320,880 Q300,640 400,560 Q500,510 600,560 Q700,640 680,880 Z'
    stripes = ''.join(path(f'M280,{y} Q500,{y - 40} 720,{y} L720,{y + 22} Q500,{y - 18} 280,{y + 22} Z', '#d9803f') for y in (640, 710, 780))
    o.append(clipped(body, path(body, '#f5a25d') + stripes))
    o.append(ellipse(500, 740, 85, 130, '#fff3e6'))
    for x in (430, 570):
        o.append(ellipse(x, 875, 55, 30, '#fff3e6'))
    # head
    for side in (-1, 1):
        o.append(poly([(500 + side * 70, 330), (500 + side * 135, 215), (500 + side * 150, 380)], '#f5a25d'))
        o.append(poly([(500 + side * 88, 330), (500 + side * 130, 250), (500 + side * 136, 360)], '#ffb3c6'))
    head = ellipse_d(500, 420, 165, 140)
    hstripes = ''.join(poly([(x - 12, 270), (x + 12, 270), (x, 345)], '#d9803f') for x in (465, 500, 535))
    o.append(clipped(head, path(head, '#f5a25d') + hstripes))
    o.append(ellipse(465, 480, 42, 32, '#fff3e6'))
    o.append(ellipse(535, 480, 42, 32, '#fff3e6'))
    for x in (435, 565):
        o.append(ellipse(x, 410, 32, 38, '#8bc34a'))
        o.append(ellipse(x, 412, 10, 30, '#1a1a1a'))
        o.append(circle(x + 10, 398, 6, '#ffffff'))
    o.append(poly([(485, 455), (515, 455), (500, 472)], '#ff7b9c'))
    for side in (-1, 1):
        for dy in (-8, 10):
            o.append(line(500 + side * 70, 475 + dy, 500 + side * 170, 465 + dy * 2.5, 2.5))
    # plant and yarn
    o.append(poly([(80, 760), (220, 760), (200, 900), (100, 900)], '#d0643b'))
    o.append(rect(70, 740, 160, 30, '#e07b52', 6))
    for k, a in enumerate(range(-150, -20, 22)):
        o.append(leaf(150, 745, 140, a, ['#6aa84f', '#88c06a'][k % 2]))
    yarn = ellipse_d(860, 880, 75, 75)
    strands = ''.join(path(f'M{780 + k * 22},820 Q{860},{880 + (k - 3) * 20} {800 + k * 22},960', 'none', 'stroke-width="2.5"') for k in range(7))
    o.append(clipped(yarn, path(yarn, '#4fa3d9') + strands))
    o.append(path('M800,920 Q720,960 640,940', 'none'))
    return page(''.join(o), '#d9803f')


def butterfly():
    rng = random.Random(10)
    o = [sunburst(500, 520, 36, ['#fdf2e4', '#f9e3c8'])]

    def wing(sign):
        mx = lambda x: 500 + sign * (x - 500)
        out = []
        upper = (f'M{f(mx(518))},460 C{f(mx(600))},230 {f(mx(870))},170 {f(mx(890))},320 '
                 f'C{f(mx(905))},440 {f(mx(760))},520 {f(mx(518))},500 Z')
        lower = (f'M{f(mx(518))},515 C{f(mx(720))},510 {f(mx(840))},640 {f(mx(770))},770 '
                 f'C{f(mx(700))},880 {f(mx(560))},760 {f(mx(518))},560 Z')
        for shape, fill, eye, edge in [(upper, '#f28f3b', (760, 330), [(620, 250), (720, 205), (830, 215), (885, 300), (860, 410), (760, 470)]),
                                       (lower, '#f6b44b', (690, 650), [(640, 540), (770, 600), (800, 690), (760, 780), (660, 790)])]:
            inner = ''.join(line(mx(520), 500, mx(x), y, 3) for x, y in edge)
            inner += ''.join(circle(mx(x + (500 - x) * 0.08), y + (500 - y) * 0.08, 22, '#fff4e0') for x, y in edge)
            ex, ey = eye
            inner += circle(mx(ex), ey, 62, '#ffd36b') + circle(mx(ex), ey, 38, '#7b3fa0') + circle(mx(ex), ey, 15, '#ffffff')
            out.append(clipped(shape, path(shape, fill) + inner))
        return ''.join(out)

    o.append(wing(1))
    o.append(wing(-1))
    o.append(ellipse(500, 530, 24, 125, '#4a3b35'))
    for k in range(5):
        o.append(line(480, 480 + k * 25, 520, 480 + k * 25, 2.5))
    o.append(circle(500, 395, 28, '#4a3b35'))
    for side in (-1, 1):
        o.append(path(f'M{500 + side * 10},372 Q{500 + side * 60},280 {500 + side * 110},250', 'none'))
        o.append(circle(500 + side * 112, 248, 12, '#4a3b35'))
    o.append(bed(40, 960, 900, 2, ['#f28fb5', '#b784d9', '#f6d24a', '#9fc5e8'], rng, 30))
    for x, a in [(120, -60), (200, -110), (800, -70), (880, -120)]:
        o.append(leaf(x, 880, 110, a, '#7fb069'))
    return page(''.join(o), '#7b3fa0')


SCENES = {
    'mushrooms': mushroom_garden,
    'wisteria': wisteria_path,
    'arbor': lantern_arbor,
    'poppies': poppy_garden,
    'tea': tea_garden,
    'cross': sunrise_cross,
    'dove': dove,
    'ark': noahs_ark,
    'loaves': loaves_fishes,
    'bethlehem': bethlehem,
    'lamb': little_lamb,
    'kitty': ginger_kitty,
    'butterfly': butterfly,
}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, fn in SCENES.items():
        with open(os.path.join(OUT, name + '.svg'), 'w') as fh:
            fh.write(fn())
        print('wrote', name)
