// @ts-ignore: Deno URL import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Area = 'business' | 'personal';
type Upload = { name: string; type: string; base64: string };
const bucket = 'mylekhpal-documents';
const cleanName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'document';

export async function persistManagedDocument(
  admin: ReturnType<typeof createClient>, area: Area, workspaceId: string, file: Upload, hash: string,
) {
  const subscriptionTable = area === 'business' ? 'business_subscriptions' : 'personal_subscriptions';
  const idColumn = area === 'business' ? 'business_id' : 'household_id';
  const { data: subscription } = await admin.from(subscriptionTable).select('plan_code,status').eq(idColumn, workspaceId).maybeSingle();
  if (!subscription?.plan_code || !['trial', 'active'].includes(subscription.status)) throw new Error('Choose an active plan before storing documents.');
  const { data: allowance } = await admin.from('storage_plan_allowances').select('included_bytes,max_file_bytes').eq('plan_code', subscription.plan_code).eq('service_area', area).maybeSingle();
  if (!allowance) throw new Error('Storage is not configured for the selected plan.');
  const bytes = Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0));
  if (bytes.byteLength > Number(allowance.max_file_bytes)) throw new Error('This file exceeds the storage limit for your plan.');
  const prefix = `${area}/${workspaceId}`;
  const { data: objects, error: usageError } = await admin.schema('storage').from('objects').select('metadata').eq('bucket_id', bucket).like('name', `${prefix}/%`);
  if (usageError) throw new Error('Unable to check your storage allowance.');
  const usedBytes = (objects || []).reduce((total: number, object: { metadata?: { size?: number | string } }) => total + Number(object.metadata?.size || 0), 0);
  if (usedBytes + bytes.byteLength > Number(allowance.included_bytes)) throw new Error('Your included storage allowance is full. Delete unneeded documents or contact support.');
  const path = `${prefix}/${new Date().toISOString().slice(0, 7)}/${hash}-${cleanName(file.name)}`;
  const { error } = await admin.storage.from(bucket).upload(path, bytes, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (error && !/already exists/i.test(error.message)) throw new Error('Unable to store the uploaded document.');
  return { path, size: bytes.byteLength, retentionStatus: 'active' };
}
