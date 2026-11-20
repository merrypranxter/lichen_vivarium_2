// Phase 11: ecological succession without compromising Codex's specimen history.
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const scope={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','succession-ecology.js'),'utf8'),scope);
const create=scope.window.LichenSuccession.create;
function scene(N=24){
  const size=N*N;
  const params={successionInfluence:1.35,successionPioneers:1.4,
    successionHeirs:1.6,successionCompetition:1.2};
  const fields={
    gridSize:N,biomass:new Float32Array(size),
    ageField:new Float32Array(size),necrosisField:new Float32Array(size),
    speciesField:new Uint8Array(size),colonyIdField:new Uint8Array(size),
    nutrientField:new Float32Array(size).fill(.78),
    waterField:new Float32Array(size).fill(.76),
    rockField:new Float32Array(size).fill(.6)
  };
  const weathering={fields:{
    memory:new Float32Array(size),
    etched:new Float32Array(size),
    oxides:new Float32Array(size),
    organics:new Float32Array(size)
  }};
  const pioneer=2*N+3,old=(N-3)*N+N-4;
  for(const key of ['memory','etched','oxides','organics'])
    weathering.fields[key][old]=.82;
  const ecology=create({...fields,weathering,params});
  return {fields,weathering,params,ecology,pioneer,old};
}
test('pioneer lichens favor fresh rock while successors favor old fungal scars',()=>{
  const s=scene();
  const a=s.ecology.recruitment(s.pioneer,0),b=s.ecology.recruitment(s.old,0);
  const c=s.ecology.recruitment(s.pioneer,1),d=s.ecology.recruitment(s.old,1);
  assert.ok(a>b,'crustose pioneer should favor unmodified mineral surfaces');
  assert.ok(d>c,'foliose should favor post-lichen niche');
  assert.ok(s.ecology.recruitment(s.old,4)>
            s.ecology.recruitment(s.pioneer,4));
  assert.ok(s.ecology.growthFactor(s.old,1)>
            s.ecology.growthFactor(s.pioneer,1));
});
test('propagule species selection changes predictably with geological history',()=>{
  const s=scene();const counts=site=>{
    const arr=new Array(5).fill(0);
    for(let k=0;k<1000;k++)arr[s.ecology.chooseSpecies(site,(k+.5)/1000,0)]++;
    return arr;
  };
  const fresh=counts(s.pioneer),old=counts(s.old);
  assert.ok(fresh[0]>old[0],'pioneers are selected more often on fresh rock');
  assert.ok(old[1]+old[2]+old[4]>fresh[1]+fresh[2]+fresh[4],
    'established niches recruit later guilds more often');
  assert.equal(fresh.reduce((a,b)=>a+b,0),1000);
});
test('competition is bounded, asymmetric and only affects mixed colonies',()=>{
  const s=scene();
  const a=s.ecology.competition(s.old,0,1);
  const b=s.ecology.competition(s.old,1,0);
  assert.ok(a>=.42&&a<=1&&b>=.42&&b<=1);
  assert.notEqual(a,b,'habitat suitability controls edge pressure');
  assert.equal(s.ecology.competition(s.old,1,1),1,
    'same guild has no artificial rivalry');
  s.params.successionCompetition=0;
  assert.equal(s.ecology.competition(s.old,0,1),1,
    'zero competition slider preserves existing border model');
});
test('succession zero gives exact original growth and establishment factors',()=>{
  const s=scene();s.params.successionInfluence=0;
  for(let guild=0;guild<5;guild++){
    for(const cell of [s.pioneer,s.old]){
      assert.equal(s.ecology.recruitment(cell,guild),1);
      assert.equal(s.ecology.growthFactor(cell,guild),1);
      assert.equal(s.ecology.establishment(cell,guild),1);
    }
  }
  assert.equal(s.ecology.competition(s.old,0,4),1);
});
test('recolonization reads the live geological memory with no persistent new arrays',()=>{
  const s=scene();
  const before=s.ecology.recruitment(s.pioneer,1);
  s.weathering.fields.memory[s.pioneer]=.9;
  s.weathering.fields.etched[s.pioneer]=.8;
  s.weathering.fields.organics[s.pioneer]=.8;
  assert.ok(s.ecology.recruitment(s.pioneer,1)>before);
  assert.ok(Object.keys(s.ecology).every(k=>k!=='reset'),
    'no new biological clocks or snapshot fields');
  const coverage=s.ecology.statistics();
  assert.ok(Number.isFinite(coverage.occupancy));
  assert.ok(coverage.successorNiches>=0);
});
test('diagnostic channels share the same computed pioneer and legacy niches',()=>{
  const s=scene(),N=s.fields.gridSize;
  const data=new Uint8Array(N*N*4);
  assert.equal(s.ecology.encodeRGBA(data),data);
  for(const i of [s.pioneer,s.old]){
    const j=i*4,niche=s.ecology.site(i);
    assert.ok(Math.abs(data[j]/255-niche.pioneer)<.005);
    assert.ok(Math.abs(data[j+1]/255-niche.secondary)<.005);
    assert.ok(Math.abs(data[j+2]/255-niche.legacy)<.005);
  }
  const i=4*N+4;
  s.fields.colonyIdField[i]=1;
  s.fields.colonyIdField[i+1]=2;
  s.fields.biomass[i+1]=.8;
  s.ecology.encodeRGBA(data);
  assert.equal(data[i*4+3],255,'biological contact boundary is visible');
});
test('app integrates successor selection, edge competition, and the Codex snapshot',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  for(const snippet of ['succession-ecology.js','LichenSuccession.create({',
    'successionEcology.chooseSpecies','successionEcology.recruitment',
    'successionEcology.competition','successionEcology.growthFactor',
    'successionEcology.establishment','successionEcology.encodeRGBA',
    'bool succession=uSubstrateView==9','createLichenSpecimenState',
    'window.setupLichenSpecimenStudio'])
    assert.ok(html.includes(snippet),'missing source integration: '+snippet);
  for(const id of ['successionInfluenceSlider','successionPioneerSlider',
    'successionHeirSlider','successionCompetitionSlider',
    'successionPioneerPreset','successionAncientPreset','successionStatus'])
    assert.equal(html.split('id="'+id+'"').length,2,
      'control is absent or duplicated: '+id);
  assert.ok(html.indexOf('LichenSuccession.create({')<
    html.lastIndexOf('seedDefaultSlateEcosystem();'),
    'ecology is ready for pre-grown biological time');
});
