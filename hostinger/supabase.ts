import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

async function edgeFunctionError(error: unknown, fallback: string) {
  const response = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context;
  if (response?.json) {
    const body = await response.json().catch(() => null) as { error?: unknown; message?: unknown } | null;
    const message = typeof body?.error === 'string' ? body.error : typeof body?.message === 'string' ? body.message : null;
    if (message) return new Error(message);
  }
  return new Error(fallback);
}

export async function booksRequest(url: string, body?: unknown) {
  const business = new URL(url, window.location.origin).searchParams.get('business');
  const { data, error } = await supabase.rpc('mylekhpal_books', {
    payload: body || (business ? { action: 'read', business } : { action: 'list' }),
  });
  if (error) {
    if (error.code === 'PGRST202') throw new Error('Workspace setup is pending. Please contact support.');
    throw new Error(error.message || 'Unable to access your books. Please retry.');
  }
  return data;
}

export async function prepareJournalDraft(payload: unknown) {
  const { data, error } = await supabase.functions.invoke('prepare-journal-draft', {
    body: payload,
  });
  if (error) throw await edgeFunctionError(error, 'Journal draft preparation is unavailable.');
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function personalFinanceRequest(payload: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Your sign-in session has expired. Please sign in again.');
  const body = typeof payload === 'object' && payload !== null ? { ...payload as Record<string, unknown>, accessToken: session.access_token } : payload;
  const { data, error } = await supabase.functions.invoke('prepare-personal-finance-draft', { body, headers: { Authorization: `Bearer ${session.access_token}` } });
  if (error) throw await edgeFunctionError(error, 'Personal Finance & Tax Support is unavailable.');
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function startPersonalSubscription(householdId: string, planCode: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Your sign-in session has expired. Please sign in again.');
  const { data, error } = await supabase.functions.invoke('create-razorpay-personal-subscription', { body: { householdId, planCode, accessToken: session.access_token }, headers: { Authorization: `Bearer ${session.access_token}` } });
  if (error) throw await edgeFunctionError(error, 'Unable to start secure payment authorisation.');
  if (data?.error || !data?.shortUrl) throw new Error(data?.error || 'Unable to start secure payment authorisation.');
  window.location.assign(data.shortUrl);
}

export async function startBusinessSubscription(businessId: string, planCode: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Your sign-in session has expired. Please sign in again.');
  const { data, error } = await supabase.functions.invoke('create-razorpay-business-subscription', { body: { businessId, planCode, accessToken: session.access_token }, headers: { Authorization: `Bearer ${session.access_token}` } });
  if (error) throw await edgeFunctionError(error, 'Unable to start secure payment authorisation.');
  if (data?.error || !data?.shortUrl) throw new Error(data?.error || 'Unable to start secure payment authorisation.');
  window.location.assign(data.shortUrl);
}

export async function googleDriveRequest(
  action: 'google-drive-connect' | 'google-drive-status',
  serviceArea: 'business' | 'personal',
  workspaceId: string,
) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Your sign-in session has expired. Please sign in again.');
  const { data, error } = await supabase.functions.invoke(action, {
    body: { serviceArea, workspaceId, accessToken: session.access_token },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) throw await edgeFunctionError(error, 'Google Drive connection is unavailable.');
  if (data?.error) throw new Error(data.error);
  return data;
}
