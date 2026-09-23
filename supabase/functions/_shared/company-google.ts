// Company-owned Drive access uses a dedicated service account shared only with the
// configured company root folder. Its credential never reaches the browser.
const base64url = (text: string) => btoa(text).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const fromPem = (pem: string) => Uint8Array.from(atob(pem.replace(/-----(BEGIN|END) PRIVATE KEY-----|\s/g, '')), (char) => char.charCodeAt(0));

export async function companyGoogleAccessToken() {
  const raw = Deno.env.get('GOOGLE_COMPANY_SERVICE_ACCOUNT_JSON');
  if (!raw) throw new Error('company_google_service_account_not_configured');
  const account = JSON.parse(raw) as { client_email?: string; private_key?: string };
  if (!account.client_email || !account.private_key) throw new Error('invalid_company_google_service_account');
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const signingInput = `${header}.${claim}`;
  const key = await crypto.subtle.importKey('pkcs8', fromPem(account.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput)));
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${signingInput}.${base64url(String.fromCharCode(...signature))}` }) });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new Error(`company_google_token_${response.status}`);
  return String(payload.access_token);
}
