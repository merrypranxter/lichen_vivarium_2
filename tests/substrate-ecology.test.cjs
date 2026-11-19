// Phase 9 — living substrate ecology and habitat diagnostic regression tests.
// No npm packages: node --test tests/*.test.cjs
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../substrate-ecology.js'),'utf8');
const scope={window:{}};
vm.runInNewContext(source,scope,{filename:'substrate-ecology.js',timeout:3000});
const create=scope.window.LichenSubstrateEcology.create;
function makeField(N=64,flat=false){
  const rockField=new Float32Array(N*N);
  const waterField=new Float32Array(N*N).fill(.45);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const u=x/(N-1),v=y/(N-1);
    const valley=Math.exp(-Math.pow((v-.50)-.1*Math.sin(u*8),2)*2200);
    const height=.66+.19*Math.floor(u*9)/9-.60*valley;
    rockField[y*N+x]=flat?.45:Math.max(0,Math.min(1,height));
  }
  const params={ambientHydration:.45,effectiveWetness:.45,
    substrateInfluence:1,substrateRetention:1.3,
    substrateExposure:.9,substrateCreviceBias:1.5,
    substrateMineralFlux:1.2};
  const engine=create({gridSize:N,rockField,waterField,params});
  engine.initialize();
  return {N,rockField,waterField,params,engine};
}
function extremaAtX(f,x){
  const ids=Array.from({length:f.N-2},(_,j)=>(j+1)*f.N+x);
  const low=ids.reduce((a,b)=>f.rockField[a]<f.rockField[b]?a:b);
  const high=ids.reduce((a,b)=>f.rockField[a]>f.rockField[b]?a:b);
  return {low,high};
}
test('rock depressions hold more water than exposed raised ridges',()=>{
  const f=makeField(),{low,high}=extremaAtX(f,30);
  for(let t=0;t<240;t++)f.engine.step();
  assert.ok(f.rockField[low]<f.rockField[high]);
  assert.ok(f.engine.fields.crevice[low]>f.engine.fields.crevice[high]+.3);
  assert.ok(f.waterField[low]>f.waterField[high]+.08,
    'crevice reservoir must actually retain moisture');
  const m=f.engine.statistics();
  for(const value of Object.values(m))
    assert.ok(Number.isFinite(value)&&value>=0&&value<=1);
});

test('different species and crack affinity make different habitat multipliers',()=>{
  const f=makeField(),{low,high}=extremaAtX(f,30);
  for(let t=0;t<240;t++)f.engine.step();
  assert.ok(f.engine.growthFactor(low,4)>f.engine.growthFactor(high,4)+.15,
    'gelatinous habitat favors retained moisture');
  assert.ok(f.engine.growthFactor(low,3)>f.engine.growthFactor(high,3)+.1,
    'squamulose growth should find a habitat advantage in fissures');
  const before=f.engine.growthFactor(low,3);
  f.params.substrateCreviceBias=0;
  const after=f.engine.growthFactor(low,3);
  assert.ok(before>after,'crevice affinity slider changes actual growth rates');
  assert.notEqual(f.engine.growthFactor(low,0),f.engine.growthFactor(low,4),
    'ecological growth form preferences are distinct');
});

test('quartz-line mineral seam corresponds to visible GPU vein trajectory',()=>{
  const f=makeField(64,true);
  const x=Math.round(.35*f.N);
  const on=(Math.round(.655*f.N)*f.N+x);
  const off=(Math.round(.19*f.N)*f.N+x);
  assert.ok(f.engine.fields.mineral[on]>f.engine.fields.mineral[off]+.15,
    'real quartz path adds a mineral-rich local seam');
  assert.ok(f.engine.replenishment(on)>f.engine.replenishment(off),
    'mineral seam affects nutrient replenishment');
});

test('terrain influence zero preserves original growth, stress and leaching',()=>{
  const f=makeField(),{low,high}=extremaAtX(f,30);
  f.params.substrateInfluence=0;
  for(let sp=0;sp<5;sp++){
    assert.equal(f.engine.growthFactor(low,sp),1);
    assert.equal(f.engine.growthFactor(high,sp),1);
  }
  assert.equal(f.engine.replenishment(low),1);
  assert.equal(f.engine.desiccation(high),1);
});

test('rainfall, desiccation and mineral feedback remain finite and reversible',()=>{
  const f=makeField(),{low,high}=extremaAtX(f,30);
  f.waterField.fill(1.0);
  f.params.ambientHydration=.85;
  for(let k=0;k<50;k++)f.engine.step();
  const rainy=f.waterField[low];
  f.params.ambientHydration=.07;
  for(let k=0;k<210;k++)f.engine.step();
  assert.ok(f.waterField[low]<rainy,'reservoirs eventually dry');
  for(const i of [low,high]){
    assert.ok(f.waterField[i]>=0&&f.waterField[i]<=1);
    assert.ok(f.engine.growthFactor(i,2)>=.34 && f.engine.growthFactor(i,2)<=1.85);
  }
});

test('RGBA habitat texture encodes the same living water, mineral and rock arrays',()=>{
  const f=makeField(),data=new Uint8Array(f.N*f.N*4);
  for(let k=0;k<42;k++)f.engine.step();
  assert.equal(f.engine.encodeRGBA(data),data);
  const i=31*f.N+30,j=i*4;
  assert.ok(Math.abs(data[j]/255-f.waterField[i])<1/255+.0001);
  assert.ok(Math.abs(data[j+1]/255-f.engine.fields.mineral[i])<1/255+.0001);
  assert.ok(Math.abs(data[j+2]/255-f.engine.fields.crevice[i])<1/255+.0001);
  assert.ok(Math.abs(data[j+3]/255-f.engine.fields.exposure[i])<1/255+.0001);
});

test('app connects substrate to growth, aging, spores, diagnostics and export shader',()=>{
  const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
  for(const part of ['substrate-ecology.js','substrateEcology.step()',
    'substrateEcology.growthFactor(i, frontSp)',
    'substrateEcology.growthFactor(i, sp)',
    'substrateEcology.replenishment(i)','substrateEcology.desiccation(i)',
    'substrateEcology.growthFactor(rIdx,randomSpecies)',
    'substrateEcology.encodeRGBA(substrateTexData)',
    'const substrateTex = createFieldTexture(3)',
    'gl.uniform1i(uniforms.uSubstrateView',
    'uniform sampler2D uSubstrateMap'])
    assert.ok(html.includes(part),'app integration missing: '+part);
  for(const id of ['tab-substrate','substrateInfluenceSlider',
    'substrateRetentionSlider','substrateExposureSlider',
    'substrateCreviceSlider','substrateMineralSlider',
    'substrateViewSelect','substrateWetPreset','substrateHarshPreset'])
    assert.equal(html.split('id="'+id+'"').length,2,'unique control '+id);
});
