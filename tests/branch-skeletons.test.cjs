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
      assert.equal(a.length,info.triangles*3*19);
      assert.deepEqual(a,b,'same seed must recreate the same geometry');
      assert.ok(a.every(Number.isFinite),'no NaN/Infinity GPU attributes');
      for(let j=0;j<a.length;j+=19){
        assert.equal(a[j+5],2,'default geometry type is fruticose branch');
        assert.ok(a[j+12]>=0 && a[j+12]<=.9,'tip birth threshold range');
        assert.equal(a[j+13],.16,'per-segment gradual growth window');
        const normal=Math.hypot(a[j+14],a[j+15],a[j+16]);
        assert.ok(normal>.98 && normal<1.02,'true tube surface normals normalized');
        assert.ok(a[j+17]>=0 && a[j+17]<=1,'circumferential UV range');
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
  for(let i=0;i<result.length;i+=19){
    const x=result[i+2],y=result[i+3],z=result[i+4];
    assert.ok(Math.abs(x)<.3 && Math.abs(y)<.3 && z>-.01 && z<2,
      'branch vertex should stay close to its holdfast');
  }
});

test('tip fibrils add bounded real 3D geometry, with stable seeds',()=>{
  for(const mode of ['cladonia','ramalina']){
    for(const quality of ['lite','rich']){
      const a=[],b=[];
      const opts={mode,quality,density:1,fibrilDensity:1.5};
      const v=grow(a,[.5,.5],.487,opts);
      grow(b,[.5,.5],.487,opts);
      assert.ok(v.fibrils>0,'fibrils appear at branch termini');
      assert.ok(v.fibrils<=(quality==='rich'?48:20),'mobile fibril cap');
      assert.equal(v.triangles,
        v.segments*(quality==='rich'?7:5)*2+v.fibrils*6);
      assert.equal(a.length,v.triangles*3*19);
      assert.deepEqual(a,b,'fibrils have stable seeded placement');
      assert.ok(a.every(Number.isFinite),'valid 3D tube/fibril positions and normals');
      let fibrilVertices=0;
      for(let j=0;j<a.length;j+=19){
        const kind=a[j+5];
        assert.ok(kind===2||kind===3,'typed lichen branch and fibril vertices');
        if(kind===3)fibrilVertices++;
      }
      assert.equal(fibrilVertices,v.fibrils*3*6,'every fibril is a 3-sided hollow tube');
    }
  }
});

test('fibril density zero retains existing skeleton within the original budget',()=>{
  const base=[],bare=[];
  const opts={mode:'cladonia',quality:'lite',density:1};
  const old=grow(base,[.5,.5],.71,opts);
  const zero=grow(bare,[.5,.5],.71,{...opts,fibrilDensity:0});
  assert.deepEqual(base,bare);
  assert.equal(old.segments,zero.segments);
  assert.equal(old.fibrils,0);
});
