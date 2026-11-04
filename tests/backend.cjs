const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = process.env.SITE_ROOT || require('node:path').resolve(__dirname, '..');
const source = fs.readFileSync(root + '/google-apps-script/Code.gs','utf8');
const store = {}, sent = [];
let failMail = false, quota = 100;
const context = vm.createContext({
  Utilities: {
    base64Decode: text => [...Buffer.from(text,'base64')],
    formatDate: () => '2026-11-04',
    newBlob: (bytes,mime,name) => ({bytes,mime,name})
  },
  LockService: { getScriptLock: () => ({tryLock:()=>true,releaseLock:()=>{}}) },
  PropertiesService: {getScriptProperties:()=>({getProperties:()=>({...store}),getProperty:k=>store[k],deleteProperty:k=>delete store[k],setProperties:p=>Object.assign(store,p)})},
  MailApp: {getRemainingDailyQuota:()=>quota,sendEmail:mail=>{if(failMail) throw Error('mail failed'); sent.push(mail);}},
  HtmlService: {XFrameOptionsMode:{ALLOWALL:1},createHtmlOutput:html=>({html,setXFrameOptionsMode(){return this;}})}
});
vm.runInContext(source,context);
let seq=0;
function payload(changes={}) {return {requestId:'12345678-1234-1234-1234-'+String(++seq).padStart(12,'0'),origin:'https://stoptime.lv',firstName:'Tests',lastName:'Pieteikums',phone:'+371 20000000',consent:true,elapsed:4000,website:'',fileName:'aizpildits.docx',fileBase64:fs.readFileSync(root+'/assets/documents/iesniegums-2026-2027.docx').toString('base64'),...changes};}
function post(p){ const html=context.doPost({parameter:{payload:JSON.stringify(p)}}).html; return JSON.parse(html.match(/postMessage\((.*),"https?:/)[1]); }
const p=payload();
assert.equal(post(p).ok,true);
assert.equal(sent.length,1);
assert.equal(sent[0].to,'gribudejot_stoptime@inbox.lv');
assert.equal(sent[0].body,'Vārds: Tests\nUzvārds: Pieteikums');
assert(!JSON.stringify(sent[0]).includes('+371'));
assert.deepEqual(Buffer.from(sent[0].attachments[0].bytes),fs.readFileSync(root+'/assets/documents/iesniegums-2026-2027.docx'));
assert.equal(post(p).ok,true); assert.equal(sent.length,1,'Retry must not duplicate an accepted message');
for (const change of [{origin:'https://evil.example'},{firstName:' '},{lastName:'x\ny'},{phone:'abcdefg'},{consent:false},{website:'spam'},{elapsed:1},{fileName:'hack.exe'},{fileBase64:Buffer.from('not a word document').toString('base64')},{fileBase64:'a'.repeat(6990510)}]) assert.equal(post(payload(change)).ok,false,JSON.stringify(change).slice(0,120));
failMail=true;
const retry=payload(); assert.equal(post(retry).ok,false); assert(!store['sent:'+retry.requestId]);
failMail=false; assert.equal(post(retry).ok,true);
quota=0; assert.equal(post(payload()).ok,false); quota=100;
store.count='80'; assert.equal(post(payload()).ok,false);
assert.equal(context.doPost({parameter:{payload:'{bad json'}}).html.includes('"ok":false'),true);
console.log('PASS: attachment bytes, recipient, minimal email, retries, validation, provider errors, quota and daily cap. No real email sent.');
