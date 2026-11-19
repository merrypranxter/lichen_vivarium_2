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
layout(location=6) in vec3 aCortexNormal; // radial surface normal in 3D anatomy
layout(location=7) in vec2 aCortexUV;     // around-tube / along-branch coordinates
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
uniform float uMeshBasalSpread;
uniform float uMeshBasalFusion;
uniform float uMeshBasalVolume;
uniform float uMeshMorph;
uniform vec3 uMeshLight;
uniform bool uMeshShadow;
out vec3 vMeshWorld;
out vec2 vMeshUV;
out float vMeshAlpha;
out float vMeshType;
out float vMeshSeed;
out float vMeshHeight;
out vec3 vCortexNormal;
out vec2 vCortexUV;
out float vCortexAge;

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
  } else if(kind < 3.5) {
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
  } else {
    // A finite-thickness basal thallus physically supports the branching axes.
    // Radial upper skin, tapered margin, skirt and underside share one mesh.
    // Alive/dead tissue is sampled per-vertex from the original 256² biology.
    vec2 offset=aLocal.xy * uMeshBasalSpread;
    uv += offset;
    b=texture(uMeshBio,clamp(uv,0.002,0.998));
    aux=texture(uMeshAux,clamp(uv,0.002,0.998));
    float radial=length(offset)/max(0.0001,0.030*uMeshBasalSpread);
    float life=smoothstep(0.035,0.24,b.r)
              *smoothstep(0.001,0.045,b.g)
              *(1.0-smoothstep(0.38,0.95,b.a));
    float wetShape=mix(0.79,1.17,uMeshWet);
    float centerLift=0.85+0.15*smoothstep(0.0,0.2,b.r);
    baseZ=(0.0012+max(-0.25,aLocal.z)*0.0095*centerLift
                 *wetShape*max(0.0,uMeshBasalVolume))*uMeshDepth;
    // The outer biological front feather-blends toward the substrate.
    float feather=1.0-smoothstep(0.78,1.10,radial);
    alpha=life * feather * clamp(uMeshBasalFusion,0.0,1.0);
    alpha*=1.0-step(0.5,abs(aux.r*4.0-2.0));
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
  vCortexNormal=aCortexNormal;
  vCortexUV=aCortexUV;
  vCortexAge=b.g;
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
in vec3 vCortexNormal;
in vec2 vCortexUV;
in float vCortexAge;
uniform sampler2D uMeshRamp;
uniform float uMeshCortexDetail;
uniform float uMeshPowder;
uniform float uMeshFissures;
uniform float uMeshWet;
uniform int uMeshBranchPattern;
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
  vec3 n=vMeshType>1.5 ? normalize(vCortexNormal)
                        : normalize(cross(dpdx,dpdy));
  if (!gl_FrontFacing) n=-n;
  if (vMeshType<1.5 || vMeshType>3.5) n.z=abs(n.z);
  n=normalize(n);
  vec3 light=normalize(uMeshLight);
  float diffuse=max(0.0,dot(n,light));
  float diffuseBack=max(0.0,dot(n,-light));
  // Root cortex and raised branches share a single living colony palette identity.
  float paletteAnatomy=min(vMeshType,2.0);
  float seed=fract(vMeshSeed*0.72+paletteAnatomy*0.33);
  vec3 base;
  if (uMeshPaletteMode == 6) {
    float anatomicalHeight=vMeshType>3.5?0.0:vMeshHeight;
    base=texture(uMeshRamp,vec2(fract(seed+anatomicalHeight*1.25),0.5)).rgb;
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
  // A genuine stem-wrapped cortex: anisotropic ridges run along the tube axis,
  // transverse fungal wrinkles accumulate with age, and older dry cortex opens
  // fine irregular fissures. All spatial phases are fixed to the tube surface;
  // there is no unmotivated time animation / pixel-space texture swimming.
  float granular=noise21(floor(vMeshUV*1800.0));
  float cortexBump=0.0;
  if (vMeshType>1.5 && vMeshType<3.5){
    float around=vCortexUV.x*6.28318530718;
    float along=vCortexUV.y;
    float mature=smoothstep(0.035,0.24,vCortexAge);
    float dry=clamp(1.0-uMeshWet,0.0,1.0);
    float rough=clamp(uMeshCortexDetail,0.0,2.0);
    // Parallel cortical striae whose pitch bends slightly with hyphal growth.
    float axial=sin(around*(uMeshBranchPattern==1?9.0:16.0)
                     +0.30*sin(along*5.5+vMeshSeed*8.0)+along*0.6);
    float ridges=pow(0.5+0.5*axial,3.0);
    float wrinkle=0.5+0.5*sin(along*32.0
                              +sin(around*8.0+vMeshSeed*11.0)*1.45);
    float grain=noise21(floor(vec2(vCortexUV.x*260.0,along*135.0)
                              +vec2(vMeshSeed*17.0,vMeshSeed*31.0)));
    cortexBump=(ridges*0.60+wrinkle*mature*0.28+grain*0.12)*rough;
    base*=mix(1.0,0.83+0.27*cortexBump,clamp(rough*.78,0.0,1.0));

    // Tip and mature-branch soralia: powdery fungal/photobiont granules, not
    // a uniform white coat. Ramalina also develops pale pseudocyphella-like
    // patches along its axial cortex.
    float patch=noise21(floor(vec2(vCortexUV.x*8.0,along*9.0)
                              +vec2(vMeshSeed*47.0,vMeshSeed*13.0)));
    float powderGrain=noise21(floor(vec2(vCortexUV.x*320.0,along*240.0)
                                    +vec2(21.3,vMeshSeed*71.0)));
    float patchThreshold=uMeshBranchPattern==1?0.66:0.78;
    float soralia=smoothstep(patchThreshold,0.98,patch)
                 *smoothstep(0.43,0.93,powderGrain)
                 *mature*clamp(uMeshPowder,0.0,2.0);
    vec3 powderTone=mix(base*1.24,vec3(0.91,0.92,0.84),
                       uMeshPaletteMode==0?0.55:0.18);
    base=mix(base,powderTone,clamp(soralia*.82,0.0,.85));
    
    // Longitudinal fissures become visible after desiccation/age.
    // The line's curvature is locked to its own stem coordinates.
    float fissureLine=sin(around*11.0+0.43*sin(along*8.0+vMeshSeed*9.0));
    float fissure=smoothstep(0.962,0.995,fissureLine)
                  *mature*(0.30+0.70*dry)
                  *clamp(uMeshFissures,0.0,2.0);
    base*=1.0-clamp(fissure*.73,0.0,.83);

    // Tiny lichen fibrils are independent real cylindrical geometry. Their
    // lighter, fibrous tip tissue inherits the palette instead of turning gray.
    if(vMeshType>2.5)base=mix(base,base*1.42+vec3(.07,.055,.045),0.62);

    // Cheap analytic normal detail instead of expensive finite differences
    // or a new fractal noise function in the mobile fragment shader.
    float normalRipple=(axial*.55+sin(along*32.0)*.45)
                       *clamp(rough,0.0,2.0)*.12;
    n=normalize(n+vec3(normalRipple*cos(around),
                            normalRipple*sin(around),0.0));
    diffuse=max(0.0,dot(n,light));
    diffuseBack=max(0.0,dot(n,-light));
    granular=grain;
  }
  if(vMeshType>3.5){
    // Basal prothallus/root rind: radial fungal hyphae, mineral-rich seams,
    // and small cortex nodules. These fixed radial coordinates attach the
    // visual fibers to the same root disk as the real rising tube branches.
    float radial=clamp(vCortexUV.y,0.0,1.0);
    float angle=vCortexUV.x*6.28318530718;
    float hyphae=0.5+0.5*sin(angle*24.0
                      +sin(radial*18.0+vMeshSeed*11.0)*0.9);
    float mineral=noise21(floor(vec2(vCortexUV.x*142.0,
                                     radial*168.0)+vMeshSeed*31.0));
    float rootAge=smoothstep(0.025,0.22,vCortexAge);
    float rootWet=clamp(uMeshWet,0.0,1.0);
    float rim=smoothstep(0.58,0.92,radial);
    // A dark prothallus-like attachment rim around living cortex.
    base=mix(base,base*0.43,clamp(rim*rootAge*.55,0.0,.72));
    float fiberLight=hyphae*(0.08+0.16*rootWet)
                     *(1.0-rim*.5);
    base*=0.89+fiberLight;
    base*=mix(.81,1.04,mineral*.7+.3);
    float nodules=smoothstep(.83,.97,mineral)
                 *rootAge*(1.0-rim)*0.18;
    base+=base*nodules;
    float wrinkling=hyphae*.08*rootAge;
    n=normalize(n+vec3(cos(angle)*wrinkling,sin(angle)*wrinkling,0.0));
    diffuse=max(0.0,dot(n,light));
    diffuseBack=max(0.0,dot(n,-light));
  }
  if(vMeshType<1.5)base*=mix(0.89,1.07,granular);
  float sheen=pow(max(0.0,dot(reflect(-light,n),vec3(0.0,0.0,1.0))),32.0);
  vec3 lit=base*(0.24+diffuse*0.77+diffuseBack*0.12)+vec3(sheen*0.16);
  // A gentle spectral edge sheen remains subordinate to the detailed base shader.
  float fringe=pow(1.0-abs(n.z),2.0);
  lit+=base*fringe*0.12;
  lit=lit/(lit+vec3(0.30));
  // Branch tubes have an opaque cortex while foliose tips are translucent.
  float surfaceAlpha=vMeshType<0.5?0.95:
                       (vMeshType<1.5?0.74:(vMeshType>3.5?0.92:0.96));
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
      'uMeshBranchHeight','uMeshBasalSpread','uMeshBasalFusion',
      'uMeshBasalVolume','uMeshMorph','uMeshLight','uMeshShadow',
      'uMeshPaletteMode','uMeshCortexDetail','uMeshPowder','uMeshFissures',
      'uMeshBranchPattern']){
      loc[name]=gl.getUniformLocation(meshProgram,name);
    }
    const vao=gl.createVertexArray();
    const buffer=gl.createBuffer();
    if(!vao || !buffer)throw Error('3D mesh buffer allocation failed');
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    // [anchor.xy, local.xyz, type, colorSeed, biologySample.xy,
    //  tube-start.xyz, birth-threshold, growthDuration,
    //  3D cortex normal.xyz, unwrapped stem UV.xy]
    const stride=19*4;
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
    gl.enableVertexAttribArray(6);
    gl.vertexAttribPointer(6,3,gl.FLOAT,false,stride,14*4);
    gl.enableVertexAttribArray(7);
    gl.vertexAttribPointer(7,2,gl.FLOAT,false,stride,17*4);
    gl.bindVertexArray(null);

    const cupAnchors=new Map();
    const folioseAnchors=new Map();
    const branchAnchors=new Map();
    let vertexCount=0, lastScanMs=-Infinity, lastBuildKey='', currentYear=0;
    let stats={cups:0,lobes:0,branchStems:0,branchSegments:0,
      basalThalli:0,fibrils:0,triangles:0,quality:'off'};
    function getLimits(quality) {
      return quality==='rich'
        ? {cupLimit:44,lobeLimit:16,cupSegments:18,lobeSteps:14,branchLimit:4}
        : {cupLimit:16,lobeLimit:9,cupSegments:12,lobeSteps:10,branchLimit:2};
    }
    function add(arr,anchor,x,y,z,type,seed){
      arr.push(anchor[0],anchor[1],x,y,z,type,seed,
               anchor[2] ?? anchor[0],anchor[3] ?? anchor[1],
               0,0,0,0,0, 0,0,1, 0,0);
    }
    function basalThallusGeometry(out,anchor,seed,segments){
      // Thin *volumetric shell* with an irregular dorsal cortex, feathered
      // perimeter, a tucked-under skirt, and a substrate-facing underside.
      // All coordinates remain in the same normalized UV/world system used
      // by the source shader. The lowest ring returns toward z=0.
      const steps=[
        [0,0.64], [0.16,0.93], [0.39,0.83],
        [0.67,0.50], [0.88,0.24], [1.0,0.035],
        [1.015,-0.015], [0.83,-0.08], [0.30,-0.07],
        [0,-0.05] // return to a tucked-under center, closing the basal shell
      ];
      const radius=0.030;
      const phase=seed*Math.PI*2;
      function surfaceAt(ring,j){
        const t=j/segments;
        const a=t*Math.PI*2+phase;
        const r=ring[0];
        const irregular=1.0+0.085*Math.sin(5*a+seed*13)
                         +0.043*Math.sin(11*a-seed*19);
        const x=Math.cos(a)*r*radius*irregular;
        const y=Math.sin(a)*r*radius*irregular;
        const z=ring[1]+0.055*r*Math.sin(7*a+seed*23);
        const slope=r<.9 ? -0.11:0.06;
        const normalLength=Math.hypot(Math.cos(a)*slope,
                                      Math.sin(a)*slope,1);
        const normal=[Math.cos(a)*slope/normalLength,
                      Math.sin(a)*slope/normalLength,1/normalLength];
        return {x,y,z,normal,uv:[t,r]};
      }
      function append(v){
        out.push(anchor[0],anchor[1],v.x,v.y,v.z,4,seed,
          anchor[0]+v.x,anchor[1]+v.y,
          0,0,0,0,0,
          v.normal[0],v.normal[1],v.normal[2],
          v.uv[0],v.uv[1]);
      }
      for(let row=0;row<steps.length-1;row++){
        for(let j=0;j<segments;j++){
          const a=surfaceAt(steps[row],j);
          const b=surfaceAt(steps[row],j+1);
          const c=surfaceAt(steps[row+1],j);
          const d=surfaceAt(steps[row+1],j+1);
          for(const p of [a,c,b,b,c,d])append(p);
        }
      }
      return 2*segments*(steps.length-1);
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
      let cups=0,leaves=0,branchStems=0,branchSegments=0,basalThalli=0,fibrils=0;
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
      // The holdfast shares the exact same colony origin as its branching
      // skeleton, so stems rise through a living thallus rather than merely
      // being painted onto the rock. Biological state remains authoritative.
      if((params.basalFusion ?? 0.90)>0.001){
        for(const o of branchAnchors.values()){
          if(basalThalli>=limit.branchLimit)break;
          basalThallusGeometry(packed,o.anchor,o.seed,
            quality==='rich'?18:12);
          basalThalli++;
        }
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
            quality,density:params.branchDensity ?? 1,
            fibrilDensity:params.branchFibrils ?? 0.8
          });
          if(result.segments>0){
            branchStems++;
            branchSegments+=result.segments;
            fibrils+=result.fibrils ?? 0;
          }
        }
      }
      vertexCount=packed.length/19;
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(packed),gl.DYNAMIC_DRAW);
      stats={cups,lobes:leaves,branchStems,branchSegments,basalThalli,fibrils,
             triangles:vertexCount/3,quality};
    }
    function scan(nowMs,quality){
      if (quality==='off')return;
      const buildKey=quality+'|'+(params.branchPattern||'cladonia')
        +'|'+(params.branchDensity ?? 1)
        +'|'+(params.branchFibrils ?? 0.8)
        +'|'+((params.basalFusion ?? .9)>0.001?1:0);
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
        gl.uniform1f(loc.uMeshBasalSpread,params.basalSpread ?? 1.0);
        gl.uniform1f(loc.uMeshBasalFusion,params.basalFusion ?? 0.90);
        gl.uniform1f(loc.uMeshBasalVolume,params.basalVolume ?? 1.0);
        gl.uniform1f(loc.uMeshCortexDetail,params.branchCortexDetail ?? 1.15);
        gl.uniform1f(loc.uMeshPowder,params.branchPowder ?? 0.85);
        gl.uniform1f(loc.uMeshFissures,params.branchFissures ?? 0.65);
        gl.uniform1i(loc.uMeshBranchPattern,
          params.branchPattern==='ramalina'?1:0);
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