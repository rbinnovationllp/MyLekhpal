export type PublicVisitRpcClient = {
  rpc: (
    name: string,
    args: { visitor_hash_input: string; suspected_bot_input: boolean },
  ) => Promise<{ error: { code?: string | null } | null }>;
};

export const recordPublicVisit = async (
  client: PublicVisitRpcClient,
  visitorHash: string,
  suspectedBot: boolean,
): Promise<boolean> => {
  const { error } = await client.rpc('record_public_visit', {
    visitor_hash_input: visitorHash,
    suspected_bot_input: suspectedBot,
  });

  if (error) {
    // Do not log a visitor identifier, hash, path, headers, or credentials.
    console.error('public_visit_persistence_failed', {
      operation: 'record_public_visit',
      code: error.code ?? 'unknown',
    });
    return false;
  }

  return true;
};
