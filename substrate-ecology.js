/* Lichen Vivarium II — Phase 9: substrate ecology (CPU).
   Runs only on the existing 256×256 rock/water/lichen grid. Derives mineral seams,
   crevice retention and exposure from the existing rockField, never fabricates
   independent geometry. Its effects are stylized biological affinities.
   Dependency-free; browser exposes window.LichenSubstrateEcology. */
(function () {
  'use strict';
  const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
  const profiles=[
    // Different ecological growth-form preferences, not validated species data.
    {water:.45,crevice:.18,mineral:.88},  // crustose pioneer on exposed mineral
    {water:1.10,crevice:.38,mineral:.10},  // foliose moisture-loving lobes
    {water:.62,crevice:.33,mineral:.22},  // raised fruticose holdfast
    {water:.76,crevice:.83,mineral:.40},  // squamulose crack colonist
    {water:1.32,crevice:.54,mineral:-.15} // gelatinous / umbilicate
  ];

  function create({gridSize,rockField,waterField,params}) {
    const N=gridSize, count=N*N;
    if(!Number.isInteger(N)||N<4 || rockField.length!==count ||
       waterField.length!==count)throw Error('Invalid shared substrate fields');
    const crevice=new Float32Array(count);
    const mineral=new Float32Array(count);
    const exposure=new Float32Array(count);
    const buffer=new Float32Array(count);
    let ticks=0;
    let weathering=null;
    function attachWeathering(engine) {
      weathering=engine||null;
    }
    function initialize(){
      // Valley depth and mineral/cleavage interfaces use the actual rock field;
      // stable sampling means the 3D rhizines follow these same fissures.
      for(let y=0;y<N;y++)for(let x=0;x<N;x++){
        const i=y*N+x;
        const left=rockField[y*N+Math.max(0,x-1)];
        const right=rockField[y*N+Math.min(N-1,x+1)];
        const up=rockField[Math.max(0,y-1)*N+x];
        const down=rockField[Math.min(N-1,y+1)*N+x];
        const height=clamp(rockField[i]);
        const valley=clamp((.53-height)*1.75);
        const slope=clamp((Math.abs(right-left)+Math.abs(up-down))*3.5);
        // Match the visible shader's quartz-vein trajectory approximately:
        // y = .68 + .52*(x-.35) - .05*fbm(x,y).
        // CPU/GPU fBm implementations differ, so this is a coherent
        // spatial approximation, not numerical identity.
        const u=x/N,v=y/N;
        const quartzDistance=Math.abs((v-.68)-.52*(u-.35)+
                                     .025+.009*(height-.5));
        const quartz=Math.exp(-quartzDistance*55.0);
        // Geological cleavage creates veins at height discontinuities,
        // rather than a new unrelated random mineral noise field.
        crevice[i]=clamp(valley*.86+slope*.22);
        mineral[i]=clamp(.14+height*.46+slope*.54+quartz*.40);
        exposure[i]=clamp(.18+height*.69-valley*.19);
        waterField[i]=clamp(waterField[i]);
      }
      buffer.set(waterField);
      ticks=0;
    }

    // Update moisture one time in three biological ticks (~20 Hz at default
    // 60 ticks/s). This respects the existing hydration lag and phone budget.
    function step() {
      ticks++;
      if(ticks%3!==0)return false;
      const ambient=clamp(params.ambientHydration);
      const retention=clamp(Number(params.substrateRetention??1.1),0,2);
      const drying=clamp(Number(params.substrateExposure??.75),0,2);
      buffer.set(waterField);
      for(let y=1;y<N-1;y++){
        const row=y*N;
        for(let x=1;x<N-1;x++){
          const i=row+x, old=waterField[i];
          const trap=crevice[i];
          const open=exposure[i];
          const target=clamp(
            ambient+.45*trap*(1-ambient)*retention
                   -.31*open*ambient*drying
                   +(weathering?weathering.moisturePocket(i):0));
          const lap=waterField[i-1]+waterField[i+1]+
                    waterField[i-N]+waterField[i+N]-4*old;
          buffer[i]=clamp(old+.085*(target-old)+.035*lap);
        }
      }
      // Perimeter cells likewise relax gradually, avoiding a visible
      // artificial damp border after a rain pulse or a dry spell.
      for(let x=0;x<N;x++)for(const y of [0,N-1]){
        const i=y*N+x;
        buffer[i]=clamp(waterField[i]+.085*(ambient-waterField[i]));
      }
      for(let y=1;y<N-1;y++)for(const x of [0,N-1]){
        const i=y*N+x;
        buffer[i]=clamp(waterField[i]+.085*(ambient-waterField[i]));
      }
      waterField.set(buffer);
      return true;
    }
    function growthFactor(i,species){
      const strength=clamp(Number(params.substrateInfluence??1),0,2);
      if(strength===0)return 1;
      const p=profiles[species]||profiles[0];
      const ambient=clamp(params.effectiveWetness);
      const local=clamp(waterField[i]);
      // Growth is locally faster in hydrated cracks but not underwater:
      // saturated surfaces lose some photosynthetic activity.
      const wetBonus=clamp((local-ambient)*(1.0+p.water*.9),-.55,.45);
      const waterPenalty=local>.94 ? (local-.94)*2.1*p.water : 0;
      const crackBonus=(crevice[i]-.38)*p.crevice*.54*
                      clamp(Number(params.substrateCreviceBias??1.15),0,2);
      const mineralBonus=(mineral[i]-.45)*p.mineral*.58*
                      clamp(Number(params.substrateMineralFlux??.9),0,2);
      const heatPenalty=exposure[i]*(1-local)*p.water*.31;
      const terrain=clamp(1+strength*(wetBonus+crackBonus+mineralBonus-
                    heatPenalty-waterPenalty),.34,1.85);
      return weathering
        ? clamp(terrain*weathering.habitatFactor(i,species),.34,2.05)
        : terrain;
    }
    function replenishment(i){
      const strength=clamp(Number(params.substrateInfluence??1),0,2);
      const leaching=clamp(Number(params.substrateMineralFlux??.9),0,2);
      const terrain=clamp(1+strength*leaching*((mineral[i]-.43)*.50+
             crevice[i]*waterField[i]*.13),.55,1.65);
      return weathering
        ? clamp(terrain*weathering.nutrientFactor(i),.50,1.75)
        : terrain;
    }
    function desiccation(i) {
      const strength=clamp(Number(params.substrateInfluence??1),0,2);
      return clamp(1+strength*((exposure[i]*(1-waterField[i]))*.80-
                              crevice[i]*waterField[i]*.31),.58,1.70);
    }
    function encodeRGBA(out){
      if(!out||out.length!==4*count)throw Error('Invalid substrate image buffer');
      for(let i=0,j=0;i<count;i++,j+=4){
        out[j]=Math.round(clamp(waterField[i])*255);
        out[j+1]=Math.round(clamp(mineral[i])*255);
        out[j+2]=Math.round(clamp(crevice[i])*255);
        out[j+3]=Math.round(clamp(exposure[i])*255);
      }
      return out;
    }
    function statistics(){
      let wet=0,crev=0,min=0,expo=0;
      for(let i=0;i<count;i++){
        wet+=waterField[i];crev+=crevice[i];min+=mineral[i];expo+=exposure[i];
      }
      return {meanWater:wet/count,meanCrevice:crev/count,
        meanMineral:min/count,meanExposure:expo/count};
    }
    function setTick(value){
      if(!Number.isSafeInteger(value)||value<0)
        throw Error('Substrate tick must be a nonnegative safe integer');
      ticks=value;
    }
    return {initialize,step,growthFactor,replenishment,desiccation,
      attachWeathering,encodeRGBA,statistics,getTick:()=>ticks,setTick,
      fields:{crevice,mineral,exposure},profiles};
  }
  window.LichenSubstrateEcology={create};
})();
