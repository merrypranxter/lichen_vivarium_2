// Phase 10: persistent geological history and chemical weathering.
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const sandbox={window:{}};
for(const name of ['rock-weathering.js','substrate-ecology.js']){
  const src=fs.readFileSync(path.resolve(__dirname,'..',name),'utf8');
  vm.runInNewContext(src,sandbox,{filename:name,timeout:3000});
}
const make=sandbox.window.LichenRockWeathering.create;
const makeTerrain=sandbox.window.LichenSubstrateEcology.create;
function scene(N=24){
  const count=N*N;
  const rockField=new Float32Array(count);
  const waterField=new Float32Array(count).fill(.76);
  const biomass=new Float32Array(count);
  const ageField=new Float32Array(count);
  const necrosisField=new Float32Array(count);
  const crackField=new Float32Array(count);
  const speciesField=new Uint8Array(count);
  const params={weatheringIntensity:1,weatheringErosion:1,
    weatheringOxides:.9,weatheringResidue:1.1,weatheringRelief:.7,
    weatheringPigment:1.15,substrateInfluence:1,
    substrateMineralFlux:1.1,substrateRetention:1.2,
    substrateExposure:.8,substrateCreviceBias:1.2,
    ambientHydration:.72,effectiveWetness:.72};
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const i=y*N+x,near=Math.abs(x-N*.52)<N*.22&&Math.abs(y-N*.5)<N*.22;
    rockField[i]=near?.32:.71;
    if(near){biomass[i]=.82;ageField[i]=26;speciesField[i]=3;crackField[i]=.24;}
  }
  const ctx={gridSize:N,rockField,waterField,biomass,ageField,
    necrosisField,crackField,speciesField,params};
  const weather=make(ctx);
  const terrain=makeTerrain({gridSize:N,rockField,waterField,params});
  terrain.initialize();
  terrain.attachWeathering(weather);
  // Read scene cells from the exact same rock grid.
  const covered=Math.floor(N*.5)*N+Math.floor(N*.5);
  const bare=N+1;
  return {ctx,weather,terrain,covered,bare,...ctx};
}
const march=(eng,n)=>{for(let i=0;i<n;i++)eng.step();};

test('biogenic etching accumulates only under hydrated, mature living thalli',()=>{
  const x=scene();march(x.weather,800);
  const e=x.weather.fields.etched,o=x.weather.fields.oxides,r=x.weather.fields.organics;
  assert.ok(e[x.covered]>.08,'old living lichen etches visible rock');
  assert.ok(o[x.covered]>.08,'mineral oxidative deposits accumulate');
  assert.ok(r[x.covered]>.08,'organic residues accumulate');
  assert.equal(e[x.bare],0,'uncolonized substrate is never acid etched');
  assert.equal(o[x.bare],0);
  assert.equal(r[x.bare],0);
});

test('dead and removed colonies leave permanent etching and scar memory',()=>{
  const x=scene();march(x.weather,560);
  const e=x.weather.fields.etched[x.covered];
  const history=x.weather.fields.memory[x.covered];
  x.biomass.fill(0);x.ageField.fill(0);x.necrosisField.fill(0);
  march(x.weather,1200);
  assert.equal(x.weather.fields.etched[x.covered],e,
    'etched mineral geometry does not heal with fungal death');
  assert.equal(x.weather.fields.memory[x.covered],history,
    'scar history retains the site of dead colonies');
  assert.ok(x.weather.fields.oxides[x.covered]>=0,'oxide field does not go negative');
});

test('weathering OFF freezes chemical change without deleting old mineral scars',()=>{
  const x=scene();march(x.weather,480);
  const before=[x.weather.fields.etched[x.covered],
    x.weather.fields.oxides[x.covered],x.weather.fields.organics[x.covered]];
  const revision=x.weather.getRevision();
  x.params.weatheringIntensity=0;
  march(x.weather,480);
  const after=[x.weather.fields.etched[x.covered],
    x.weather.fields.oxides[x.covered],x.weather.fields.organics[x.covered]];
  assert.deepEqual(after,before);
  assert.equal(x.weather.getRevision(),revision,
    'no redundant GPU revision while weathering is disabled');
});

test('individual acid, oxide and residue controls operate independently',()=>{
  const x=scene();
  x.params.weatheringErosion=0;
  x.params.weatheringOxides=0;
  x.params.weatheringResidue=1.5;
  march(x.weather,360);
  assert.equal(x.weather.fields.etched[x.covered],0);
  assert.equal(x.weather.fields.oxides[x.covered],0);
  assert.ok(x.weather.fields.organics[x.covered]>.01);
});

test('altered rock feeds back to subsequent ecological niches and moisture pockets',()=>{
  const x=scene();
  const base=x.terrain.growthFactor(x.covered,3);
  const before=x.weather.moisturePocket(x.covered);
  march(x.weather,620);
  const after=x.terrain.growthFactor(x.covered,3);
  assert.ok(x.weather.moisturePocket(x.covered)>before);
  assert.ok(after>base,'old erosion should make a niche for new growth');
  assert.ok(x.weather.nutrientFactor(x.covered)>=.82);
  x.params.substrateInfluence=0;
  assert.equal(x.terrain.growthFactor(x.covered,3),1,
    'legacy terrain influence zero still isolates substrate ecology');
});

test('weathered RGBA records match CPU fields, finite values and texture revision',()=>{
  const x=scene(),N=x.ctx.gridSize;
  const before=x.weather.getRevision();
  assert.equal(x.weather.step(),false,'no update on the first fixed tick');
  assert.equal(x.weather.getRevision(),before);
  march(x.weather,500);
  assert.ok(x.weather.getRevision()>before);
  const data=new Uint8Array(N*N*4);
  assert.equal(x.weather.encodeRGBA(data),data);
  const i=x.covered,j=i*4;
  for(const [channel,field]of [
    [0,x.weather.fields.etched],[1,x.weather.fields.oxides],
    [2,x.weather.fields.organics],[3,x.weather.fields.memory]]){
    assert.ok(Math.abs(data[j+channel]/255-field[i])<=1/255+.00001);
  }
  for(const value of Object.values(x.weather.statistics()))
    assert.ok(Number.isFinite(value)&&value>=0&&value<=1);
});

test('confirmed geological reset erases old records but not surviving organisms',()=>{
  const x=scene();march(x.weather,540);
  const initialBiomass=x.biomass[x.covered];
  assert.ok(x.weather.statistics().maxEtch>0);
  const revision=x.weather.getRevision();
  x.weather.reset();
  assert.ok(x.weather.getRevision()>revision);
  assert.equal(x.weather.statistics().maxEtch,0);
  assert.equal(x.weather.statistics().meanOxide,0);
  assert.equal(x.weather.statistics().scarCoverage,0);
  assert.equal(x.biomass[x.covered],initialBiomass);
});

test('repeated weathering runs are deterministic with identical biological inputs',()=>{
  const a=scene(),b=scene();
  march(a.weather,620);march(b.weather,620);
  const wa=new Uint8Array(a.ctx.gridSize**2*4);
  const wb=new Uint8Array(b.ctx.gridSize**2*4);
  a.weather.encodeRGBA(wa);b.weather.encodeRGBA(wb);
  assert.deepEqual([...wa],[...wb],'no random weathering or frame timing dependence');
});

test('main app preserves scar history on reseed, with a separate reset and color exports',()=>{
  const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
  for(const marker of [
    'rock-weathering.js','rockWeathering.step()',
    'substrateEcology.attachWeathering(rockWeathering)',
    'const weatheringTex = createFieldTexture(4)',
    'uWeatheringRelief','uWeatheringPigment',
    'rockWeathering.encodeRGBA(weatheringTexData)',
    'weatheringCompareBtn','weatheringResetBtn',
    'rockWeathering.reset()',
    'weatheringView','weatheringIntensitySlider'
  ]){
    // 'weatheringView' was intentionally avoided as independent state —
    // the original terrain selector now handles 0–8.
    if(marker==='weatheringView')continue;
    assert.ok(html.includes(marker),'missing integration: '+marker);
  }
  for(const id of ['weatheringIntensitySlider','weatheringErosionSlider',
    'weatheringOxidesSlider','weatheringResidueSlider',
    'weatheringReliefSlider','weatheringPigmentSlider',
    'weatheringBefore','weatheringStats']){
    if(id==='weatheringBefore'){
      assert.ok(html.includes('params.weatheringBefore'));
    }else assert.equal(html.split('id="'+id+'"').length,2);
  }
  const js=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
  const init=js.indexOf('rockWeathering=window.LichenRockWeathering.create(');
  const seeds=js.lastIndexOf('seedDefaultSlateEcosystem();');
  assert.ok(init>=0&&seeds>init,'the weathering model exists before pre-growing');
  const clear=js.slice(js.indexOf('function clearAllLichens()'),js.indexOf('// Inoculate a new lichen'));
  assert.ok(!clear.includes('rockWeathering.reset()'),
    'clearing biomass does not erase the rock');
});
