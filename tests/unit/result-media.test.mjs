import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('../../features/compositions/lib/result-media.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function setup({ width = 2, height = 1, patches = [], abortOnBitmap, encode = true } = {}) {
  const bitmaps = [], revoked = [], samples = [];
  let canceled = false;
  class Canvas {
    width = 0; height = 0; pixels = [];
    reset() { if (this.pixels.length !== this.width * this.height) this.pixels = Array(this.width * this.height).fill(0); }
    getContext() {
      return {
        clearRect: (x, y, w, h) => { this.reset(); for (let row=y;row<y+h;row++) for(let col=x;col<x+w;col++) this.pixels[row*this.width+col]=0; },
        getImageData: () => { this.reset(); return { pixels: [...this.pixels] }; },
        putImageData: (data) => { this.pixels = data.pixels ? [...data.pixels] : Array.from(data.data).filter((_,i)=>i%4===0); },
        drawImage: (image,x,y) => { this.reset(); for(let row=0;row<image.height;row++) for(let col=0;col<image.width;col++) { const pixel=image.pixels[row*image.width+col]; if(pixel) this.pixels[(y+row)*this.width+x+col]=pixel; } },
        fillRect() {},
      };
    }
    toBlob(done) { this.reset(); done(new Blob([JSON.stringify(this.pixels)],{type:'image/png'})); }
  }
  const parsed = { lsd: { width, height }, gct: [], frames: patches.map(patch => ({ image: { descriptor: patch.dims }, patch })) };
  class Output {
    state='pending'; target;
    constructor({target}) { this.target=target; }
    addVideoTrack() {}
    async start() { this.state='started'; }
    async finalize() { this.state='finalized'; this.target.buffer=new ArrayBuffer(8); }
    async cancel() { canceled=true;this.state='canceled'; }
  }
  const sandbox = {
    exports:{}, Blob, File, TextDecoder, Uint8ClampedArray,
    ImageData: class { constructor(data,width,height){this.data=data;this.width=width;this.height=height} },
    document:{createElement:()=>new Canvas()},
    URL:{createObjectURL:()=>`blob:frame-${bitmaps.length}`,revokeObjectURL:url=>revoked.push(url)},
    createImageBitmap:async image=>{
      const pixels=image instanceof Blob ? JSON.parse(await image.text()) : [...image.pixels];
      const bitmap={pixels,width:width,height:height,closed:false,close(){this.closed=true}};
      bitmaps.push(bitmap);abortOnBitmap?.();return bitmap;
    },
    require(name){
      if(name==='gifuct-js')return {parseGIF:()=>parsed,decompressFrame:frame=>frame.patch};
      if(name==='mediabunny')return {
        Output, Mp4OutputFormat:class{},BufferTarget:class{},Quality:class{},canEncodeVideo:async()=>encode,
        CanvasSource:class {async add(time,duration){samples.push({time,duration})}},
      };
      throw new Error(name);
    },
  };
  runInNewContext(code,sandbox);
  return {...sandbox.exports, bitmaps, revoked, samples, get canceled(){return canceled}};
}
const patch=(pixels,left=0,disposalType=1,delay=100)=>({dims:{width:pixels.length,height:1,left,top:0},patch:new Uint8ClampedArray(pixels.flatMap(p=>[p,0,0,p?255:0])),disposalType,delay});
const input=()=>new Blob(['GIF89a']);

test('frame extraction preserves offsets, transparency, disposal 2/3, and per-frame delays',async()=>{
  const media=setup({patches:[patch([1,1]),patch([2],0,2,40),patch([3],1,3,150),patch([4],0,1,80)]});
  const result=await media.decodeResult(input(),new AbortController().signal);
  const pixels=await Promise.all(result.frames.map(async f=>JSON.parse(await f.png.text())));
  assert.deepEqual(pixels,[[1,1],[2,1],[0,3],[4,1]]);
  assert.deepEqual(Array.from(result.frames,f=>f.delay),[100,40,150,80]);
  media.releaseResult(result);
  assert.equal(media.bitmaps.every(b=>b.closed),true);assert.equal(media.revoked.length,4);
});

test('canceling extraction releases already allocated bitmaps and object URLs',async()=>{
  const controller=new AbortController();
  const media=setup({patches:[patch([1,1]),patch([2,2])],abortOnBitmap:()=>controller.abort()});
  await assert.rejects(media.decodeResult(input(),controller.signal),{name:'AbortError'});
  assert.equal(media.bitmaps.length,1);assert.equal(media.bitmaps[0].closed,true);assert.equal(media.revoked.length,1);
});

test('invalid signatures and excessive pixel allocations are rejected before frame decompression',async()=>{
  const media=setup({width:4096,height:4096,patches:Array.from({length:20},()=>patch([1]))});
  await assert.rejects(media.decodeResult(new Blob(['notGIF']),new AbortController().signal),/GIF/);
  await assert.rejects(media.decodeResult(input(),new AbortController().signal),/너무 커요/);
  assert.equal(media.bitmaps.length,0);
});

test('MP4 encodes full-resolution PNG frames in original order and variable durations',async()=>{
  const media=setup();
  const frames=[40,150,80].map((delay,i)=>({png:new Blob([JSON.stringify([i+1,i+1])]),delay}));
  const file=await media.encodeResultMp4({width:2,height:1,frames},()=>{},new AbortController().signal);
  assert.equal(file.type,'video/mp4');assert.equal(file.name,'gifgloo-result.mp4');
  assert.deepEqual(media.samples,[{time:0,duration:.04},{time:.04,duration:.15},{time:.19,duration:.08}]);
  assert.equal(media.bitmaps.every(b=>b.closed),true);
});

test('unsupported H264 encoding fails without attempting to encode',async()=>{
  const media=setup({encode:false});
  await assert.rejects(media.encodeResultMp4({width:2,height:1,frames:[]},()=>{},new AbortController().signal),/지원하지 않아요/);
  assert.equal(media.samples.length,0);
});

test('canceling MP4 closes the active bitmap and cancels the output',async()=>{
  const controller=new AbortController();
  const media=setup({abortOnBitmap:()=>controller.abort()});
  await assert.rejects(media.encodeResultMp4({width:2,height:1,frames:[{png:new Blob(['[1,1]']),delay:100}]},()=>{},controller.signal),{name:'AbortError'});
  assert.equal(media.canceled,true);assert.equal(media.bitmaps[0].closed,true);assert.equal(media.samples.length,0);
});
