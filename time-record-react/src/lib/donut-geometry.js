/* ============================================================
   DONUT GEOMETRY  (ported from legacy app.js)
   ------------------------------------------------------------
   Requirements from the donut spec sheet: round corner joins;
   corner radius 0.25–0.4x the ring thickness; 2–4px gaps;
   uniform thickness; clean separation.

   `stroke-linecap="round"` cannot satisfy requirement 2 — its cap
   is always a half-thickness semicircle (0.5x), which overshoots
   the range and turns small slices into pills. Drawing each
   segment as an annular-sector path decouples the corner radius
   from the ring thickness and produces the flat radial end shown
   in the spec's detail diagram.
   ============================================================ */

/** Fraction of ring thickness used as the corner radius (spec: 0.25–0.4). */
export const DONUT_CORNER_RATIO = 0.32;

/** Visible separation between neighbouring segments, in px (spec: 2–4). */
export const DONUT_GAP = 3;

/**
 * Annular sector with independently rounded corners.
 *
 * @param {number} cx  centre x
 * @param {number} cy  centre y
 * @param {number} ri  inner radius
 * @param {number} ro  outer radius
 * @param {number} a0  start angle (radians)
 * @param {number} a1  end angle (radians)
 * @param {number} rc  requested corner radius
 */
export function donutSectorPath(cx, cy, ri, ro, a0, a1, rc) {
  const P = (rr, aa) => [cx + rr * Math.cos(aa), cy + rr * Math.sin(aa)];
  const f = (n) => n.toFixed(2);
  const span = a1 - a0;
  if (span <= 0) return '';

  // Full ring: two concentric circles wound in opposite directions.
  if (span >= 2 * Math.PI - 1e-6) {
    const [ox, oy] = P(ro, 0);
    const [oxb, oyb] = P(ro, Math.PI);
    const [ix, iy] = P(ri, 0);
    const [ixb, iyb] = P(ri, Math.PI);
    return 'M' + f(ox) + ' ' + f(oy)
      + 'A' + f(ro) + ' ' + f(ro) + ' 0 1 1 ' + f(oxb) + ' ' + f(oyb)
      + 'A' + f(ro) + ' ' + f(ro) + ' 0 1 1 ' + f(ox) + ' ' + f(oy) + 'Z'
      + 'M' + f(ix) + ' ' + f(iy)
      + 'A' + f(ri) + ' ' + f(ri) + ' 0 1 0 ' + f(ixb) + ' ' + f(iyb)
      + 'A' + f(ri) + ' ' + f(ri) + ' 0 1 0 ' + f(ix) + ' ' + f(iy) + 'Z';
  }

  // Clamp the corner radius so it can never exceed the sector it rounds.
  const maxRadial = (ro - ri) / 2;
  const maxAngular = (ro * Math.sin(span / 2)) / (1 + Math.sin(span / 2));
  const rr = Math.max(0, Math.min(rc, maxRadial, maxAngular));

  // Too small to round: plain annular sector.
  if (rr < 0.15) {
    const [o0x, o0y] = P(ro, a0);
    const [o1x, o1y] = P(ro, a1);
    const [i1x, i1y] = P(ri, a1);
    const [i0x, i0y] = P(ri, a0);
    const la = span > Math.PI ? 1 : 0;
    return 'M' + f(o0x) + ' ' + f(o0y)
      + 'A' + f(ro) + ' ' + f(ro) + ' 0 ' + la + ' 1 ' + f(o1x) + ' ' + f(o1y)
      + 'L' + f(i1x) + ' ' + f(i1y)
      + 'A' + f(ri) + ' ' + f(ri) + ' 0 ' + la + ' 0 ' + f(i0x) + ' ' + f(i0y) + 'Z';
  }

  const th = Math.asin(Math.min(1, rr / (ro - rr)));
  const ph = Math.asin(Math.min(1, rr / (ri + rr)));
  const ao = (ro - rr) * Math.cos(th);
  const ai = (ri + rr) * Math.cos(ph);
  const [p1x, p1y] = P(ro, a0 + th);
  const [p2x, p2y] = P(ro, a1 - th);
  const [p3x, p3y] = P(ao, a1);
  const [p4x, p4y] = P(ai, a1);
  const [p5x, p5y] = P(ri, a1 - ph);
  const [p6x, p6y] = P(ri, a0 + ph);
  const [p7x, p7y] = P(ai, a0);
  const [p8x, p8y] = P(ao, a0);
  const laO = (a1 - th) - (a0 + th) > Math.PI ? 1 : 0;
  const laI = (a1 - ph) - (a0 + ph) > Math.PI ? 1 : 0;

  return 'M' + f(p1x) + ' ' + f(p1y)
    + 'A' + f(ro) + ' ' + f(ro) + ' 0 ' + laO + ' 1 ' + f(p2x) + ' ' + f(p2y)
    + 'A' + f(rr) + ' ' + f(rr) + ' 0 0 1 ' + f(p3x) + ' ' + f(p3y)
    + 'L' + f(p4x) + ' ' + f(p4y)
    + 'A' + f(rr) + ' ' + f(rr) + ' 0 0 1 ' + f(p5x) + ' ' + f(p5y)
    + 'A' + f(ri) + ' ' + f(ri) + ' 0 ' + laI + ' 0 ' + f(p6x) + ' ' + f(p6y)
    + 'A' + f(rr) + ' ' + f(rr) + ' 0 0 1 ' + f(p7x) + ' ' + f(p7y)
    + 'L' + f(p8x) + ' ' + f(p8y)
    + 'A' + f(rr) + ' ' + f(rr) + ' 0 0 1 ' + f(p1x) + ' ' + f(p1y) + 'Z';
}

/**
 * Guarantee every visible slice enough arc to draw its corners plus the gap,
 * taking the space proportionally from slices that can spare it. Keeps the
 * ring thickness uniform instead of thinning small slices.
 */
export function donutAllocateArcs(values, C, minArc) {
  const total = values.reduce((s, v) => s + v, 0);
  if (total <= 0) return values.map(() => 0);
  const arcs = values.map((v) => (v / total) * C);
  if (values.length < 2) return arcs;
  const short = arcs.filter((a) => a < minArc);
  if (!short.length || short.length === arcs.length) return arcs;
  const deficit = short.reduce((s, a) => s + (minArc - a), 0);
  const spare = arcs.reduce((s, a) => s + (a > minArc ? a - minArc : 0), 0);
  if (spare <= deficit) return arcs;
  const ratio = deficit / spare;
  return arcs.map((a) => (a < minArc ? minArc : a - (a - minArc) * ratio));
}

/**
 * Turn a list of values into ready-to-draw sector angles.
 *
 * Selection widens a segment by `selectedGrow` px, so the arc budget is
 * computed against the widest a segment can get — selecting one must never
 * make its neighbours collide.
 */
export function buildDonutSectors(values, {
  radius, thickness, gap = DONUT_GAP, selectedGrow = 6,
}) {
  const C = 2 * Math.PI * radius;
  const maxStroke = thickness + selectedGrow;
  const corner = thickness * DONUT_CORNER_RATIO;
  const minArc = 2 * corner + gap + 1;
  const arcs = donutAllocateArcs(values, C, minArc);
  const multi = values.length > 1;
  const inset = multi ? (gap / 2) / radius : 0;

  const out = [];
  let cursor = 0;
  arcs.forEach((arc) => {
    const a0 = ((cursor / C) * 2 * Math.PI) - Math.PI / 2 + inset;
    const a1 = (((cursor + arc) / C) * 2 * Math.PI) - Math.PI / 2 - inset;
    out.push({ a0, a1, arc, start: cursor, valid: a1 > a0 });
    cursor += arc;
  });
  return { sectors: out, C, maxStroke };
}
