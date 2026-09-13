import { useEffect, useState } from 'react';
import { supabase } from '../hostinger/supabase';

const number = (n: number) => new Intl.NumberFormat('en-IN').format(n || 0);
export default function AdminAnalytics() {
  const [data, setData] = useState<any>(null), [error, setError] = useState('Loading analytics…');
  useEffect(() => { void (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { setError('Sign in as a platform administrator to view analytics.'); return; }
    const { data: result, error: requestError } = await supabase.functions.invoke('admin-adoption-metrics', { headers: { Authorization: `Bearer ${session.access_token}` } });
    if (requestError || result?.error) { setError(result?.error || 'Analytics are unavailable.'); return; }
    setData(result); setError('');
  })(); }, []);
  if (!data) return <main className="wrap admin-analytics"><h1>Adoption analytics</h1><p>{error}</p></main>;
  const summary = data.summary || {};
  return <main className="wrap admin-analytics"><a href="/">← Home</a><h1>Adoption analytics</h1><p>Private administrator view. No personal or payment details are shown here.</p><section className="adoption-counter"><div><small>TOTAL VISITS</small><strong>{number(summary.total_visitors)}</strong></div><div><small>UNIQUE VISITORS</small><strong>{number(summary.unique_visitors)}</strong></div><div><small>REGISTERED USERS</small><strong>{number(summary.registered_users)}</strong></div><div><small>ACTIVE ADOPTERS</small><strong>{number(summary.active_adopters)}</strong></div></section><section className="panel"><h2>Daily visitor sessions — last 30 days</h2><table><thead><tr><th>Date</th><th>Sessions</th><th>Unique visitors</th></tr></thead><tbody>{(data.dailyVisitors || []).map((row: any) => <tr key={row.date}><td>{row.date}</td><td>{number(row.sessions)}</td><td>{number(row.uniqueVisitors)}</td></tr>)}</tbody></table><p>Captured live payments: {number(data.paymentEvidence?.capturedLivePayments)} · Refunded payments: {number(data.paymentEvidence?.refundedPayments)}</p></section></main>;
}
