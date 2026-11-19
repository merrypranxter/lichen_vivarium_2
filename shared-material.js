/* Shared dielectric tissue shading and the scene's single display transform.
   All inputs to lighting/compositing are linear. Palette bytes are sRGB.
   WebGL2 without float rendering+blending uses an RGBA8 linear target: stable
   and complete, but highlights above 1 are clipped before the display curve. */
(function () {
  'use strict';
  const glsl = `
vec3 lichenSRGBToLinear(vec3 c) {
  c=max(c,vec3(0.0));
  return mix(c/12.92,pow((c+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),c));
}
vec3 lichenLinearToSRGB(vec3 c) {
  c=max(c,vec3(0.0));
  return mix(c*12.92,1.055*pow(c,vec3(1.0/2.4))-0.055,step(vec3(0.0031308),c));
}
vec3 lichenACES(vec3 c) {
  c=max(c,vec3(0.0));
  return clamp((c*(2.51*c+0.03))/(c*(2.43*c+0.59)+0.14),0.0,1.0);
}
float lichenTissueRoughness(float hydration,float film,float powder) {
  float roughness=mix(0.79,0.48,clamp(hydration,0.0,1.0));
  roughness=mix(roughness,0.17,clamp(film,0.0,1.0));
  return mix(roughness,0.91,clamp(powder,0.0,1.0));
}
// A conventional nonmetallic GGX BRDF, Schlick Fresnel and correlated Smith
// visibility. Radiance scale and the restrained studio environment are artistic.
vec3 lichenGGX(vec3 n,vec3 v,vec3 l,vec3 baseLinear,float roughness,float occlusion) {
  n=normalize(n);v=normalize(v);l=normalize(l);
  vec3 h=normalize(v+l);
  float nv=max(0.001,dot(n,v));
  float nl=max(0.0,dot(n,l));
  float nh=max(0.0,dot(n,h));
  float vh=max(0.0,dot(v,h));
  float a=max(0.0064,roughness*roughness);
  float a2=a*a;
  float den=nh*nh*(a2-1.0)+1.0;
  float distribution=a2/max(0.000001,3.14159265*den*den);
  float visibility=0.5/max(0.0001,
      nl*sqrt(nv*nv*(1.0-a2)+a2)+
      nv*sqrt(nl*nl*(1.0-a2)+a2));
  vec3 fresnel=vec3(0.04)+vec3(0.96)*pow(1.0-vh,5.0);
  vec3 diffuse=(vec3(1.0)-fresnel)*max(baseLinear,vec3(0.0))/3.14159265;
  vec3 specular=distribution*visibility*fresnel;
  vec3 sky=mix(vec3(0.10,0.085,0.075),vec3(0.19,0.22,0.27),clamp(n.z*0.5+0.5,0.0,1.0));
  vec3 ambient=max(baseLinear,vec3(0.0))*sky;
  // Broad environment reflection remains subordinate to the directional light.
  ambient+=mix(vec3(0.006),vec3(0.025,0.030,0.038),1.0-roughness)*max(0.0,n.z);
  return ambient*clamp(occlusion,0.0,1.0)+(diffuse+specular)*nl*3.2;
}
`;
  window.LichenMaterial = Object.freeze({ glsl });

  window.createLichenCompositor = function createLichenCompositor(gl) {
    let target=null;
    const canFloat=!!gl.getExtension('EXT_color_buffer_float') &&
                   !!gl.getExtension('EXT_float_blend');
    function compile(type,source) {
      const shader=gl.createShader(type);
      if(!shader)throw Error('Display shader allocation failed');
      gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) {
        const message=gl.getShaderInfoLog(shader)||'unknown compile error';
        gl.deleteShader(shader);throw Error('Display shader: '+message);
      }
      return shader;
    }
    const vertex=compile(gl.VERTEX_SHADER,`#version 300 es
precision highp float;
out vec2 vUV;
void main() {
  vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
  vUV=p;gl_Position=vec4(p*2.0-1.0,0.0,1.0);
}`);
    const fragment=compile(gl.FRAGMENT_SHADER,`#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uScene;
uniform float uMacroOptics;
uniform float uExposure;
uniform float uTime;
uniform bool uGrayscale;
uniform bool uDebug;
out vec4 fragColor;
${glsl}
float displayHash(vec2 p) {
  return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
}
void main() {
  vec3 c=texture(uScene,vUV).rgb;
  if(uDebug) {fragColor=vec4(clamp(c,0.0,1.0),1.0);return;}
  if(uMacroOptics>0.0) {
    float vignette=1.0-smoothstep(0.35,0.82,length(vUV-0.5))*0.28*uMacroOptics;
    c*=vignette;
  }
  c=lichenACES(c*uExposure);
  if(uGrayscale)c=vec3(dot(c,vec3(0.2126,0.7152,0.0722)));
  c=lichenLinearToSRGB(c);
  if(uMacroOptics>0.0)c+=(displayHash(gl_FragCoord.xy+fract(uTime))-0.5)*0.012*uMacroOptics;
  fragColor=vec4(clamp(c,0.0,1.0),1.0);
}`);
    const program=gl.createProgram();
    if(!program)throw Error('Display program allocation failed');
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) {
      const message=gl.getProgramInfoLog(program)||'unknown link error';
      gl.deleteProgram(program);throw Error('Display program: '+message);
    }
    const vao=gl.createVertexArray();
    if(!vao){gl.deleteProgram(program);throw Error('Display VAO allocation failed');}
    const loc={};
    for(const name of ['uScene','uMacroOptics','uExposure','uTime','uGrayscale','uDebug'])
      loc[name]=gl.getUniformLocation(program,name);

    function release(t) {
      if(!t)return;
      gl.deleteFramebuffer(t.framebuffer);gl.deleteTexture(t.texture);
      gl.deleteRenderbuffer(t.depth);
    }
    function allocate(width,height,hdr) {
      const t={width,height,hdr,framebuffer:gl.createFramebuffer(),
        texture:gl.createTexture(),depth:gl.createRenderbuffer()};
      if(!t.framebuffer||!t.texture||!t.depth) {
        release(t);throw Error('Scene target allocation failed');
      }
      gl.activeTexture(gl.TEXTURE0+7);
      gl.bindTexture(gl.TEXTURE_2D,t.texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,hdr?gl.RGBA16F:gl.RGBA8,
        width,height,0,gl.RGBA,hdr?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,null);
      gl.bindRenderbuffer(gl.RENDERBUFFER,t.depth);
      gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,width,height);
      gl.bindFramebuffer(gl.FRAMEBUFFER,t.framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t.texture,0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,t.depth);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) {
        release(t);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
        throw Error(hdr?'Floating-point scene target incomplete':'Scene target incomplete');
      }
      return t;
    }
    function begin(width,height) {
      width=Math.max(1,Math.floor(width));height=Math.max(1,Math.floor(height));
      if(!target||target.width!==width||target.height!==height) {
        let next;
        if(canFloat) {
          try{next=allocate(width,height,true);}catch(error){
            console.warn('HDR scene target unavailable; using bounded linear RGBA8.',error.message);
          }
        }
        if(!next)next=allocate(width,height,false);
        release(target);target=next;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);
      gl.viewport(0,0,width,height);
      gl.disable(gl.SCISSOR_TEST);gl.depthMask(true);
      gl.clearColor(0.0,0.0,0.0,1.0);gl.clearDepth(1.0);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      return {hdr:target.hdr,format:target.hdr?'RGBA16F':'RGBA8 linear (bounded)'};
    }
    function present(options={}) {
      if(!target)throw Error('Scene display called before begin');
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      gl.viewport(0,0,target.width,target.height);
      gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);
      gl.useProgram(program);gl.bindVertexArray(vao);
      gl.activeTexture(gl.TEXTURE0+7);gl.bindTexture(gl.TEXTURE_2D,target.texture);
      gl.uniform1i(loc.uScene,7);
      gl.uniform1f(loc.uMacroOptics,Math.max(0,Number(options.macroOptics)||0));
      gl.uniform1f(loc.uExposure,Number.isFinite(options.exposure)?Math.max(0,options.exposure):1);
      gl.uniform1f(loc.uTime,Number(options.time)||0);
      gl.uniform1i(loc.uGrayscale,options.grayscale?1:0);
      gl.uniform1i(loc.uDebug,options.debug?1:0);
      gl.drawArrays(gl.TRIANGLES,0,3);
      gl.bindVertexArray(null);gl.activeTexture(gl.TEXTURE0);
    }
    return {begin,present,
      get hdr(){return !!target?.hdr;},
      get format(){return target?.hdr?'RGBA16F':'RGBA8 linear (bounded)';},
      dispose(){release(target);target=null;gl.deleteVertexArray(vao);gl.deleteProgram(program);}
    };
  };
})();
