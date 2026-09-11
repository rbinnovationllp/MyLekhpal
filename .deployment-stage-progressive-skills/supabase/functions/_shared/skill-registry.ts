import { GENERATED_SKILLS } from './generated-skill-registry.ts';
import type { SkillRepository } from './progressive-skill-agent.ts';

type GeneratedSkill = typeof GENERATED_SKILLS[number];

export function detectedSkills() {
  return GENERATED_SKILLS.map(({ name, description, skillPath }) => ({ name, description, skillPath }));
}

export function repositoryFor(name: string): SkillRepository {
  const skill = (GENERATED_SKILLS as readonly GeneratedSkill[]).find((item) => item.name === name);
  if (!skill) throw new Error(`Approved skill not found: ${name}`);
  return {
    name: skill.name,
    description: skill.description,
    skillPath: skill.skillPath,
    loadSkill: async () => skill.skill,
    references: Object.fromEntries(Object.entries(skill.references).map(([path, content]) => [path, async () => content])),
    resources: Object.fromEntries(Object.entries(skill.resources).map(([path, resource]) => [path, { kind: resource.kind as 'script' | 'template' | 'example', available: resource.available, note: 'Approved package resource; execution is limited to an isolated worker.' }])),
  };
}
