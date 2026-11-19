// Phases 6–7: branch cortex + biologically attached basal thallus regressions.
// No browser required and no third-party packages.
// Run: node --test tests/*.test.cjs
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const sources = ['branch-skeletons.js','rhizine-network.js','geometry-layer.js']
  .map(f=>fs.readFileSync(path.resolve(__dirname,'..',f),'utf8'));
const sandbox={window:{}};
for(const source of sources)vm.runInNewContext(source,sandbox,{timeout:3000});

function makeFields(){
  const N=256*256;
  const f={GRID_SIZE:256,biomass:new Float32Array(N),
    ageField:new Float32Array(N),fruitingField:new Float32Array(N),
    speciesField:new Uint8Array(N),colonyIdField:new Uint8Array(N),
    colonyOriginX:new Float32Array(256),colonyOriginY:new Float32Array(256),
    rockField:new Float32Array(N),waterField:new Float32Array(N)};
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const u=x/256,v=y/256;
    const c=Math.exp(-2200*Math.pow((v-.52)+.38*(u-.5),2));
    f.rockField[y*256+x]=.65-.54*c+.08*Math.sin(u*41)*Math.cos(v*37);
    f.waterField[y*256+x]=.57+.35*c;
  }
  for(const [id,cx,cy,species,radius] of [
    [1,64,64,1,45],[2,170,170,3,48],[3,66,173,2,46]
  ]){
    f.colonyOriginX[id]=cx;f.colonyOriginY[id]=cy;
    for(let y=1;y<255;y++)for(let x=1;x<255;x++){
      if(Math.hypot(x-cx,y-cy)>=radius)continue;
      const i=y*256+x;
      f.biomass[i]=.84;f.ageField[i]=16;
      f.fruitingField[i]=species===3?.72:0;
      f.speciesField[i]=species;f.colonyIdField[i]=id;
    }
  }
  return f;
}
function fakeWebGL(){
  const shaders=[],buffers=[],draws=[],attrs=[],uniforms=[];
  const gl={VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,COMPILE_STATUS:35713,
    LINK_STATUS:35714,ARRAY_BUFFER:34962,FLOAT:5126,DYNAMIC_DRAW:35048,
    TEXTURE0:33984,TEXTURE1:33985,TEXTURE_2D:3553,TRIANGLES:4,BLEND:3042,
    DEPTH_TEST:2929,SRC_ALPHA:770,ONE_MINUS_SRC_ALPHA:771,
    DEPTH_BUFFER_BIT:256,LEQUAL:515,
    createShader(type){return {type};},
    shaderSource(sh,source){sh.source=source;shaders.push(source);},
    compileShader(){},getShaderParameter(){return true;},
    getShaderInfoLog(){return'';},deleteShader(){},
    createProgram(){return{};},attachShader(){},linkProgram(){},
    getProgramParameter(){return true;},getProgramInfoLog(){return'';},
    deleteProgram(){},getUniformLocation(_,name){return name;},
    createVertexArray(){return{};},createBuffer(){return{};},
    bindVertexArray(){},bindBuffer(){},
    enableVertexAttribArray(i){attrs.push(i);},
    vertexAttribPointer(i,size,type,norm,stride,offset){
      assert.equal(stride,19*4,'both mesh types use 19-float stride');
    },
    bufferData(_,data){buffers.push(new Float32Array(data));},
    useProgram(){},activeTexture(){},bindTexture(){},
    uniform1i(loc,val){uniforms.push([loc,val]);},
    uniform1f(loc,val){uniforms.push([loc,val]);},
    uniform2f(){},uniform3f(){},
    enable(){},disable(){},blendFunc(){},clear(){},
    depthFunc(){},depthMask(){},
    drawArrays(type,start,count){draws.push({type,count});},
    deleteVertexArray(){},deleteBuffer(){}
  };
  return {gl,shaders,buffers,draws,attrs,uniforms};
}
function makeScene(){
  const gpu=fakeWebGL();
  const params={geometryQuality:'lite',geometryDepth:1,geometryTilt:.65,
    branchPattern:'cladonia',branchDensity:1,branchHeight:1,
    branchCortexDetail:1.15,branchPowder:.85,
    branchFissures:.65,branchFibrils:.8,
    basalFusion:.90,basalSpread:1,basalVolume:1,
    rhizineDensity:1,rhizineGrip:1.3,rhizineLength:1,cupRise:1.25,
    lobeUnfurl:1.15,morphogenesis:1,effectiveWetness:.75,
    zoom:1,panX:0,panY:0,paletteMode:1};
  const layer=sandbox.window.createLichenGeometryLayer({
    gl:gpu.gl,fields:makeFields(),params,getYears:()=>22
  });
  const bindings={mainProgram:{},bioTex:{},auxTex:{},
    light:[.6,.45,.65]};
  return {...gpu,layer,params,bindings};
}

test('three lichen forms create live meshes and bounded 3D fibrils',()=>{
  const x=makeScene(),stats=x.layer.draw(2000,x.bindings);
  assert.ok(stats.cups>0,'scyphi visible');
  assert.ok(stats.lobes>0,'foliose raised ribbons visible');
  assert.ok(stats.branchStems>0,'fruticose axes present');
  assert.ok(stats.branchSegments>0,'branch segments present');
  assert.ok(stats.fibrils>0 && stats.fibrils<=20,'mobile fibril cap');
  assert.ok(stats.triangles<5000,'Lite triangle budget');
  assert.equal(x.draws.length,2,'shadow and physical mesh passes');
  assert.equal(x.buffers.at(-1).length,stats.triangles*3*19);
  assert.ok(x.buffers.at(-1).every(Number.isFinite));
  assert.deepEqual([...new Set(x.attrs)],[0,1,2,3,4,5,6,7]);
});

test('material shaders use true surface normals and stem UVs',()=>{
  const x=makeScene();
  const [vert,frag]=x.shaders;
  for(const tag of ['aCortexNormal','aCortexUV','vCortexNormal','vCortexUV']){
    assert.ok(vert.includes(tag),'vertex must carry '+tag);
  }
  for(const tag of ['uMeshCortexDetail','uMeshPowder','uMeshFissures',
    'uMeshBranchPattern','vCortexAge']){
    assert.ok(frag.includes(tag),'fragment shader must handle '+tag);
  }
  x.layer.draw(2000,x.bindings);
  const data=x.buffers.at(-1);
  let branchVertexCount=0,fibrilVertexCount=0;
  for(let i=0;i<data.length;i+=19){
    const kind=data[i+5];
    if(kind>=2){
      branchVertexCount++;
      if(kind===3)fibrilVertexCount++;
      const n=Math.hypot(data[i+14],data[i+15],data[i+16]);
      assert.ok(Math.abs(n-1)<.025,'analytic cortex normal');
      assert.ok(data[i+17]>=0 && data[i+17]<=1,'wrapped UV coordinate');
    }
  }
  assert.ok(branchVertexCount>0 && fibrilVertexCount>0);
});

test('switching growth architecture, density, and tip fibrils rebuilds optional mesh',()=>{
  const x=makeScene();
  const original=x.layer.draw(2000,x.bindings);
  x.params.branchPattern='ramalina';
  const switched=x.layer.draw(2100,x.bindings);
  assert.notEqual(switched.branchSegments,original.branchSegments);
  x.params.branchDensity=1.8;x.params.branchFibrils=2;
  const crowded=x.layer.draw(2200,x.bindings);
  assert.ok(crowded.branchSegments>switched.branchSegments);
  assert.ok(crowded.fibrils>=switched.fibrils && crowded.fibrils<=20);
  x.params.branchFibrils=0;
  const bare=x.layer.draw(2300,x.bindings);
  assert.equal(bare.fibrils,0,'zero must disable tip fibril geometry');
  assert.equal(x.buffers.length,4,'four on-demand rebuilds');
});

test('Rich detail raises fidelity and Off preserves the original renderer',()=>{
  const x=makeScene();
  const lite=x.layer.draw(2000,x.bindings);
  x.params.geometryQuality='rich';
  const rich=x.layer.draw(2100,x.bindings);
  assert.ok(rich.triangles>lite.triangles);
  assert.ok(rich.fibrils<=48);
  const before=x.draws.length;
  x.params.geometryQuality='off';
  x.layer.draw(2200,x.bindings);
  assert.equal(x.draws.length,before,'Off does not touch the framebuffer');
});

test('living holdfasts share real branch anchors and have closed radial skins',()=>{
  const x=makeScene();
  const stats=x.layer.draw(2000,x.bindings);
  assert.equal(stats.basalThalli,stats.branchStems,
    'every active branching colony receives one basal attachment');
  assert.ok(stats.basalThalli>0,'at least one living holdfast');
  const data=x.buffers.at(-1);
  const roots=[];
  const branches=[];
  for(let i=0;i<data.length;i+=19){
    if(data[i+5]===4)roots.push(i);
    if(data[i+5]===2)branches.push(i);
  }
  assert.ok(roots.length>100,'multi-ring root shell has real triangular surfaces');
  assert.ok(branches.length>0,'branch tubes are still present');
  const anchor=data.slice(roots[0],roots[0]+2);
  const attached=branches.some(i=>
    Math.hypot(data[i]-anchor[0],data[i+1]-anchor[1])<1e-6);
  assert.ok(attached,'basal thallus and branch tubes share the same origin');
  for(const i of roots){
    const radial=Math.hypot(data[i+2],data[i+3]);
    assert.ok(radial<0.04,'root geometry remains local to its holdfast');
    assert.ok(data[i+4]>-.3 && data[i+4]<1.2,
      'domed root cortex and underside remain finite');
    const norm=Math.hypot(data[i+14],data[i+15],data[i+16]);
    assert.ok(Math.abs(norm-1)<.025,'root cortex normals are normalized');
  }
  const VS=x.shaders[0],FS=x.shaders[1];
  for(const name of ['uMeshBasalFusion','uMeshBasalSpread','uMeshBasalVolume'])
    assert.ok(VS.includes('uniform float '+name+';'),
      'mesh vertex shader exposes '+name);
  assert.ok(FS.includes('vMeshType>3.5'),
    'living root cortex uses a distinct material branch');
});

test('zero attachment removes only basal geometry, leaving branches intact',()=>{
  const x=makeScene();
  const attached=x.layer.draw(2000,x.bindings);
  const beforeBuffers=x.buffers.length;
  x.params.basalFusion=0;
  const detached=x.layer.draw(2100,x.bindings);
  assert.equal(detached.basalThalli,0,'no basal triangles when fusion is zero');
  assert.equal(detached.branchSegments,attached.branchSegments,
    'the skeleton and biological colony remain unchanged');
  assert.ok(detached.triangles<attached.triangles);
  assert.equal(x.buffers.length,beforeBuffers+1,'only optional mesh rebuilt');
  x.params.basalFusion=.8;
  const restored=x.layer.draw(2200,x.bindings);
  assert.equal(restored.basalThalli,attached.basalThalli,
    'restored root attachment after enabling fusion');
});

test('root thickness/fusion update uniforms; spread rebuilds crevice-guided rhizines',()=>{
  const x=makeScene();
  x.layer.draw(2000,x.bindings);
  const before=x.buffers.length;
  x.params.basalVolume=.35;
  x.params.basalFusion=.55;
  x.layer.draw(2100,x.bindings);
  assert.equal(x.buffers.length,before,
    'height and opacity update on GPU without mesh rebuild');
  x.params.basalSpread=1.55;
  x.layer.draw(2200,x.bindings);
  assert.equal(x.buffers.length,before+1,
    'spread re-anchors rhizine routes against real rock cracks');
  const recent=x.uniforms.slice(-40);
  assert.ok(recent.some(([name,v])=>name==='uMeshBasalSpread'&&v===1.55));
  assert.ok(recent.some(([name,v])=>name==='uMeshBasalVolume'&&v===.35));
  assert.ok(recent.some(([name,v])=>name==='uMeshBasalFusion'&&v===.55));
});

test('rock-gripping rhizines share living holdfast origins and remain bounded',()=>{
  const x=makeScene(),stats=x.layer.draw(2000,x.bindings);
  assert.ok(stats.rhizines>0,'rhizines emerge from fruticose holdfast');
  assert.ok(stats.rhizines<=15*stats.basalThalli,'Lite budget is hard capped');
  assert.ok(stats.rhizineForks>0,'daughter rootlets branch from established fibers');
  assert.ok(stats.rhizineSegments>stats.rhizines,'multiple physical segments per rootlet');
  const data=x.buffers.at(-1);
  let rootlets=0;
  for(let i=0;i<data.length;i+=19){
    if(data[i+5]!==5)continue;
    rootlets++;
    const n=Math.hypot(data[i+14],data[i+15],data[i+16]);
    assert.ok(Math.abs(n-1)<.025,'rootlet normals are normalized');
    assert.ok(Number.isFinite(data[i+12]) && data[i+12]>=0,
      'growth birth threshold follows living biology');
    assert.ok(Math.abs(data[i+2])<.15 && Math.abs(data[i+3])<.15,
      'rootlets stay near their shared colony origin');
  }
  assert.ok(rootlets>100,'rootlets are true 3D tube triangles');
});

test('increasing crevice affinity selects lower rock valleys, not random decoration',()=>{
  const f=makeFields(),anchor=[.5,.5],seed=.782;
  const base={rockField:f.rockField,waterField:f.waterField,gridSize:256,
    quality:'lite',density:1.4,length:1.1};
  const loose=[],clinging=[],repeat=[];
  const a=sandbox.window.LichenRhizines.grow(loose,anchor,seed,{...base,grip:0});
  const b=sandbox.window.LichenRhizines.grow(clinging,anchor,seed,{...base,grip:2});
  const c=sandbox.window.LichenRhizines.grow(repeat,anchor,seed,{...base,grip:2});
  assert.ok(b.avgRockTip<a.avgRockTip-.015,
    'high grip should finish in lower/wetter rock crevices');
  assert.equal(b.roots,a.roots,'grip changes direction, not density');
  assert.equal(b.triangles,b.segments*6,'Lite uses three-sided 3D tubes');
  assert.equal(clinging.length,b.triangles*3*19);
  assert.deepEqual(clinging,repeat,'terrain-guided paths must be deterministic');
  assert.equal(b.avgRockTip,c.avgRockTip);
});

test('turning rhizines off preserves branches, lobes, cups, and basal tissue',()=>{
  const x=makeScene();
  const before=x.layer.draw(2000,x.bindings);
  const n=x.buffers.length;
  x.params.rhizineDensity=0;
  const disabled=x.layer.draw(2100,x.bindings);
  assert.equal(disabled.rhizines,0);
  assert.equal(disabled.rhizineSegments,0);
  assert.equal(disabled.basalThalli,before.basalThalli);
  assert.equal(disabled.branchSegments,before.branchSegments);
  assert.equal(disabled.cups,before.cups);
  assert.equal(disabled.lobes,before.lobes);
  assert.ok(disabled.triangles<before.triangles);
  assert.equal(x.buffers.length,n+1,'only optional geometry rebuilds');
  x.params.rhizineDensity=1;
  const restored=x.layer.draw(2200,x.bindings);
  assert.equal(restored.rhizines,before.rhizines);
});

test('Rich rhizines obey cap and never rebuild every frame',()=>{
  const x=makeScene();
  x.params.geometryQuality='rich';x.params.rhizineDensity=2;
  const first=x.layer.draw(2000,x.bindings);
  assert.ok(first.rhizines>0 && first.rhizines<=30*first.basalThalli);
  const uploads=x.buffers.length;
  x.layer.draw(2016,x.bindings);
  x.layer.draw(2032,x.bindings);
  assert.equal(x.buffers.length,uploads,'GPU sim changes do not rebuild static root paths');
});
