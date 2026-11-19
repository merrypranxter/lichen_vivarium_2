'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sandbox = { window: {}, Float32Array, Uint8Array };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'tissue-hydration.js'), 'utf8'), sandbox);

function scene(initial = 0.2) {
  const waterField = new Float32Array(4).fill(initial);
  const biomass = new Float32Array(4).fill(0.8);
  return { waterField, biomass,
    ...sandbox.window.LichenHydration.create({ size: 2, waterField, biomass, initial }) };
}
function close(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 2e-6, `${message}: ${actual} vs ${expected}`);
}

test('local mist changes nearby tissue, film and shape without global wetness', () => {
  const h = scene();
  h.waterField[0] = 1;
  h.step(0.7);
  assert.ok(h.tissue[0] > 0.65);
  assert.ok(h.film[0] > 0.9);
  assert.ok(h.shape[0] > 0.2 && h.shape[0] < h.tissue[0], 'curl relaxation trails tissue uptake');
  for (let i = 1; i < 4; i++) {
    close(h.tissue[i], 0.2, 'unmisted tissue');
    close(h.shape[i], 0.2, 'unmisted shape');
    assert.equal(h.film[i], 0);
  }
  assert.equal(h.waterField[0], 1, 'material evolution does not overwrite environmental water');
});

test('damp tissue can remain matte and film dries before internal tissue', () => {
  const h = scene(0.72);
  h.step(10);
  assert.equal(h.film[0], 0, 'damp environmental water is below film threshold');
  h.reset(1);
  h.waterField.fill(0);
  h.step(2);
  assert.ok(h.tissue[0] > 0.7, 'internal water is retained');
  assert.ok(h.film[0] < 0.34, 'exposed film evaporates faster');
  assert.ok(h.shape[0] > h.tissue[0], 'deformation trails desiccation');
});

test('uptake is faster than drying over equal time', () => {
  const wetting = scene(0), drying = scene(1);
  wetting.waterField.fill(1);
  drying.waterField.fill(0);
  wetting.step(0.7);
  drying.step(0.7);
  assert.ok(wetting.tissue[0] > 0.63);
  assert.ok(1 - drying.tissue[0] < 0.10);
});

test('constant-environment transitions agree across frame intervals', () => {
  for (const [initial, target] of [[0.2, 1], [1, 0.15]]) {
    const one = scene(initial), many = scene(initial);
    one.waterField.fill(target);
    many.waterField.fill(target);
    one.step(2.4);
    for (let frame = 0; frame < 144; frame++) many.step(1 / 60);
    for (const key of ['tissue', 'film', 'shape']) {
      for (let i = 0; i < 4; i++) close(one[key][i], many[key][i], key);
    }
  }
});

test('film requires tissue occupancy and state packs to independent RGBA channels', () => {
  const h = scene(0);
  h.waterField.fill(1);
  h.biomass[1] = 0;
  h.step(1);
  assert.ok(h.film[0] > 0.9);
  assert.equal(h.film[1], 0);
  const packed = new Uint8Array(16);
  assert.equal(h.encodeRGBA(packed), packed);
  for (let i = 0; i < 4; i++) {
    assert.equal(packed[i * 4], Math.round(h.tissue[i] * 255));
    assert.equal(packed[i * 4 + 1], Math.round(h.film[i] * 255));
    assert.equal(packed[i * 4 + 2], Math.round(h.shape[i] * 255));
    assert.equal(packed[i * 4 + 3], 255);
  }
});

test('wet/dry cycling remains finite; invalid timesteps and buffers fail clearly', () => {
  const h = scene();
  for (let n = 0; n < 100; n++) {
    h.waterField.fill(n % 2 ? -0.5 : 1.5);
    h.step(n % 3 ? 1 / 60 : 20);
  }
  for (const key of ['tissue', 'film', 'shape']) {
    for (const value of h[key]) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
  }
  assert.throws(() => h.step(-1), /nonnegative/);
  assert.throws(() => h.step(NaN), /finite/);
  assert.throws(() => h.encodeRGBA(new Uint8Array(3)), /RGBA8/);
  h.reset(0.6);
  close(h.tissue[0], 0.6, 'reset tissue');
  close(h.shape[0], 0.6, 'reset shape');
  assert.equal(h.film[0], 0);
});
