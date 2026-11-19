/* Lichen Vivarium II: optional true-triangle anatomical layer.
   Pixie-cup rings and lifted foliose ribbons are actual GPU vertices,
   not an image-space displacement effect. The original shader survives any failure.
   No dependencies, secondary canvas, Three.js or paid APIs. */
(function () {
  'use strict';

  window.createLichenGeometryLayer = function createLichenGeometryLayer(api) {
    const { gl, fields, params, getYears } = api;
    const {
      GRID_SIZE, biomass, ageField, fruitingField, speciesField,
      colonyIdField, colonyOriginX, colonyOriginY
    } = fields;
    const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
    const hash = (a,b) => {
      let x = Math.imul(a + 173, 1597334677) ^ Math.imul(b + 29, 3812015801);
      x = Math.imul(x ^ (x >>> 16), 2246822519);
      return ((x ^ (x >>> 13)) >>> 0) / 4294967295;
    };
    const vert = `#version 300 es
precision highp float;
layout(location=0) in vec2 aAnchor;
layout(location=1) in vec3 aLocal;
layout(location=2) in vec2 aMeta;
uniform sampler2D uMeshBio;
uniform sampler2D uMeshAux;
uniform float uMeshZoom;
uniform vec2 uMeshPan;
uniform float uMeshWet;
uniform float uMeshDepth;
uniform float uMeshTilt;
uniform float uMeshCupRise;
uniform float uMeshLobeCurl;
uniform float uMeshMorph;
uniform vec3 uMeshLight;
uniform bool uMeshShadow;
out vec3 vMeshWorld;
out vec2 vMeshUV;
out float vMeshAlpha;
out float vMeshType;
out float vMeshSeed;
out float vMeshHeight;

void main() {
  float kind = aMeta.x; // 0: real hollow cup, 1: actual foliose ribbon.
  float baseZ = 0.0;
  vec2 uv = aAnchor;
  vec4 b = texture(uMeshBio, clamp(uv,0.002,0.998));
  vec4 aux = texture(uMeshAux, clamp(uv,0.002,0.998));
  float alpha = 0.0;

  if (kind < 0.5) {
    // A real 3D podetium with a stalk, outward flaring rim and inward-dipping cup.
    // Living fruiting tissue drives the geometry stage (no periodic wobble).
    float fruit = aux.g;
    float stage = smoothstep(0.012,0.83,fruit) * smoothstep(0.055,0.36,b.r);
    float stalk = smoothstep(0.0,0.40,stage);
    float flare = smoothstep(0.16,0.88,stage);
    float radiusScale = mix(1.0, mix(0.20,1.0,flare),uMeshMorph);
    uv += aLocal.xy * 0.014 * radiusScale;
    baseZ = aLocal.z * 0.040 * mix(1.0,stalk,uMeshMorph) *
            max(0.0,uMeshCupRise) * uMeshDepth;
    alpha = smoothstep(0.012,0.19,fruit)
          * smoothstep(0.048,0.18,b.r) * (1.0-b.a);
    alpha *= 1.0-step(0.5,abs(aux.r*4.0-3.0));
  } else {
    // Lift the edges of a triangulated foliose sheet. Keep the root attached.
    uv += aLocal.xy;
    b = texture(uMeshBio, clamp(uv,0.002,0.998));
    aux = texture(uMeshAux, clamp(uv,0.002,0.998));
    float age = smoothstep(0.003,0.17,b.g);
    float mature = smoothstep(0.055,0.29,b.r);
    float curl = aLocal.z * (0.5+0.5*(1.0-uMeshWet))
                 * max(0.0,uMeshLobeCurl) * age;
    baseZ = (0.0025 + 0.023*curl*uMeshMorph) * mature * uMeshDepth;
    alpha = smoothstep(0.045,0.24,b.r) * smoothstep(0.002,0.07,b.g)
            * (1.0-b.a);
    alpha *= 1.0-step(0.5,abs(aux.r*4.0-1.0));
  }

  float h = max(0.0,baseZ);
  vec2 xy = uv;
  if (uMeshShadow) {
    // Shadows are projections of the triangle geometry along the real sun vector.
    xy -= uMeshLight.xy * h * (0.35 / max(0.15,uMeshLight.z));
  } else {
    // Oblique macro lens: the rock plane stays registered to the base renderer
    // while height genuinely changes the mesh silhouette and surface shading.
    xy += vec2(-0.18,0.55) * h * uMeshTilt;
  }
  vec2 clip = (xy-0.5-uMeshPan)*2.0*uMeshZoom;
  gl_Position = vec4(clip, uMeshShadow ? -0.95 : -0.17-h*0.5, 1.0);
  vMeshWorld = vec3(uv,h);
  vMeshUV=uv;
  vMeshHeight=h;
  vMeshAlpha=alpha;
  vMeshSeed=aMeta.y;
  vMeshType=kind;
}
`;
    const frag = `#version 300 es
precision highp float;
in vec3 vMeshWorld;
in vec2 vMeshUV;
in float vMeshAlpha;
in float vMeshType;
in float vMeshSeed;
in float vMeshHeight;
uniform sampler2D uMeshRamp;
uniform int uMeshPaletteMode;
uniform vec3 uMeshLight;
uniform bool uMeshShadow;
out vec4 fragColor;
float noise21(vec2 p) {
  return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
}
void main() {
  if (vMeshAlpha < 0.026) discard;
  if (uMeshShadow) {
    fragColor=vec4(0.008,0.009,0.014,vMeshAlpha*0.34);
    return;
  }
  vec3 dpdx=dFdx(vMeshWorld);
  vec3 dpdy=dFdy(vMeshWorld);
  vec3 n=normalize(cross(dpdx,dpdy));
  if (!gl_FrontFacing) n=-n;
  n.z=abs(n.z);
  n=normalize(n);
  vec3 light=normalize(uMeshLight);
  float diffuse=max(0.0,dot(n,light));
  float diffuseBack=max(0.0,dot(n,-light));
  float seed=fract(vMeshSeed*0.72+vMeshType*0.33);
  vec3 base;
  if (uMeshPaletteMode == 6) {
    base=texture(uMeshRamp,vec2(fract(seed+vMeshHeight*1.25),0.5)).rgb;
  } else if (uMeshPaletteMode == 0) {
    base=vMeshType<0.5 ? vec3(0.70,0.83,0.47) : vec3(0.48,0.63,0.31);
  } else if (uMeshPaletteMode == 1) {
    base=mix(vec3(0.98,0.11,0.79),vec3(0.08,0.96,0.94),seed);
  } else if (uMeshPaletteMode == 2) {
    base=mix(vec3(0.22,0.29,0.92),vec3(0.45,0.98,0.78),seed);
  } else if (uMeshPaletteMode == 3) {
    base=mix(vec3(0.65,0.98,0.07),vec3(0.83,0.08,0.97),seed);
  } else if (uMeshPaletteMode == 4) {
    base=mix(vec3(0.04,0.45,0.96),vec3(0.06,1.0,0.81),seed);
  } else {
    base=mix(vec3(0.98,0.16,0.34),vec3(1.0,0.78,0.15),seed);
  }
  // Micrograins and rim reflectance anchor these to the original lichen material.
  float granular=noise21(floor(vMeshUV*1800.0));
  base*=mix(0.89,1.07,granular);
  float sheen=pow(max(0.0,dot(reflect(-light,n),vec3(0.0,0.0,1.0))),32.0);
  vec3 lit=base*(0.24+diffuse*0.77+diffuseBack*0.12)+vec3(sheen*0.16);
  // A gentle spectral edge sheen remains subordinate to the detailed base shader.
  float fringe=pow(1.0-abs(n.z),2.0);
  lit+=base*fringe*0.12;
  lit=lit/(lit+vec3(0.30));
  fragColor=vec4(clamp(lit,0.0,1.0),vMeshAlpha*(vMeshType<0.5?0.95:0.74));
}
`;

    function shader(type,source) {
      const sh=gl.createShader(type);
      if (!sh) throw Error('WebGL shader allocation failed');
      gl.shaderSource(sh,source);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh,gl.COMPILE_STATUS)) {
        const message=gl.getShaderInfoLog(sh) || 'unknown shader error';
        gl.deleteShader(sh);
        throw Error('3D geometry shader: '+message);
      }
      return sh;
    }
    const vs=shader(gl.VERTEX_SHADER,vert), fs=shader(gl.FRAGMENT_SHADER,frag);
    const meshProgram=gl.createProgram();
    gl.attachShader(meshProgram,vs);
    gl.attachShader(meshProgram,fs);
    gl.linkProgram(meshProgram);
    gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(meshProgram,gl.LINK_STATUS)){
      const message=gl.getProgramInfoLog(meshProgram);
      gl.deleteProgram(meshProgram);
      throw Error('3D geometry program failed: '+message);
    }

    const loc={};
    for(const name of ['uMeshBio','uMeshAux','uMeshRamp','uMeshZoom','uMeshPan',
      'uMeshWet','uMeshDepth','uMeshTilt','uMeshCupRise','uMeshLobeCurl',
      'uMeshMorph','uMeshLight','uMeshShadow','uMeshPaletteMode']){
      loc[name]=gl.getUniformLocation(meshProgram,name);
    }
    const vao=gl.createVertexArray();
    const buffer=gl.createBuffer();
    if(!vao || !buffer)throw Error('3D mesh buffer allocation failed');
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    // [anchor.x, anchor.y, offset.x, offset.y, rise, type, stable color seed]
    const stride=7*4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0,2,gl.FLOAT,false,stride,0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1,3,gl.FLOAT,false,stride,2*4);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2,2,gl.FLOAT,false,stride,5*4);
    gl.bindVertexArray(null);

    const cupAnchors=new Map();
    const folioseAnchors=new Map();
    let vertexCount=0, lastScanMs=-Infinity, lastQuality='', currentYear=0;
    let stats={cups:0,lobes:0,triangles:0,quality:'off'};
    function getLimits(quality) {
      return quality==='rich'
        ? {cupLimit:44,lobeLimit:16,cupSegments:18,lobeSteps:14}
        : {cupLimit:16,lobeLimit:9,cupSegments:12,lobeSteps:10};
    }
    function add(arr,anchor,x,y,z,type,seed){
      arr.push(anchor[0],anchor[1],x,y,z,type,seed);
    }
    function cupGeometry(arr,anchor,seed,segments){
      // Each annular ring is a real 3D surface. The last two rings fold inward,
      // forming the hollow inside of the scyphus rather than a solid disk.
      const rings=[
        [.16,.04], [.25,.43], [.43,.78],
        [1.0,1.0], [.81,.99], [.42,.70], [.11,.57]
      ];
      function vertex(ring,n){
        const a=(2*Math.PI*n/segments)+seed*0.9;
        const crenelation=1.0+0.055*Math.cos(9*a+seed*19);
        return [Math.cos(a)*ring[0]*crenelation,
                Math.sin(a)*ring[0]*crenelation,
                ring[1]];
      }
      for(let k=0;k<rings.length-1;k++){
        for(let j=0;j<segments;j++){
          const a=vertex(rings[k],j),b=vertex(rings[k],j+1);
          const c=vertex(rings[k+1],j),d=vertex(rings[k+1],j+1);
          for(const v of [a,b,c,b,d,c])add(arr,anchor,v[0],v[1],v[2],0,seed);
        }
      }
    }
    function lobeGeometry(arr,anchor,seed,count,steps,number){
      const a=2*Math.PI*number/count+(seed-0.5)*0.21;
      const dir=[Math.cos(a),Math.sin(a)],side=[-dir[1],dir[0]];
      const outerR=0.075*(0.85+0.32*hash(number,Math.round(seed*999)));
      function vertex(k,edge){
        const t=k/steps;
        const r=t*outerR;
        const width=0.007*(0.25+0.75*Math.pow(Math.sin(Math.PI*(0.03+t*.94)),0.72));
        const displacement=edge*width*(0.48+0.52*t);
        // A slight asymmetric curl around each leaf tip breaks rotational symmetry.
        const lateralLift=Math.abs(edge)*(0.24+0.76*t*t);
        const tipLift=Math.pow(t,2.4);
        const x=dir[0]*r+side[0]*displacement+side[0]*Math.sin(t*5+seed*9)*.0009;
        const y=dir[1]*r+side[1]*displacement+side[1]*Math.sin(t*5+seed*9)*.0009;
        return [x,y,Math.min(1.4,0.78*tipLift+0.34*lateralLift)];
      }
      for(let k=0;k<steps;k++){
        const a0=vertex(k,-1),a1=vertex(k,1);
        const b0=vertex(k+1,-1),b1=vertex(k+1,1);
        for(const v of [a0,a1,b0,a1,b1,b0])add(arr,anchor,v[0],v[1],v[2],1,seed);
      }
    }
    function findAnchors(quality){
      const max=getLimits(quality);
      let sawTissue=false;
      const known=new Set();
      // Scan 1/16 of the biological grid; no per-pixel per-frame CPU mesh generation.
      for(let y=4;y<GRID_SIZE-4;y+=4)for(let x=4;x<GRID_SIZE-4;x+=4){
        const i=y*GRID_SIZE+x;
        if (biomass[i]>0.05) sawTissue=true;
        if(speciesField[i]===1&&biomass[i]>0.12){
          const col=colonyIdField[i];
          if(col>0&&!known.has(col) && !folioseAnchors.has(col)){
            folioseAnchors.set(col,{
              anchor:[(colonyOriginX[col]+0.5)/GRID_SIZE,
                      (colonyOriginY[col]+0.5)/GRID_SIZE],
              seed:hash(col,19)
            });
          }
          known.add(col);
        }
      }
      if (!sawTissue) {
        cupAnchors.clear();folioseAnchors.clear();
        return;
      }
      // Stable cell-lattice anchors. Cells are only allocated when fruiting
      // genuinely exists; after that, animation is entirely driven by textures.
      const spacing=11;
      for(let y=6;y<GRID_SIZE-6;y+=spacing){
        for(let x=6;x<GRID_SIZE-6;x+=spacing){
          if(cupAnchors.size>=max.cupLimit*2)break;
          const key=x+':'+y;
          if(cupAnchors.has(key))continue;
          let peak=0,px=0,py=0;
          for(let dy=-4;dy<=4;dy+=2)for(let dx=-4;dx<=4;dx+=2){
            const sx=x+dx,sy=y+dy,idx=sy*GRID_SIZE+sx;
            if(speciesField[idx]!==3||biomass[idx]<0.075)continue;
            const fruit=fruitingField[idx];
            if(fruit>peak){peak=fruit;px=sx;py=sy;}
          }
          if(peak>0.045){
            cupAnchors.set(key,{
              anchor:[(px+0.5)/GRID_SIZE,(py+0.5)/GRID_SIZE],
              seed:hash(x,y)
            });
          }
        }
      }
    }
    function rebuild(quality){
      const limit=getLimits(quality);
      const packed=[];
      let cups=0,leaves=0;
      for(const o of cupAnchors.values()){
        if(cups>=limit.cupLimit)break;
        cupGeometry(packed,o.anchor,o.seed,limit.cupSegments);
        cups++;
      }
      for(const o of folioseAnchors.values()){
        const count=Math.min(limit.lobeLimit,quality==='rich'?16:9);
        for(let i=0;i<count;i++){
          lobeGeometry(packed,o.anchor,o.seed,count,limit.lobeSteps,i);
          leaves++;
        }
        // Prevent an uncontrolled number of independently painted foliose colonies.
        if(leaves>=limit.lobeLimit*3)break;
      }
      vertexCount=packed.length/7;
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(packed),gl.DYNAMIC_DRAW);
      stats={cups,lobes:leaves,triangles:vertexCount/3,quality};
    }
    function scan(nowMs,quality){
      if (quality==='off')return;
      if (quality===lastQuality && nowMs>=lastScanMs && nowMs-lastScanMs<1700)return;
      lastScanMs=nowMs;
      const year=getYears();
      if (year<currentYear-0.8) {
        cupAnchors.clear();folioseAnchors.clear(); // new slate starts a new life.
      }
      currentYear=year;
      const before=cupAnchors.size+'|'+folioseAnchors.size;
      findAnchors(quality);
      const after=cupAnchors.size+'|'+folioseAnchors.size;
      if(quality!==lastQuality||before!==after)rebuild(quality);
      lastQuality=quality;
    }

    function draw(nowMs,bindings){
      const quality=params.geometryQuality || 'off';
      if(quality==='off')return stats;
      scan(nowMs,quality);
      if(!vertexCount)return stats;
      const restoreProgram=bindings.mainProgram;
      try{
        gl.useProgram(meshProgram);
        gl.bindVertexArray(vao);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D,bindings.bioTex);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D,bindings.auxTex);
        if(loc.uMeshBio!==null)gl.uniform1i(loc.uMeshBio,0);
        if(loc.uMeshAux!==null)gl.uniform1i(loc.uMeshAux,1);
        if(loc.uMeshRamp!==null)gl.uniform1i(loc.uMeshRamp,2);
        gl.uniform1f(loc.uMeshZoom,params.zoom);
        gl.uniform2f(loc.uMeshPan,params.panX,params.panY);
        gl.uniform1f(loc.uMeshWet,params.effectiveWetness);
        gl.uniform1f(loc.uMeshDepth,params.geometryDepth ?? 1);
        gl.uniform1f(loc.uMeshTilt,params.geometryTilt ?? 0.65);
        gl.uniform1f(loc.uMeshCupRise,params.cupRise ?? 1);
        gl.uniform1f(loc.uMeshLobeCurl,params.lobeUnfurl ?? 1);
        gl.uniform1f(loc.uMeshMorph,params.morphogenesis ?? 1);
        gl.uniform3f(loc.uMeshLight,bindings.light[0],bindings.light[1],bindings.light[2]);
        gl.uniform1i(loc.uMeshPaletteMode,params.paletteMode);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
        // Cast coherent projected triangular shadows over existing rock/lichen.
        gl.disable(gl.DEPTH_TEST);
        gl.uniform1i(loc.uMeshShadow,1);
        gl.drawArrays(gl.TRIANGLES,0,vertexCount);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.depthMask(true);
        gl.uniform1i(loc.uMeshShadow,0);
        gl.drawArrays(gl.TRIANGLES,0,vertexCount);
      }finally{
        gl.disable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);
        gl.depthMask(true);
        gl.bindVertexArray(null);
        gl.useProgram(restoreProgram);
        gl.activeTexture(gl.TEXTURE0);
      }
      return stats;
    }
    function dispose(){
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(meshProgram);
    }
    return {draw,stats:()=>({...stats}),dispose,debug:{getAnchorCounts:()=>
      ({cups:cupAnchors.size,foliose:folioseAnchors.size})}};
  };
})();