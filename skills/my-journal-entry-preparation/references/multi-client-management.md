# Multi-Client and Multi-Company Management

For Chartered Accountants, accounting firms, bookkeepers, and consultants managing more than
one client's books. Single-business users can ignore all of this — just omit `client` entirely
and the skill behaves exactly as single-company mode.

## Core design: one workbook = one client's workspace

Rather than trying to police access control inside a single file (which Claude can't actually
enforce — see the honesty note below), **each client gets their own workbook**. This gives real
separation for free: nothing from Client A can leak into Client B's file because they're
physically different files. `scripts/build_journal_entry.py` supports this directly:

- **Single-client mode**: input JSON has `entries`/`exceptions`/`source_documents` at the top
  level, plus an optional `client` object. Output is one `.xlsx`.
- **Multi-client mode**: input JSON has a top-level `clients` list, where each item is
  `{"client": {...}, "entries": [...], "exceptions": [...], "source_documents": [...]}`. Run
  with `--output` pointing at a **directory**, not a file — the script writes one workbook per
  client (`{client_id}_journal_entries.xlsx`) plus a `portfolio_dashboard.xlsx` summarizing all
  of them.

## Before doing anything: confirm the client

Don't create, import, review, approve, or otherwise act on an entry until you know which client
it belongs to. If it's not obvious from the conversation:

> "Which client or company should this journal entry be prepared for?"

If two clients have similar names, ask using disambiguating detail (Client ID, GSTIN/PAN,
branch, financial year) rather than guessing. Once established, keep using that client for the
rest of the conversation unless the user says otherwise — don't re-ask on every message, but do
re-confirm if the user's phrasing suggests they've switched clients without saying so
explicitly.

## The `client` object

```
{
  "client_id": "CLI-0001",
  "legal_name": "ABC Private Limited",
  "trade_name": "",
  "entity_type": "Private Limited Company",
  "financial_year": "2026-27",
  "accounting_framework": "Ind AS",
  "base_currency": "INR",
  "country": "India",
  "jurisdiction": "India",
  "registration_ids": {"PAN": "ABCDE1234F", "GSTIN": "27ABCDE1234F1Z5"},
  "branches": ["HQ - Mumbai", "Branch - Pune"],
  "chart_of_accounts_note": "Firm-standard COA v3",
  "tax_configuration_note": "GST monthly filer",
  "approval_workflow_note": "Two-level: Manager then Partner",
  "authorized_users": ["J. Rao (Preparer)", "P. Shah (Approver)"],
  "document_storage_note": "Firm DMS, /Clients/CLI-0001/",
  "journal_numbering_prefix": "CLI-0001-JE-2026-"
}
```

Every field is optional except `client_id` and `legal_name` — fill in what the user has told
you and leave the rest blank rather than inventing values.

When a `client` is supplied, the generated workbook automatically gets:

- A **Client Info** cover sheet (opens first) with all the client details — the workbook's
  version of "confirm the correct client before doing anything else."
- An **"Active Client: CLI-0001 — ABC Private Limited"** banner on every other sheet (Dashboard,
  Journal Register, Journal Lines, Entry Details, Source Documents, Exceptions, Approval
  Status) — so the active client is never ambiguous no matter which tab is open.

## Entry ID convention

Prefix entry IDs with the client ID and year, e.g. `CLI-0001-JE-2026-00001`. This keeps entries
globally unique even if you later merge exports from multiple clients into one place for
review, and makes it immediately obvious which client an entry ID belongs to.

## Wrong-client detection

If something in an uploaded document doesn't match the selected client — a different GSTIN,
legal name, address, or bank account than what's in the `client` object — stop and flag it
rather than processing it automatically:

- Add an Exceptions row: `exception_type: "Possible Wrong-Client Document"`, `risk_level:
  "High"`, with the specific mismatch in the description (e.g., "Invoice GSTIN
  07XYZAB5678K1Z2 does not match client's registered GSTIN 27ABCDE1234F1Z5").
- Ask the user to confirm which client the document actually belongs to before drafting an
  entry from it.
- If they confirm a reassignment, note that in `change_history` so it's traceable.

## Multi-client spreadsheet imports

If a single uploaded spreadsheet contains rows for multiple clients (a `client_id` column),
don't guess a default client for blank/invalid IDs — treat those rows as validation failures
needing clarification. Validate every `client_id` against a client the user has actually told
you about, split the transactions client-wise, and apply each client's own chart of accounts,
tax configuration, and approval policy to its rows — never one client's mapping to another's
transactions. Give the user a client-wise summary of what converted, what didn't, and why.

## Portfolio-level view

`build_portfolio_dashboard()` produces a summarized, per-client KPI table (total entries,
debit/credit, status counts, unbalanced/duplicate/missing-doc/tax-review/low-confidence counts)
computed directly from each client's data at build time — not live cross-file formulas, which
are fragile once files get renamed or moved. Make clear to the user that this file is a
summary for firm-level oversight, not a substitute for opening the individual client workbook,
and that they're responsible for only sharing it with people authorized to see cross-client
data.

## What Claude genuinely can't do here — be upfront about it

The full specification this is based on describes real role-based access control (different
permissions per user per client), a persistent multi-user approval workflow, and an
application with login/session state. Claude, generating files in a single conversation,
cannot:

- Enforce that only authorized users can open or edit a client's workbook — anyone with the
  file can open it, same as any spreadsheet.
- Track *which human* is currently looking at the file or restrict what they can do — Excel's
  own sheet/workbook protection can raise friction (and the skill can apply basic protection if
  asked) but that's not real access control.
- Maintain "the same person is Approver for Client A and read-only for Client B" as an enforced
  system — that's a real-world permissions matrix the user's own systems need to own.

Say this plainly rather than implying the workbook enforces permissions it doesn't. The
value this skill actually delivers is correct, well-separated, audit-ready draft data per
client — the access-control layer has to live in wherever the user actually stores and shares
these files (their DMS, their firm's file permissions, etc.).
