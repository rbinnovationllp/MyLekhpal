import assert from 'node:assert/strict';
import test from 'node:test';
import {
  publicMetricsAllowedHeaders,
  publicMetricsAllowedMethods,
  publicMetricsCorsHeaders,
} from '../supabase/functions/_shared/public-metrics-cors.ts';

test('approved origin receives POST preflight policy with required Supabase headers', () => {
  const headers = publicMetricsCorsHeaders('https://mylekhpal.com');
  assert.equal(headers['access-control-allow-origin'], 'https://mylekhpal.com');
  assert.equal(headers['access-control-allow-methods'], 'POST, OPTIONS');
  for (const header of ['authorization', 'apikey', 'x-client-info', 'content-type']) {
    assert.match(headers['access-control-allow-headers'], new RegExp(`\\b${header}\\b`));
  }
  assert.equal(headers.vary, 'origin');
});

test('www and local development origins keep the same POST policy', () => {
  for (const origin of ['https://www.mylekhpal.com', 'http://localhost:5173']) {
    const headers = publicMetricsCorsHeaders(origin);
    assert.equal(headers['access-control-allow-origin'], origin);
    assert.equal(headers['access-control-allow-methods'], publicMetricsAllowedMethods);
    assert.equal(headers['access-control-allow-headers'], publicMetricsAllowedHeaders);
  }
});

test('rejected origins receive no CORS permission', () => {
  assert.deepEqual(publicMetricsCorsHeaders('https://attacker.example'), {});
  assert.deepEqual(publicMetricsCorsHeaders(null), {});
});
