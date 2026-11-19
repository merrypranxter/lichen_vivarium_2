/* Lichen Vivarium II — local water optics and deformation state.
   Environmental water, internal tissue water, surface film and relaxed shape
   have separate meanings. Time constants are artistic seconds, not measured
   rates for a named species. CPU arrays remain authoritative and saveable. */
(function () {
  'use strict';
  const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const filmTarget = value => {
    const t = clamp((value - 0.80) / 0.20);
    return t * t * (3 - 2 * t);
  };
  const relax = (current, target, dt, tau) => target + (current - target) * Math.exp(-dt / tau);

  function create({ size, waterField, biomass, initial = 0.72 }) {
    const count = size * size;
    if (!Number.isInteger(size) || size < 1 ||
        waterField?.length !== count || biomass?.length !== count) {
      throw new Error('Hydration requires matching square water and biomass fields');
    }
    const tissue = new Float32Array(count);
    const film = new Float32Array(count);
    const shape = new Float32Array(count);
    const uptakeTau = 0.7, dryingTau = 7.0, shapeTau = 1.2;

    function reset(value = initial) {
      const water = clamp(value);
      tissue.fill(water);
      film.fill(filmTarget(water));
      shape.fill(water);
    }

    function step(dt) {
      if (!Number.isFinite(dt) || dt < 0) {
        throw new Error('Hydration step requires finite, nonnegative seconds');
      }
      if (dt === 0) return;
      for (let i = 0; i < count; i++) {
        const target = clamp(waterField[i]);
        const oldTissue = clamp(tissue[i]);
        const tau = target > oldTissue ? uptakeTau : dryingTau;
        const tissueDecay = Math.exp(-dt / tau);
        const shapeDecay = Math.exp(-dt / shapeTau);
        tissue[i] = clamp(target + (oldTissue - target) * tissueDecay);
        // Exact response of a second relaxation driven by the continuously
        // changing tissue value. This avoids frame-rate-dependent shape lag.
        shape[i] = clamp(target + (clamp(shape[i]) - target) * shapeDecay +
          (oldTissue - target) * tau / (tau - shapeTau) *
          (tissueDecay - shapeDecay));

        // Damp tissue has no compulsory glossy coating. Only near-saturated
        // environmental water deposits a film, and film evaporates faster
        // than water held inside the tissue. Bare substrate holds no tissue
        // film; the renderer has its own rock-water material.
        const targetFilm = filmTarget(target) * clamp(biomass[i] * 8);
        const oldFilm = clamp(film[i]);
        film[i] = clamp(relax(oldFilm, targetFilm, dt,
          targetFilm > oldFilm ? 0.25 : 1.8));
      }
    }

    function encodeRGBA(out) {
      if (!(out instanceof Uint8Array) || out.length !== count * 4) {
        throw new Error('Hydration upload requires an RGBA8 buffer matching the grid');
      }
      for (let i = 0; i < count; i++) {
        const p = i * 4;
        out[p] = Math.round(clamp(tissue[i]) * 255);
        out[p + 1] = Math.round(clamp(film[i]) * 255);
        out[p + 2] = Math.round(clamp(shape[i]) * 255);
        out[p + 3] = 255;
      }
      return out;
    }

    reset(initial);
    return { tissue, film, shape, step, encodeRGBA, reset };
  }

  window.LichenHydration = { create };
})();
