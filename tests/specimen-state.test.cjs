'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sandbox = { window: {} };
for (const file of ['specimen-state.js', 'rock-weathering.js', 'substrate-ecology.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox);
}

function scene() {
  const size = 256, count = size * size;
  const fields = {};
  for (const key of ['biomass', 'nextBiomass', 'ageField', 'stressField', 'crackField',
    'necrosisField', 'fruitingField', 'waterField', 'rockField', 'nutrientField', 'nextNutrient']) {
    fields[key] = new Float32Array(count).fill(0.4);
  }
  fields.speciesField = new Uint8Array(count).fill(3);
  fields.colonyIdField = new Uint8Array(count).fill(2);
  fields.colonyOriginX = new Float32Array(256).fill(12);
  fields.colonyOriginY = new Float32Array(256).fill(24);
  const params = { zoom: 1, paletteMode: 6, custom: { color: '#abcd12' }, ambientHydration: 0.4 };
  const hydration = { tissue: new Float32Array(count).fill(0.3),
    film: new Float32Array(count).fill(0.1), shape: new Float32Array(count).fill(0.2),
    reset(value) { this.tissue.fill(value); this.shape.fill(value); this.film.fill(0); } };
  let revision = 5;
  const weathering = { fields: {}, getRevision: () => revision,
    reset() { for (const array of Object.values(this.fields)) array.fill(0); revision++; } };
  for (const key of ['etched', 'oxides', 'organics', 'memory']) weathering.fields[key] = new Float32Array(count).fill(0.15);
  let state = { simYears: 22, isRunning: true, nextColonyCounter: 7, randomState: 89, simulationTick: 912 };
  let invalidated = 0;
  const api = { fields, params, hydration, weathering, getState: () => state,
    setState(value) { state = value; }, invalidate() { invalidated++; } };
  return { ...api, ...sandbox.window.createLichenSpecimenState(api), invalidated: () => invalidated };
}

test('snapshot copies all supplied state without sharing arrays or nested settings', () => {
  const s = scene(), snapshot = s.capture();
  s.fields.biomass[0] = 0.9;
  s.params.custom.color = '#ffffff';
  s.hydration.tissue[0] = 0.8;
  s.weathering.fields.memory[0] = 0.9;
  assert.ok(snapshot.fields.biomass[0] < 0.5);
  assert.equal(snapshot.params.custom.color, '#abcd12');
  assert.ok(snapshot.hydration.tissue[0] < 0.4);
  assert.ok(snapshot.weathering.memory[0] < 0.2);
  snapshot.fields.waterField[0] = 1;
  assert.ok(s.fields.waterField[0] < 0.5);
});

test('restore recovers biology, weather history, local water, settings and clocks', () => {
  const s = scene(), snapshot = s.capture();
  s.loadSpecimen();
  s.weathering.fields.etched.fill(0.9);
  s.fields.rockField.fill(0.1);
  s.params.extra = true;
  const revision = s.weathering.getRevision();
  s.restore(snapshot);
  for (const [key, value] of Object.entries(s.fields)) assert.deepEqual(value, snapshot.fields[key], key);
  for (const [key, value] of Object.entries(s.weathering.fields)) assert.deepEqual(value, snapshot.weathering[key], key);
  for (const key of ['tissue', 'film', 'shape']) assert.deepEqual(s.hydration[key], snapshot.hydration[key]);
  assert.deepEqual(s.getState(), snapshot.state);
  assert.equal(JSON.stringify(s.params), JSON.stringify(snapshot.params));
  assert.equal(s.params.extra, undefined);
  assert.ok(s.weathering.getRevision() > revision, 'restoration marks geological GPU data dirty');
  assert.equal(s.invalidated(), 2);
});

test('incompatible field lengths are rejected before any live mutation', () => {
  const s = scene(), snapshot = s.capture();
  snapshot.fields.biomass.fill(0.9);
  snapshot.weathering.memory = new Float32Array(2);
  const before = s.capture();
  assert.throws(() => s.restore(snapshot), /Incompatible weathering field: memory/);
  assert.deepEqual(s.fields.biomass, before.fields.biomass);
  assert.deepEqual(s.weathering.fields.memory, before.weathering.memory);
  assert.equal(s.invalidated(), 0);
  snapshot.weathering.memory = before.weathering.memory;
  snapshot.hydration.shape[0] = NaN;
  assert.throws(() => s.restore(snapshot), /Nonfinite hydration field/);
  assert.deepEqual(s.fields.biomass, before.fields.biomass);
});

test('mature fixture is deterministic, paused and preserves substrate and geological history', () => {
  const s = scene(), before = s.capture();
  s.loadSpecimen();
  const first = s.capture();
  assert.equal(s.fields.colonyOriginX[42], 128);
  assert.equal(s.fields.colonyOriginY[42], 128);
  const center = 128 * 256 + 128;
  assert.ok(s.fields.biomass[center] > 0.84);
  assert.equal(s.fields.speciesField[center], 1);
  assert.equal(s.fields.colonyIdField[center], 42);
  assert.ok(s.fields.ageField[center] >= 12);
  assert.equal(s.fields.biomass[0], 0);
  assert.deepEqual(s.fields.biomass, s.fields.nextBiomass);
  for (const key of ['rockField', 'nutrientField', 'nextNutrient']) assert.deepEqual(s.fields[key], before.fields[key]);
  for (const key of Object.keys(s.weathering.fields)) assert.deepEqual(s.weathering.fields[key], before.weathering[key]);
  assert.equal(s.getState().isRunning, false);
  assert.equal(s.getState().simYears, 18);
  assert.equal(s.params.geometryQuality, 'rich');
  assert.equal(s.params.realismEnabled, true);
  assert.equal(s.params.renderLayer, 'composite');
  assert.equal(s.params.effectiveWetness, 0.2);
  s.loadSpecimen();
  assert.deepEqual(s.capture().fields, first.fields);
});

test('wetness action changes environmental water without skipping the tissue transition', () => {
  const s = scene();
  const tissue = s.hydration.tissue.slice(), shape = s.hydration.shape.slice();
  s.setWet(1);
  assert.ok(s.fields.waterField.every(value => value === 1));
  assert.equal(s.params.ambientHydration, 1);
  assert.deepEqual(s.hydration.tissue, tissue);
  assert.deepEqual(s.hydration.shape, shape);
  s.setWet(-10);
  assert.ok(s.fields.waterField.every(value => value === 0));
});

function coupledScene() {
  const size = 16, count = size * size;
  const fields = {
    rockField: new Float32Array(count), waterField: new Float32Array(count).fill(0.78),
    biomass: new Float32Array(count).fill(0.8), ageField: new Float32Array(count).fill(16),
    necrosisField: new Float32Array(count), crackField: new Float32Array(count).fill(0.2),
    speciesField: new Uint8Array(count).fill(1)
  };
  for (let i = 0; i < count; i++) fields.rockField[i] = 0.4 + 0.1 * Math.sin(i * 0.13);
  const params = { ambientHydration: 0.67, effectiveWetness: 0.67 };
  const weathering = sandbox.window.LichenRockWeathering.create({ ...fields, gridSize: size, params });
  const ecology = sandbox.window.LichenSubstrateEcology.create({ ...fields, gridSize: size, params });
  ecology.initialize();
  ecology.attachWeathering(weathering);
  let state = { simulationTick: 0 };
  let invalidations = 0;
  const api = { fields, params, weathering, ecology, getState: () => state,
    setState(value) { state = value; }, invalidate() { invalidations++; } };
  const comparison = sandbox.window.createLichenSpecimenState(api);
  const step = () => {
    state.simulationTick++;
    return [ecology.step(), weathering.step()];
  };
  return { ...api, ...comparison, step, invalidations: () => invalidations };
}

test('restoring private substrate and weathering clocks preserves subsequent field evolution', () => {
  const s = coupledScene();
  s.step(); s.step(); // deliberately between the 3- and 4-tick updates
  const saved = s.capture();
  assert.equal(saved.timing.ecologyTick, 2);
  assert.equal(saved.timing.weatheringTick, 2);
  const expectedSchedule = [];
  for (let tick = 0; tick < 13; tick++) expectedSchedule.push(s.step());
  const expected = s.capture();
  for (let tick = 0; tick < 9; tick++) s.step();
  s.fields.rockField.fill(0.1);
  s.ecology.initialize(); // also modifies static habitat fields and clock
  s.restore(saved);
  assert.equal(s.ecology.getTick(), 2);
  assert.equal(s.weathering.getTick(), 2);
  const actualSchedule = [];
  for (let tick = 0; tick < 13; tick++) actualSchedule.push(s.step());
  assert.deepEqual(actualSchedule, expectedSchedule, 'updates occur on the same biological ticks');
  const actual = s.capture();
  assert.deepEqual(actual.fields, expected.fields, 'shared environmental water resumes identically');
  assert.deepEqual(actual.weathering, expected.weathering, 'geological records resume identically');
  assert.deepEqual(actual.ecology, expected.ecology, 'habitat fields are restored with the rock');
  assert.deepEqual(actual.timing, expected.timing);
});

test('invalid private clocks fail before restoration mutates any field', () => {
  const s = coupledScene();
  s.step();
  const saved = s.capture(), before = s.capture();
  saved.fields.biomass.fill(0);
  saved.timing.weatheringTick = -1;
  assert.throws(() => s.restore(saved), /Invalid specimen timing: weatheringTick/);
  assert.deepEqual(s.fields.biomass, before.fields.biomass);
  assert.equal(s.weathering.getTick(), 1);
  assert.equal(s.invalidations(), 0);
  for (const engine of [s.ecology, s.weathering]) {
    const tick = engine.getTick();
    for (const bad of [-1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => engine.setTick(bad), /nonnegative safe integer/);
      assert.equal(engine.getTick(), tick);
    }
  }
});
