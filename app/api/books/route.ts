import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { clean, validateLines, validDate } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const entryRoles = new Set([
  'Business owner',
  'Authorized representative',
  'Accounts staff',
  'Entry preparer',
]);

const respond = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });

async function activeBusiness(businessId: string, userId: string) {
  return env.DB.prepare(
    `SELECT b.*, COALESCE(m.role, 'Business owner') AS active_role
     FROM businesses b
     LEFT JOIN memberships m ON m.business_id = b.id AND m.user_id = ? AND m.status = 'active'
     WHERE b.id = ? AND (b.owner = ? OR m.id IS NOT NULL)`,
  )
    .bind(userId, businessId, userId)
    .first<Record<string, unknown>>();
}

export async function GET(req: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: 'Sign in to continue.' }, 401);

  const businessId = new URL(req.url).searchParams.get('business');
  if (!businessId) {
    const list = await env.DB.prepare(
      `SELECT DISTINCT b.*, COALESCE(m.role, 'Business owner') AS active_role
       FROM businesses b
       LEFT JOIN memberships m ON m.business_id = b.id AND m.user_id = ? AND m.status = 'active'
       WHERE b.owner = ? OR m.id IS NOT NULL
       ORDER BY b.created_at DESC`,
    )
      .bind(user.userId, user.userId)
      .all();
    return respond({ businesses: list.results });
  }

  const business = await activeBusiness(businessId, user.userId);
  if (!business) return respond({ error: 'Business unavailable.' }, 404);

  const [accounts, entries, audit, memberships] = await Promise.all([
    env.DB.prepare('SELECT * FROM accounts WHERE business_id = ? ORDER BY code')
      .bind(businessId)
      .all(),
    env.DB.prepare(
      'SELECT * FROM entries WHERE business_id = ? ORDER BY date DESC, created_at DESC LIMIT 500',
    )
      .bind(businessId)
      .all(),
    env.DB.prepare(
      'SELECT * FROM audit WHERE business_id = ? ORDER BY created_at DESC LIMIT 100',
    )
      .bind(businessId)
      .all(),
  ]);

  return respond({
    business,
    accounts: accounts.results,
    entries: entries.results,
    audit: audit.results,
  });
}

export async function POST(req: Request) {
  const user = await getChatGPTUser();
  if (!user) return respond({ error: 'Sign in to continue.' }, 401);
  if (req.headers.get('Origin') !== new URL(req.url).origin) {
    return respond({ error: 'Request origin rejected.' }, 403);
  }
  if (!req.headers.get('content-type')?.startsWith('application/json')) {
    return respond({ error: 'JSON required.' }, 415);
  }

  const raw = await req.text();
  if (raw.length > 32_000) return respond({ error: 'Request too large.' }, 413);

  let input: Record<string, unknown>;
  try {
    input = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return respond({ error: 'Invalid request.' }, 400);
  }

  const now = new Date().toISOString();

  try {
    if (input.action === 'createBusiness') {
      const name = clean(input.name, 160, true);
      const tradeName = clean(input.tradeName ?? '', 160);
      const entityType = clean(input.entityType ?? '', 80);
      const pan = clean(input.pan ?? '', 10).toUpperCase();
      const gstin = clean(input.gstin ?? '', 15).toUpperCase();
      const state = clean(input.state ?? '', 80);
      const address = clean(input.address ?? '', 500);
      const year = Number(input.year);

      if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan))
        throw new Error('PAN format is invalid.');
      if (
        gstin &&
        (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin) ||
          (pan && gstin.slice(2, 12) !== pan))
      ) {
        throw new Error('GSTIN format or PAN does not match.');
      }
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        throw new Error('Select a valid financial year.');
      }
      if (input.confirmAccounts !== true)
        throw new Error('Confirm the starter chart of accounts.');

      const count = await env.DB.prepare(
        'SELECT COUNT(*) AS n FROM businesses WHERE owner = ?',
      )
        .bind(user.userId)
        .first<{ n: number }>();
      if ((count?.n ?? 0) >= 10) {
        return respond(
          { error: 'Foundation preview allows up to 10 businesses.' },
          409,
        );
      }

      const businessId = `ML-${crypto.randomUUID()}`;
      const clientId = `CL-${crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
      const defaults = [
        ['1000', 'Cash', 'Asset'],
        ['1010', 'Bank', 'Asset'],
        ['1100', 'Customer receivables', 'Asset'],
        ['2000', 'Supplier payables', 'Liability'],
        ['3000', 'Owner capital', 'Equity'],
        ['4000', 'Sales', 'Income'],
        ['5000', 'Purchases', 'Expense'],
        ['5100', 'General expenses', 'Expense'],
      ];

      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO businesses
           (id, client_id, owner, name, trade_name, entity_type, pan, gstin, year, state, address, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          businessId,
          clientId,
          user.userId,
          name,
          tradeName,
          entityType,
          pan,
          gstin,
          year,
          state,
          address,
          'Onboarding draft',
          now,
        ),
        env.DB.prepare(
          'INSERT INTO memberships(id, business_id, user_id, role, status, created_at) VALUES(?, ?, ?, ?, ?, ?)',
        ).bind(
          crypto.randomUUID(),
          businessId,
          user.userId,
          'Business owner',
          'active',
          now,
        ),
        ...defaults.map(([code, accountName, type]) =>
          env.DB.prepare(
            'INSERT INTO accounts(id, business_id, code, name, type) VALUES(?, ?, ?, ?, ?)',
          ).bind(crypto.randomUUID(), businessId, code, accountName, type),
        ),
        env.DB.prepare(
          'INSERT INTO audit(id, business_id, actor, action, record_id, detail, created_at) VALUES(?, ?, ?, ?, ?, ?, ?)',
        ).bind(
          crypto.randomUUID(),
          businessId,
          user.userId,
          'Business created',
          businessId,
          JSON.stringify({
            name,
            clientId,
            starterAccounts: defaults.map((account) => account[1]),
          }),
          now,
        ),
      ]);
      return respond({ id: businessId, clientId }, 201);
    }

    const businessId = clean(input.business, 60, true);
    const business = await activeBusiness(businessId, user.userId);
    if (!business) return respond({ error: 'Business unavailable.' }, 404);

    if (input.action === 'createEntry') {
      if (!entryRoles.has(String(business.active_role))) {
        return respond(
          { error: 'Your assigned role cannot create journal drafts.' },
          403,
        );
      }
      if (input.confirmBusiness !== true)
        throw new Error('Confirm the active business before saving.');

      const narration = clean(input.narration, 1000, true);
      const reference = clean(input.reference, 100, true);
      const date = validDate(input.date, Number(business.year));
      const accounts = await env.DB.prepare(
        'SELECT id FROM accounts WHERE business_id = ?',
      )
        .bind(businessId)
        .all<{ id: string }>();
      const { lines, total } = validateLines(
        input.lines,
        new Set(accounts.results.map((account) => account.id)),
      );
      const duplicate = await env.DB.prepare(
        'SELECT id FROM entries WHERE business_id = ? AND reference = ?',
      )
        .bind(businessId, reference)
        .first();
      if (duplicate) {
        return respond(
          {
            error:
              'This reference already exists. Review the existing entry before continuing.',
          },
          409,
        );
      }

      const entryId = `JE-${crypto.randomUUID()}`;
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO entries
           (id, business_id, date, narration, reference, lines, total, status, source, actor, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          entryId,
          businessId,
          date,
          narration,
          reference,
          JSON.stringify(lines),
          total,
          'Draft',
          'Manual',
          user.userId,
          now,
        ),
        env.DB.prepare(
          'INSERT INTO audit(id, business_id, actor, action, record_id, detail, created_at) VALUES(?, ?, ?, ?, ?, ?, ?)',
        ).bind(
          crypto.randomUUID(),
          businessId,
          user.userId,
          'Draft created',
          entryId,
          JSON.stringify({
            date,
            narration,
            reference,
            lines,
            total,
            status: 'Draft',
          }),
          now,
        ),
      ]);
      return respond({ id: entryId, status: 'Draft' }, 201);
    }

    return respond({ error: 'Unsupported action.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/D1|SQLITE|constraint/i.test(message)) {
      return respond(
        {
          error:
            'Could not save. Check for a duplicate reference and try again.',
        },
        409,
      );
    }
    return respond({ error: message || 'Unable to save this request.' }, 422);
  }
}
