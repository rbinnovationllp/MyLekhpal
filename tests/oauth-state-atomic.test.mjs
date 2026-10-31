import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('callback consumes OAuth state atomically before exchanging a Google code', async () => {
  const source = await read('supabase/functions/google-drive-callback/index.ts');
  assert.match(source, /admin\.rpc\('google_oauth_consume_state', \{ p_state_hash: stateHash \}\)/);
  assert.doesNotMatch(source, /google_oauth_lookup_state/);
  assert.doesNotMatch(source, /google_oauth_delete_state/);
  assert.match(source, /const stateHash = await sha256\(state\);[\s\S]*google_oauth_consume_state[\s\S]*token_exchange/);
});

test('consume helper deletes exactly one unexpired state and remains service-role-only', async () => {
  const source = await read('supabase/migrations/202609130007_google_oauth_private_rpc.sql');
  const hardening = await read('supabase/migrations/202610300003_google_oauth_rpc_hardening.sql');
  assert.match(source, /delete from private\.workspace_google_oauth_states[\s\S]*where state_hash = p_state_hash and expires_at > now\(\)[\s\S]*returning/);
  assert.match(hardening, /grant execute on function public\.google_oauth_consume_state\(text\) to service_role;/);
  assert.match(hardening, /revoke all on function public\.google_oauth_consume_state\(text\) from public, anon, authenticated;/);
});
