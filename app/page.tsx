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
          <a className="button" href="/workspace">
            Open your workspace <ArrowUpRight size={18} />
          </a>
        </div>
        <div className="collab">
          <div>
            <span className="avatar">BO</span>
            <b>Business owner</b>
            <small>Capture records · Answer queries</small>
          </div>
          <span className="connection">Shared records · Clear review</span>
          <div>
            <span className="avatar blue">CA</span>
            <b>Chartered Accountant</b>
            <small>Review entries · Prepare compliance</small>
          </div>
        </div>
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
