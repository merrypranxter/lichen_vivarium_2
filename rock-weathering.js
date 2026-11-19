/* Lichen Vivarium II — Phase 10: persistent biogenic weathering.
 * Stylized growth-form chemistry (not a quantitative geochemical model).
 * Owned rock records survive biomass clearance and local senescence.
 * No Math.random, no dependencies, capped 256^2 fields, tick-based.
 */
(function () {
  'use strict';
  const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,v));
  // Relative contact/organic activity, not empirical acid secretion constants.
  const traits=[
    {acid:1.35,oxide:.85,organic:.55},
    {acid:.72,oxide:.58,organic:1.15},
    {acid:.58,oxide:.48,organic:.95},
    {acid:1.16,oxide:1.18,organic:.85},
    {acid:.45,oxide:.40,organic:1.30}
  ];
  function create(fields) {
    const {gridSize,rockField,waterField,biomass,ageField,
      necrosisField,crackField,speciesField,params}=fields;
    const N=gridSize, count=N*N;
    if(!Number.isInteger(N)||N<4)throw Error('Invalid weathering grid');
    for(const field of [rockField,waterField,biomass,ageField,
      necrosisField,crackField,speciesField]){
      if(!field||field.length!==count)throw Error('Incompatible weathering field');
    }
    const etched=new Float32Array(count);
    const oxides=new Float32Array(count);
    const organics=new Float32Array(count);
    const memory=new Float32Array(count);
    let tick=0,revision=1;
    // Rock weathering can become irreversible, but the overlay can be turned
    // off without zeroing it. Rebuilding the ecosystem leaves scars intact.
    function step(){
      tick++;
      if(tick%4!==0)return false;
      const intensity=clamp(Number(params.weatheringIntensity??1),0,2);
      if(intensity<=.0001)return false;
      const erosion=clamp(Number(params.weatheringErosion??1),0,2);
      const oxidation=clamp(Number(params.weatheringOxides??1),0,2);
      const residue=clamp(Number(params.weatheringResidue??1),0,2);
      let changed=false;
      for(let i=0;i<count;i++){
        const b=clamp(biomass[i]);
        const age=ageField[i];
        const death=clamp(necrosisField[i]);
        const t=traits[speciesField[i]]||traits[0];
        const wet=clamp(waterField[i]);
        const rock=clamp(rockField[i]);
        const crack=clamp(crackField[i]);
        // Aging and hydration control how strongly the thallus interacts
        // with substrate; dry/bare stone is never spontaneously dissolved.
        const maturity=clamp(age/(age+8.0));
        const living=b*(1.0-death)*(.12+.88*maturity);
        const contact=living*(.20+.80*wet);
        if(contact>.00015){
          const etchRate=.0032*intensity*erosion*t.acid*contact
             *(.54+.46*(1.0-rock))*(1.0+.24*crack);
          const oxideRate=.0038*intensity*oxidation*t.oxide*contact
             *(.38+.62*rock);
          const organicRate=.0047*intensity*residue*t.organic*contact;
          const oldE=etched[i],oldO=oxides[i],oldR=organics[i];
          etched[i]=clamp(oldE+etchRate);
          oxides[i]=clamp(oldO+oxideRate);
          organics[i]=clamp(oldR+organicRate);
          memory[i]=Math.max(memory[i],clamp(etched[i]*.67+
            oxides[i]*.12+organics[i]*.31));
          if(etched[i]!==oldE||oxides[i]!==oldO||organics[i]!==oldR)
            changed=true;
        }else{
          // Sedimentary stains persist long after death, but some lose their
          // strongest saturation through slow weathering and runoff.
          if(oxides[i]>.00001){
            oxides[i]=Math.max(0,oxides[i]-.000008);
            changed=true;
          }
          if(organics[i]>.00001){
            organics[i]=Math.max(0,organics[i]-.000022);
            changed=true;
          }
          // etched and memory never decrease on their own.
        }
      }
      if(changed)revision++;
      return changed;
    }
    function reset(){
      etched.fill(0);oxides.fill(0);organics.fill(0);memory.fill(0);
      tick=0;revision++;
    }
    function habitatFactor(i,species){
      const p=species===0?{etch:.52,oxide:.12}:
        species===3?{etch:.44,oxide:.10}:
        species===4?{etch:.58,oxide:-.12}:
        {etch:.29,oxide:-.16};
      return clamp(1.0+etched[i]*p.etch+
                   oxides[i]*p.oxide+organics[i]*.12,.72,1.75);
    }
    function nutrientFactor(i){
      // Some reworked mineral edges release resources; acidic weathering also
      // consumes reactive material. Clamp to avoid positive-feedback runaway.
      return clamp(1.0+.16*oxides[i]-.12*etched[i]+.06*organics[i],
        .82,1.17);
    }
    function moisturePocket(i){
      // Shallow etched pits hold a little extra retained water and can offer
      // refuges to future organisms after the original lichen has died.
      return .17*etched[i]+.035*memory[i];
    }
    function encodeRGBA(out) {
      if(!out||out.length!==4*count)throw Error('Invalid weathering image buffer');
      for(let i=0,j=0;i<count;i++,j+=4){
        out[j]=Math.round(etched[i]*255);
        out[j+1]=Math.round(oxides[i]*255);
        out[j+2]=Math.round(organics[i]*255);
        out[j+3]=Math.round(memory[i]*255);
      }
      return out;
    }
    function statistics(){
      let totalE=0,totalO=0,totalR=0,coverage=0,maxEtch=0;
      for(let i=0;i<count;i++){
        totalE+=etched[i];totalO+=oxides[i];totalR+=organics[i];
        if(memory[i]>.015)coverage++;
        if(etched[i]>maxEtch)maxEtch=etched[i];
      }
      return {meanEtch:totalE/count,meanOxide:totalO/count,
        meanOrganic:totalR/count,scarCoverage:coverage/count,maxEtch};
    }
    return {step,reset,habitatFactor,nutrientFactor,moisturePocket,
      encodeRGBA,statistics,getRevision:()=>revision,
      fields:{etched,oxides,organics,memory},traits};
  }
  window.LichenRockWeathering={create};
})();
