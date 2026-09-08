import assert from 'node:assert/strict';
const base='http://localhost:3000';const headers={'Content-Type':'application/json',Origin:base,Cookie:'__sites_local_auth=1'};const stamp=Date.now();let checks=0;
async function call(method,path,body,expected,custom=headers){const r=await fetch(base+path,{method,headers:custom,body:body?JSON.stringify(body):undefined});const raw=await r.text();let data;try{data=JSON.parse(raw)}catch{data={error:raw}};assert.equal(r.status,expected,JSON.stringify(data));checks++;return data;}
await call('GET','/api/books',null,401,{});
await call('GET','/api/books',null,401,{'oai-authenticated-user-id':'forged','oai-authenticated-user-email':'forged@example.test'});
await call('POST','/api/books',{action:'createBusiness'},403,{...headers,Origin:'https://other.example'});
const input={action:'createBusiness',name:'Synthetic test '+stamp,year:2026,confirmAccounts:true};
await call('POST','/api/books',{...input,confirmAccounts:false},422);
const a=await call('POST','/api/books',input,201);
const b=await call('POST','/api/books',{...input,name:'Second synthetic test '+stamp},201);
assert.match(a.clientId,/^CL-[A-Z0-9]{10}$/);
assert.notEqual(a.clientId,b.clientId);
const ar=await call('GET','/api/books?business='+a.id,null,200);assert.equal(ar.accounts.length,8);assert.equal(ar.business.status,'Onboarding draft');
assert.equal(ar.business.client_id,a.clientId);assert.equal(ar.business.active_role,'Business owner');assert.equal(ar.memberships.length,1);assert.equal(ar.memberships[0].role,'Business owner');
const br=await call('GET','/api/books?business='+b.id,null,200);
const entry={action:'createEntry',business:a.id,date:'2026-09-08',reference:'TEST-'+stamp,narration:'Synthetic test only',confirmBusiness:true,lines:[{account:ar.accounts[0].id,debit:'118.01'},{account:ar.accounts[5].id,credit:'100.01'},{account:ar.accounts[6].id,credit:'18'}]};
await call('POST','/api/books',{...entry,lines:[{account:ar.accounts[0].id,debit:'118.01'},{account:ar.accounts[5].id,credit:'100'}]},422);
await call('POST','/api/books',{...entry,lines:[{account:br.accounts[0].id,debit:'100'},{account:ar.accounts[5].id,credit:'100'}]},422);
await call('POST','/api/books',{...entry,confirmBusiness:false},422);
await call('POST','/api/books',{...entry,date:'2027-04-01'},422);
await call('POST','/api/books',entry,201);
await call('POST','/api/books',entry,409);
const saved=await call('GET','/api/books?business='+a.id,null,200);assert.equal(saved.entries.length,1);assert.equal(saved.entries[0].total,11801);assert.equal(saved.entries[0].status,'Draft');assert.equal(saved.audit.length,2);
const separate=await call('GET','/api/books?business='+b.id,null,200);assert.equal(separate.entries.length,0);
await call('GET','/api/books?business=unavailable-business',null,404);
await call('POST','/api/books',{...entry,business:'unavailable-business'},404);
console.log(`${checks} HTTP checks passed: authentication, spoofed headers, origin, onboarding, persistence, compound draft, duplicate reference, date, active-client confirmation and account scoping.`);

