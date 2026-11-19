'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'foliose-anatomy.js'), 'utf8'), context);
const anatomy = context.window.LichenFoliose;
function build(quality = 'lite', seed = .713) {
  const data = [];
  const stats = anatomy.build(data, [.5, .5], seed, { quality });
  return { data, stats };
}
const xyzKey = (data, i) => data.slice(i + 2, i + 5).map(v => v.toFixed(8)).join(',');

test('foliose shells have finite coordinates, anatomical regions and normalized normals', () => {
  const { data, stats } = build();
  assert.equal(data.length, stats.triangles * 57);
  assert.equal(stats.lobes, 12);
  assert.ok(stats.triangles < 2300, 'bounded mobile specimen');
  assert.ok(data.every(Number.isFinite));
  const kinds = new Set();
  for (let i = 0; i < data.length; i += 19) {
    kinds.add(data[i + 5]);
    assert.ok(Math.abs(Math.hypot(...data.slice(i + 14, i + 17)) - 1) < 1e-5);
    assert.ok(data[i + 4] > 0 && data[i + 4] < .03);
    assert.ok(Math.abs(data[i + 2]) < .16 && Math.abs(data[i + 3]) < .16);
  }
  assert.deepEqual([...kinds].sort(), [1, 1.1, 1.2]);
});

test('upper, underside and rims close every shell with actual finite thickness', () => {
  const { data } = build();
  const edges = new Map();
  const columns = new Map();
  for (let i = 0; i < data.length; i += 57) {
    const vertices = [i, i + 19, i + 38].map(j => xyzKey(data, j));
    for (let k = 0; k < 3; k++) {
      const key = [vertices[k], vertices[(k + 1) % 3]].sort().join('|');
      edges.set(key, (edges.get(key) || 0) + 1);
    }
    for (let j = i; j < i + 57; j += 19) {
      if (data[j + 5] === 1.2) continue;
      const xy = data[j + 12] + ':' + data.slice(j + 2, j + 4).map(v => v.toFixed(8)).join(',');
      const zs = columns.get(xy) || new Set();
      zs.add(data[j + 4]); columns.set(xy, zs);
    }
  }
  assert.ok([...edges.values()].every(n => n === 2), 'each shell edge has two incident faces');
  for (const heights of columns.values()) {
    const zs = [...heights];
    assert.equal(zs.length, 2, 'same x/y has upper and lower cortex');
    assert.ok(Math.abs(zs[0] - zs[1]) >= .0009 && Math.abs(zs[0] - zs[1]) < .002);
  }
});

test('seed preserves branching history and unequal proportions', () => {
  const a = build(), b = build(), c = build('lite', .714);
  assert.deepEqual(a.data, b.data);
  assert.notDeepEqual(a.data, c.data);
  const lobes = anatomy.anatomy(.713);
  assert.equal(lobes.filter(l => l.parentId !== null).length, 4);
  assert.ok(new Set(lobes.map(l => l.length.toFixed(5))).size > 8);
  assert.ok(new Set(lobes.map(l => l.width.toFixed(5))).size > 8);
  for (const child of lobes.filter(l => l.parentId !== null)) {
    assert.ok(child.origin[0] !== 0 || child.origin[1] !== 0, 'fork grows from its parent tissue');
    assert.ok(child.length < lobes[child.parentId].length);
  }
});

test('Rich samples the same anatomy; Lite vertices retain their world coordinates', () => {
  const lite = build('lite'), rich = build('rich');
  assert.equal(lite.stats.lobes, rich.stats.lobes);
  assert.ok(rich.stats.triangles > lite.stats.triangles);
  const richVertices = new Set();
  for (let i = 0; i < rich.data.length; i += 19) richVertices.add(xyzKey(rich.data, i));
  for (let i = 0; i < lite.data.length; i += 19)
    assert.ok(richVertices.has(xyzKey(lite.data, i)), 'quality changes sampling, never lobe identity');
  assert.deepEqual(build('lite').data, lite.data, 'returning to Lite restores identical mesh');
});


test('hydration curling preserves the finite cortex thickness, including lower rim vertices', () => {
  const { data } = build();
  const columns = new Map();
  for (let i = 0; i < data.length; i += 19) {
    const key = data[i + 12] + ':' + data.slice(i + 2, i + 4).map(v => v.toFixed(8)).join(',');
    const vertices = columns.get(key) || [];
    vertices.push({ z: data[i + 4], offset: data[i + 13], attachment: data[i + 11] });
    columns.set(key, vertices);
  }
  let rimOffsets = 0;
  for (let i = 0; i < data.length; i += 19)
    if (data[i + 5] === 1.2 && data[i + 13] > 0) rimOffsets++;
  assert.ok(rimOffsets > 0, 'rim bottom vertices carry the same lower-skin offset');
  for (const vertices of columns.values()) {
    const upper = vertices.find(v => v.offset === 0);
    const lower = vertices.find(v => v.offset > 0);
    assert.ok(upper && lower);
    assert.ok(Math.abs(upper.z - (lower.z + lower.offset)) < 1e-12,
      'upper and lower vertices reconstruct the same upper surface');
    const thickness = upper.z - lower.z;
    for (const shapeScale of [.58, 1.12]) {
      function deform(v) {
        const top = v.z + v.offset;
        const freeLift = Math.max(0, top - v.attachment);
        return top + freeLift * (shapeScale - 1) - v.offset;
      }
      assert.ok(Math.abs(deform(upper) - deform(lower) - thickness) < 1e-12,
        'dry and hydrated curl keep the original shell thickness');
    }
  }
});
