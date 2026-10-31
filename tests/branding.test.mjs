import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\//, '');
const customerFacingFiles = [
  'app/page.tsx',
  'app/layout.tsx',
  'app/workspace/workspace.tsx',
  'account.tsx',
  'hostinger/account.tsx',
  'hostinger/legal-page.tsx',
  'hostinger/main.tsx',
  'hostinger/personal-marketing.tsx',
  'index.html',
];

test('customer-facing sources use the official MyLekhpal spelling', async () => {
  for (const relativePath of customerFacingFiles) {
    const source = await readFile(join(root, relativePath), 'utf8');
    assert.doesNotMatch(source, /MyLekhapal|Mylekhpal/,
      `${relativePath} contains a customer-facing misspelling`);
  }
});
