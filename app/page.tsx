import {
  ArrowUpRight,
  Check,
  ArrowRight,
  FileText,
  ShieldCheck,
  Users,
  Languages,
  ScanLine,
  CircleCheck,
} from 'lucide-react';
const money = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
export default function Home() {
  return (
    <main>
      <nav className="nav wrap">
        <a href="/" className="brand">
          <img
            className="brand-mark"
            src="/brand/mylekhpal-logo.png"
            alt="Mylekhpal logo"
          />
          mylekhpal<span className="brand-dot">.</span>
        </a>
        <div className="navlinks">
          <a href="#workflow">How it works</a>
          <a href="#together">For businesses & CAs</a>
          <a href="/workspace">Workspace</a>
        </div>
        <a className="button small" href="/workspace">
          Get started <ArrowUpRight size={17} />
        </a>
      </nav>
      <section className="hero wrap">
        <div className="hero-copy">
          <span className="eyebrow">
            <span /> YOUR BUSINESS. YOUR BOOKS. TOGETHER.
          </span>
          <h1>
            Business is
            <br />
            your craft.
            <br />
            <span>Books are ours.</span>
          </h1>
          <p>
            From everyday business records to CA-ready books. A simpler way to
            organise your accounts and work with your accountant.
          </p>
          <div className="actions">
            <a href="/workspace" className="button">
              Set up your business <ArrowUpRight size={19} />
            </a>
            <a href="#preview" className="textlink">
              Explore the workspace <ArrowRight size={18} />
            </a>
          </div>
          <div className="hero-notes">
            <span>
              <Check size={16} /> Made for Indian businesses
            </span>
            <span>
              <Check size={16} /> You stay in control
            </span>
          </div>
        </div>
        <div className="hero-visual" id="preview">
          <div className="preview-label">
            <span className="live-dot" /> A CLEARER PICTURE OF YOUR BUSINESS{' '}
            <span>ILLUSTRATIVE DATA</span>
          </div>
          <div className="dashboard-card">
            <div className="dash-heading">
              <div className="company-icon">S</div>
              <div>
                <b>Sharma Trading Co.</b>
                <small>DEMO-001 · FY 2026–27</small>
              </div>
              <span className="status">Business owner</span>
            </div>
            <div className="dash-title">
              <div>
                <small>YOUR BUSINESS AT A GLANCE</small>
                <h2>A good day to grow.</h2>
              </div>
              <span>September 2026</span>
            </div>
            <div className="metrics">
              <div>
                <small>Sales this month</small>
                <strong>{money(284500)}</strong>
                <span className="positive">Sample sales activity</span>
              </div>
              <div>
                <small>Money to collect</small>
                <strong>{money(68400)}</strong>
                <span>From 8 customers</span>
              </div>
            </div>
            <div className="chart-label">
              <b>Money in & money out</b>
              <span>
                <i /> Income <i /> Expenses
              </span>
            </div>
            <div
              className="bar-chart"
              aria-label="Illustrative income and expense chart"
            >
              {[45, 68, 52, 85, 70, 96, 80].map((x, i) => (
                <div className="bar-group" key={i}>
                  <div>
                    <i style={{ height: x + '%' }} />
                    <i style={{ height: x * 0.62 + '%' }} />
                  </div>
                  <span>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                  </span>
                </div>
              ))}
            </div>
            <div className="ready">
              <CircleCheck />
              <div>
                <b>Everything in one place.</b>
                <small>Documents, draft entries and accountant review.</small>
              </div>
              <ArrowRight size={19} />
            </div>
          </div>
          <div className="floating-card">
            <div className="scan-icon">
              <ScanLine />
            </div>
            <div>
              <b>A receipt. A record. Less effort.</b>
              <small>AI-assisted drafts, with human review.</small>
            </div>
          </div>
        </div>
      </section>
      <section className="principles">
        <div className="wrap">
          <span>
            <ShieldCheck /> Your business stays separate
          </span>
          <span>
            <FileText /> Every entry has a story
          </span>
          <span>
            <Users /> Your CA stays in the loop
          </span>
          <span>
            <Languages /> Built for India
          </span>
        </div>
      </section>
      <section className="section wrap" id="workflow">
        <div className="section-head">
          <div>
            <span className="eyebrow">LESS BACK-AND-FORTH. MORE BUSINESS.</span>
            <h2>
              From daily records
              <br />
              to a confident handover.
            </h2>
          </div>
          <p>
            A shared place for you and your accountant.
            <br />
            Designed to keep the details connected.
          </p>
        </div>
        <div className="steps">
          {[
            [
              FileText,
              '01',
              'Bring your records together',
              'Organise everyday sales, purchases and expenses under the right business.',
            ],
            [
              ScanLine,
              '02',
              'Turn details into draft books',
              'Prepare structured entries, resolve missing information and keep source documents connected.',
            ],
            [
              Users,
              '03',
              'Move forward with your CA',
              'Share a clear review queue so your accountant can check the books and prepare compliance.',
            ],
          ].map(([Icon, no, title, copy]: any) => (
            <article key={no}>
              <div className="step-top">
                <Icon />
                <span>{no}</span>
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="together wrap" id="together">
        <div>
          <span className="eyebrow">ONE SHARED PICTURE</span>
          <h2>
            You know your business.
            <br />
            Your CA knows the books.
          </h2>
          <p>
            Mylekhpal brings both sides together, with simple business summaries
            and room for the accounting detail that matters.
          </p>
          <a className="button" href="/workspace?role=owner">
            Choose your role <ArrowUpRight size={18} />
          </a>
        </div>
        <div className="collab">
          <a className="role-card" href="/workspace?role=owner">
            <span className="avatar">BO</span>
            <b>Business owner</b>
            <small>Capture records · Answer queries</small>
            <em>Sign in as Business Owner</em>
          </a>
          <span className="connection">Shared records · Clear review</span>
          <a className="role-card" href="/workspace?role=ca_partner">
            <span className="avatar blue">CA</span>
            <b>Chartered Accountant</b>
            <small>Review entries · Prepare compliance</small>
            <em>Sign in as Chartered Accountant</em>
          </a>
          <a className="role-card" href="/workspace?role=accountant">
            <span className="avatar bookkeeper">AB</span>
            <b>Accountant / Bookkeeper</b>
            <small>Maintain books for businesses that appoint you</small>
            <em>Sign in as Accountant/Bookkeeper</em>
          </a>
        </div>
      </section>
      <section className="section wrap compliance-notice" id="compliance">
        <span className="eyebrow">COMPLIANCE &amp; PROFESSIONAL USE</span>
        <h2>Important information for clients</h2>
        <p><b>MyLekhapal is an accounting-software platform developed by Rashi Bhartiya Innovation LLP.</b> It is not presented as government-approved, GSTN-certified, or as a replacement for a Chartered Accountant, statutory auditor, tax practitioner, or other authorised professional.</p>
        <p>The service prepares accounting drafts for verification. Accounting, GST treatment, audit-trail review, and any filing remain subject to client and qualified-professional approval.</p>
        <div className="compliance-grid">
          <article><b>Journals, ledgers and reports</b><span>The platform supports preparation and review of accounting records; it does not claim a special government software licence.</span></article>
          <article><b>GST filing and e-invoicing</b><span>Direct government filing or e-invoice connections are not offered unless the required authorised GSTN/GSP route and approvals are in place.</span></article>
          <article><b>Professional services</b><span>MyLekhapal does not certify accounts, perform statutory audits, or replace regulated professional services.</span></article>
          <article><b>Audit trail and changes</b><span>The product is designed to support identifiable, timestamped changes, approvals, reversals, and period controls. Finalised records must not be silently changed.</span></article>
        </div>
        <p className="helper">If a future government integration is introduced, MyLekhapal will use the appropriate authorised route before that capability is advertised. No “government-approved” claim will be used without written approval from the relevant authority.</p>
        <p className="helper">For context, see <a href="https://www.gstn.org.in/" target="_blank" rel="noreferrer">GSTN</a> and <a href="https://tallysolutions.com/accounting/what-accounting-software-is-considered-a-safe-bet-for-long-term-government-and-tax-compliance-in-india/" target="_blank" rel="noreferrer">Tally’s guidance</a>. This notice is informational and not legal or tax advice.</p>
      </section>
      <footer className="wrap">
        <a className="brand" href="/">
          <img
            className="brand-mark"
            src="/brand/mylekhpal-logo.png"
            alt="Mylekhpal logo"
          />
          mylekhpal.
        </a>
        <div className="footer-contact">
          <p>Rashi Bhartiya Innovation LLP</p>
          <address>Gurugram-122001, Haryana, India</address>
          <a href="mailto:admin@mylekhpal.com">admin@mylekhpal.com</a>
          <a href="tel:+918178113449">+91 81781 13449</a>
        </div>
        <small>
          Foundation preview. AI and tax workings require professional review.
        </small>
      </footer>
    </main>
  );
}
