import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../../shared/lib/share.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function load(clipboard, ClipboardItem){const sandbox={exports:{},navigator:{clipboard},ClipboardItem,Blob};runInNewContext(code,sandbox);return sandbox.exports.copyShareUrl}

test('clipboard writing starts during the click, before share-link creation resolves',async()=>{
  let resolveLink, item, writes=0;
  const link=new Promise(resolve=>{resolveLink=resolve});
  const copy=load({write:async items=>{writes++;item=items[0];await item.data['text/plain']}},class {constructor(data){this.data=data}});
  const pending=copy(link);
  assert.equal(writes,1);
  resolveLink('https://example.test/result/token');await pending;
  assert.equal(await (await item.data['text/plain']).text(),'https://example.test/result/token');
});

test('share API failure rejects without writing a bogus URL',async()=>{
  const copy=load({write:async items=>{await items[0].data['text/plain']}},class {constructor(data){this.data=data}});
  await assert.rejects(copy(Promise.reject(new Error('share failed'))),/share failed/);
});

test('text-only clipboard fallback uses the resolved public link',async()=>{
  let copied;
  const copy=load({writeText:async text=>{copied=text}});
  await copy(Promise.resolve('https://example.test/result/token'));assert.equal(copied,'https://example.test/result/token');
});

test('clipboard item construction failure still handles a rejected share request',async()=>{
  const copy=load({write:async()=>{}},class {constructor(){throw new Error('unsupported')}});
  await assert.rejects(copy(Promise.reject(new Error('share failed'))));
});
