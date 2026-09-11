import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const skillsRoot = join(root, 'skills');
const output = join(root, 'supabase', 'functions', '_shared', 'generated-skill-registry.ts');

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]));
  return nested.flat();
}

function frontMatter(markdown, key) {
  const header = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const value = header?.[1].match(new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, 'm'))?.[1];
  return value?.replace(/^['"]|['"]$/g, '') || '';
}

const folders = (await readdir(skillsRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
const skills = [];
for (const folder of folders) {
  const folderPath = join(skillsRoot, folder);
  const all = await files(folderPath);
  const skillFile = all.find((file) => file.endsWith(`${sep}SKILL.md`));
  if (!skillFile) throw new Error(`No SKILL.md found in ${folder}`);
  const skill = await readFile(skillFile, 'utf8');
  const base = `/skills/${folder}`;
  const references = {};
  const resources = {};
  for (const file of all) {
    const rel = relative(folderPath, file).split(sep).join('/');
    if (rel === 'SKILL.md' || rel === 'MANIFEST.json' || rel === 'PACKAGE-NOTES.md' || rel.startsWith('agents/')) continue;
    const path = `${base}/${rel}`;
    const content = await readFile(file, 'utf8');
    if (rel.startsWith('references/')) references[path] = content;
    else resources[path] = { kind: rel.startsWith('scripts/') ? 'script' : rel.startsWith('templates/') ? 'template' : 'example', available: true, content };
  }
  skills.push({ folder, name: frontMatter(skill, 'name') || folder, description: frontMatter(skill, 'description'), skillPath: `${base}/SKILL.md`, skill, references, resources });
}
const banner = '// Generated from /skills by scripts/generate-skill-registry.mjs. Do not hand-edit.\n';
await writeFile(output, `${banner}export const GENERATED_SKILLS = ${JSON.stringify(skills, null, 2)} as const;\n`, 'utf8');
console.log(`Generated registry for ${skills.length} skill package(s).`);
