/* ============================================================
   Glass UI — Liquid Glass controls for the legacy app
   ------------------------------------------------------------
   Vanilla port of the shadcn glass components adopted in
   time-record-react (websiteglass `glass-tabs` + `@glasscn`
   `glass-toggle-group` / `liquid-glass`). No dependencies.

   Two controls:
   • Bottom tab bar (.tabbar-capsule) — the frosted capsule
     refracts the page scrolling behind it (Chromium only;
     other engines fall back to the plain frosted blur) and the
     white capsule glides between tabs with spring physics,
     deforming like a droplet while travelling.
   • Insights Day/Week/Month/Year (.insights-seg) — same frosted
     capsule with a spring-animated glass puck.

   The legacy markup is untouched: this script adopts the
   existing .tab-item / .seg-btn buttons and the existing
   #tabIndicator element (which becomes the droplet). It runs
   before, after or without app.js — with JS disabled the
   original stylesheet still shows the old controls.
   ============================================================ */
(function () {
  'use strict';
  if (typeof document === 'undefined' || window.GlassUI) return;

  /* ── motion core (ported from components/ui/glass-motion.js) ── */

  const VELOCITY_RESET_MS = 80;

  class MotionValue {
    constructor(initial) {
      this.current = initial;
      this.prevTime = 0;
      this.velocityValue = 0;
      this.subs = new Set();
      this.cancelFn = null;
    }
    get() { return this.current; }
    getVelocity() {
      if (performance.now() - this.prevTime > VELOCITY_RESET_MS) return 0;
      return this.velocityValue;
    }
    set(next, timestamp) {
      timestamp = timestamp == null ? performance.now() : timestamp;
      const elapsed = timestamp - this.prevTime;
      if (elapsed > VELOCITY_RESET_MS) this.velocityValue = 0;
      else if (elapsed > 0) {
        const dt = Math.min(Math.max(elapsed, 8), 30);
        this.velocityValue = ((next - this.current) / dt) * 1000;
      }
      this.prevTime = timestamp;
      this.current = next;
      for (const fn of this.subs) fn(next);
    }
    jump(next) {
      this.stop();
      this.velocityValue = 0;
      this.prevTime = performance.now();
      this.current = next;
      for (const fn of this.subs) fn(next);
    }
    on(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
    setCancel(fn) { this.cancelFn = fn; }
    stop() { if (this.cancelFn) this.cancelFn(); this.cancelFn = null; }
  }

  class SpringDriver {
    constructor(value, options, getTarget, canRest) {
      this.value = value;
      this.options = options;
      this.getTarget = getTarget;
      this.canRest = canRest || function () { return true; };
      this.restDelta = options.restDelta != null ? options.restDelta : 5e-4;
      this.restSpeed = options.restSpeed != null ? options.restSpeed : 0.005;
      this.vel = 0;
      this.raf = 0;
      this.last = 0;
      this.running = false;
    }
    start() {
      if (this.running) return;
      this.value.stop();
      this.value.setCancel(() => this.stop());
      this.running = true;
      this.last = performance.now();
      const step = (now) => {
        if (!this.running) return;
        const dt = Math.min((now - this.last) / 1000, 0.033);
        this.last = now;
        const target = this.getTarget();
        const x = this.value.get();
        const accel =
          -this.options.stiffness * (x - target) - this.options.damping * this.vel;
        this.vel += accel * dt;
        const next = x + this.vel * dt;
        this.value.set(next, now);
        const settled =
          Math.abs(next - target) < this.restDelta &&
          Math.abs(this.vel) < this.restSpeed;
        if (settled && this.canRest()) {
          this.running = false;
          this.vel = 0;
          this.value.setCancel(null);
          this.value.set(target, now);
          if (this.options.onSettle) this.options.onSettle();
          return;
        }
        this.raf = requestAnimationFrame(step);
      };
      this.raf = requestAnimationFrame(step);
    }
    stop() {
      this.running = false;
      this.vel = 0;
      cancelAnimationFrame(this.raf);
    }
  }

  function prefersReducedMotion() {
    return typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ── liquid glass displacement map
        (ported from components/ui/glasscn/liquid-glass.jsx) ── */

  const MAX_TEXTURE_SIZE = 480;
  const EDGE_TAPER_PX = 1.25;
  const mapCache = new Map();

  function convexSquircle(x) {
    return Math.pow(1 - Math.pow(1 - x, 4), 0.25);
  }

  function createDisplacementMap(o) {
    const key = o.width + ':' + o.height + ':' + o.radius + ':' + o.bezel;
    if (mapCache.has(key)) return mapCache.get(key);

    const downscale = Math.min(1, MAX_TEXTURE_SIZE / Math.max(o.width, o.height));
    const texW = Math.max(2, Math.round(o.width * downscale));
    const texH = Math.max(2, Math.round(o.height * downscale));

    const canvas = document.createElement('canvas');
    canvas.width = texW;
    canvas.height = texH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const image = ctx.createImageData(texW, texH);
    const data = image.data;
    const halfW = o.width / 2;
    const halfH = o.height / 2;
    const r = Math.min(o.radius, halfW, halfH);
    const bezelPx = Math.max(1, o.bezel * Math.min(halfW, halfH));

    for (let ty = 0; ty < texH; ty += 1) {
      for (let tx = 0; tx < texW; tx += 1) {
        const px = ((tx + 0.5) / texW) * o.width - halfW;
        const py = ((ty + 0.5) / texH) * o.height - halfH;
        const qx = Math.abs(px) - (halfW - r);
        const qy = Math.abs(py) - (halfH - r);
        let signedDistance, dirX = 0, dirY = 0;
        if (qx > 0 && qy > 0) {
          const len = Math.hypot(qx, qy);
          signedDistance = len - r;
          dirX = (Math.sign(px) * qx) / len;
          dirY = (Math.sign(py) * qy) / len;
        } else if (qx > qy) {
          signedDistance = qx - r;
          dirX = Math.sign(px);
        } else {
          signedDistance = qy - r;
          dirY = Math.sign(py);
        }
        const index = (ty * texW + tx) * 4;
        const inside = -signedDistance;
        if (inside <= 0) {
          data[index] = 128; data[index + 1] = 128;
          data[index + 2] = 128; data[index + 3] = 255;
          continue;
        }
        const t = Math.min(1, inside / bezelPx);
        let magnitude = 1 - convexSquircle(t);
        magnitude *= Math.min(1, inside / EDGE_TAPER_PX);
        data[index] = Math.round(128 + dirX * magnitude * 127);
        data[index + 1] = Math.round(128 + dirY * magnitude * 127);
        data[index + 2] = 128;
        data[index + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    const url = canvas.toDataURL('image/png');
    mapCache.set(key, url);
    return url;
  }

  // Only Chromium renders SVG filters through backdrop-filter.
  function supportsRefraction() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    const isChromium = /Chrom(e|ium)/.test(ua) || /Edg\//.test(ua);
    return isChromium && !/Firefox/.test(ua);
  }

  const refraction = supportsRefraction();
  const NS = 'http://www.w3.org/2000/svg';
  let svgHost = null;

  function makeFilter(id) {
    if (!refraction) return null;
    if (!svgHost) {
      svgHost = document.createElementNS(NS, 'svg');
      svgHost.setAttribute('width', '0');
      svgHost.setAttribute('height', '0');
      svgHost.setAttribute('aria-hidden', 'true');
      svgHost.style.position = 'absolute';
      document.body.appendChild(svgHost);
    }
    const filter = document.createElementNS(NS, 'filter');
    filter.setAttribute('id', id);
    filter.setAttribute('x', '0');
    filter.setAttribute('y', '0');
    filter.setAttribute('width', '100%');
    filter.setAttribute('height', '100%');
    filter.setAttribute('color-interpolation-filters', 'sRGB');

    const feImage = document.createElementNS(NS, 'feImage');
    feImage.setAttribute('x', '0');
    feImage.setAttribute('y', '0');
    feImage.setAttribute('width', '100%');
    feImage.setAttribute('height', '100%');
    feImage.setAttribute('preserveAspectRatio', 'none');
    feImage.setAttribute('result', 'map');

    const disp = document.createElementNS(NS, 'feDisplacementMap');
    disp.setAttribute('in', 'SourceGraphic');
    disp.setAttribute('in2', 'map');
    disp.setAttribute('scale', '15');
    disp.setAttribute('xChannelSelector', 'R');
    disp.setAttribute('yChannelSelector', 'G');
    disp.setAttribute('result', 'displaced');

    const blur = document.createElementNS(NS, 'feGaussianBlur');
    blur.setAttribute('in', 'displaced');
    blur.setAttribute('stdDeviation', '0.15');

    filter.appendChild(feImage);
    filter.appendChild(disp);
    filter.appendChild(blur);
    svgHost.appendChild(filter);
    return { filter: filter, feImage: feImage };
  }

  function updateFilter(part, capsule) {
    if (!part) return;
    const rect = capsule.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const cs = getComputedStyle(capsule);
    const parsed = parseFloat(cs.borderTopLeftRadius);
    const radius = Math.min(
      Number.isFinite(parsed) ? parsed : Math.min(rect.width, rect.height) / 2,
      rect.width / 2, rect.height / 2);
    const map = createDisplacementMap({
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      radius: radius,
      bezel: 0.34,
    });
    if (!map) return;
    part.feImage.setAttribute('href', map);
    part.feImage.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', map);
  }

  /* ══════════════════════════════════════════════════════════════
     1. Bottom tab bar — spring droplet over the frosted capsule
        (geometry + springs from glass-tabs' TabsList)
     ══════════════════════════════════════════════════════════════ */

  const INDICATOR_SPRING = { stiffness: 50, damping: 13 };
  const DEFORM_SPRING = { stiffness: 66, damping: 9 };
  const VELOCITY_SCALE = 0.134;
  const DEFORM_CLAMP = 0.3;
  const SQUEEZE_X = 0.3;
  const STRETCH_X = 2;
  const RATIO_Y = 4;

  function initTabBar() {
    const capsule = document.querySelector('.tabbar-capsule');
    const droplet = document.getElementById('tabIndicator');
    if (!capsule || !droplet) return;

    const part = makeFilter('glass-tabbar');
    if (part) {
      const cs = getComputedStyle(capsule);
      const blur = cs.webkitBackdropFilter || cs.backdropFilter || 'blur(30px) saturate(180%)';
      // keep the plain blur/saturate, prepend the refraction filter
      capsule.style.backdropFilter = 'url(#glass-tabbar) ' + blur;
      capsule.style.webkitBackdropFilter = 'url(#glass-tabbar) ' + blur;
      updateFilter(part, capsule);
    }

    const cx = new MotionValue(0);
    const cy = new MotionValue(0);
    const hw = new MotionValue(0);
    const hh = new MotionValue(0);
    const deform = new MotionValue(0);
    const targets = { cx: 0, cy: 0, hw: 0, hh: 0 };
    let initialized = false;
    let frame = 0;

    function apply() {
      frame = 0;
      const q = Math.max(0, deform.get());
      const widthFactor = 1 - q * (q > 0 ? SQUEEZE_X : STRETCH_X);
      const heightFactor = 1 + q * RATIO_Y;
      const w = Math.max(hw.get() * 2 * widthFactor, 0);
      const h = Math.max(hh.get() * 2 * heightFactor, 0);
      droplet.style.width = w + 'px';
      droplet.style.height = h + 'px';
      droplet.style.borderRadius = Math.min(w, h) / 2 + 'px';
      droplet.style.left = (cx.get() - w / 2) + 'px';
      droplet.style.top = (cy.get() - h / 2) + 'px';
    }

    function schedule() {
      if (frame === 0) frame = requestAnimationFrame(apply);
    }

    const drivers = [
      new SpringDriver(cx, INDICATOR_SPRING, () => targets.cx),
      new SpringDriver(cy, INDICATOR_SPRING, () => targets.cy),
      new SpringDriver(hw, INDICATOR_SPRING, () => targets.hw),
      new SpringDriver(hh, INDICATOR_SPRING, () => targets.hh),
    ];
    const deformDriver = new SpringDriver(
      deform, DEFORM_SPRING,
      () => {
        const width = capsule.getBoundingClientRect().width;
        const vNorm = Math.abs(cx.getVelocity()) / Math.max(width, 1);
        return Math.min(DEFORM_CLAMP, Math.sqrt(vNorm) * VELOCITY_SCALE);
      },
      () => Math.abs(cx.getVelocity()) < 0.005);

    [cx, cy, hw, hh, deform].forEach((v) => v.on(schedule));
    cx.on(() => deformDriver.start());

    function measure(animate) {
      const active = capsule.querySelector('.tab-item.is-active');
      if (!active) return;
      const cRect = capsule.getBoundingClientRect();
      const r = active.getBoundingClientRect();
      if (!r.width) return; // hidden screen
      targets.cx = r.left - cRect.left + r.width / 2;
      targets.cy = r.top - cRect.top + r.height / 2;
      targets.hw = r.width / 2;
      targets.hh = r.height / 2;
      if (!initialized || !animate || prefersReducedMotion()) {
        initialized = true;
        cx.jump(targets.cx); cy.jump(targets.cy);
        hw.jump(targets.hw); hh.jump(targets.hh);
        deform.jump(0);
        apply();
        return;
      }
      for (const d of drivers) d.start();
      deformDriver.start();
    }

    measure(false);

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        updateFilter(part, capsule);
        measure(false);
      });
      ro.observe(capsule);
    } else {
      window.addEventListener('resize', () => {
        updateFilter(part, capsule);
        measure(false);
      });
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => measure(false)).catch(() => {});
    }

    // class = active-tab toggle (showTab), characterData = i18n label
    // translation (init) which changes the widths.
    const mo = new MutationObserver(() => measure(true));
    mo.observe(capsule, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
      characterData: true,
    });
  }

  /* ══════════════════════════════════════════════════════════════
     2. Insights range — spring glass puck
        (puck + springs from @glasscn glass-toggle-group)
     ══════════════════════════════════════════════════════════════ */

  function initRange() {
    const host = document.getElementById('insightsSeg');
    if (!host) return;
    const puck = document.getElementById('insightsPuck');
    if (!puck) return;

    const part = makeFilter('glass-range');
    if (part) {
      host.style.backdropFilter = 'url(#glass-range) blur(18px) saturate(1.5)';
      host.style.webkitBackdropFilter = 'url(#glass-range) blur(18px) saturate(1.5)';
    }

    const left = new MotionValue(0);
    const width = new MotionValue(0);
    const sy = new MotionValue(1);
    let initialized = false;
    let frame = 0;
    let bounceRaf = 0;

    function apply() {
      frame = 0;
      puck.style.left = left.get() + 'px';
      puck.style.width = width.get() + 'px';
      puck.style.transform = 'scaleY(' + sy.get() + ')';
      puck.style.opacity = '1';
    }
    function schedule() {
      if (frame === 0) frame = requestAnimationFrame(apply);
    }

    const drivers = [
      new SpringDriver(left, { stiffness: 400, damping: 30 }, () => 0),
      new SpringDriver(width, { stiffness: 400, damping: 30 }, () => 0),
    ];
    [left, width, sy].forEach((v) => v.on(schedule));

    // scaleY 1 → 1.25 → 1 over 300ms, like the motion.puck keyframes.
    function bounce() {
      cancelAnimationFrame(bounceRaf);
      if (prefersReducedMotion()) return;
      const start = performance.now();
      const step = (now) => {
        const t = Math.min((now - start) / 300, 1);
        sy.set(1 + 0.25 * Math.sin(Math.PI * t), now);
        if (t < 1) bounceRaf = requestAnimationFrame(step);
        else { sy.set(1); }
      };
      bounceRaf = requestAnimationFrame(step);
    }

    let activeEl = null;

    function measure(animate) {
      const active = host.querySelector('.seg-btn.is-active');
      if (!active) return;
      const hRect = host.getBoundingClientRect();
      const r = active.getBoundingClientRect();
      if (!r.width) return; // hidden screen
      const l = r.left - hRect.left;
      const w = r.width;
      if (!initialized || !animate || prefersReducedMotion()) {
        initialized = true;
        left.jump(l);
        width.jump(w);
        apply();
        return;
      }
      drivers[0].getTarget = () => l;
      drivers[1].getTarget = () => w;
      for (const d of drivers) d.start();
      if (activeEl !== active) bounce();
      activeEl = active;
    }

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        updateFilter(part, host);
        measure(false);
      });
      ro.observe(host);
    } else {
      window.addEventListener('resize', () => {
        updateFilter(part, host);
        measure(false);
      });
    }

    // app.js rebuilds #insightsSeg on every renderInsights() and toggles
    // .is-active on mode change — watch both.
    const mo = new MutationObserver(() => {
      if (host.children.length) {
        updateFilter(part, host);
        measure(true);
      }
    });
    mo.observe(host, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    if (host.children.length) {
      updateFilter(part, host);
      measure(false);
    }
  }

  try {
    initTabBar();
    initRange();
    window.GlassUI = { active: true, refraction: refraction };
  } catch (err) {
    // Glass is a progressive enhancement — never break the controls.
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Glass UI disabled:', err);
    }
  }
})();
