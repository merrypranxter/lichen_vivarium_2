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
layout(location=3) in vec2 aBiologySample; // biology can sit near the geometric Worley center
layout(location=4) in vec3 aStemRoot;  // base of this specific tube segment
layout(location=5) in vec2 aGrowth;    // developmental birth threshold, emergence width
uniform sampler2D uMeshBio;
uniform sampler2D uMeshAux;
uniform float uMeshZoom;
uniform vec2 uMeshPan;
uniform float uMeshWet;
uniform float uMeshDepth;
uniform float uMeshTilt;
uniform float uMeshCupRise;
uniform float uMeshLobeCurl;
uniform float uMeshBranchHeight;
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
  float kind = aMeta.x; // 0: hollow cup, 1: foliose ribbon, 2: fruticose branch.
  float baseZ = 0.0;
  vec2 uv = aAnchor;
  vec4 b = texture(uMeshBio, clamp(aBiologySample,0.002,0.998));
  vec4 aux = texture(uMeshAux, clamp(aBiologySample,0.002,0.998));
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
  } else if (kind < 1.5) {
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
  } else {
    // Actual tubular branch skeleton. Geometry is born at the segment's
    // attachment node, then extrudes and thickens as that tissue matures.
    // Zero decorative time wobble: biomass and tissue age drive every tip.
    float livingStage = clamp(0.23*b.r + 0.77*smoothstep(0.008,0.27,b.g),0.0,1.0);
    float emergence = smoothstep(aGrowth.x,
                                 aGrowth.x + max(0.045,aGrowth.y), livingStage);
    // Developmental Unfolding at zero restores fully extended static
    // geometry, matching the rest of the Motion tab.
    float tipExtension = mix(1.0, emergence, uMeshMorph);
    vec3 grown = mix(aStemRoot,aLocal,tipExtension);
    uv += grown.xy;
    baseZ = grown.z * 0.115 * uMeshDepth * max(0.0,uMeshBranchHeight);
    alpha = smoothstep(0.065,0.23,b.r)
           * smoothstep(0.003,0.06,b.g) * (1.0-b.a)
           * smoothstep(0.01,0.24,tipExtension);
    alpha *= 1.0-step(0.5,abs(aux.r*4.0-2.0));
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
    base=vMeshType<0.5 ? vec3(0.70,0.83,0.47) :
         (vMeshType<1.5 ? vec3(0.48,0.63,0.31) : vec3(0.70,0.76,0.52));
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
  // Branch tubes have an opaque cortex while foliose tips are translucent.
  float surfaceAlpha=vMeshType<0.5?0.95:(vMeshType<1.5?0.74:0.96);
  fragColor=vec4(clamp(lit,0.0,1.0),vMeshAlpha*surfaceAlpha);
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
      'uMeshBranchHeight','uMeshMorph','uMeshLight','uMeshShadow','uMeshPaletteMode']){
      loc[name]=gl.getUniformLocation(meshProgram,name);
    }
    const vao=gl.createVertexArray();
    const buffer=gl.createBuffer();
    if(!vao || !buffer)throw Error('3D mesh buffer allocation failed');
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    // [anchor.xy, local.xyz, type, colorSeed, sample.xy,
    //  tube-start.xyz, birth-threshold, duration]
    const stride=14*4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0,2,gl.FLOAT,false,stride,0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1,3,gl.FLOAT,false,stride,2*4);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2,2,gl.FLOAT,false,stride,5*4);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3,2,gl.FLOAT,false,stride,7*4);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4,3,gl.FLOAT,false,stride,9*4);
    gl.enableVertexAttribArray(5);
    gl.vertexAttribPointer(5,2,gl.FLOAT,false,stride,12*4);
    gl.bindVertexArray(null);

    const cupAnchors=new Map();
    const folioseAnchors=new Map();
    const branchAnchors=new Map();
    let vertexCount=0, lastScanMs=-Infinity, lastBuildKey='', currentYear=0;
    let stats={cups:0,lobes:0,branchStems:0,branchSegments:0,triangles:0,quality:'off'};
    function getLimits(quality) {
      return quality==='rich'
        ? {cupLimit:44,lobeLimit:16,cupSegments:18,lobeSteps:14,branchLimit:4}
        : {cupLimit:16,lobeLimit:9,cupSegments:12,lobeSteps:10,branchLimit:2};
    }
    function add(arr,anchor,x,y,z,type,seed){
      arr.push(anchor[0],anchor[1],x,y,z,type,seed,
               anchor[2] ?? anchor[0],anchor[3] ?? anchor[1],
               0,0,0,0,0);
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
        if(speciesField[i]===2&&biomass[i]>0.12){
          const col=colonyIdField[i];
          if(col>0 && !branchAnchors.has(col)){
            const bx=colonyOriginX[col],by=colonyOriginY[col];
            // A surviving holdfast determines the 3D branch's position.
            branchAnchors.set(col,{
              anchor:[(bx+0.5)/GRID_SIZE,(by+0.5)/GRID_SIZE],
              seed:hash(col,47)
            });
          }
        }
      }
      if (!sawTissue) {
        cupAnchors.clear();folioseAnchors.clear();branchAnchors.clear();
        return;
      }
      // Stable cell-lattice anchors. Cells are only allocated when fruiting
      // genuinely exists; after that, animation is entirely driven by textures.
      // Place cups in the *same cellular domains* as the biological shader's
      // worley(mUv * 22.0 + 5.3, 0.78) scyphi. Geometry and original anatomy
      // therefore agree on where cup sites belong, not an unrelated screen grid.
      const fract=t=>t-Math.floor(t);
      const glslHash21=(x,y)=>{
        let a=fract(x*123.34),b=fract(y*456.21);
        const dot=a*(a+45.32)+b*(b+45.32);
        a+=dot;b+=dot;
        return fract(a*b);
      };
      const cupCandidates=[];
      for(let y=5;y<=28;y++)for(let x=5;x<=28;x++){
        const key=x+':'+y;
        if(cupAnchors.has(key))continue;
        if(glslHash21(x,y)<0.24)continue; // original goblet suitability
        const rx=fract(Math.sin(x*127.1+y*311.7)*43758.5453123);
        const ry=fract(Math.sin(x*269.5+y*183.3)*43758.5453123);
        const cx=(x+0.11+0.78*rx-5.3)/22.0;
        const cy=(y+0.11+0.78*ry-5.3)/22.0;
        if(cx<0.02||cx>0.98||cy<0.02||cy>0.98)continue;
        const px=Math.floor(cx*GRID_SIZE),py=Math.floor(cy*GRID_SIZE);
        let peak=0,sx=px,sy=py;
        // The shader's small organic domain-warp shifts local biological
        // pixels by a few cells: sample nearby while retaining the original
        // fixed polygonal center as the real mesh's physical anchor.
        for(let dy=-6;dy<=6;dy+=2)for(let dx=-6;dx<=6;dx+=2){
          const xx=px+dx,yy=py+dy;
          if(xx<1||yy<1||xx>=GRID_SIZE-1||yy>=GRID_SIZE-1)continue;
          const i=yy*GRID_SIZE+xx;
          if(speciesField[i]!==3||biomass[i]<0.075)continue;
          const val=fruitingField[i]*(1.0-0.025*Math.hypot(dx,dy));
          if(val>peak){peak=val;sx=xx;sy=yy;}
        }
        if(peak>0.045)cupCandidates.push({
          key,seed:hash(x,y),
          // vertex location is in the existing cup's Worley domain;
          // fruiting intensity is sampled from the nearby growing tissue.
          anchor:[cx,cy,(sx+0.5)/GRID_SIZE,(sy+0.5)/GRID_SIZE]
        });
      }
      // Deterministic site distribution instead of filling only the topmost
      // rows of the rock when the Lite GPU budget is reached.
      cupCandidates.sort((a,b)=>a.seed-b.seed);
      for(const o of cupCandidates){
        if(cupAnchors.size>=max.cupLimit*2)break;
        cupAnchors.set(o.key,{anchor:o.anchor,seed:o.seed});
      }
    }
    function rebuild(quality){
      const limit=getLimits(quality);
      const packed=[];
      let cups=0,leaves=0,branchStems=0,branchSegments=0;
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
      // Fruticose anatomy is built once from a stable colony identity.
      // Its triangle vertices grow entirely in the GPU as biological
      // age/biomass changes, so nothing flickers between rebuilds.
      if(window.LichenBranchSkeleton &&
         typeof window.LichenBranchSkeleton.grow==='function'){
        for(const o of branchAnchors.values()){
          if(branchStems>=limit.branchLimit)break;
          const result=window.LichenBranchSkeleton.grow(packed,o.anchor,o.seed,{
            mode:params.branchPattern||'cladonia',
            quality,density:params.branchDensity ?? 1
          });
          if(result.segments>0){
            branchStems++;
            branchSegments+=result.segments;
          }
        }
      }
      vertexCount=packed.length/14;
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(packed),gl.DYNAMIC_DRAW);
      stats={cups,lobes:leaves,branchStems,branchSegments,
             triangles:vertexCount/3,quality};
    }
    function scan(nowMs,quality){
      if (quality==='off')return;
      const buildKey=quality+'|'+(params.branchPattern||'cladonia')
        +'|'+(params.branchDensity ?? 1);
      if(buildKey===lastBuildKey && nowMs>=lastScanMs && nowMs-lastScanMs<1700)return;
      lastScanMs=nowMs;
      const year=getYears();
      if (year<currentYear-0.8) {
        cupAnchors.clear();folioseAnchors.clear();branchAnchors.clear(); // new slate
      }
      currentYear=year;
      const before=cupAnchors.size+'|'+folioseAnchors.size+'|'+branchAnchors.size;
      findAnchors(quality);
      const after=cupAnchors.size+'|'+folioseAnchors.size+'|'+branchAnchors.size;
      if(buildKey!==lastBuildKey||before!==after)rebuild(quality);
      lastBuildKey=buildKey;
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
        gl.uniform1f(loc.uMeshBranchHeight,params.branchHeight ?? 1);
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
      ({cups:cupAnchors.size,foliose:folioseAnchors.size,
        fruticose:branchAnchors.size})}};
  };
})();