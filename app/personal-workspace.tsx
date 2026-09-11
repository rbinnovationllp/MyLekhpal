'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, FileText, Upload } from 'lucide-react';
import { personalFinanceRequest, startPersonalSubscription, supabase } from '../hostinger/supabase';

const modes = [
  ['statement_analysis', 'Analyse a bank statement'], ['household_budget', 'Build a household budget'], ['liability_planning', 'Plan loans and EMIs'],
  ['goal_planning', 'Plan future goals'], ['retirement_planning', 'Explore retirement scenarios'], ['tax_intake', 'Prepare tax-service intake'], ['department_notice', 'Summarise a departmental notice'],
] as const;
const plans = [
  ['personal_basic_monthly', 'Personal Basic — ₹117/month (GST included)'], ['personal_basic_yearly', 'Personal Basic — ₹1,179/year (GST included)'],
  ['personal_plus_monthly', 'Personal Plus — ₹235/month (GST included)'], ['personal_plus_yearly', 'Personal Plus — ₹2,359/year (GST included)'],
  ['professional_monthly', 'Professional — ₹471/month (GST included)'], ['professional_yearly', 'Professional — ₹4,719/year (GST included)'],
  ['premium_monthly', 'Premium — ₹825/month (GST included)'], ['premium_yearly', 'Premium — ₹8,259/year (GST included)'],
] as const;

export default function PersonalWorkspace() {
  const [households, setHouseholds] = useState<any[]>([]), [householdId, setHouseholdId] = useState(''), [name, setName] = useState(''), [planCode, setPlanCode] = useState('personal_plus_monthly');
  const [mode, setMode] = useState<(typeof modes)[number][0]>('statement_analysis'), [purposeConfirmed, setPurposeConfirmed] = useState(false), [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [result, setResult] = useState<any>(null);
  const uploadRef = useRef<HTMLInputElement>(null), cameraRef = useRef<HTMLInputElement>(null);
  async function load() {
    const { data, error: queryError } = await supabase.from('households').select('id,display_name,preferred_language,created_at').order('created_at', { ascending: false });
    if (queryError) { setError('Unable to load your personal workspace.'); return; }
    setHouseholds(data || []); if (data?.length) setHouseholdId((current) => current || data[0].id);
  }
  useEffect(() => { void load(); }, []);
  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const response = await personalFinanceRequest({ action: 'create_household', displayName: name, preferredLanguage: 'en-IN' });
      setName(''); await load(); setHouseholdId(response.household.id);
      setNotice('Your workspace was created. Continue to secure AutoPay authorisation to begin your 14-day trial.');
      await startPersonalSubscription(response.household.id, planCode);
    } catch (reason: any) { setError(reason.message || 'Unable to create the personal workspace.'); setBusy(false); }
  }
  async function subscribe() {
    if (!householdId) return; setBusy(true); setError('');
    try { await startPersonalSubscription(householdId, planCode); } catch (reason: any) { setError(reason.message || 'Unable to start secure payment authorisation.'); setBusy(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!householdId) return; setBusy(true); setError(''); setResult(null);
    try {
      const purpose = ['tax_intake', 'department_notice'].includes(mode) ? 'tax_intake' : 'statement_analysis';
      if (purposeConfirmed) await personalFinanceRequest({ action: 'grant_consent', householdId, purpose });
      const upload = file ? { name: file.name, type: file.type, base64: await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('Unable to read the selected file.')); reader.onload = () => resolve(String(reader.result).split(',')[1] || ''); reader.readAsDataURL(file); }) } : undefined;
      const response = await personalFinanceRequest({ action: 'prepare', householdId, serviceMode: mode, manualText: text, file: upload }); setResult(response);
    } catch (reason: any) { setError(reason.message || 'Unable to prepare your draft.'); } finally { setBusy(false); }
  }
  const planPicker = <label>Selected personal plan<select value={planCode} onChange={(e) => setPlanCode(e.target.value)}>{plans.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>;
  return <main className="workspace"><div className="wrap workspace-head"><a className="textlink" href="/workspace?service=business">← Business Accounting</a><span className="pill">Personal Finance &amp; Tax Support</span><h1>Understand your household finances</h1><p>Upload statements or documents, organise your questions, and review a draft before sharing anything with a professional.</p></div><div className="wrap">
    {!households.length ? <section className="panel"><h2>Create your personal workspace</h2><p className="helper">Keep household records separate from business accounting. Select a plan, then authorise AutoPay securely through Razorpay. No subscription fee is charged during the 14-day trial.</p><form onSubmit={create}><label>Household name<input value={name} maxLength={160} required onChange={(e) => setName(e.target.value)} placeholder="e.g. Kumar household" /></label>{planPicker}<button className="button" disabled={busy}>{busy ? 'Preparing secure authorisation…' : 'Create workspace & authorise plan'}</button></form></section> : <section className="panel personal-draft"><div className="toolbar"><label>Personal workspace<select value={householdId} onChange={(e) => setHouseholdId(e.target.value)}>{households.map((h) => <option key={h.id} value={h.id}>{h.display_name}</option>)}</select></label><a className="button small" href="/workspace?service=business">Switch service</a></div><h2>MyLekhapal Intelligence</h2><p className="helper">Your submission is analysed only for the purpose you confirm. It remains a draft for review; nothing is filed, paid, or shared automatically.</p><section className="personal-subscription"><b>Start or resume your Personal Finance plan</b><span>Authorise AutoPay securely to start the 14-day trial. No subscription fee is charged during the trial.</span>{planPicker}<button type="button" className="button small" disabled={busy} onClick={subscribe}>{busy ? 'Opening secure authorisation…' : 'Authorise plan securely'}</button></section><form onSubmit={submit}><label>What would you like help with?<select value={mode} onChange={(e) => { setMode(e.target.value as any); setPurposeConfirmed(false); }}>{modes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Describe your question or context<textarea value={text} maxLength={6000} onChange={(e) => setText(e.target.value)} placeholder="Optional context. Do not include passwords, OTPs, UPI PINs, CVVs, or full account numbers." /></label><div className="upload-actions"><input ref={uploadRef} className="sr-only" type="file" accept="application/pdf,image/*,.csv,.xls,.xlsx" onChange={(e) => setFile(e.target.files?.[0] || null)} /><input ref={cameraRef} className="sr-only" type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] || null)} /><button type="button" className="quiet" onClick={() => uploadRef.current?.click()}><Upload size={16} /> Upload statement or document</button><button type="button" className="quiet" onClick={() => cameraRef.current?.click()}><Camera size={16} /> Take photo</button>{file && <span className="helper"><FileText size={16} /> {file.name}</span>}</div><label className="check"><input type="checkbox" checked={purposeConfirmed} onChange={(e) => setPurposeConfirmed(e.target.checked)} required /> I confirm that this sensitive document may be analysed to prepare a private review draft. I will review it before relying on it or sharing it with a professional.</label><button className="button" disabled={busy || (!text && !file)}>{busy ? 'Preparing your draft…' : 'Prepare review draft'}</button></form>{error && <p className="error" role="alert">{error}</p>}{result?.draft && <section className="draft-result"><span className="pill">Review required</span><h3>{result.draft.summary}</h3><p><b>Confidence:</b> {result.draft.confidence_level}</p>{result.draft.clarifications?.length > 0 && <p className="missing">More information needed: {result.draft.clarifications.join(', ')}</p>}<p>{result.draft.recommended_next_action}</p></section>}</section>}
    {error && !households.length && <p className="error" role="alert">{error}</p>}{notice && <p className="success" role="status">{notice}</p>}</div></main>;
}
