import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (file) => readFile(resolve(root, file), 'utf8');

test('both service endpoints use the controlled progressive skill runner', async () => {
  for (const endpoint of ['prepare-journal-draft/index.ts', 'prepare-personal-finance-draft/index.ts']) {
    const source = await read(`supabase/functions/${endpoint}`);
    assert.match(source, /runProgressiveSkillAgent/);
    assert.match(source, /repositoryFor\(/);
  }
});

test('authoritative skill packages are dynamically discovered into the runtime registry', async () => {
  const generator = await read('scripts/generate-skill-registry.mjs');
  const registry = await read('supabase/functions/_shared/generated-skill-registry.ts');
  assert.match(generator, /skillsRoot/);
  assert.match(generator, /No SKILL\.md found/);
  assert.match(registry, /my-journal-entry-preparation/);
  assert.match(registry, /mylekhpal-personal-finance-tax-support/);
  assert.match(registry, /build_journal_entry\.py/);
});

test('agent forces complete skill loading before it accepts a draft', async () => {
  const source = await read('supabase/functions/_shared/progressive-skill-agent.ts');
  assert.match(source, /tool_choice = \{ type: 'tool', name: 'load_skill' \}/);
  assert.match(source, /if \(!skillLoaded\) throw new Error\('skill_not_loaded_before_draft'\)/);
  assert.match(source, /MAX_AGENT_STEPS = 7/);
  assert.doesNotMatch(source, /Deno\.Command|spawn\(|exec\(/);
});

test('observability migration records only metadata, not raw financial input', async () => {
  const source = await read('supabase/migrations/202609110009_progressive_skill_agent_observability.sql');
  assert.match(source, /skill_loaded boolean/);
  assert.match(source, /references_loaded jsonb/);
  assert.match(source, /tool_calls jsonb/);
  assert.doesNotMatch(source, /raw_input|document_content|api_key/i);
});
