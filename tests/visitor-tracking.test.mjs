import assert from 'node:assert/strict';
import test from 'node:test';
import { recordPublicVisit } from '../supabase/functions/_shared/visitor-tracking.ts';

const visitorHash = 'a'.repeat(64);

test('records a visit only when the service-role RPC succeeds', async () => {
  const calls = [];
  const client = {
    async rpc(name, args) {
      calls.push({ name, args });
      return { error: null };
    },
  };

  assert.equal(await recordPublicVisit(client, visitorHash, false), true);
  assert.deepEqual(calls, [{
    name: 'record_public_visit',
    args: { visitor_hash_input: visitorHash, suspected_bot_input: false },
  }]);
});

test('does not report a recorded visit when the RPC returns an error', async () => {
  const client = {
    async rpc() {
      return { error: { code: '42501' } };
    },
  };

  assert.equal(await recordPublicVisit(client, visitorHash, true), false);
});
