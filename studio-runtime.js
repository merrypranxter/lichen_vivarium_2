/* Lichen Vivarium II — Color Vault, responsive viewport & local media export.
   Uses the original biological simulation and WebGL renderer via an explicit adapter.
   All rendering and encoding occurs on-device; no API keys or paid servers. */
(function () {
  'use strict';
  window.setupLichenStudio = function setupLichenStudio(api) {
    const { gl, canvas, params, uniforms } = api;
    const $ = id => document.getElementById(id);
    const library = Array.isArray(window.LICHEN_STUDIO_PALETTES) ? window.LICHEN_STUDIO_PALETTES : [];
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const isColor = h => /^#[0-9a-f]{6}$/i.test(h);
    const hexChannels = h => [1,3,5].map(i => parseInt(h.slice(i, i+2), 16));
    const colorHex = (r,g,b) => '#' + [r,g,b].map(c => Math.round(clamp(c,0,255)).toString(16).padStart(2,'0')).join('');
    const randomHex = () => colorHex(Math.random()*255, Math.random()*255, Math.random()*255);

    // ======================================================================
    // Pinned artwork: one screen, swipe the *controls*, drag to resize art.
    // ======================================================================
    const divider = $('stageDivider');
    const stage = $('viewportStage');
    let resizing = false;
    function resizeStage(px) {
      const usable = window.innerHeight || 700;
      document.documentElement.style.setProperty('--lichen-stage-height',
        Math.round(clamp(px, 215, usable * 0.77)) + 'px');
    }
    divider.addEventListener('pointerdown', event => {
      if (window.matchMedia('(min-width: 1024px)').matches) return;
      resizing = true;
      divider.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    divider.addEventListener('pointermove', event => {
      if (resizing) resizeStage(event.clientY);
    });
    function releaseDivider() { resizing = false; }
    divider.addEventListener('pointerup', releaseDivider);
    divider.addEventListener('pointercancel', releaseDivider);
    divider.addEventListener('lostpointercapture', releaseDivider);
    divider.addEventListener('keydown', event => {
      if (!['ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
      const now = stage.getBoundingClientRect().height;
      resizeStage(event.key === 'Home' ? 235 : event.key === 'End'
        ? window.innerHeight * 0.76 : now + (event.key === 'ArrowDown' ? 30 : -30));
      event.preventDefault();
    });
    document.querySelectorAll('#tabBar .tab-btn').forEach(button => {
      button.setAttribute('role', 'tab');
      button.addEventListener('click', () => {
        // Return to panel top after swapping tabs; artwork remains pinned.
        const panel = $('controlsPanel');
        panel.scrollTo({top:0,behavior:'instant'});
      });
    });

    // ======================================================================
    // Authentic source-defined palette vault; no stop downsampling.
    // ======================================================================
    const paletteSel = $('paletteVaultSelect');
    const familySel = $('paletteFamily');
    const search = $('paletteSearch');
    const stopEditor = $('colorStopEditor');
    const paletteStatus = $('paletteVaultStatus');
    let paletteIndex = -1;
    let stops = [];
    const rampTexture = gl.createTexture();
    if (!rampTexture) throw new Error('Unable to allocate palette texture.');
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, rampTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (uniforms.uColorRamp !== null) gl.uniform1i(uniforms.uColorRamp, 2);

    function uploadRamp() {
      if (stops.length < 2) return;
      const pixels = new Uint8Array(256 * 4);
      const decoded = stops.map(hexChannels);
      for (let x=0;x<256;x++) {
        const t = (x / 255) * (decoded.length - 1);
        const a = Math.min(decoded.length - 2, Math.floor(t));
        const f = t - a;
        for (let k=0;k<3;k++)
          pixels[x*4+k] = Math.round(decoded[a][k] * (1-f) + decoded[a+1][k] * f);
        pixels[x*4+3] = 255;
      }
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D,rampTexture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,1,0,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    }
    function activateNamed() {
      if (stops.length < 2) return;
      params.paletteMode = 6;
      document.querySelectorAll('.palette-pill').forEach(b => b.classList.remove('active'));
      uploadRamp();
    }
    function renderStops() {
      stopEditor.replaceChildren();
      if (!stops.length) {
        stopEditor.textContent = 'Choose a palette above to edit every color stop.';
        return;
      }
      stops.forEach((hex,i) => {
        const wrap = document.createElement('div');
        wrap.className = 'stop';
        const input = document.createElement('input');
        input.type='color'; input.value=hex; input.setAttribute('aria-label','Edit stop '+(i+1));
        input.addEventListener('input',() => {
          stops[i]=input.value; activateNamed();
          paletteStatus.textContent='Editing the live color ramp · stop '+(i+1)+' of '+stops.length;
        });
        const label = document.createElement('div');
        label.className='stop-label';
        label.textContent=String(i+1).padStart(2,'0')+' / '+stops.length;
        label.title=hex;
        const shuffle = document.createElement('button');
        shuffle.type='button';shuffle.textContent='🎲';shuffle.title='Randomize only this color';
        shuffle.setAttribute('aria-label','Randomize stop '+(i+1));
        shuffle.addEventListener('click',()=>{stops[i]=randomHex();activateNamed();renderStops();});
        const remove = document.createElement('button');
        remove.type='button';remove.textContent='×';remove.title='Remove this color stop';
        remove.setAttribute('aria-label','Remove stop '+(i+1));
        remove.disabled=stops.length<=2;
        remove.addEventListener('click',()=>{if(stops.length>2){stops.splice(i,1);activateNamed();renderStops();}});
        wrap.append(input,label,shuffle,remove);
        stopEditor.appendChild(wrap);
      });
    }
    function activatePalette(index) {
      const p=library[index];
      if (!p || !Array.isArray(p.colors) || p.colors.length<2) return;
      paletteIndex=index;
      stops=p.colors.filter(isColor).map(c=>c.toLowerCase());
      paletteSel.value=String(index);
      paletteStatus.textContent=p.name+' · '+stops.length+' original stops · '+p.source;
      activateNamed();renderStops();
    }
    function refreshPaletteOptions() {
      const q=search.value.trim().toLowerCase();
      const group=familySel.value;
      const fragment=document.createDocumentFragment();
      const empty=document.createElement('option');
      empty.value='';empty.textContent='Choose one of '+library.length+' named palettes…';
      fragment.appendChild(empty);
      let found=0;
      for (const [i,p] of library.entries()) {
        if (group!=='all' && p.source!==group) continue;
        if (q && !(p.name+' '+p.source).toLowerCase().includes(q)) continue;
        const o=document.createElement('option');
        o.value=String(i);o.textContent=p.name+' ('+p.source.replaceAll('_',' ')+')';
        fragment.appendChild(o);found++;
      }
      paletteSel.replaceChildren(fragment);
      paletteSel.value=paletteIndex>=0 && [...paletteSel.options].some(x=>x.value===String(paletteIndex))
        ? String(paletteIndex) : '';
      if (!found) paletteStatus.textContent='No palettes match that filter.';
    }
    const families=[...new Set(library.map(p=>p.source))];
    families.forEach(group=>{
      const o=document.createElement('option');
      o.value=group;o.textContent=group.replaceAll('_',' ').replace('itsamoire', "It's a Moiré");
      familySel.appendChild(o);
    });
    paletteSel.addEventListener('change',()=>activatePalette(Number(paletteSel.value)));
    familySel.addEventListener('change',refreshPaletteOptions);
    search.addEventListener('input',refreshPaletteOptions);
    refreshPaletteOptions();renderStops();

    function randomNamed() {
      if (!library.length) return;
      let idx=Math.floor(Math.random()*library.length);
      if (library.length>1 && idx===paletteIndex) idx=(idx+1)%library.length;
      familySel.value='all';search.value='';
      refreshPaletteOptions();activatePalette(idx);
    }
    $('randomPaletteBtn').addEventListener('click',randomNamed);
    function mutateStops(fn) {
      if(stops.length<2)randomNamed();
      if(stops.length<2)return;
      stops=fn([...stops]);
      activateNamed();renderStops();
      paletteStatus.textContent='Custom mutation · '+stops.length+' editable color stops';
    }
    $('randomStopColorsBtn').addEventListener('click',()=>mutateStops(a=>a.map(randomHex)));
    $('shuffleStopOrderBtn').addEventListener('click',()=>mutateStops(a=>{
      for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
      return a;
    }));
    $('reverseStopOrderBtn').addEventListener('click',()=>mutateStops(a=>a.reverse()));
    $('rotateStopOrderBtn').addEventListener('click',()=>mutateStops(a=>[a.at(-1),...a.slice(0,-1)]));
    $('addColorStopBtn').addEventListener('click',()=>mutateStops(a=>{a.push(randomHex());return a;}));
    document.querySelectorAll('.palette-pill').forEach(button=>{
      button.addEventListener('click',()=>{
        paletteIndex=-1;
        paletteSel.value='';
        paletteStatus.textContent='Gemini original pigment mode selected; choose a vault palette to return to custom stops.';
      });
    });
    // Original Surprise Pigments mutates other optics, then the additional
    // listener optionally selects a real named palette without resetting anatomy.
    $('surprisePigmentBtn').addEventListener('click',()=>{
      if(Math.random() < .8)randomNamed();
      else {paletteIndex=-1;paletteSel.value='';paletteStatus.textContent='Gemini material genome mutation';}
    });

    // ======================================================================
    // High-resolution frame-by-frame GIF and H.264-in-MP4 exporter.
    // ======================================================================
    const exportStatus=$('exportStatus');
    let busy=false;
    let cancelled=false;
    let outputURL=null;
    let encoderInFlight=null;
    const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(resolve));
    function status(msg){exportStatus.textContent=msg;}
    function setBusy(flag) {
      busy=flag;
      ['exportGifBtn','exportMp4Btn','exportHiresPngBtn'].forEach(id=>$(id).disabled=flag);
      $('cancelExportBtn').disabled=!flag;
    }
    function makeFileName(ext){
      return 'lichen-vivarium-II-yr-'+Math.round(api.getYears())+'-'+Date.now()+'.'+ext;
    }
    function offer(blob,extension) {
      if (outputURL) URL.revokeObjectURL(outputURL);
      outputURL=URL.createObjectURL(blob);
      const name=makeFileName(extension);
      const link=document.createElement('a');
      link.href=outputURL;link.download=name;link.textContent='⬇ Tap to save '+name;
      link.style.cssText='display:block;margin-top:9px;color:#aff7ff;text-decoration:underline;overflow-wrap:anywhere;min-height:36px;';
      exportStatus.replaceChildren(document.createTextNode(
        'Export ready · '+(blob.size/1048576).toFixed(1)+' MB. If Safari opens a preview, use Share → Save to Files.'),
        link);
      link.click();
    }
    function exportOptions(kind) {
      const size=Number($('exportResolution').value);
      const seconds=Number($('exportSeconds').value);
      const fps=Number($('exportFps').value);
      const bitrate=Number($('exportBitrate').value);
      const steps=Number($('exportGrowthSteps').value);
      if (![size,seconds,fps,bitrate,steps].every(Number.isFinite)) throw Error('Invalid export settings');
      const maxSide=Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
      if (size>maxSide) throw Error('This device only supports rendering up to '+maxSide+' pixels per side.');
      if (kind==='gif' && size>=1536 && fps*seconds>180)
        throw Error('That GIF would be enormous on a phone. For 1536–2048px choose up to 180 GIF frames, or use MP4 for longer animations.');
      return {size,seconds,fps,bitrate,steps,frames:Math.round(seconds*fps)};
    }
    function prepare(size,steps){
      api.setExportLock(true,steps);
      canvas.width=size;canvas.height=size;
      gl.viewport(0,0,size,size);
    }
    function restore(){
      api.setExportLock(false);
      api.restoreCanvas();
    }
    async function draw(i,fps,advance) {
      if(cancelled)throw new DOMException('Export cancelled','AbortError');
      api.exportFrame(1000 * i/fps,advance);
      if(gl.isContextLost()) throw new Error('GPU context lost during export; try a smaller resolution.');
      if(i%2===0)await nextPaint();
    }
    async function encodeGIF(opts){
      status('Loading the local GIF encoder…');
      const {GIFEncoder,quantize,applyPalette}=await import('https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js');
      const gif=GIFEncoder();
      const {size,frames,fps}=opts;
      const sampler=document.createElement('canvas');
      sampler.width=size;sampler.height=size;
      const ctx=sampler.getContext('2d',{willReadFrequently:true});
      if(!ctx)throw Error('Unable to initialize GIF frame sampler.');
      let palette=null;
      for(let i=0;i<frames;i++){
        await draw(i,fps,true);
        ctx.drawImage(canvas,0,0,size,size);
        const rgba=ctx.getImageData(0,0,size,size).data;
        if(!palette)palette=quantize(rgba,256,{format:'rgb565'});
        const indexed=applyPalette(rgba,palette,'rgb565');
        gif.writeFrame(indexed,size,size,{palette,delay:Math.round(1000/fps),repeat:0});
        if(i%5===0 || i===frames-1)status('Encoding GIF '+(i+1)+'/'+frames+' frames · '+size+'px · '+fps+'fps');
        if(i%3===0)await sleep(0);
      }
      gif.finish();
      if(cancelled)throw new DOMException('Export cancelled','AbortError');
      return new Blob([gif.bytesView()],{type:'image/gif'});
    }
    async function encodeWebCodecsMP4(opts) {
      if(typeof VideoEncoder==='undefined' || typeof VideoFrame==='undefined')return null;
      const codecs=['avc1.640033','avc1.640028','avc1.4d0028','avc1.42e01f','avc1.42001f'];
      let config=null;
      for(const codec of codecs) {
        const candidate={
          codec,width:opts.size,height:opts.size,bitrate:opts.bitrate,
          framerate:opts.fps,latencyMode:'quality',avc:{format:'avc'}
        };
        try{
          const support=await VideoEncoder.isConfigSupported(candidate);
          if(support.supported){config=support.config;break;}
        }catch(e){console.warn('Encoder configuration rejected',codec,e);}
      }
      if(!config)return null;
      status('Loading MP4 muxer…');
      const {Muxer,ArrayBufferTarget}=await import('https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/+esm');
      const target=new ArrayBufferTarget();
      const muxer=new Muxer({
        target,video:{codec:'avc',width:opts.size,height:opts.size,frameRate:opts.fps},
        fastStart:'in-memory',firstTimestampBehavior:'offset'
      });
      let fatal=null;
      const encoder=new VideoEncoder({
        output:(chunk,metadata)=>muxer.addVideoChunk(chunk,metadata),
        error:error=>{fatal=error;console.error(error);}
      });
      encoderInFlight=encoder;
      try{
        encoder.configure(config);
        for(let i=0;i<opts.frames;i++){
          if(fatal)throw fatal;
          await draw(i,opts.fps,true);
          const frame=new VideoFrame(canvas,{timestamp:Math.round(i*1000000/opts.fps)});
          try{encoder.encode(frame,{keyFrame:i%Math.max(1,opts.fps)===0});}
          finally{frame.close();}
          if(i%10===9)await encoder.flush();
          if(i%5===0 || i===opts.frames-1)
            status('Encoding H.264 MP4 '+(i+1)+'/'+opts.frames+' · '+opts.size+'px · '+opts.fps+'fps');
        }
        await encoder.flush();
        if(fatal)throw fatal;
        if(cancelled)throw new DOMException('Export cancelled','AbortError');
        muxer.finalize();
        return new Blob([target.buffer],{type:'video/mp4'});
      }finally{
        try{if(encoder.state!=='closed')encoder.close();}catch(e){}
        encoderInFlight=null;
      }
    }
    async function encodeRecorderMP4(opts){
      if(typeof MediaRecorder==='undefined' || !canvas.captureStream ||
         !MediaRecorder.isTypeSupported('video/mp4')) return null;
      status('Browser H.264 recorder available; recording in real time…');
      const stream=canvas.captureStream(opts.fps);
      const chunks=[];
      const recorder=new MediaRecorder(stream,{mimeType:'video/mp4',videoBitsPerSecond:opts.bitrate});
      const done=new Promise((resolve,reject)=>{
        recorder.ondataavailable=e=>{if(e.data && e.data.size)chunks.push(e.data);};
        recorder.onerror=e=>reject(e.error||Error('MP4 recorder error'));
        recorder.onstop=()=>resolve(new Blob(chunks,{type:'video/mp4'}));
      });
      try{
        recorder.start(1000);
        for(let i=0;i<opts.frames;i++){
          await draw(i,opts.fps,true);
          if(i%5===0)status('Recording MP4 '+(i+1)+'/'+opts.frames+' frames');
          await sleep(1000/opts.fps);
        }
        recorder.stop();
        return await done;
      }finally{
        if(recorder.state==='recording')recorder.stop();
        stream.getTracks().forEach(track=>track.stop());
      }
    }
    async function startExport(kind){
      if(busy)return;
      setBusy(true);cancelled=false;
      let didPrepare=false;
      try{
        const opts=exportOptions(kind);
        status('Preparing '+opts.size+' × '+opts.size+' '+kind.toUpperCase()+'…');
        prepare(opts.size,opts.steps);
        didPrepare=true;
        let blob;
        if(kind==='png'){
          await draw(0,opts.fps,false);
          blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG capture failed')),'image/png'));
        }else if(kind==='gif'){
          blob=await encodeGIF(opts);
        }else{
          blob=await encodeWebCodecsMP4(opts);
          if(!blob)blob=await encodeRecorderMP4(opts);
          if(!blob)throw Error('This browser has no usable H.264 MP4 encoder. Try a current Safari/Chrome, or export GIF.');
        }
        if(cancelled)throw new DOMException('Export cancelled','AbortError');
        if(!blob || !blob.size)throw Error('The encoder produced an empty file.');
        offer(blob,kind);
      }catch(error){
        if(error && error.name==='AbortError')status('Export cancelled. Your living lichen is still here.');
        else{console.error('Lichen export error:',error);status('Export failed: '+(error?.message||String(error)));}
      }finally{
        if(didPrepare)restore();
        setBusy(false);cancelled=false;
      }
    }
    $('exportGifBtn').addEventListener('click',()=>startExport('gif'));
    $('exportMp4Btn').addEventListener('click',()=>startExport('mp4'));
    $('exportHiresPngBtn').addEventListener('click',()=>startExport('png'));
    $('cancelExportBtn').addEventListener('click',()=>{cancelled=true;status('Cancelling after the current frame…');});
    $('exportGrowthSteps').addEventListener('input',e=>{
      $('exportGrowthVal').textContent=e.target.value;
    });
    window.lichenStudioExportPNG=()=>startExport('png');

    console.info('Lichen Studio II: '+library.length+' authentic palettes and GIF/MP4/PNG export enabled.');
  };
})();
