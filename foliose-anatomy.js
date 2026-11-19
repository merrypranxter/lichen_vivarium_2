/* A fictional leathery foliose phenotype. World units are the substrate's UV
   plane: a colony spans about 0.2 units. Geometry is independent of render time,
   biology, and quality; quality only samples the same anatomical surfaces more
   densely. These are connected/overlapping lobe shells, not a species model. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  function random(seed, id) {
    let v = Math.imul((Math.floor(seed * 0x7fffffff) ^ id) >>> 0, 1597334677);
    v = Math.imul(v ^ (v >>> 16), 2246822519);
    return ((v ^ (v >>> 13)) >>> 0) / 4294967296;
  }

  function anatomy(seed) {
    const lobes = [];
    // Radial organization with unequal extension, spacing, handedness and
    // branching history. The daughter count does not change with GPU quality.
    for (let id = 0; id < 8; id++) {
      const phase = random(seed, id * 17 + 1);
      lobes.push({
        id, parentId: null, origin: [0, 0, 0.0025],
        angle: id / 8 * TAU + seed * TAU + (phase - .5) * .40,
        length: .062 + .039 * random(seed, id * 17 + 2),
        width: .012 + .010 * random(seed, id * 17 + 3),
        bend: (random(seed, id * 17 + 4) - .5) * .025,
        lift: .003 + .009 * random(seed, id * 17 + 5),
        roll: (random(seed, id * 17 + 6) - .5) * .005,
        phase: phase * TAU, thickness: .0014 + phase * .0005
      });
    }
    // A few bifurcations, rather than every lobe splitting at the same radius.
    for (let k = 0; k < 4; k++) {
      const parent = lobes[k * 2];
      const t = .42 + .15 * random(seed, 220 + k);
      const start = surface(parent, t, 0, false);
      lobes.push({
        id: 8 + k, parentId: parent.id, origin: start,
        angle: parent.angle + (k % 2 ? -1 : 1) * (.36 + .32 * random(seed, 240 + k)),
        length: .033 + .021 * random(seed, 260 + k),
        width: parent.width * (.53 + .14 * random(seed, 280 + k)),
        bend: parent.bend * .35,
        lift: .002 + parent.lift * .42,
        roll: parent.roll * -.6,
        phase: parent.phase + 1.3,
        thickness: parent.thickness * .85
      });
    }
    return lobes;
  }

  function surface(lobe, t, s, underside) {
    const { angle, length, width, bend, phase, origin } = lobe;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const sx = -dy, sy = dx;
    const terminal = smooth(.70, 1, t);
    const broadness = .36 + .64 * Math.pow(Math.sin(Math.PI * (.10 + t * .85)), .65);
    const scallop = 1 + .085 * Math.sin(t * 19 + phase + s * .4) + .030 * Math.sin(t * 37 - phase);
    const lateral = s * width * broadness * scallop;
    const curve = bend * t * t + .0012 * Math.sin(t * 7 + phase) * t;
    // The leading margin is a rounded spatulate end, not a square ribbon.
    const forkDepth = lobe.parentId === null && lobe.id % 3 === 0 ? .37 : .12;
    const tipCleft = width * forkDepth * Math.exp(-s * s * 15) * terminal * terminal;
    const forward = t * length + (1 - s * s) * width * .28 * terminal - tipCleft;
    const lift = lobe.lift * Math.pow(Math.max(0, t), 2.4);
    const roll = lobe.roll * s * t * t;
    const margin = .0032 * Math.pow(Math.abs(s), 2.5) * smooth(.17, .95, t);
    const fold = .0009 * Math.sin(t * 14 + phase + s * 1.1) * t * (1 - s * s);
    const z = origin[2] + lift + roll + margin + fold;
    const thickness = lobe.thickness * (.9 + .1 * Math.cos(t * 5 + phase));
    return [origin[0] + dx * forward + sx * (curve + lateral),
            origin[1] + dy * forward + sy * (curve + lateral),
            z - (underside ? thickness : 0)];
  }

  function normal(lobe, t, s, underside) {
    const e = .0001;
    const p0 = surface(lobe, t - e, s, underside);
    const p1 = surface(lobe, t + e, s, underside);
    const q0 = surface(lobe, t, s - e, underside);
    const q1 = surface(lobe, t, s + e, underside);
    const a = p1.map((x, i) => x - p0[i]);
    const b = q1.map((x, i) => x - q0[i]);
    const n = [a[1] * b[2] - a[2] * b[1],
               a[2] * b[0] - a[0] * b[2],
               a[0] * b[1] - a[1] * b[0]];
    const len = Math.hypot(...n) || 1;
    const sign = underside ? -1 : 1;
    return n.map(x => x / len * sign);
  }

  function build(out, anchor, seed, options = {}) {
    const rich = options.quality === 'rich';
    const steps = rich ? 16 : 8;
    const across = rich ? 8 : 4;
    const lobes = anatomy(seed);
    const before = out.length;
    function append(lobe, t, s, lower, kind, rimNormal) {
      const p = surface(lobe, t, s, lower);
      const n = rimNormal || normal(lobe, t, s, lower);
      // Carry the offset from the upper skin separately so hydration deforms
      // the sheet's top surface while preserving physical cortex thickness.
      const lowerSkinOffset = lower ? surface(lobe, t, s, false)[2] - p[2] : 0;
      out.push(anchor[0], anchor[1], ...p, kind, seed,
        anchor[0] + p[0], anchor[1] + p[1],
        lobe.origin[0], lobe.origin[1], lobe.origin[2],
        .02 + lobe.id * .004, lowerSkinOffset,
        ...n, (s + 1) / 2, t);
    }
    for (const lobe of lobes) {
      for (let i = 0; i < steps; i++) for (let j = 0; j < across; j++) {
        const t = i / steps, u = (i + 1) / steps;
        const s = j / across * 2 - 1, v = (j + 1) / across * 2 - 1;
        // Consistent outward winding for upper and lower skins.
        for (const [a, b] of [[t,s],[u,s],[t,v],[t,v],[u,s],[u,v]])
          append(lobe, a, b, false, 1);
        for (const [a, b] of [[t,s],[t,v],[u,s],[t,v],[u,v],[u,s]])
          append(lobe, a, b, true, 1.1);
      }
      // Walk the sheet boundary counterclockwise, then join the two skins.
      // This closes the free margin, rounded tip and attached root as one shell.
      const perimeter = [];
      for (let i = 0; i < steps; i++) perimeter.push([i / steps, -1]);
      for (let j = 0; j < across; j++) perimeter.push([1, j / across * 2 - 1]);
      for (let i = steps; i > 0; i--) perimeter.push([i / steps, 1]);
      for (let j = across; j > 0; j--) perimeter.push([0, j / across * 2 - 1]);
      for (let i = 0; i < perimeter.length; i++) {
        const a = perimeter[i], b = perimeter[(i + 1) % perimeter.length];
        const pa = surface(lobe, ...a, false), pb = surface(lobe, ...b, false);
        const tangent = [pb[0] - pa[0], pb[1] - pa[1]];
        const len = Math.hypot(...tangent) || 1;
        const n = [tangent[1] / len, -tangent[0] / len, 0];
        for (const [p, lower] of [[a,false],[a,true],[b,false],[b,false],[a,true],[b,true]])
          append(lobe, p[0], p[1], lower, 1.2, n);
      }
    }
    return { lobes: lobes.length, triangles: (out.length - before) / 57 };
  }
  window.LichenFoliose = { build, anatomy };
})();
