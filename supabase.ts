import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

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
  if (error) throw new Error(error.message || 'Journal draft preparation is unavailable.');
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function startGoogleDriveConnection(businessId: string) {
  const { data, error } = await supabase.functions.invoke('google-drive-start', { body: { businessId } });
  if (error || !data?.authorizationUrl) throw new Error('Unable to start the secure Google Drive connection.');
  window.location.assign(data.authorizationUrl);
}
