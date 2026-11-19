// Dependency-free regression tests for the real 3D lichen branch grammars.
// Run: node --test tests/branch-skeletons.test.cjs
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../branch-skeletons.js'),'utf8');
const sandbox = { window: {} };
vm.runInNewContext(source,sandbox,{filename:'branch-skeletons.js',timeout:2000});
const grow = sandbox.window.LichenBranchSkeleton.grow;

test('each fruticose mode is deterministic, triangle-aligned and finite', () => {
  for (const mode of ['cladonia','ramalina']) {
    for (const quality of ['lite','rich']) {
      const a=[],b=[];
      const info = grow(a,[0.5,0.5],0.3571,{mode,quality,density:1});
      const again = grow(b,[0.5,0.5],0.3571,{mode,quality,density:1});
      assert.ok(info.segments>3,mode+' '+quality+' must branch');
      assert.ok(info.terminals>0,mode+' '+quality+' needs terminal tips');
      assert.equal(info.triangles,info.segments*(quality==='rich'?7:5)*2);
      assert.equal(a.length,info.triangles*3*14);
      assert.deepEqual(a,b,'same seed must recreate the same geometry');
      assert.ok(a.every(Number.isFinite),'no NaN/Infinity GPU attributes');
      for(let j=0;j<a.length;j+=14){
        assert.equal(a[j+5],2,'geometry type is fruticose branch');
        assert.ok(a[j+12]>=0 && a[j+12]<=.9,'tip birth threshold range');
        assert.equal(a[j+13],.16,'per-segment gradual growth window');
      }
    }
  }
});

test('Cladonia forms tip divisions and Ramalina uses a lateral bud architecture',()=>{
  const cladonia=[],ramalina=[];
  const c=grow(cladonia,[0.5,0.5],0.71,{mode:'cladonia',quality:'rich',density:1});
  const r=grow(ramalina,[0.5,0.5],0.71,{mode:'ramalina',quality:'rich',density:1});
  assert.ok(c.segments>r.segments,'branching grammars should be different');
  assert.notDeepEqual(cladonia,ramalina);
});

test('density changes seed-stable tree complexity and respects quality budgets',()=>{
  for(const mode of ['cladonia','ramalina']){
    const low=[],high=[];
    const a=grow(low,[0.5,0.5],0.42,{mode,quality:'lite',density:.5});
    const b=grow(high,[0.5,0.5],0.42,{mode,quality:'lite',density:2});
    assert.ok(a.segments < b.segments,'density should produce more stems');
    assert.ok(b.segments<=46,'lite must respect GPU segment cap');
    assert.ok(a.segments<=46,'lite must respect GPU segment cap');
  }
});

test('mature branch tip geometry stays within a bounded world domain',()=>{
  const result=[];
  grow(result,[.40,.60],.55,{mode:'cladonia',quality:'rich',density:2});
  for(let i=0;i<result.length;i+=14){
    const x=result[i+2],y=result[i+3],z=result[i+4];
    assert.ok(Math.abs(x)<.3 && Math.abs(y)<.3 && z>-.01 && z<2,
      'branch vertex should stay close to its holdfast');
  }
});
