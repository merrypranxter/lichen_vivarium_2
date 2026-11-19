/* In-memory specimen comparison state. This copies the supplied CPU fields,
   material settings and clocks; it is not a versioned editable project format.
   GPU resources and optional geometry must be invalidated by the host. */
(function () {
  'use strict';
  const arrayField = value => ArrayBuffer.isView(value) && typeof value.set === 'function';
  const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const copy = value => {
    if (arrayField(value)) return value.slice();
    if (Array.isArray(value)) return value.map(copy);
    if (value && typeof value === 'object') {
      const out = {};
      for (const [key, item] of Object.entries(value)) out[key] = copy(item);
      return out;
    }
    return value;
  };

  window.createLichenSpecimenState = function createLichenSpecimenState(api) {
    const { fields, params, hydration, weathering, ecology, getState, setState, invalidate } = api;
    const fieldEntries = Object.entries(fields).filter(([, value]) => arrayField(value));
    const hydrationEntries = hydration
      ? ['tissue', 'film', 'shape'].map(key => [key, hydration[key]]) : [];
    const weatherEntries = Object.entries(weathering?.fields || {});
    const ecologyEntries = Object.entries(ecology?.fields || {});
    const captureArrays = entries => Object.fromEntries(entries.map(([key, value]) => [key, value.slice()]));

    function capture() {
      return {
        version: 1,
        fields: captureArrays(fieldEntries),
        hydration: captureArrays(hydrationEntries),
        weathering: captureArrays(weatherEntries),
        ecology: captureArrays(ecologyEntries),
        timing: {
          weatheringTick: weathering?.getTick ? weathering.getTick() : null,
          ecologyTick: ecology?.getTick ? ecology.getTick() : null
        },
        params: copy(params),
        state: copy(getState())
      };
    }

    function validateArrays(source, entries, label) {
      if (!source || typeof source !== 'object') throw new Error(`Missing ${label} snapshot`);
      for (const [key, target] of entries) {
        const value = source[key];
        if (!arrayField(value) || value.length !== target.length ||
            value.constructor.name !== target.constructor.name) {
          throw new Error(`Incompatible ${label} field: ${key}`);
        }
        for (let i = 0; i < value.length; i++) {
          if (!Number.isFinite(value[i])) throw new Error(`Nonfinite ${label} field: ${key}`);
        }
      }
    }

    function restore(snapshot) {
      if (!snapshot || snapshot.version !== 1) throw new Error('Unsupported specimen snapshot');
      // Validate every field before touching any live state. A damaged or
      // incompatible comparison must not partly overwrite the artwork.
      validateArrays(snapshot.fields, fieldEntries, 'biology');
      validateArrays(snapshot.hydration, hydrationEntries, 'hydration');
      validateArrays(snapshot.weathering, weatherEntries, 'weathering');
      validateArrays(snapshot.ecology, ecologyEntries, 'ecology');
      for (const [engine, key] of [[weathering, 'weatheringTick'], [ecology, 'ecologyTick']]) {
        if (engine?.getTick && engine?.setTick &&
            (!Number.isSafeInteger(snapshot.timing?.[key]) || snapshot.timing[key] < 0)) {
          throw new Error(`Invalid specimen timing: ${key}`);
        }
      }
      if (!snapshot.params || typeof snapshot.params !== 'object' ||
          !snapshot.state || typeof snapshot.state !== 'object') {
        throw new Error('Missing specimen settings or clock state');
      }
      const savedParams = copy(snapshot.params), savedState = copy(snapshot.state);
      for (const [key, value] of fieldEntries) value.set(snapshot.fields[key]);
      for (const [key, value] of hydrationEntries) value.set(snapshot.hydration[key]);
      // Preserve cadence as well as field values. Older adapters without
      // clock access still invalidate their upload before restoring records.
      if (weathering?.setTick && weathering?.getTick) weathering.setTick(snapshot.timing.weatheringTick);
      else if (weathering && weatherEntries.length) weathering.reset();
      for (const [key, value] of weatherEntries) value.set(snapshot.weathering[key]);
      for (const [key, value] of ecologyEntries) value.set(snapshot.ecology[key]);
      if (ecology?.setTick && ecology?.getTick) ecology.setTick(snapshot.timing.ecologyTick);
      for (const key of Object.keys(params)) delete params[key];
      Object.assign(params, savedParams);
      setState(savedState);
      invalidate();
    }

    function setWet(value) {
      const wet = clamp(value);
      fields.waterField.fill(wet);
      params.ambientHydration = wet;
      // Keep existing tissue, film and shape so the transformation is visible.
    }

    function loadSpecimen() {
      const size = Math.sqrt(fields.biomass.length);
      if (!Number.isInteger(size) || size < 72 ||
          fields.colonyOriginX.length <= 42 || fields.colonyOriginY.length <= 42) {
        throw new Error('Specimen fixture requires a square grid and colony slot 42');
      }
      for (const name of ['biomass', 'nextBiomass', 'ageField', 'stressField',
        'crackField', 'necrosisField', 'fruitingField', 'speciesField',
        'colonyIdField', 'colonyOriginX', 'colonyOriginY']) {
        fields[name]?.fill(0);
      }
      const center = Math.floor(size / 2);
      fields.colonyOriginX[42] = center;
      fields.colonyOriginY[42] = center;
      for (let y = center - 36; y <= center + 36; y++) {
        for (let x = center - 36; x <= center + 36; x++) {
          const dx = x - center, dy = y - center;
          const angle = Math.atan2(dy, dx);
          const radius = 35 + 0.65 * Math.sin(angle * 5 + 0.4) + 0.3 * Math.cos(angle * 9);
          const distance = Math.hypot(dx, dy);
          if (distance >= radius) continue;
          const i = y * size + x;
          const edge = clamp((distance - 28) / (radius - 28));
          const density = 0.85 * (1 - edge * edge * (3 - 2 * edge));
          fields.biomass[i] = density;
          if (fields.nextBiomass) fields.nextBiomass[i] = density;
          fields.ageField[i] = 13 + 0.7 * Math.sin(dx * 0.12) * Math.cos(dy * 0.14);
          fields.speciesField[i] = 1;
          fields.colonyIdField[i] = 42;
        }
      }
      Object.assign(params, {
        zoom: 3.4, panX: 0, panY: 0, geometryQuality: 'rich', realismEnabled: true,
        exposure:1, geometryDepth:1, geometryTilt:.65, lobeUnfurl:1.15,
        morphogenesis:1, weatheringBefore:false, weatheringRelief:.7,
        weatheringPigment:1.15, substrateView:0, microDetail:1, reliefHeight:1.15,
        grayscaleProof:false, hueShift:0, psyIntensity:1.35,
        materialDebug: 0, renderLayer: 'composite', effectiveWetness: 0.2,
        tissueCharacter: 0.65, marginEnergy: 0.5,
        paletteMode: 1, macroOptics: 0, fluorescence: 0, iridescence: 0,
        lightAzimuth: 2.3, lightElevation: 0.48
      });
      setWet(0.2);
      hydration?.reset(0.2);
      setState({ ...getState(), isRunning: false, simYears: 18,
        nextColonyCounter: 43, randomState: 12345, simulationTick: 0 });
      invalidate();
    }

    return { capture, restore, loadSpecimen, setWet };
  };
})();
