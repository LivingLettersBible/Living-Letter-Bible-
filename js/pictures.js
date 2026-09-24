/*
 * Built-in coloring pages.
 *
 * Each picture is drawn onto a grid with a tiny shape DSL (rect, circle,
 * ellipse, poly, line, ...). Shapes are tested against cell centres, so a
 * picture is just a list of shapes painted back to front. Unused palette
 * entries are dropped automatically, and every cell becomes a numbered cell.
 */
(function () {
  function inPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function segDist(px, py, x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / len2)) : 0;
    return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
  }

  function art(id, title, category, size, palette, draw) {
    const w = size;
    const h = size;
    const g = new Uint8Array(w * h);
    const where = (test, c) => {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (test(x + 0.5, y + 0.5, x, y)) g[y * w + x] = c;
        }
      }
    };
    const api = {
      w,
      h,
      fill: (c) => g.fill(c),
      where,
      rect: (x, y, rw, rh, c) => where((px, py) => px >= x && px < x + rw && py >= y && py < y + rh, c),
      circle: (x, y, r, c) => where((px, py) => (px - x) ** 2 + (py - y) ** 2 <= r * r, c),
      ellipse: (x, y, rx, ry, c) => where((px, py) => ((px - x) / rx) ** 2 + ((py - y) / ry) ** 2 <= 1, c),
      ring: (x, y, r0, r1, c, upperHalf) =>
        where((px, py) => {
          const d = Math.hypot(px - x, py - y);
          return d >= r0 && d < r1 && (!upperHalf || py <= y);
        }, c),
      poly: (pts, c) => where((px, py) => inPoly(px, py, pts), c),
      line: (x0, y0, x1, y1, t, c) => where((px, py) => segDist(px, py, x0, y0, x1, y1) <= t / 2, c),
      px: (x, y, c) => {
        if (x >= 0 && y >= 0 && x < w && y < h) g[y * w + x] = c;
      },
    };
    draw(api);

    const used = [...new Set(g)].sort((a, b) => a - b);
    const remap = new Map(used.map((u, i) => [u, i]));
    return {
      id,
      title,
      category,
      w,
      h,
      palette: used.map((u) => palette[u]),
      cells: Array.from(g, (v) => remap.get(v)),
    };
  }

  const heart = (px, py, cx, cy, s) => {
    const u = (px - cx) / s;
    const v = -(py - cy) / s;
    return (u * u + v * v - 1) ** 3 - u * u * v * v * v <= 0;
  };

  window.PICTURES = [
    art('sunrise-cross', 'Sunrise Cross', 'Faith', 32,
      ['#ffe2b8', '#ffb36b', '#ff8a5c', '#ffe066', '#7cc47f', '#3f8f4f', '#6b3f22', '#fff4d6'],
      (d) => {
        d.rect(0, 0, 32, 9, 2);
        d.rect(0, 9, 32, 8, 1);
        d.rect(0, 17, 32, 15, 0);
        d.circle(16, 22, 10, 7);
        d.circle(16, 22, 6.5, 3);
        d.ellipse(6, 33, 16, 9, 4);
        d.ellipse(27, 34, 15, 9, 4);
        d.rect(15, 5, 2, 22, 6);
        d.rect(10, 10, 12, 2, 6);
        d.ellipse(16, 38, 24, 12, 5);
      }),

    art('dove', 'Dove of Peace', 'Faith', 32,
      ['#bfe3ff', '#9fd3f7', '#ffffff', '#d5dbe6', '#f4a340', '#2b2b2b', '#7a5a2a', '#6aa84f', '#3d7a34', '#eef7ff'],
      (d) => {
        d.fill(0);
        d.rect(0, 22, 32, 10, 1);
        [[6, 26, 3], [9, 25, 4], [13, 27, 3], [26, 6, 3], [29, 5, 3]].forEach(([x, y, r]) => d.circle(x, y, r, 9));
        d.poly([[9, 17], [2, 12], [1, 18], [3, 21]], 3);
        d.ellipse(15, 17, 8, 4.5, 2);
        d.circle(22, 13, 3.5, 2);
        d.poly([[10, 16], [13, 4], [18, 3], [19, 15]], 2);
        d.poly([[13, 15], [15, 7], [17, 6], [17, 15]], 3);
        d.poly([[25, 12.5], [29, 13.5], [25, 14.5]], 4);
        d.px(23, 12, 5);
        d.line(27, 14, 28, 25, 1, 6);
        d.ellipse(25.5, 17, 1.8, 1, 7);
        d.ellipse(29.5, 18.5, 1.8, 1, 8);
        d.ellipse(25.5, 21, 1.8, 1, 8);
        d.ellipse(29.5, 22.5, 1.8, 1, 7);
      }),

    art('rainbow-ark', "Noah's Rainbow", 'Faith', 32,
      ['#cdeeff', '#ef5350', '#ffa726', '#ffee58', '#66bb6a', '#42a5f5', '#7e57c2', '#ffffff', '#2f7fc1', '#6fb7ea', '#8d5a33', '#5e3a1f', '#e0b27a'],
      (d) => {
        d.fill(0);
        const bands = [15.5, 14, 12.5, 11, 9.5, 8, 6.5];
        for (let i = 0; i < 6; i++) d.ring(16, 22, bands[i + 1], bands[i], i + 1, true);
        [[3, 21, 3], [6, 20, 3.5], [1, 23, 2], [29, 21, 3], [26, 20, 3.5], [31, 23, 2]].forEach(([x, y, r]) => d.circle(x, y, r, 7));
        d.rect(0, 25, 32, 7, 8);
        d.where((px, py, x, y) => (y === 27 && x % 6 < 3) || (y === 30 && (x + 3) % 6 < 3), 9);
        d.poly([[6, 22], [26, 22], [22.5, 27.5], [9.5, 27.5]], 10);
        d.rect(11, 18, 10, 4, 12);
        d.poly([[9.5, 18], [16, 14.5], [22.5, 18]], 11);
        [13, 15, 17, 19].forEach((x) => d.px(x, 19, 11));
      }),

    art('ichthys', 'Ichthys Fish', 'Faith', 32,
      ['#0d4f8b', '#1a73b8', '#2d9cdb', '#ffb74d', '#ffe0b2', '#ffffff', '#1b1b1b', '#b3e5fc', '#e8c98a', '#2e9e5b', '#f57c00'],
      (d) => {
        d.rect(0, 0, 32, 10, 2);
        d.rect(0, 10, 32, 10, 1);
        d.rect(0, 20, 32, 12, 0);
        d.where((px, py) => py > 19 && Math.abs(px - (4 + Math.sin(py * 0.7))) < 0.9, 9);
        d.where((px, py) => py > 21 && Math.abs(px - (28 + Math.sin(py * 0.7 + 1))) < 0.9, 9);
        d.ellipse(16, 36, 22, 7, 8);
        const inBody = (px, py) => (px - 15) ** 2 + (py - 10.5) ** 2 <= 81 && (px - 15) ** 2 + (py - 21.5) ** 2 <= 81;
        d.poly([[13, 13], [16, 9.5], [18, 13]], 10);
        d.where(inBody, 3);
        d.where((px, py) => inBody(px, py) && py > 16.5, 4);
        d.poly([[9, 16], [3, 11], [4.5, 16], [3, 21]], 10);
        d.circle(19, 14.5, 1.2, 5);
        d.px(19, 14, 6);
        [[25, 10, 1.2], [27, 6, 1], [24, 4, 0.8]].forEach(([x, y, r]) => d.circle(x, y, r, 7));
      }),

    art('bethlehem', 'Star of Bethlehem', 'Faith', 32,
      ['#14213d', '#1f3163', '#ffe066', '#fff6c2', '#ffffff', '#0b1426', '#ffb703', '#2b3a66'],
      (d) => {
        d.rect(0, 0, 32, 14, 0);
        d.rect(0, 14, 32, 18, 1);
        d.circle(16, 8, 4.5, 3);
        d.poly([[16, 1], [17.5, 6.5], [23, 8], [17.5, 9.5], [16, 17], [14.5, 9.5], [9, 8], [14.5, 6.5]], 2);
        [[3, 3], [7, 10], [26, 3], [29, 11], [22, 14], [5, 16], [11, 2], [28, 18]].forEach(([x, y]) => d.px(x, y, 4));
        d.ellipse(8, 34, 16, 8, 7);
        d.ellipse(26, 35, 14, 8, 7);
        d.rect(4, 23, 5, 9, 5);
        d.poly([[3.5, 23], [6.5, 20], [9.5, 23]], 5);
        d.rect(11, 25, 6, 7, 5);
        d.circle(14, 25, 3, 5);
        d.rect(19, 22, 4, 10, 5);
        d.rect(24, 24, 6, 8, 5);
        d.poly([[23.5, 24], [27, 21.5], [30.5, 24]], 5);
        [[6, 26], [13, 28], [20, 25], [21, 28], [26, 27], [28, 27]].forEach(([x, y]) => d.px(x, y, 6));
      }),

    art('lamb', 'Little Lamb', 'Animals', 32,
      ['#bde6ff', '#8bc34a', '#5f9e2f', '#fdfbf5', '#e3dccb', '#4a3b35', '#ffffff', '#3b2f2a', '#ffd54f', '#f48fb1', '#eef8ff'],
      (d) => {
        d.fill(0);
        d.circle(27, 5, 3.5, 8);
        [[5, 6, 2.5], [8, 5, 3], [11, 6, 2.5]].forEach(([x, y, r]) => d.circle(x, y, r, 10));
        d.rect(0, 22, 32, 10, 1);
        d.where((px, py, x, y) => y >= 23 && (x * 7 + y * 3) % 9 === 0, 2);
        [[10, 20], [14, 21], [18, 21], [22, 20]].forEach(([x, y]) => d.rect(x, y, 2, 27 - y, 7));
        [[11, 17, 4.5], [16, 15, 5], [21, 17, 4.5], [16, 19, 4.5]].forEach(([x, y, r]) => d.circle(x, y, r, 3));
        d.circle(13, 20, 2, 4);
        d.circle(19, 20.5, 1.6, 4);
        d.ellipse(21.5, 10.5, 1.8, 1.1, 5);
        d.ellipse(28.5, 10.5, 1.8, 1.1, 5);
        d.ellipse(25, 12.5, 3, 3.8, 5);
        d.circle(25, 8.8, 2.2, 3);
        d.px(24, 12, 6);
        d.px(26, 12, 6);
        [[4, 27], [29, 29], [7, 30]].forEach(([x, y]) => d.circle(x, y, 1, 9));
      }),

    art('kitty', 'Ginger Kitty', 'Animals', 32,
      ['#e6f4ea', '#f5a25d', '#ffd7b0', '#d2733a', '#2f2f2f', '#ffffff', '#ff7b9c', '#ffb3c6', '#bfe3c9'],
      (d) => {
        d.fill(0);
        d.where((px, py, x, y) => (x + y) % 8 === 0, 8);
        d.poly([[5, 15], [8, 3], [15, 9]], 1);
        d.poly([[27, 15], [24, 3], [17, 9]], 1);
        d.poly([[8, 12], [9, 6], [13, 9.5]], 7);
        d.poly([[24, 12], [23, 6], [19, 9.5]], 7);
        d.ellipse(16, 18.5, 11, 10, 1);
        d.rect(15, 8.5, 2, 3.5, 3);
        d.line(12, 9.5, 13, 12, 1, 3);
        d.line(20, 9.5, 19, 12, 1, 3);
        d.line(5.5, 17, 8.5, 18, 1, 3);
        d.line(5.5, 20.5, 8.5, 20.5, 1, 3);
        d.line(26.5, 17, 23.5, 18, 1, 3);
        d.line(26.5, 20.5, 23.5, 20.5, 1, 3);
        d.ellipse(13.5, 23, 3, 2.5, 2);
        d.ellipse(18.5, 23, 3, 2.5, 2);
        d.ellipse(11, 16.5, 2, 2.6, 5);
        d.ellipse(21, 16.5, 2, 2.6, 5);
        d.ellipse(11, 17, 1, 1.8, 4);
        d.ellipse(21, 17, 1, 1.8, 4);
        d.poly([[14.5, 20.5], [17.5, 20.5], [16, 22.3]], 6);
      }),

    art('heart', 'Heart Bloom', 'Love', 32,
      ['#fff0f4', '#ffd1dc', '#e53957', '#ff6f8a', '#ffc2cf', '#a81d3a'],
      (d) => {
        d.fill(0);
        d.where((px, py, x, y) => (x % 6 === 1 && y % 6 === 1) || (x % 6 === 4 && y % 6 === 4), 1);
        d.where((px, py) => heart(px, py, 16, 17, 12.5), 5);
        d.where((px, py) => heart(px, py, 16, 17, 11), 2);
        d.where((px, py) => heart(px, py, 16, 17, 11) && px + py < 23, 3);
        d.ellipse(10.5, 10, 2.5, 1.6, 4);
      }),

    art('sunflower', 'Sunflower', 'Nature', 32,
      ['#a7dbff', '#ffc928', '#f59f00', '#6d4c2f', '#3e2a1a', '#3f9b4b', '#62c370', '#8d6e4f', '#ffffff'],
      (d) => {
        d.fill(0);
        [[4, 5, 2.5], [7, 4, 3], [26, 26, 2.5], [29, 25, 3]].forEach(([x, y, r]) => d.circle(x, y, r, 8));
        d.rect(15, 18, 2, 14, 5);
        d.ellipse(11, 25, 4, 1.8, 6);
        d.ellipse(21, 22, 4, 1.8, 6);
        for (let i = 0; i < 12; i++) {
          const a = (i * Math.PI) / 6;
          d.circle(16 + Math.cos(a) * 6.8, 12 + Math.sin(a) * 6.8, 2.8, i % 2 ? 2 : 1);
        }
        d.circle(16, 12, 4.6, 3);
        d.where((px, py, x, y) => (px - 16) ** 2 + (py - 12) ** 2 <= 14 && (x + y) % 2 === 0, 4);
        d.rect(0, 30, 32, 2, 7);
      }),

    art('balloon', 'Hot Air Balloon', 'Nature', 32,
      ['#d6f0ff', '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#a0643b', '#5a3b22', '#ffffff'],
      (d) => {
        d.fill(0);
        [[5, 24, 3], [8, 23, 3.5], [11, 25, 2.5], [25, 6, 2.5], [28, 5, 3]].forEach(([x, y, r]) => d.circle(x, y, r, 7));
        const hw = (py) => (py <= 15 ? 9 * Math.sqrt(Math.max(0, 1 - ((py - 12) / 10) ** 2)) : 8.59 + ((3 - 8.59) * (py - 15)) / 9);
        const stripes = [1, 2, 4, 2, 1];
        for (let k = 0; k < 5; k++) {
          d.where((px, py) => {
            if (py < 2 || py > 24) return false;
            const h = hw(py);
            if (Math.abs(px - 16) > h) return false;
            return Math.min(4, Math.floor(((px - 16) / h) * 2.5 + 2.5)) === k;
          }, stripes[k]);
        }
        d.where((px, py) => py > 11 && py < 13.2 && Math.abs(px - 16) <= hw(py), 3);
        d.line(13, 24, 14, 27, 0.6, 6);
        d.line(19, 24, 18, 27, 0.6, 6);
        d.rect(13.5, 27, 5, 3.5, 5);
      }),

    art('tulips', 'Tulip Garden', 'Nature', 32,
      ['#fff7e0', '#e63946', '#9d4edd', '#ff8fab', '#2d6a4f', '#52b788', '#7f5539', '#ffd166'],
      (d) => {
        d.fill(0);
        d.circle(28, 4, 2.5, 7);
        const tulips = [[7, 11, 1], [16, 8, 2], [25, 12, 3]];
        tulips.forEach(([cx, cy]) => d.line(cx, cy + 2, cx, 30, 1.2, 4));
        tulips.forEach(([cx]) => {
          d.ellipse(cx - 2.2, 24, 1.3, 4, 5);
          d.ellipse(cx + 2.2, 25, 1.3, 3.5, 5);
        });
        tulips.forEach(([cx, cy, c]) => {
          d.ellipse(cx, cy, 3.2, 3.2, c);
          d.poly([[cx - 3.2, cy], [cx - 3.2, cy - 5], [cx - 1, cy - 2.5], [cx, cy - 5.5], [cx + 1, cy - 2.5], [cx + 3.2, cy - 5], [cx + 3.2, cy]], c);
        });
        d.rect(0, 29, 32, 3, 6);
      }),

    art('mountain-lake', 'Mountain Lake', 'Nature', 32,
      ['#ffb997', '#f67e7d', '#ffe8a3', '#843b62', '#621940', '#ffffff', '#f6a6a0', '#c06c84', '#2e1a2e'],
      (d) => {
        d.rect(0, 0, 32, 8, 1);
        d.rect(0, 8, 32, 12, 0);
        d.circle(22, 15, 4, 2);
        d.poly([[0, 20], [8, 8], [14, 14], [20, 6], [32, 20]], 3);
        d.poly([[20, 6], [17.75, 9], [19, 8.3], [20, 9.4], [21.5, 8.4], [22.6, 9]], 5);
        d.poly([[0, 20], [5, 13], [11, 20]], 4);
        d.poly([[22, 20], [28, 12], [32, 16], [32, 20]], 4);
        d.rect(0, 20, 32, 12, 7);
        d.where((px, py, x, y) => (y === 23 || y === 26 || y === 29) && (x + y) % 5 < 3, 6);
        d.ellipse(22, 21.5, 3, 0.9, 2);
        d.poly([[1, 31.5], [3.5, 23], [6, 31.5]], 8);
        d.poly([[5, 32], [7.5, 26], [10, 32]], 8);
      }),
  ];
})();
