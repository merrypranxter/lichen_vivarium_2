/* Lichen Vivarium II — deterministic lithotropic rhizine geometry.
   Simulates artistically plausible substrate-seeking attachment filaments using
   the EXISTING rock cleavage (rockField) and retained moisture (waterField).
   Produces only compact, capped 3D triangle tubes; no shader or DOM required.
   Not a species-specific model of hyphal navigation. */
(function () {
  'use strict';
  const PI2=Math.PI*2;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const fract=x=>x-Math.floor(x);
  function seeded(seed){
    let s=(Math.floor(seed*0xffffffff)^0x91e10da5)>>>0;
    return function(){
      s^=s<<13;s^=s>>>17;s^=s<<5;
      return (s>>>0)/4294967296;
    };
  }
  function sample(array,N,x,y,fallback){
    if(!array||!Number.isFinite(x)||!Number.isFinite(y))return fallback;
    const fx=clamp(x*N,0,N-1.001),fy=clamp(y*N,0,N-1.001);
    const ix=Math.floor(fx),iy=Math.floor(fy);
    const tx=fx-ix,ty=fy-iy;
    const a=array[iy*N+ix],b=array[iy*N+ix+1];
    const c=array[(iy+1)*N+ix],d=array[(iy+1)*N+ix+1];
    return lerp(lerp(a,b,tx),lerp(c,d,tx),ty);
  }
  function tube(out,anchor,from,to,seed,birth,width,radius,quality){
    const facets=quality==='rich'?4:3;
    const dir=[to[0]-from[0],to[1]-from[1],to[2]-from[2]];
    const len=Math.max(1e-9,Math.hypot(...dir));
    const tang=dir.map(d=>d/len);
    let sx=-tang[1],sy=tang[0],sz=0;
    let slen=Math.hypot(sx,sy);
    if(slen<1e-6){sx=1;sy=0;slen=1;}
    sx/=slen;sy/=slen;
    let up=[tang[1]*sz-tang[2]*sy,
            tang[2]*sx-tang[0]*sz,
            tang[0]*sy-tang[1]*sx];
    const ul=Math.max(1e-6,Math.hypot(...up));up=up.map(v=>v/ul);
    const phase=seed*PI2;
    function vertex(center,r,j,t){
      const angle=j/facets*PI2+phase;
      const c=Math.cos(angle),s=Math.sin(angle);
      const n=[sx*c+up[0]*s,sy*c+up[1]*s,sz*c+up[2]*s];
      const pos=[center[0]+r*n[0],center[1]+r*n[1],center[2]+r*n[2]];
      const nl=Math.max(1e-6,Math.hypot(...n));
      return {pos,n:n.map(v=>v/nl),uv:[j/facets,t]};
    }
    function pack(v){
      out.push(anchor[0],anchor[1],
        v.pos[0]-anchor[0],v.pos[1]-anchor[1],v.pos[2],
        5,seed,anchor[0],anchor[1],
        from[0]-anchor[0],from[1]-anchor[1],from[2],
        birth,width,v.n[0],v.n[1],v.n[2],v.uv[0],v.uv[1]);
    }
    for(let j=0;j<facets;j++){
      const a=vertex(from,radius,j,0),b=vertex(from,radius,j+1,0);
      const c=vertex(to,radius*.70,j,1),d=vertex(to,radius*.70,j+1,1);
      for(const v of [a,c,b,b,c,d])pack(v);
    }
    return 2*facets;
  }
  function grow(out,anchor,seed,opt={}){
    const quality=opt.quality==='rich'?'rich':'lite';
    const countLimit=quality==='rich'?30:15;
    const steps=quality==='rich'?8:5;
    const density=clamp(Number(opt.density??1),0,2);
    const rootCount=Math.min(countLimit,Math.max(0,Math.round(
      (quality==='rich'?17:9)*density)));
    const grip=clamp(Number(opt.grip??1.2),0,2);
    const length=clamp(Number(opt.length??1),.35,1.75);
    const spread=clamp(Number(opt.spread??1),.5,1.6);
    const rock=opt.rockField,moisture=opt.waterField;
    const N=opt.gridSize||256;
    if(rootCount===0)return {roots:0,segments:0,forks:0,triangles:0,
      avgRockTip:0,quality};
    const random=seeded(seed);
    const pieces=[];
    const startR=.0254*spread;
    let forks=0,totalRock=0,tipCount=0;
    const sampleRock=(x,y)=>clamp(sample(rock,N,x,y,.48),0,1);
    const sampleWet=(x,y)=>clamp(sample(moisture,N,x,y,.68),0,1);
    const candidateDirs=[-1.02,-.66,-.33,0,.33,.66,1.02];
    for(let i=0;i<rootCount;i++){
      const angle=PI2*fract((i+.18)/rootCount + .043*(random()-.5));
      const r=startR*(.91+.16*random());
      let p=[anchor[0]+Math.cos(angle)*r,
             anchor[1]+Math.sin(angle)*r,
             .0042];
      let heading=angle;
      const stepLen=(quality==='rich'?.0031:.0047)*length;
      const path=[];
      for(let k=0;k<steps;k++){
        const t=(k+1)/steps;
        const outward=Math.atan2(p[1]-anchor[1],p[0]-anchor[0]);
        let best=null,bestScore=Infinity;
        // Persist outward while actively sampling nearby rock valleys. The
        // native slate crack depression also retains water; neither field
        // is invented or regenerated independently of the living simulation.
        for(const off of candidateDirs){
          const a=heading+off;
          const vx=Math.cos(a),vy=Math.sin(a);
          const radial=Math.cos(a-outward);
          if(radial<.16)continue;
          const x=p[0]+vx*stepLen,y=p[1]+vy*stepLen;
          if(x<.008||x>.992||y<.008||y>.992)continue;
          const rockVal=sampleRock(x,y),wet=sampleWet(x,y);
          const persistence=off*off*.115+(1-radial)*.13;
          const mineralValley=rockVal*.77+(1-wet)*.23;
          const score=persistence+grip*mineralValley+
            (random()-.5)*.018;
          if(score<bestScore){bestScore=score;best=[x,y,a,rockVal];}
        }
        if(!best)break;
        heading=best[2];
        // Let the tip settle into the rock's valley. Its center always remains
        // slightly above the surface for a visible attachment silhouette.
        const z=.00034+.0038*(1-t)*(1-t)+.0007*best[3];
        const q=[best[0],best[1],z];
        const birth=.035 + k/steps*.145;
        const radius=(.00043*(1-.78*t))*(.8+.3*random());
        pieces.push({p,q,seed:seed+i*.013+k*.001,
          birth,width:.10,radius});
        path.push({p,q,birth,radius});
        p=q;
      }
      totalRock+=sampleRock(p[0],p[1]);tipCount++;
      // Daughter rootlets branch off established older rhizines and sample
      // their own local rock micro-valleys, rather than forming parallel rays.
      if(i%3===0 && path.length>=3){
        const parent=path[1];
        const branchStart=parent.q;
        const outAngle=heading + (random()<.5?-1:1)*(.72+.4*random());
        const forkLength=stepLen*.8;
        const endpoint=[branchStart[0]+Math.cos(outAngle)*forkLength,
          branchStart[1]+Math.sin(outAngle)*forkLength,.00075];
        if(endpoint[0]>.008&&endpoint[0]<.992&&
           endpoint[1]>.008&&endpoint[1]<.992){
          pieces.push({p:branchStart,q:endpoint,
            seed:seed+i*.019+.72,birth:parent.birth+.075,
            width:.11,radius:parent.radius*.54});
          forks++;
        }
      }
    }
    let triangles=0;
    for(const piece of pieces)
      triangles+=tube(out,anchor,piece.p,piece.q,
        piece.seed,piece.birth,piece.width,piece.radius,quality);
    return {roots:rootCount,segments:pieces.length,forks,
      triangles,avgRockTip:tipCount?totalRock/tipCount:0,quality};
  }
  window.LichenRhizines={grow};
})();