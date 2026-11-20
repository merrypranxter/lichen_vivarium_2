/* Lichen Vivarium II — Phase 11: deterministic ecological succession.
 * Artistic ecological guilds, not calibrated species succession.
 * Reads live biology and Phase 10 rock history. No independent mutable
 * history arrays, randomness or timers: Codex's specimen snapshots remain
 * fully reversible and frame-perfect.
 */
(function(){
  'use strict';
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  // Ecological guild profiles map to the five existing morphology engines.
  // 0 crustose pioneer, 1 foliose, 2 fruticose, 3 squamulose, 4 gelatinous.
  const guilds=Object.freeze([
    {name:'Crustose pioneer',pioneer:1.0,heir:-.54,water:-.12,minerals:.43},
    {name:'Foliose successor',pioneer:-.24,heir:.94,water:.34,minerals:.12},
    {name:'Fruticose successor',pioneer:-.02,heir:.68,water:.15,minerals:.04},
    {name:'Squamulose pioneer',pioneer:.72,heir:.16,water:.18,minerals:.32},
    {name:'Gelatinous successor',pioneer:-.35,heir:1.08,water:.67,minerals:-.18}
  ]);
  function create({gridSize,biomass,ageField,necrosisField,speciesField,
                   colonyIdField,nutrientField,waterField,rockField,
                   weathering,params}){
    const n=gridSize*gridSize;
    if(!Number.isInteger(gridSize)||gridSize<4)throw Error('Succession needs a square rock grid');
    for(const [name,array] of Object.entries({biomass,ageField,necrosisField,
      speciesField,colonyIdField,nutrientField,waterField,rockField})){
      if(!array||array.length!==n)throw Error('Succession field mismatch: '+name);
    }
    const memory=weathering?.fields?.memory||null;
    const etched=weathering?.fields?.etched||null;
    const organics=weathering?.fields?.organics||null;
    const oxides=weathering?.fields?.oxides||null;
    const strength=()=>clamp(Number(params.successionInfluence??1),0,2);
    function site(i){
      const old=memory?clamp(memory[i]):0;
      const pit=etched?clamp(etched[i]):0;
      const organic=organics?clamp(organics[i]):0;
      const oxide=oxides?clamp(oxides[i]):0;
      const wet=clamp(waterField[i]);
      const nutrients=clamp(nutrientField[i]);
      const rock=clamp(rockField[i]);
      // Mature lichen modifies mineral substrate; biological corpses leave
      // dark organic films and micro-catchments that invite successors.
      const legacy=clamp(.72*old+.17*pit+.14*organic);
      const secondary=clamp(legacy*(.72+.28*wet)+.12*organic);
      const pioneer=clamp((1-legacy)*(.56+.44*rock));
      return {legacy,secondary,pioneer,wet,nutrients,rock,oxide};
    }
    function affinityFromSite(s,species){
      const guild=guilds[species]||guilds[0];
      const primary=clamp(Number(params.successionPioneers??1),0,2);
      const secondary=clamp(Number(params.successionHeirs??1),0,2);
      const relativeWet=s.wet-.55;
      // Positive secondary preference means successional species favor the
      // accumulated scars. Pioneer species are selected on fresh bare rock.
      const value=primary*guild.pioneer*(s.pioneer-.30)*.62+
                  secondary*guild.heir*(s.secondary-.12)*1.10+
                  guild.water*relativeWet*.38+
                  guild.minerals*(s.oxide-.24)*.22+
                  (s.nutrients-.5)*.14;
      return clamp(1+strength()*value,.35,2.40);
    }
    function affinity(i,species) {
      if(strength()===0)return 1;
      return affinityFromSite(site(i),species);
    }
    function recruitment(i,species){
      if(strength()===0)return 1;
      const s=site(i);
      return clamp(affinityFromSite(s,species)*(.86+.24*s.nutrients),.25,2.30);
    }
    function growthFactor(i,species){
      if(strength()===0)return 1;
      const s=site(i);
      // Avoid double niche allocation in the biology's 256² hot loop.
      return clamp(1+(affinityFromSite(s,species)-1)*.38+
                   strength()*(s.secondary-.15)*.06,.65,1.45);
    }
    function competition(i,localSpecies,neighborSpecies){
      if(strength()===0||localSpecies===neighborSpecies)return 1;
      const contest=clamp(Number(params.successionCompetition??1.0),0,2);
      if(contest===0)return 1;
      const local=affinity(i,localSpecies);
      const foreign=affinity(i,neighborSpecies);
      const disadvantage=clamp(.5+(foreign-local)*.5);
      // Borders thicken slowly, they do not steal occupied pixels. Historical
      // cracks remain physically present after either competitor dies.
      return clamp(1-strength()*contest*(.12+.32*disadvantage),.42,1);
    }
    function chooseSpecies(i,random,activeSpecies){
      if(strength()===0)return activeSpecies;
      const r=clamp(random,0,.99999999);
      let weights=[],total=0;
      for(let sp=0;sp<5;sp++){
        // Active art-brush species remains a favored propagule source, but
        // cannot dominate rock where a different guild thrives.
        const source=(sp===activeSpecies?2.3:1);
        const w=source*recruitment(i,sp);
        weights.push(w);total+=w;
      }
      let pick=r*total;
      for(let sp=0;sp<5;sp++){
        pick-=weights[sp];
        if(pick<0)return sp;
      }
      return 4;
    }
    function establishment(i,species){
      if(strength()===0)return 1;
      const spot=site(i);
      return clamp(recruitment(i,species)*
        (.82+.18*spot.nutrients),.12,1.75);
    }
    // Diagnostic RGBA8, generated only when specifically requested. R pioneers
    // G successors, B historical life/death imprint, A competing boundaries.
    function encodeRGBA(out){
      if(!out||out.length!==n*4)throw Error('Succession map needs 256² RGBA8');
      for(let i=0,j=0;i<n;i++,j+=4){
        const s=site(i);
        out[j]=Math.round(s.pioneer*255);
        out[j+1]=Math.round(s.secondary*255);
        out[j+2]=Math.round(s.legacy*255);
        let border=0;
        const x=i%gridSize,y=Math.floor(i/gridSize),col=colonyIdField[i];
        if(col!==0&&x>0&&x<gridSize-1&&y>0&&y<gridSize-1){
          const indices=[i-1,i+1,i-gridSize,i+gridSize];
          for(const k of indices){
            const other=colonyIdField[k];
            if(other!==0&&other!==col&&biomass[k]>.05){border=1;break;}
          }
        }
        out[j+3]=border?255:0;
      }
      return out;
    }
    function statistics(){
      let secondary=0,occupied=0,contested=0;
      for(let i=0;i<n;i++){
        const s=site(i);
        if(s.secondary>.20&&biomass[i]<.07)secondary++;
        if(biomass[i]>.05)occupied++;
        if(colonyIdField[i]!==0&&i>=gridSize&&i<n-gridSize&&
          colonyIdField[i-1]!==0&&colonyIdField[i-1]!==colonyIdField[i]&&
          biomass[i]>.05)contested++;
      }
      return {successorNiches:secondary,occupancy:occupied/n,
        contestedMargins:contested,modelStrength:strength()};
    }
    return {site,affinity,recruitment,growthFactor,competition,
      chooseSpecies,establishment,encodeRGBA,statistics,guilds};
  }
  window.LichenSuccession={create};
})();