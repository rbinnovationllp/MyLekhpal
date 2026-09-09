'use client';
import { useEffect, useRef, useState } from 'react';
import { booksRequest, prepareJournalDraft } from '../../hostinger/supabase';
import {
  BookOpenCheck,
  Plus,
  ArrowLeft,
  Download,
  Search,
  Building2,
  FileText,
  ShieldCheck,
  Camera,
  Upload,
  FileSpreadsheet,
  Image as ImageIcon,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
const money = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
    n / 100,
  );
const blankLine = () => ({ account: '', debit: '', credit: '' });
type ImportResult = {
  name: string;
  kind: 'spreadsheet' | 'image' | 'document';
  preview?: string;
  date: string;
  reference: string;
  party: string;
  description: string;
  taxableAmount: string;
  gst: string;
  total: string;
  missing: string[];
};
const csvRow = (line: string) => {
  const values: string[] = [];
  let value = '', quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { values.push(value.trim()); value = ''; }
    else value += char;
  }
  values.push(value.trim());
  return values;
};
const dateFromValue = (value: string) => {
  const iso = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : date.toISOString().slice(0, 10);
};
export default function Workspace({ user }: { user: string }) {
  const [businesses, setBusinesses] = useState<any[]>([]),
    [active, setActive] = useState(''),
    [data, setData] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [setup, setSetup] = useState(false),
    [tab, setTab] = useState('overview'),
    [query, setQuery] = useState(''),
    [detail, setDetail] = useState<any>(null),
    [confirm, setConfirm] = useState(false),
    [confirmBusiness, setConfirmBusiness] = useState(false),
    [lines, setLines] = useState([blankLine(), blankLine()]),
    [journal, setJournal] = useState({ date: '', reference: '', narration: '' }),
    [imported, setImported] = useState<ImportResult | null>(null),
    [importFile, setImportFile] = useState<File | null>(null),
    [aiDraft, setAiDraft] = useState<any>(null),
    [aiBusy, setAiBusy] = useState(false),
    [hi, setHi] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const t = (en: string, hindi: string) => (hi ? hindi : en);
  const request = booksRequest;
  async function loadBusinesses() {
    setLoading(true);
    try {
      const r = await request('/api/books');
      setBusinesses(r.businesses);
      if (r.businesses.length === 1) setActive(r.businesses[0].id);
      if (!r.businesses.length) setSetup(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  async function refresh(id: string) {
    const r = await request('/api/books?business=' + encodeURIComponent(id));
    setData(r);
    return r;
  }
  useEffect(() => {
    void loadBusinesses();
  }, []);
  useEffect(() => {
    let valid = true;
    setData(null);
    setConfirmBusiness(false);
    setLines([blankLine(), blankLine()]);
    setJournal({ date: '', reference: '', narration: '' });
    setImported(null);
    setImportFile(null);
    setAiDraft(null);
    setDetail(null);
    if (active) {
      setLoading(true);
      request('/api/books?business=' + encodeURIComponent(active))
        .then((r) => {
          if (valid) setData(r);
        })
        .catch((e) => {
          if (valid) setError(e.message);
        })
        .finally(() => {
          if (valid) setLoading(false);
        });
    }
    return () => {
      valid = false;
    };
  }, [active]);
  useEffect(() => {
    const ctx = (document as any).modelContext;
    if (!ctx?.registerTool) return;
    const control = new AbortController();
    Promise.resolve(
      ctx.registerTool(
        {
          name: 'search_journal_register',
          description:
            'Filter the active business journal register by narration or reference. Does not change accounting records.',
          inputSchema: {
            type: 'object',
            properties: { query: { type: 'string', maxLength: 100 } },
            required: ['query'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: (input: any) => {
            if (
              !input ||
              typeof input.query !== 'string' ||
              input.query.length > 100
            )
              throw new Error(
                'A search query of at most 100 characters is required.',
              );
            if (!data) throw new Error('Select a business first.');
            setQuery(input.query);
            setTab('journal');
            return {
              matches: data.entries
                .filter((e: any) =>
                  (e.narration + ' ' + e.reference)
                    .toLowerCase()
                    .includes(input.query.toLowerCase()),
                )
                .map((e: any) => ({
                  id: e.id,
                  reference: e.reference,
                  status: e.status,
                })),
            };
          },
        },
        { signal: control.signal },
      ),
    ).catch(() => {});
    return () => control.abort();
  }, [data]);
  async function createBusiness(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError('');
    setBusy(true);
    try {
      const fields = Object.fromEntries(new FormData(form));
      const r = await request('/api/books', {
        ...fields,
        action: 'createBusiness',
        confirmAccounts: confirm,
      });
      await loadBusinesses();
      setActive(r.id);
      setSetup(false);
      setConfirm(false);
      setNotice(
        t('Business setup draft saved.', 'व्यवसाय सेटअप ड्राफ्ट सहेजा गया।'),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveEntry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError('');
    setBusy(true);
    try {
      const fields = Object.fromEntries(new FormData(form));
      await request('/api/books', {
        ...fields,
        action: 'createEntry',
        business: active,
        lines,
        confirmBusiness,
      });
      await refresh(active);
      form.reset();
      setLines([blankLine(), blankLine()]);
      setJournal({ date: '', reference: '', narration: '' });
      setImported(null);
      setImportFile(null);
      setAiDraft(null);
      setConfirmBusiness(false);
      setTab('journal');
      setNotice(
        t(
          'Balanced journal draft saved. It has not been posted.',
          'संतुलित जर्नल ड्राफ्ट सहेजा गया। इसे पोस्ट नहीं किया गया है।',
        ),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function suggestedLines(description: string, amount: string) {
    const words = description.toLowerCase();
    const account = (terms: string[]) =>
      data.accounts.find((a: any) => terms.some((term) => a.name.toLowerCase().includes(term)))?.id || '';
    const cash = account(['cash', 'bank']);
    if (words.includes('sale') || words.includes('invoice'))
      return [{ account: account(['receivable', 'bank', 'cash']), debit: amount, credit: '' }, { account: account(['sales']), debit: '', credit: amount }];
    if (words.includes('purchase') || words.includes('supplier'))
      return [{ account: account(['purchases']), debit: amount, credit: '' }, { account: account(['payable', 'cash', 'bank']), debit: '', credit: amount }];
    return [{ account: account(['expense']), debit: amount, credit: '' }, { account: cash, debit: '', credit: amount }];
  }
  function applyImport(result: ImportResult) {
    const narration = [result.description, result.party && `Party: ${result.party}`].filter(Boolean).join(' · ');
    setJournal({ date: result.date, reference: result.reference, narration });
    if (result.total) setLines(suggestedLines(narration, result.total));
    setNotice(t('Suggested details were added to this draft. Review every field before saving.', 'सुझाए गए विवरण ड्राफ्ट में जोड़ दिए गए हैं। सहेजने से पहले हर फ़ील्ड जाँचें।'));
  }
  async function readImport(file: File) {
    setImportFile(file);
    const image = file.type.startsWith('image/');
    const spreadsheet = file.name.toLowerCase().endsWith('.csv') || file.type.includes('csv');
    const base: ImportResult = { name: file.name, kind: image ? 'image' : spreadsheet ? 'spreadsheet' : 'document', preview: image ? URL.createObjectURL(file) : undefined, date: '', reference: '', party: '', description: '', taxableAmount: '', gst: '', total: '', missing: ['Transaction date', 'Reference number', 'Party', 'Amount'] };
    if (spreadsheet) {
      const rows = (await file.text()).split(/\r?\n/).filter(Boolean).map(csvRow);
      const headers = rows[0]?.map((x) => x.toLowerCase().replace(/[^a-z0-9]/g, '')) || [];
      const row = rows[1] || [];
      const field = (...names: string[]) => row[headers.findIndex((header) => names.some((name) => header.includes(name)))] || '';
      base.date = dateFromValue(field('date', 'invoicedate', 'transactiondate'));
      base.reference = field('invoice', 'reference', 'voucher', 'billno');
      base.party = field('party', 'vendor', 'supplier', 'customer', 'customername');
      base.description = field('description', 'narration', 'particular', 'item') || 'Imported CSV transaction';
      base.taxableAmount = field('taxable', 'subtotal', 'amount');
      base.gst = field('gst', 'tax');
      base.total = field('total', 'grandtotal', 'amount') || base.taxableAmount;
      base.missing = [['Transaction date', base.date], ['Reference number', base.reference], ['Party', base.party], ['Amount', base.total]].filter(([, value]) => !value).map(([label]) => label as string);
    } else {
      base.description = image ? 'Photo captured for review' : 'Document uploaded for review';
      base.missing = ['Transaction date', 'Reference number', 'Party', 'Taxable amount', 'GST', 'Total amount'];
    }
    setImported(base);
    await analyseWithClaude(file, spreadsheet ? 'excel_csv_import' : image ? 'invoice_upload' : 'receipt_upload');
  }
  async function analyseWithClaude(file: File, sourceMethod: string) {
    setAiBusy(true); setError(''); setAiDraft(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('Unable to read the selected file.')); reader.onload = () => resolve(String(reader.result).split(',')[1] || ''); reader.readAsDataURL(file); });
      const result = await prepareJournalDraft({ businessId: active, sourceMethod, file: { name: file.name, type: file.type, base64 } });
      const draft = result.draft;
      setJournal({ date: draft.transaction_date || '', reference: draft.reference || '', narration: draft.narration || '' });
      setLines(draft.lines.map((line: any) => ({ account: line.account_id, debit: line.debit ? String(line.debit) : '', credit: line.credit ? String(line.credit) : '' })));
      setAiDraft({ ...draft, model: result.model, requestId: result.requestId, skill: result.skill });
      setImported((current) => current ? { ...current, date: draft.transaction_date || '', reference: draft.reference || '', party: draft.party_name || '', description: draft.narration || current.description, taxableAmount: draft.taxable_amount == null ? '' : String(draft.taxable_amount), gst: draft.gst_amount == null ? '' : String(draft.gst_amount), total: draft.total_amount == null ? '' : String(draft.total_amount), missing: (draft.completeness || []).filter((item: any) => ['missing', 'invalid', 'inconsistent', 'pending_professional_review'].includes(item.status)).map((item: any) => item.field) } : current);
      setNotice(t(`Claude (${result.model}) prepared a ${draft.status} draft (${draft.confidence} confidence). Request ${result.requestId}. Review it before saving.`, `Claude ने ${draft.status} ड्राफ्ट तैयार किया। सहेजने से पहले जाँचें।`));
    } catch (e: any) { setError(e.message || 'Claude processing could not prepare a draft.'); }
    finally { setAiBusy(false); }
  }
  function exportCsv() {
    const rows = [
      [
        'Entry ID',
        'Date',
        'Reference',
        'Narration',
        'Debit INR',
        'Credit INR',
        'Status',
      ],
      ...data.entries.map((e: any) => [
        e.id,
        e.date,
        e.reference,
        e.narration,
        (e.total / 100).toFixed(2),
        (e.total / 100).toFixed(2),
        e.status,
      ]),
    ];
    const csv = rows
      .map((r) =>
        r
          .map((s: any) => {
            const v = String(s);
            return (
              '"' +
              (/^[=+@\-\t\r]/.test(v) ? "'" : '') +
              v.replaceAll('"', '""') +
              '"'
            );
          })
          .join(','),
      )
      .join('\r\n');
    const a = document.createElement('a');
    const url = URL.createObjectURL(
      new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }),
    );
    a.href = url;
    a.download = active + '-draft-register.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Exported the currently loaded register, up to 500 drafts.');
  }
  const filtered =
    data?.entries.filter((e: any) =>
      (e.narration + ' ' + e.reference)
        .toLowerCase()
        .includes(query.toLowerCase()),
    ) || [];
  return (
    <main className="workspace" lang={hi ? 'hi' : 'en'}>
      <header className="workspace-header">
        <a href="/" className="brand">
          <BookOpenCheck />
          mylekhpal.
        </a>
        <div>
          <button className="quiet" onClick={() => setHi(!hi)}>
            {hi ? 'English' : 'हिन्दी'}
          </button>
          <span className="user-name">{user}</span>
        </div>
      </header>
      <div className="workspace-main">
        <div className="notice">
          <ShieldCheck size={18} />
          {t(
            'Claude AI prepares reviewable journal drafts from supported documents. It never posts entries automatically; use test records until professional review is configured.',
            'Claude AI समर्थित दस्तावेज़ों से समीक्षा योग्य जर्नल ड्राफ्ट तैयार करता है। यह कभी अपने-आप प्रविष्टियाँ पोस्ट नहीं करता; पेशेवर समीक्षा सेट होने तक परीक्षण रिकॉर्ड उपयोग करें।',
          )}
        </div>
        {error && (
          <div role="alert" className="error">
            {error}
            <button className="quiet" onClick={() => setError('')}>
              ×
            </button>
          </div>
        )}
        {notice && (
          <div role="status" className="success">
            {notice}
            <button className="quiet" onClick={() => setNotice('')}>
              ×
            </button>
          </div>
        )}
        <div className="workspace-title">
          <div>
            <span className="eyebrow">
              {t('YOUR BUSINESS WORKSPACE', 'आपका व्यवसाय कार्यक्षेत्र')}
            </span>
            <h1>{t('Clarity starts here.', 'स्पष्टता की शुरुआत यहाँ।')}</h1>
          </div>
          <button className="button small" onClick={() => setSetup(!setup)}>
            <Plus size={18} />
            {t('Add business', 'व्यवसाय जोड़ें')}
          </button>
        </div>
        {businesses.length > 0 && (
          <div className="business-switch">
            <label>{t('Active business', 'चयनित व्यवसाय')}</label>
            <Select
              value={active}
              onValueChange={(v) => {
                setActive(v || '');
                setTab('overview');
              }}
            >
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue placeholder={t('Choose a business', 'व्यवसाय चुनें')}>
                  {businesses.find((b) => b.id === active)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {businesses.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {setup && (
          <section className="panel">
            <div className="panel-heading">
              <Building2 />
              <div>
                <h2>{t('Set up your business', 'अपना व्यवसाय सेट करें')}</h2>
                <p>
                  {t(
                    'Save an incomplete setup as a draft. Add identifiers only when known.',
                    'अधूरा सेटअप ड्राफ्ट में सहेजें। ज्ञात पहचान विवरण ही भरें।',
                  )}
                </p>
              </div>
            </div>
            <form onSubmit={createBusiness}>
              <div className="form-grid">
                <label>
                  {t('Legal business name *', 'कानूनी व्यवसाय नाम *')}
                  <input name="name" required maxLength={160} />
                </label>
                  <label>
                    {t('Trade name', 'व्यापार नाम')}
                    <input name="tradeName" maxLength={160} />
                  </label>
                  <label>
                    {t('Entity type', 'इकाई का प्रकार')}
                    <input
                      name="entityType"
                      maxLength={80}
                      placeholder={t('e.g. Proprietorship', 'उदा. एकल स्वामित्व')}
                    />
                  </label>
                  <label>
                    PAN
                  <input
                    name="pan"
                    maxLength={10}
                    placeholder="Optional during setup"
                  />
                </label>
                <label>
                  GSTIN
                  <input
                    name="gstin"
                    maxLength={15}
                    placeholder="Optional during setup"
                  />
                </label>
                <label>
                  {t('Financial year start *', 'वित्त वर्ष का प्रारंभ *')}
                  <input
                    name="year"
                    type="number"
                    min={2000}
                    max={2100}
                    defaultValue={
                      new Date().getMonth() < 3
                        ? new Date().getFullYear() - 1
                        : new Date().getFullYear()
                    }
                    required
                  />
                </label>
                <label>
                  {t('State', 'राज्य')}
                  <input name="state" maxLength={80} />
                </label>
                <label className="full">
                  {t('Business address', 'व्यवसाय पता')}
                  <input name="address" maxLength={500} />
                </label>
              </div>
              <p className="helper">
                {t(
                  'Starter accounts: Cash, Bank, Customer receivables, Supplier payables, Owner capital, Sales, Purchases and General expenses.',
                  'प्रारंभिक खाते: नकद, बैंक, ग्राहक प्राप्य, आपूर्तिकर्ता देय, मालिक पूंजी, बिक्री, खरीद और सामान्य खर्च।',
                )}
              </p>
              <label className="check">
                <Checkbox checked={confirm} onCheckedChange={setConfirm} />
                {t(
                  'I authorize creating these starter accounts for this business.',
                  'मैं इस व्यवसाय के लिए ये प्रारंभिक खाते बनाने की अनुमति देता हूँ।',
                )}
              </label>
              <button className="button" disabled={busy || !confirm}>
                {busy
                  ? t('Saving…', 'सहेज रहे हैं…')
                  : t('Save setup draft', 'सेटअप ड्राफ्ट सहेजें')}
              </button>
            </form>
          </section>
        )}
        {loading && (
          <p role="status">
            {t('Loading your workspace…', 'कार्यक्षेत्र लोड हो रहा है…')}
          </p>
        )}
        {!loading && !active && businesses.length > 1 && (
          <section className="panel">
            <h2>
              {t('Select a business to continue', 'जारी रखने के लिए व्यवसाय चुनें')}
            </h2>
            <p>
              Records from different businesses stay in separate workspaces.
            </p>
          </section>
        )}
        {data && (
          <>
            <div className="identity">
                <div>
                  <b>{data.business.name}</b>
                  <span>
                    {data.business.id} ·{' '}
                    {data.business.client_id ||
                      t('Client ID pending', 'क्लाइंट ID लंबित')}
                  </span>
                </div>
              <div>
                <small>GSTIN</small>
                <b>
                  {data.business.gstin ||
                    t('Not provided', 'प्रदान नहीं किया गया')}
                </b>
              </div>
              <div>
                <small>{t('Financial year', 'वित्त वर्ष')}</small>
                <b>
                  {data.business.year}–{String(data.business.year + 1).slice(2)}
                </b>
              </div>
              <span className="pill">
                {t('Onboarding draft', 'सेटअप ड्राफ्ट')}
              </span>
            </div>
            <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
              <TabsList className="workspace-tabs">
                <TabsTrigger value="overview">
                  {t('Overview', 'सारांश')}
                </TabsTrigger>
                <TabsTrigger value="journal">
                  {t('Journal register', 'जर्नल रजिस्टर')}
                </TabsTrigger>
                <TabsTrigger value="new">
                  {t('New draft', 'नया ड्राफ्ट')}
                </TabsTrigger>
                <TabsTrigger value="accounts">
                  {t('Accounts', 'खाते')}
                </TabsTrigger>
                <TabsTrigger value="audit">
                  {t('Activity', 'गतिविधि')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <div className="summary-grid">
                  <button className="summary" onClick={() => setTab('journal')}>
                    <FileText />
                    <span>{t('Journal drafts', 'जर्नल ड्राफ्ट')}</span>
                    <strong>{data.entries.length}</strong>
                    <small>
                      {t('Open the underlying entries', 'मूल प्रविष्टियाँ खोलें')}
                    </small>
                  </button>
                  <button className="summary" onClick={() => setTab('journal')}>
                    <span>{t('Draft debit total', 'ड्राफ्ट डेबिट कुल')}</span>
                    <strong>
                      {money(
                        data.entries.reduce(
                          (a: number, e: any) => a + e.total,
                          0,
                        ),
                      )}
                    </strong>
                    <small>
                      {t(
                        'Unposted working records',
                        'अभी पोस्ट नहीं किए गए रिकॉर्ड',
                      )}
                    </small>
                  </button>
                  <div className="summary">
                    <span>{t('Books status', 'खातों की स्थिति')}</span>
                    <strong className="text-status">
                      {t('In preparation', 'तैयारी में')}
                    </strong>
                    <small>
                      {t(
                        'No entries have been posted',
                        'कोई प्रविष्टि पोस्ट नहीं की गई है',
                      )}
                    </small>
                  </div>
                </div>
                <section className="panel">
                  <h2>
                    {t(
                      'Build your first set of records',
                      'अपने शुरुआती रिकॉर्ड बनाएं',
                    )}
                  </h2>
                  <p>
                    {t(
                      'Start with a balanced draft. Your narration, accounts and reference will be saved together for later review.',
                      'संतुलित ड्राफ्ट से शुरू करें। विवरण, खाते और संदर्भ बाद की समीक्षा के लिए साथ सहेजे जाएंगे।',
                    )}
                  </p>
                  <button className="button" onClick={() => setTab('new')}>
                    <Plus size={18} />
                    {t('Create journal draft', 'जर्नल ड्राफ्ट बनाएं')}
                  </button>
                </section>
                <section className="panel">
                  <h3>
                    {t(
                      'Before using live business data',
                      'वास्तविक व्यवसाय डेटा उपयोग करने से पहले',
                    )}
                  </h3>
                  <p>
                    {t(
                      'This foundation still needs team permissions, MFA, document scanning, backups, professional accounting review and production security testing. GST estimates and compliance statuses are not yet available.',
                      'इस संस्करण में टीम अनुमतियाँ, MFA, दस्तावेज़ स्कैनिंग, बैकअप, पेशेवर लेखा समीक्षा और सुरक्षा परीक्षण अभी बाकी हैं। GST अनुमान और अनुपालन स्थिति अभी उपलब्ध नहीं हैं।',
                    )}
                  </p>
                  <p className="professional-boundary">
                    {t(
                      'MyLekhapal provides bookkeeping and compliance-preparation assistance. AI-generated entries and tax estimates must be reviewed by an authorized accountant or Chartered Accountant before posting, payment or return filing.',
                      'MyLekhapal बहीखाता और अनुपालन-तैयारी सहायता प्रदान करता है। AI-निर्मित प्रविष्टियों और कर अनुमानों की पोस्टिंग, भुगतान या रिटर्न फाइलिंग से पहले अधिकृत लेखाकार या चार्टर्ड अकाउंटेंट द्वारा समीक्षा की जानी चाहिए।',
                    )}
                  </p>
                </section>
              </TabsContent>
              <TabsContent value="journal">
                <section className="panel">
                  <div className="register-heading">
                    <h2>
                      {t('Compact journal register', 'संक्षिप्त जर्नल रजिस्टर')}
                    </h2>
                    <button className="quiet" onClick={exportCsv}>
                      <Download size={16} /> CSV
                    </button>
                  </div>
                  <label className="search">
                    <Search size={18} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      maxLength={100}
                      placeholder={t(
                        'Search reference or narration',
                        'संदर्भ या विवरण खोजें',
                      )}
                      aria-label={t('Search journal', 'जर्नल खोजें')}
                    />
                  </label>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {[
                          'Reference',
                          'Date',
                          'Description',
                          'Debit',
                          'Credit',
                          'Status',
                        ].map((h) => (
                          <TableHead key={h}>{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((e: any) => (
                        <TableRow key={e.id}>
                          <TableCell>
                            <button
                              className="entry-link"
                              onClick={() => setDetail(e)}
                            >
                              {e.reference}
                            </button>
                          </TableCell>
                          <TableCell>{e.date}</TableCell>
                          <TableCell>{e.narration}</TableCell>
                          <TableCell>{money(e.total)}</TableCell>
                          <TableCell>{money(e.total)}</TableCell>
                          <TableCell>
                            <span className="pill">Draft</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {!filtered.length && (
                    <p className="empty">
                      {t(
                        'No matching drafts. Create a draft to get started.',
                        'कोई ड्राफ्ट नहीं मिला। नया ड्राफ्ट बनाएं।',
                      )}
                    </p>
                  )}
                  <p className="helper">
                    {t(
                      'Showing up to 500 latest drafts. Nothing here is posted or filed.',
                      'अधिकतम 500 नवीनतम ड्राफ्ट दिखाए गए हैं। ये पोस्ट या फाइल नहीं किए गए हैं।',
                    )}
                  </p>
                </section>
              </TabsContent>
              <TabsContent value="new">
                <section className="panel">
                  <h2>{t('New journal draft', 'नया जर्नल ड्राफ्ट')}</h2>
                  <p>
                    {t(
                      'Use your business’s accounts. Debits and credits must balance.',
                      'अपने व्यवसाय के खाते उपयोग करें। डेबिट और क्रेडिट संतुलित होना चाहिए।',
                    )}
                  </p>
                  <div className="document-import" aria-labelledby="document-import-title">
                    <div className="import-heading">
                      <div>
                        <span className="eyebrow">{t('DOCUMENT ASSIST', 'दस्तावेज़ सहायता')}</span>
                        <h3 id="document-import-title">{t('Start from a document or photo', 'दस्तावेज़ या फ़ोटो से शुरू करें')}</h3>
                        <p>{t('This submission is processed using Claude AI. Add a CSV, Excel file, PDF, invoice, receipt or handwritten chit; Claude prepares a reviewable draft and never posts automatically.', 'यह सबमिशन Claude AI द्वारा प्रोसेस किया जाता है। Claude समीक्षा योग्य ड्राफ्ट तैयार करता है और कभी अपने-आप पोस्ट नहीं करता।')}</p>
                      </div>
                    </div>
                    <div className="import-actions">
                      <button type="button" className="import-action" onClick={() => uploadRef.current?.click()}>
                        <Upload size={21} />
                        <span><b>{t('Upload document / file', 'दस्तावेज़ / फ़ाइल अपलोड करें')}</b><small>{t('Excel, CSV, PDF, image or receipt', 'Excel, CSV, PDF, इमेज या रसीद')}</small></span>
                      </button>
                      <button type="button" className="import-action camera" onClick={() => cameraRef.current?.click()}>
                        <Camera size={21} />
                        <span><b>{t('Take photo', 'फ़ोटो लें')}</b><small>{t('Open your phone camera now', 'अभी फ़ोन कैमरा खोलें')}</small></span>
                      </button>
                    </div>
                    <input ref={uploadRef} className="sr-only" type="file" accept=".csv,.xlsx,.xls,.pdf,image/*,.heic" onChange={(e) => { const file = e.target.files?.[0]; if (file) void readImport(file); e.currentTarget.value = ''; }} />
                    <input ref={cameraRef} className="sr-only" type="file" accept="image/*" capture="environment" onChange={(e) => { const file = e.target.files?.[0]; if (file) void readImport(file); e.currentTarget.value = ''; }} />
                    {imported && <div className="import-review">
                      <div className="import-preview">
                        {imported.preview ? <img src={imported.preview} alt={`Preview of ${imported.name}`} /> : imported.kind === 'spreadsheet' ? <FileSpreadsheet aria-hidden="true" /> : <FileText aria-hidden="true" />}
                        <span>{imported.name}</span>
                        <button type="button" className="quiet" aria-label={t('Remove document', 'दस्तावेज़ हटाएँ')} onClick={() => { if (imported.preview) URL.revokeObjectURL(imported.preview); setImported(null); setImportFile(null); }}><X size={18} /></button>
                      </div>
                      <div className="extraction-status">
                        {imported.kind === 'spreadsheet' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                        <div><b>{aiBusy ? t('Claude is preparing your draft', 'Claude आपका ड्राफ्ट तैयार कर रहा है') : aiDraft ? t('Claude draft ready for review', 'Claude ड्राफ्ट समीक्षा के लिए तैयार है') : t('Document selected', 'दस्तावेज़ चुना गया')}</b><span>{aiBusy ? t('Please wait while details, GST treatment, accounts and debits/credits are checked.', 'विवरण, GST, खाते और डेबिट/क्रेडिट की जाँच हो रही है।') : aiDraft ? t('Details below are a draft only. Correct anything uncertain before you save.', 'नीचे के विवरण केवल ड्राफ्ट हैं। सहेजने से पहले अनिश्चित जानकारी सुधारें।') : t('Processing starts automatically after a supported document is selected.', 'समर्थित दस्तावेज़ चुनते ही प्रोसेसिंग अपने-आप शुरू होती है।')}</span></div>
                      </div>
                      <div className="extracted-grid">
                        <span><small>{t('Date', 'तारीख')}</small><b>{imported.date || '—'}</b></span>
                        <span><small>{t('Reference', 'संदर्भ')}</small><b>{imported.reference || '—'}</b></span>
                        <span><small>{t('Party', 'पार्टी')}</small><b>{imported.party || '—'}</b></span>
                        <span><small>{t('Taxable amount', 'कर योग्य राशि')}</small><b>{imported.taxableAmount || '—'}</b></span>
                        <span><small>GST</small><b>{imported.gst || '—'}</b></span>
                        <span><small>{t('Total', 'कुल')}</small><b>{imported.total || '—'}</b></span>
                      </div>
                      {imported.missing.length > 0 && <p className="missing"><AlertTriangle size={16} /> {t('Needs your attention:', 'आपका ध्यान आवश्यक:')} {imported.missing.join(', ')}</p>}
                      {aiDraft?.clarifications?.length > 0 && <p className="missing"><AlertTriangle size={16} /> {t('Claude needs clarification:', 'Claude को स्पष्टीकरण चाहिए:')} {aiDraft.clarifications.join(', ')}</p>}
                      {aiDraft?.exceptions?.length > 0 && <p className="missing"><AlertTriangle size={16} /> {t('Review flags:', 'समीक्षा संकेत:')} {aiDraft.exceptions.join(', ')}</p>}
                      {aiBusy && <p role="status" className="helper">{t('Claude is extracting details and preparing a draft…', 'Claude विवरण निकालकर ड्राफ्ट तैयार कर रहा है…')}</p>}
                    </div>}
                  </div>
                  <form onSubmit={saveEntry}>
                    <div className="form-grid">
                      <label>
                        {t('Transaction date *', 'लेनदेन तिथि *')}
                        <input
                          name="date"
                          type="date"
                          min={`${data.business.year}-04-01`}
                          max={`${data.business.year + 1}-03-31`}
                          required
                          value={journal.date}
                          onChange={(e) => setJournal({ ...journal, date: e.target.value })}
                        />
                      </label>
                      <label>
                        {t('Unique reference *', 'विशिष्ट संदर्भ *')}
                        <input
                          name="reference"
                          maxLength={100}
                          required
                          placeholder="JV-001"
                          value={journal.reference}
                          onChange={(e) => setJournal({ ...journal, reference: e.target.value })}
                        />
                      </label>
                      <label className="full">
                        {t('What happened? *', 'क्या हुआ? *')}
                        <input
                          name="narration"
                          maxLength={1000}
                          required
                          placeholder={t(
                            'Describe this transaction',
                            'इस लेनदेन का विवरण दें',
                          )}
                          value={journal.narration}
                          onChange={(e) => setJournal({ ...journal, narration: e.target.value })}
                        />
                      </label>
                    </div>
                    <div className="journal-lines">
                      {lines.map((l, i) => (
                        <div className="journal-line" key={i}>
                          <label>
                            {t('Account', 'खाता')} {i + 1}
                            <Select
                              value={l.account}
                              onValueChange={(v) =>
                                setLines(
                                  lines.map((x, j) =>
                                    i === j ? { ...x, account: v || '' } : x,
                                  ),
                                )
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue
                                  placeholder={t('Choose account', 'खाता चुनें')}
                                >
                                  {
                                    data.accounts.find(
                                      (a: any) => a.id === l.account,
                                    )?.name
                                  }
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {data.accounts.map((a: any) => (
                                  <SelectItem value={a.id} key={a.id}>
                                    {a.code} · {a.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </label>
                          <label>
                            {t('Debit ₹', 'डेबिट ₹')}
                            <input
                              inputMode="decimal"
                              value={l.debit}
                              onChange={(e) =>
                                setLines(
                                  lines.map((x, j) =>
                                    i === j
                                      ? { ...x, debit: e.target.value }
                                      : x,
                                  ),
                                )
                              }
                            />
                          </label>
                          <label>
                            {t('Credit ₹', 'क्रेडिट ₹')}
                            <input
                              inputMode="decimal"
                              value={l.credit}
                              onChange={(e) =>
                                setLines(
                                  lines.map((x, j) =>
                                    i === j
                                      ? { ...x, credit: e.target.value }
                                      : x,
                                  ),
                                )
                              }
                            />
                          </label>
                          {lines.length > 2 && (
                            <button
                              type="button"
                              className="quiet"
                              aria-label={`Remove line ${i + 1}`}
                              onClick={() =>
                                setLines(lines.filter((_, j) => i !== j))
                              }
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      className="quiet"
                      type="button"
                      disabled={lines.length >= 40}
                      onClick={() => setLines([...lines, blankLine()])}
                    >
                      <Plus size={16} />
                      {t('Add line', 'पंक्ति जोड़ें')}
                    </button>
                    <label className="check">
                      <Checkbox
                        checked={confirmBusiness}
                        onCheckedChange={setConfirmBusiness}
                      />
                      {t(
                        'I confirm this entry belongs to',
                        'मैं पुष्टि करता हूँ कि यह प्रविष्टि संबंधित है',
                      )}{' '}
                      {data.business.name} · FY {data.business.year}–
                      {data.business.year + 1}.
                    </label>
                    <button
                      className="button"
                      disabled={busy || !confirmBusiness}
                    >
                      {busy
                        ? t('Saving…', 'सहेज रहे हैं…')
                        : t('Save balanced draft', 'संतुलित ड्राफ्ट सहेजें')}
                    </button>
                  </form>
                </section>
              </TabsContent>
              <TabsContent value="accounts">
                <section className="panel">
                  <h2>{t('Chart of accounts', 'खातों की सूची')}</h2>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.accounts.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell>{a.code}</TableCell>
                          <TableCell>{a.name}</TableCell>
                          <TableCell>{a.type}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="helper">
                    Starter accounts were created with your authorization.
                    Account amendments are not yet enabled.
                  </p>
                </section>
              </TabsContent>
              <TabsContent value="audit">
                <section className="panel">
                  <h2>{t('Activity history', 'गतिविधि इतिहास')}</h2>
                  <p className="helper">
                    Latest 100 events. This foundation log does not yet provide
                    a tamper-evident external checkpoint.
                  </p>
                  {data.audit.map((a: any) => (
                    <div className="activity" key={a.id}>
                      <span className="activity-dot" />
                      <div>
                        <b>{a.action}</b>
                        <p>{a.record_id}</p>
                        <small>
                          {a.created_at} · {a.actor}
                        </small>
                      </div>
                    </div>
                  ))}
                </section>
              </TabsContent>
            </Tabs>
          </>
        )}
        <Sheet
          open={!!detail}
          onOpenChange={(v) => {
            if (!v) setDetail(null);
          }}
        >
          <SheetContent className="entry-sheet">
            <SheetHeader>
              <SheetTitle>{detail?.reference}</SheetTitle>
              <SheetDescription>
                {t(
                  'Journal draft details — not posted',
                  'जर्नल ड्राफ्ट विवरण — पोस्ट नहीं किया गया',
                )}
              </SheetDescription>
            </SheetHeader>
            {detail && (
              <div className="detail-body">
                <span className="pill">Draft</span>
                <h3>{detail.narration}</h3>
                <p>
                  {detail.date} · {data?.business.name}
                </p>
                <p className="helper">{detail.id}</p>
                {JSON.parse(detail.lines).map((l: any, i: number) => (
                  <div className="detail-line" key={i}>
                    <b>
                      {
                        data?.accounts.find((a: any) => a.id === l.account)
                          ?.name
                      }
                    </b>
                    <span>
                      {l.debit
                        ? 'Dr ' + money(l.debit)
                        : 'Cr ' + money(l.credit)}
                    </span>
                  </div>
                ))}
                <p>Balanced total: {money(detail.total)}</p>
                <hr />
                <p className="helper">
                  Created: {detail.created_at}
                  <br />
                  Preparer: {detail.actor}
                  <br />
                  Source: {detail.source}
                  <br />
                  Review: Pending professional review
                  <br />
                  Supporting documents: Not attached
                  <br />
                  Tax treatment: Not determined
                </p>
                <p className="notice">
                  Balance validation passed. Full voucher completeness and
                  professional approval are still required before posting.
                </p>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </main>
  );
}


