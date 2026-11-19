/* Fruticose lichen branch skeletons.
 * Biological inspiration: dichotomously divided Cladonia tips and lateral-budding
 * Ramalina axes. Artistically procedural, not a species-specific growth predictor.
 * Pure seeded geometry: no rendering, no dependencies, no Math.random(). */
(function () {
  'use strict';
  const TAU = Math.PI*2;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const length=v=>Math.hypot(v[0],v[1],v[2]);
  function norm(v){
    const d=Math.max(1e-8,length(v));
    return [v[0]/d,v[1]/d,v[2]/d];
  }
  function makeRandom(seed){
    let state=((Math.floor(seed*4294967295) ^ 0x9e3779b9)>>>0)||1981;
    return function(){
      state^=state<<13;state^=state>>>17;state^=state<<5;
      return (state>>>0)/4294967296;
    };
  }
  function pack(out,anchor,center,p,seed,birth,width){
    out.push(anchor[0],anchor[1],p[0],p[1],p[2],2,seed,
      anchor[2]??anchor[0],anchor[3]??anchor[1],
      center[0],center[1],center[2],birth,width);
  }

  function emitTube(out,anchor,seed,part,facets,flat) {
    const {p0,p1,r0,r1,birth,width}=part;
    const tangent=norm([p1[0]-p0[0],p1[1]-p0[1],p1[2]-p0[2]]);
    // Orthogonal moving tube frame; flattened Ramalina branches make straps,
    // Cladonia branches stay nearly circular in cross-section.
    const side=norm([-tangent[1],tangent[0],0]);
    const up=norm([
      tangent[1]*side[2]-tangent[2]*side[1],
      tangent[2]*side[0]-tangent[0]*side[2],
      tangent[0]*side[1]-tangent[1]*side[0]
    ]);
    const phase=seed*TAU+part.birth*.9;
    function ring(center,radius,k){
      const a=(k/facets)*TAU+phase;
      const c=Math.cos(a),s=Math.sin(a);
      const w=flat?radius*1.28:radius;
      const thick=flat?radius*.38:radius;
      const ridge=1.0+0.10*Math.cos(a*3.0+seed*27.0);
      return [center[0]+side[0]*c*w*ridge+up[0]*s*thick,
        center[1]+side[1]*c*w*ridge+up[1]*s*thick,
        center[2]+side[2]*c*w*ridge+up[2]*s*thick];
    }
    for(let i=0;i<facets;i++){
      const a=ring(p0,r0,i),b=ring(p0,r0,i+1);
      const c=ring(p1,r1,i),d=ring(p1,r1,i+1);
      for(const v of [a,c,b,b,c,d])
        pack(out,anchor,p0,v,seed,birth,width);
    }
  }
  function grow(out,anchor,seed,options={}) {
    const mode=options.mode==='ramalina'?'ramalina':'cladonia';
    const quality=options.quality==='rich'?'rich':'lite';
    const density=clamp(+options.density||1,0.5,2);
    const random=makeRandom(seed);
    const maxParts=quality==='rich'?114:46;
    const facets=quality==='rich'?7:5;
    const maxShoots=quality==='rich'?5:3;
    const shoots=Math.round(clamp((quality==='rich'?3:2)*density,1,maxShoots));
    const root=[0,0,0];
    const parts=[];
    let terminalCount=0;
    function add(p0,dir,len,r0,birth){
      if(parts.length>=maxParts)return p0;
      const d=norm(dir);
      const curvature=0.76+random()*.44;
      const p1=[p0[0]+d[0]*len*.16*curvature,
        p0[1]+d[1]*len*.16*curvature,
        p0[2]+d[2]*len*curvature];
      parts.push({p0,p1,r0,r1:r0*(.63+random()*.19),
        birth:clamp(birth,0,0.9),width:0.16});
      return p1;
    }
    function cladonia(p,dir,depth,radius,birth){
      if(parts.length>=maxParts)return;
      const baseLen=(.185*Math.pow(.75,depth))*(.82+.38*random());
      const tip=add(p,dir,baseLen,radius,birth);
      if(depth>= (quality==='rich'?4:3) || parts.length>=maxParts){
        terminalCount++;return;
      }
      const angle=TAU*random();
      // The two elongating tips are born by a dichotomous split.
      for(const sign of [-1,1]){
        if(parts.length>=maxParts)break;
        const perturb=[
          Math.cos(angle)*sign*(.30+random()*.10),
          Math.sin(angle)*sign*(.30+random()*.10),
          -.045+random()*.12
        ];
        cladonia(tip,norm([dir[0]+perturb[0],dir[1]+perturb[1],
          dir[2]+perturb[2]]),depth+1,radius*.68,
          birth+.18+random()*.035);
      }
    }
    function ramalina(p,dir,shoot){
      // Main ramalina axis remains and grows; lateral buds originate from
      // existing mature lengths, rather than every tip splitting in two.
      let center=p,heading=dir;
      const steps=quality==='rich'?5:4;
      for(let k=0;k<steps && parts.length<maxParts;k++){
        const r=.0029*Math.pow(.79,k)*(.86+.14*random());
        const segLen=.105*(.82+.35*random());
        const birth=.035+shoot*.025+k*.15;
        const next=add(center,heading,segLen,r,birth);
        if(k>=1 && parts.length<maxParts){
          const angle=random()*TAU;
          const lateral=norm([heading[0]+.7*Math.cos(angle),
            heading[1]+.7*Math.sin(angle),heading[2]*.57]);
          const lateralEnd=add(next,lateral,segLen*.8,r*.45,birth+.095);
          if(quality==='rich' && k>=2 && parts.length<maxParts){
            const tipDir=norm([lateral[0]+.35*Math.sin(angle),
              lateral[1]+.35*Math.cos(angle),lateral[2]*.94]);
            add(lateralEnd,tipDir,segLen*.56,r*.26,birth+.19);
          }
          terminalCount++;
        }
        heading=norm([heading[0]+(random()-.5)*.13,
          heading[1]+(random()-.5)*.13,heading[2]-.04]);
        center=next;
      }
      terminalCount++;
    }
    for(let i=0;i<shoots && parts.length<maxParts;i++){
      const theta=TAU*(i+.19+random()*.24)/shoots;
      const d=norm([Math.cos(theta)*(.26+.25*random()),
        Math.sin(theta)*(.26+.25*random()),.96]);
      const p=[root[0]+Math.cos(theta)*.003,
        root[1]+Math.sin(theta)*.003,root[2]];
      if(mode==='cladonia'){
        cladonia(p,d,0,.0033*(.82+.22*random()),.012+i*.018);
      }else{
        ramalina(p,d,i);
      }
    }
    for(let i=0;i<parts.length;i++){
      emitTube(out,anchor,seed+(.001*i),parts[i],facets,mode==='ramalina');
    }
    return {segments:parts.length,terminals:terminalCount,
      triangles:parts.length*facets*2,mode,quality};
  }
  window.LichenBranchSkeleton={grow};
})();