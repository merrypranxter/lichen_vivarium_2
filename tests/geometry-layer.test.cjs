// Phase 6: regression tests for the optional lichen 3D mesh layer.
// No browser required and no third-party packages.
// Run: node --test tests/*.test.cjs
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const sources = ['branch-skeletons.js','geometry-layer.js']
  .map(f=>fs.readFileSync(path.resolve(__dirname,'..',f),'utf8'));
const sandbox={window:{}};
for(const source of sources)vm.runInNewContext(source,sandbox,{timeout:3000});

function makeFields(){
  const N=256*256;
  const f={GRID_SIZE:256,biomass:new Float32Array(N),
    ageField:new Float32Array(N),fruitingField:new Float32Array(N),
    speciesField:new Uint8Array(N),colonyIdField:new Uint8Array(N),
    colonyOriginX:new Float32Array(256),colonyOriginY:new Float32Array(256)};
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
    branchFissures:.65,branchFibrils:.8,cupRise:1.25,
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
