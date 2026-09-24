// Controlled progressive-disclosure runner for MyLekhapal skills.
// It deliberately exposes no filesystem or shell tool to the model.
export type SkillRepository = {
  name: string;
  description: string;
  skillPath: string;
  loadSkill: () => Promise<string>;
  references: Record<string, () => Promise<string>>;
  resources?: Record<string, { kind: 'script' | 'template' | 'example'; available: boolean; note: string }>;
};

type AnthropicBlock = { type: string; id?: string; name?: string; input?: Record<string, unknown> };
type AnthropicResponse = { content?: AnthropicBlock[]; model?: string; usage?: { input_tokens?: number; output_tokens?: number } };

const MAX_AGENT_STEPS = 7;
const encoder = new TextEncoder();
const asToolResult = (toolUseId: string, value: unknown) => ({ type: 'tool_result', tool_use_id: toolUseId, content: JSON.stringify(value) });

export function skillIndex(repository: SkillRepository) {
  return `Available skills:\n\n${repository.name}\nDescription: ${repository.description}\nPath: ${repository.skillPath}`;
}

export async function runProgressiveSkillAgent(args: {
  repository: SkillRepository;
  model: string;
  apiKey: string;
  userContent: unknown[];
  runtimeContext: string;
  finalToolName: string;
  finalToolDescription: string;
  finalToolSchema: Record<string, unknown>;
  maxTokens: number;
}): Promise<{ draft: any; requestId: string; model?: string; inputTokens: number; outputTokens: number; toolCalls: string[]; referencesLoaded: string[]; skillLoaded: boolean }> {
  const { repository } = args;
  const referencesLoaded: string[] = [];
  const toolCalls: string[] = [];
  let skillLoaded = false;
  let inputTokens = 0;
  let outputTokens = 0;
  const messages: Array<Record<string, unknown>> = [{ role: 'user', content: args.userContent }];
  const system = `${skillIndex(repository)}\n\nYou are a skill-aware agent. The selected workflow is ${repository.name}. First call load_skill with the exact approved path. After that, follow the full loaded skill verbatim. Load references only when the skill or task requires them. You must return the requested reviewable draft using ${args.finalToolName}; do not perform irreversible actions. ${args.runtimeContext}`;
  const tools = [
    { name: 'load_skill', description: 'Load the complete approved SKILL.md without summarising it.', input_schema: { type: 'object', additionalProperties: false, properties: { skillPath: { type: 'string' } }, required: ['skillPath'] } },
    { name: 'list_references', description: 'List only supporting resources belonging to the loaded skill.', input_schema: { type: 'object', additionalProperties: false, properties: { skillPath: { type: 'string' } }, required: ['skillPath'] } },
    { name: 'read_reference', description: 'Read one supporting resource belonging to the loaded skill.', input_schema: { type: 'object', additionalProperties: false, properties: { referencePath: { type: 'string' } }, required: ['referencePath'] } },
    { name: 'list_skill_resources', description: 'List approved scripts, templates and examples. This never grants shell or filesystem access.', input_schema: { type: 'object', additionalProperties: false, properties: {}, required: [] } },
    { name: args.finalToolName, description: args.finalToolDescription, input_schema: args.finalToolSchema },
  ];

  for (let step = 0; step < MAX_AGENT_STEPS; step++) {
    const body: Record<string, unknown> = { model: args.model, max_tokens: args.maxTokens, system, messages, tools };
    if (step === 0) body.tool_choice = { type: 'tool', name: 'load_skill' };
    const api = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': args.apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body),
    });
    const requestId = api.headers.get('request-id') || crypto.randomUUID();
    const result = await api.json() as AnthropicResponse & { error?: unknown };
    if (!api.ok) throw new Error(`provider_${api.status}:${requestId}`);
    inputTokens += Number(result.usage?.input_tokens || 0);
    outputTokens += Number(result.usage?.output_tokens || 0);
    const blocks = result.content || [];
    const final = blocks.find((block) => block.type === 'tool_use' && block.name === args.finalToolName);
    if (final?.input) {
      if (!skillLoaded) throw new Error('skill_not_loaded_before_draft');
      toolCalls.push(args.finalToolName);
      return { draft: final.input, requestId, model: result.model, inputTokens, outputTokens, toolCalls, referencesLoaded, skillLoaded };
    }
    const toolUses = blocks.filter((block) => block.type === 'tool_use' && block.id && block.name);
    if (!toolUses.length) throw new Error('agent_did_not_return_a_tool_result');
    messages.push({ role: 'assistant', content: blocks });
    const results = [];
    for (const tool of toolUses) {
      toolCalls.push(tool.name!);
      const input = tool.input || {};
      if (tool.name === 'load_skill') {
        if (input.skillPath !== repository.skillPath) results.push(asToolResult(tool.id!, { error: 'Only the selected approved skill path may be loaded.' }));
        else {
          const content = await repository.loadSkill();
          skillLoaded = true;
          results.push(asToolResult(tool.id!, { skillPath: repository.skillPath, content, bytes: encoder.encode(content).byteLength }));
        }
      } else if (tool.name === 'list_references') {
        results.push(asToolResult(tool.id!, input.skillPath === repository.skillPath ? { references: Object.keys(repository.references) } : { error: 'Skill path rejected.' }));
      } else if (tool.name === 'read_reference') {
        const path = String(input.referencePath || '');
        const reader = skillLoaded ? repository.references[path] : undefined;
        if (!reader) results.push(asToolResult(tool.id!, { error: 'Reference path rejected or the skill has not been loaded.' }));
        else { referencesLoaded.push(path); results.push(asToolResult(tool.id!, { referencePath: path, content: await reader() })); }
      } else if (tool.name === 'list_skill_resources') {
        results.push(asToolResult(tool.id!, { resources: repository.resources || {} }));
      } else {
        results.push(asToolResult(tool.id!, { error: 'Unsupported tool.' }));
      }
    }
    messages.push({ role: 'user', content: results });
  }
  throw new Error('agent_step_limit_reached');
}

// Bulk spreadsheet imports already have a selected skill and a narrow, fixed
// output schema.  Supplying the complete approved skill in the first request
// avoids a separate load_skill round-trip for every small batch.  This is not a
// reduced prompt: the entire SKILL.md is included verbatim.  It prevents a
// large workbook from exhausting the Edge Function request window merely while
// repeating the same skill-loading ceremony dozens of times.
export async function runLoadedSkillOnce(args: {
  repository: SkillRepository;
  model: string;
  apiKey: string;
  userContent: unknown[];
  runtimeContext: string;
  finalToolName: string;
  finalToolDescription: string;
  finalToolSchema: Record<string, unknown>;
  maxTokens: number;
}): Promise<{ draft: any; requestId: string; model?: string; inputTokens: number; outputTokens: number; toolCalls: string[]; referencesLoaded: string[]; skillLoaded: boolean }> {
  const skill = await args.repository.loadSkill();
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': args.apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: args.model,
      max_tokens: args.maxTokens,
      system: `You are using the selected approved skill at ${args.repository.skillPath}. Follow the complete skill below verbatim. Return only the requested reviewable draft via the required tool; do not perform irreversible actions.\n\n--- BEGIN APPROVED SKILL ---\n${skill}\n--- END APPROVED SKILL ---\n\n${args.runtimeContext}`,
      messages: [{ role: 'user', content: args.userContent }],
      tools: [{ name: args.finalToolName, description: args.finalToolDescription, input_schema: args.finalToolSchema }],
      tool_choice: { type: 'tool', name: args.finalToolName },
    }),
  });
  const requestId = response.headers.get('request-id') || crypto.randomUUID();
  const result = await response.json() as AnthropicResponse & { error?: unknown };
  if (!response.ok) throw new Error(`provider_${response.status}:${requestId}`);
  const final = (result.content || []).find((block) => block.type === 'tool_use' && block.name === args.finalToolName);
  if (!final?.input) throw new Error('agent_did_not_return_a_tool_result');
  return { draft: final.input, requestId, model: result.model, inputTokens: Number(result.usage?.input_tokens || 0), outputTokens: Number(result.usage?.output_tokens || 0), toolCalls: [args.finalToolName], referencesLoaded: [], skillLoaded: true };
}
