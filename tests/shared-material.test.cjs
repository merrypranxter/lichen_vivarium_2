'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const sandbox={window:{},console:{warn(){}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','shared-material.js'),'utf8'),sandbox);

// These checks cover resource ownership and capability fallback. Actual shader
// compilation and output are checked by the rendered-browser study harness.
function fakeGL({float=true,failFloat=false,failAll=false}={}) {
  const events=[],uniforms=[];
  let id=0,internalFormat;
  const gl={};
  const constants=['VERTEX_SHADER','FRAGMENT_SHADER','COMPILE_STATUS','LINK_STATUS',
    'TEXTURE0','TEXTURE_2D','TEXTURE_MIN_FILTER','TEXTURE_MAG_FILTER','NEAREST',
    'TEXTURE_WRAP_S','TEXTURE_WRAP_T','CLAMP_TO_EDGE','RGBA16F','RGBA8','RGBA',
    'HALF_FLOAT','UNSIGNED_BYTE','RENDERBUFFER','DEPTH_COMPONENT24','FRAMEBUFFER',
    'COLOR_ATTACHMENT0','DEPTH_ATTACHMENT','FRAMEBUFFER_COMPLETE','SCISSOR_TEST',
    'COLOR_BUFFER_BIT','DEPTH_BUFFER_BIT','BLEND','DEPTH_TEST','TRIANGLES'];
  constants.forEach((name,index)=>{gl[name]=index+1;});
  for(const type of ['Shader','Program','VertexArray','Texture','Framebuffer','Renderbuffer']) {
    gl['create'+type]=()=>{const value={type,id:++id};events.push(['create',value]);return value;};
    gl['delete'+type]=value=>{if(value)events.push(['delete',value]);};
  }
  gl.getExtension=()=>float?{}:null;
  gl.getShaderParameter=gl.getProgramParameter=()=>true;
  gl.getUniformLocation=(_,name)=>name;
  gl.texImage2D=(_target,_level,format)=>{internalFormat=format;events.push(['allocate',format]);};
  gl.checkFramebufferStatus=()=>failAll||(failFloat&&internalFormat===gl.RGBA16F)?-1:gl.FRAMEBUFFER_COMPLETE;
  gl.uniform1f=gl.uniform1i=(name,value)=>uniforms.push([name,value]);
  for(const name of ['shaderSource','compileShader','attachShader','linkProgram',
    'activeTexture','bindTexture','texParameteri','bindRenderbuffer',
    'renderbufferStorage','bindFramebuffer','framebufferTexture2D',
    'framebufferRenderbuffer','viewport','disable','depthMask','clearColor',
    'clearDepth','clear','useProgram','bindVertexArray','drawArrays']) gl[name]=()=>{};
  return {gl,events,uniforms};
}
const make=options=>{
  const gpu=fakeGL(options);
  return {...gpu,compositor:sandbox.window.createLichenCompositor(gpu.gl)};
};

test('scene target reuses resources at the same size and releases them on resize/dispose',()=>{
  const {compositor,events}=make();
  assert.equal(compositor.begin(64,32).format,'RGBA16F');
  compositor.begin(64,32);
  assert.equal(events.filter(([kind])=>kind==='allocate').length,1);
  compositor.begin(128,64);
  compositor.dispose();
  const resources=events.filter(([kind,value])=>kind==='create'&&
    ['Framebuffer','Texture','Renderbuffer'].includes(value.type)).map(([,value])=>value);
  const deleted=events.filter(([kind])=>kind==='delete').map(([,value])=>value);
  assert.equal(resources.length,6);
  for(const resource of resources)assert.equal(deleted.filter(x=>x===resource).length,1);
});

test('missing float capabilities use a bounded linear RGBA8 target',()=>{
  const {compositor,events,gl}=make({float:false});
  assert.equal(compositor.begin(64,64).hdr,false);
  assert.equal(compositor.format,'RGBA8 linear (bounded)');
  assert.deepEqual(events.filter(([kind])=>kind==='allocate').map(([,format])=>format),[gl.RGBA8]);
  compositor.present();
  compositor.dispose();
});

test('incomplete float framebuffer is released before an RGBA8 retry',()=>{
  const {compositor,events,gl}=make({failFloat:true});
  assert.equal(compositor.begin(64,64).hdr,false);
  assert.deepEqual(events.filter(([kind])=>kind==='allocate').map(([,format])=>format),[gl.RGBA16F,gl.RGBA8]);
  const deleted=events.filter(([kind,value])=>kind==='delete'&&
    ['Framebuffer','Texture','Renderbuffer'].includes(value.type));
  assert.equal(deleted.length,3,'failed float target does not leak');
  compositor.dispose();
});

test('incomplete fallback rejects the frame instead of presenting an invalid target',()=>{
  const {compositor,events}=make({float:false,failAll:true});
  assert.throws(()=>compositor.begin(64,64),/Scene target incomplete/);
  assert.throws(()=>compositor.present(),/before begin/);
  assert.equal(events.filter(([kind,value])=>kind==='delete'&&
    ['Framebuffer','Texture','Renderbuffer'].includes(value.type)).length,3);
  compositor.dispose();
});

test('exposure defaults to one and diagnostic display is explicitly selected',()=>{
  const {compositor,uniforms}=make();
  compositor.begin(64,64);
  compositor.present();
  assert.ok(uniforms.some(([name,value])=>name==='uExposure'&&value===1));
  compositor.present({exposure:1.7,debug:true,grayscale:true,macroOptics:0,time:3});
  assert.ok(uniforms.some(([name,value])=>name==='uExposure'&&value===1.7));
  assert.ok(uniforms.some(([name,value])=>name==='uDebug'&&value===1));
  compositor.present({exposure:-2});
  assert.deepEqual(uniforms.filter(([name])=>name==='uExposure').at(-1),['uExposure',0]);
  compositor.dispose();
});
