// Optional real WebGL check. Start a static server, then run with Playwright installed:
// node tests/rendered-study.cjs http://127.0.0.1:8000
'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
 const page=await browser.newPage({viewport:{width:1100,height:750},deviceScaleFactor:1});
 page.setDefaultTimeout(180000);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Failed to load resource:'))errors.push(m.text());});
 // Freeze the preview scheduler, not simulation logic. Render exact frames via the adapter.
 await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
 await page.route('https://**',route=>route.abort());
 await page.goto((process.argv[2]||'http://127.0.0.1:8000')+'/?study=1');
 await page.waitForFunction(()=>!!window.lichenStudy);
 await page.evaluate(()=>{lichenStudy.loadSpecimen();lichenStudy.canvas.width=512;lichenStudy.canvas.height=512;});
 const out=path.resolve(__dirname,'../docs/specimen-review');fs.mkdirSync(out,{recursive:true});
 const manifest={browser:await browser.version(),resolution:512,frames:[]};
 async function capture(name,change){
  const data=await page.evaluate(change=>{
   const a=lichenStudy;
   Object.assign(a.params,change);
   const start=performance.now();a.render();a.gl.finish();
   const elapsed=performance.now()-start;
   const pixels=new Uint8Array(512*512*4);a.gl.readPixels(0,0,512,512,a.gl.RGBA,a.gl.UNSIGNED_BYTE,pixels);
   let nonzero=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]+pixels[i+1]+pixels[i+2]>10)nonzero++;
   return {png:a.canvas.toDataURL('image/png').split(',')[1],elapsed,nonzero,error:a.gl.getError()};
  },change);
  assert.equal(data.error,0,`${name}: WebGL errors`);assert.ok(data.nonzero>4000,`${name}: scene is empty`);
  const bytes=Buffer.from(data.png,'base64');fs.writeFileSync(path.join(out,name+'.png'),bytes);
  const hash=crypto.createHash('sha256').update(bytes).digest('hex');
  manifest.frames.push({name,sha256:hash,renderMs:Math.round(data.elapsed),nonzeroPixels:data.nonzero});
  console.log(name,Math.round(data.elapsed)+'ms',hash.slice(0,12));return hash;
 }
 const dry=await capture('01-dry-pigment',{realismEnabled:true,materialDebug:0,renderLayer:'composite'});
 const repeat=await capture('02-repeat',{realismEnabled:true});assert.equal(dry,repeat,'Frozen rendering must repeat exactly');
 await capture('03-neutral',{materialDebug:1,grayscaleProof:true});
 await capture('04-raking-light',{materialDebug:1,grayscaleProof:false,lightElevation:.20,lightAzimuth:3.6});
 await capture('05-silhouette',{materialDebug:7});
 await page.evaluate(()=>{lichenStudy.setWet(1);lichenStudy.stepWeather(4);});
 const wet=await capture('06-wet-pigment',{materialDebug:0,lightElevation:.48,lightAzimuth:2.3});assert.notEqual(dry,wet,'Hydration must visibly change tissue');
 await capture('07-hydration',{materialDebug:5});
 await page.evaluate(()=>lichenStudy.loadSpecimen());
 await capture('08-legacy-comparison',{realismEnabled:false,materialDebug:0});
 await capture('09-albedo',{realismEnabled:true,materialDebug:2});
 await capture('10-normals',{materialDebug:3});
 await capture('11-roughness',{materialDebug:4});
 await capture('12-specular',{materialDebug:6});
 // Capture/restore must recover the exact same composed frame, including module phases.
 await page.evaluate(()=>{window.studySnapshot=lichenStudy.capture();lichenStudy.setWet(.95);lichenStudy.stepWeather(2);lichenStudy.restore(window.studySnapshot);});
 const restored=await capture('13-restored',{materialDebug:0});assert.equal(restored,dry,'Snapshot restore must recover the original frozen frame');
 assert.deepEqual(errors,[],'Shader compile/link and runtime errors');
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log('Rendered study passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
