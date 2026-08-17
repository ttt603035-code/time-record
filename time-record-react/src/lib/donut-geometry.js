/* ============================================================
   DONUT GEOMETRY
   ------------------------------------------------------------
   Implements the Donut Chart spec sheet:

     1. round (not butt/miter) corner joins
     2. corner radius = 0.25–0.4x the ring thickness
     3. 2–4px gap between neighbouring segments
     4. uniform ring thickness
     5. clearly separated segments with soft edges
     6. iOS-native feel: clean, soft, precise

   Why a path instead of `stroke-linecap="round"`:
   a round line cap is always a half-thickness semicircle (0.5x),
   which overshoots requirement 2 and turns small slices into
   pills. Drawing the annular sector as a real path lets the
   corner radius be set independently of the ring thickness, and
   gives the flat radial end shown in the spec's detail diagram.
   ============================================================ */

/** Corner radius as a fraction of ring thickness (spec: 0.25–0.4). */
export const CORNER_RATIO = 0.32;

/** Visible separation between neighbouring segments, in px (spec: 2–4). */
export const SEGMENT_GAP = 3;

/**
 * Build an annular-sector path with four rounded corners.
 *
 * @param {number} cx  centre x
 * @param {number} cy  centre y
 * @param {number} ri  inner radius
 * @param {number} ro  outer radius
 * @param {number} a0  start angle (radians)
 * @param {number} a1  end angle (radians)
 * @param {number} rc  requested corner radius (clamped to fit)
 * @returns {string}   SVG path data
 */
export function sectorPath(cx, cy, ri, ro, a0, a1, rc) {
  const P = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const f = (n) => n.toFixed(2);

  const span = a1 - a0;
  if (span <= 0) return '';

  // A full ring has no ends to round — emit two arcs instead, otherwise the
  // start and end corners would collapse onto each other.
  if (span >= 2 * Math.PI - 1e-6) {
    const [ox, oy] = P(ro, 0);
    const [oxb, oyb] = P(ro, Math.PI);
    const [ix, iy] = P(ri, 0);
    const [ixb, iyb] = P(ri, Math.PI);
    return `M${f(ox)} ${f(oy)}`
      + `A${f(ro)} ${f(ro)} 0 1 1 ${f(oxb)} ${f(oyb)}`
      + `A${f(ro)} ${f(ro)} 0 1 1 ${f(ox)} ${f(oy)}Z`
      + `M${f(ix)} ${f(iy)}`
      + `A${f(ri)} ${f(ri)} 0 1 0 ${f(ixb)} ${f(iyb)}`
      + `A${f(ri)} ${f(ri)} 0 1 0 ${f(ix)} ${f(iy)}Z`;
  }

  // Clamp the corner radius so opposing corners never cross: it must fit both
  // radially (half the thickness) and angularly (half the sector's sweep).
  const maxRadial = (ro - ri) / 2;
  const maxAngular = (ro * Math.sin(span / 2)) / (1 + Math.sin(span / 2));
  const r = Math.max(0, Math.min(rc, maxRadial, maxAngular));

  if (r < 0.15) {
    // Too small to round meaningfully — draw a plain sector.
    const [o0x, o0y] = P(ro, a0);
    const [o1x, o1y] = P(ro, a1);
    const [i1x, i1y] = P(ri, a1);
    const [i0x, i0y] = P(ri, a0);
    const la = span > Math.PI ? 1 : 0;
    return `M${f(o0x)} ${f(o0y)}`
      + `A${f(ro)} ${f(ro)} 0 ${la} 1 ${f(o1x)} ${f(o1y)}`
      + `L${f(i1x)} ${f(i1y)}`
      + `A${f(ri)} ${f(ri)} 0 ${la} 0 ${f(i0x)} ${f(i0y)}Z`;
  }

  // Angular inset of each corner's tangent point, and the radius at which the
  // corner meets the flat radial edge.
  const th = Math.asin(Math.min(1, r / (ro - r)));
  const ph = Math.asin(Math.min(1, r / (ri + r)));
  const ao = (ro - r) * Math.cos(th);
  const ai = (ri + r) * Math.cos(ph);

  const [p1x, p1y] = P(ro, a0 + th);
  const [p2x, p2y] = P(ro, a1 - th);
  const [p3x, p3y] = P(ao, a1);
  const [p4x, p4y] = P(ai, a1);
  const [p5x, p5y] = P(ri, a1 - ph);
  const [p6x, p6y] = P(ri, a0 + ph);
  const [p7x, p7y] = P(ai, a0);
  const [p8x, p8y] = P(ao, a0);

  const laOuter = (a1 - th) - (a0 + th) > Math.PI ? 1 : 0;
  const laInner = (a1 - ph) - (a0 + ph) > Math.PI ? 1 : 0;

  return `M${f(p1x)} ${f(p1y)}`
    + `A${f(ro)} ${f(ro)} 0 ${laOuter} 1 ${f(p2x)} ${f(p2y)}` // outer arc
    + `A${f(r)} ${f(r)} 0 0 1 ${f(p3x)} ${f(p3y)}`            // corner
    + `L${f(p4x)} ${f(p4y)}`                                  // flat radial end
    + `A${f(r)} ${f(r)} 0 0 1 ${f(p5x)} ${f(p5y)}`            // corner
    + `A${f(ri)} ${f(ri)} 0 ${laInner} 0 ${f(p6x)} ${f(p6y)}` // inner arc
    + `A${f(r)} ${f(r)} 0 0 1 ${f(p7x)} ${f(p7y)}`            // corner
    + `L${f(p8x)} ${f(p8y)}`                                  // flat radial end
    + `A${f(r)} ${f(r)} 0 0 1 ${f(p1x)} ${f(p1y)}Z`;          // corner
}

/**
 * Allocate arc lengths so every visible slice can render its rounded corners
 * and still leave the required gap.
 *
 * A slice needs roughly (2 * corner radius + gap) of arc before its two
 * corners meet. Slices below that minimum are topped up, and the space is
 * taken proportionally from the slices that can spare it — keeping the ring
 * thickness uniform (requirement 4) instead of thinning small slices.
 *
 * @param {number[]} values   raw values, one per segment
 * @param {number}   C        centreline circumference
 * @param {number}   minArc   minimum arc length per visible segment
 * @returns {number[]}        arc length per segment (sums to C)
 */
export function allocateArcs(values, C, minArc) {
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
