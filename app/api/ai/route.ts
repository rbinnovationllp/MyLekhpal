import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';

export const dynamic = 'force-dynamic';

const respond = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });

/**
 * Deliberately disabled by default. Provider secrets are server-only runtime
 * variables and must never be read by the browser or placed in source control.
 */
export async function POST(req: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: 'Sign in to continue.' }, 401);
  if (req.headers.get('Origin') !== new URL(req.url).origin) {
    return respond({ error: 'Request origin rejected.' }, 403);
  }

  const runtime = env as unknown as Record<string, string | undefined>;
  if (runtime.AI_PROCESSING_ENABLED !== 'true') {
    return respond(
      {
        error:
          'AI processing is not enabled. No document or accounting data has been sent to an AI provider.',
      },
      503,
    );
  }
  if (!runtime.MYLEKHAPAL_ANTHROPIC_API_KEY) {
    return respond({ error: 'AI processing is unavailable.' }, 503);
  }

  // A provider integration, rate limits, and an approved data-minimisation
  // contract must be added before this endpoint can process requests.
  return respond({ error: 'AI processing setup is incomplete.' }, 503);
}
