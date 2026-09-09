import { readFileSync, readdirSync, statSync } from 'node:fs';
import { parseEnv } from 'node:util';
import assert from 'node:assert/strict';
const env=parseEnv(readFileSync('.env.local','utf8'));
const files=[];function walk(dir){for(const f of readdirSync(dir)){const path=dir+'/'+f; if(statSync(path).isDirectory())walk(path);else files.push(path);}}walk('dist');
assert(files.includes('dist/index.html'));assert(files.includes('dist/.htaccess'));assert(files.includes('dist/brand/mylekhpal-logo.png'));
const secrets=Object.entries(env).filter(([k,v])=>v && v.length>10 && !['SUPABASE_URL','SUPABASE_ANON_KEY','VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','MYLEKHAPAL_BASE_URL','EMAIL_FROM','GOOGLE_REDIRECT_URI','MYLEKHAPAL_ANTHROPIC_MODEL'].includes(k));
for(const file of files){assert(!/\.(?:ts|tsx|sql|env|map)$/.test(file));const bytes=readFileSync(file);for(const [name,value] of secrets){assert(!bytes.includes(Buffer.from(value)),`Secret ${name} found in ${file}`);}}
console.log(`${files.length} deployment files checked: index, routing, logo and no private environment values.`);
const response=await fetch(env.SUPABASE_URL+'/rest/v1/rpc/mylekhpal_books',{method:'POST',headers:{apikey:env.SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({payload:{action:'list'}})});
assert.equal(response.status,401);console.log('Supabase HTTP endpoint denies anonymous access (401).');

