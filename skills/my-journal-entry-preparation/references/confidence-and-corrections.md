# Confidence Scoring, Clarification, and Corrections

## Confidence levels

Give each entry a single overall confidence rating (High / Medium / Low) for the `confidence`
field — this is what colors the Journal Register row and feeds the Dashboard's "Low-Confidence
AI Entries" count. Then, for anything not High, add a `confidence_details` entry (field, level,
reason) so the Entry Details sheet can show *why*. Common reasons to downgrade:

- Blurred, cropped, or low-resolution document image
- Handwritten invoice or annotation
- Invoice line items that don't sum to the stated total
- Vendor/customer not previously seen in this conversation and not otherwise identifiable
- Missing tax registration number where one would be expected
- Ambiguous expense category (could plausibly map to more than one account)
- More than one plausible ledger account with no clear tie-breaker
- Missing service/delivery date needed to pick the right accounting period
- Uncertain tax treatment (rate, exemption, reverse charge applicability)
- Possible duplicate of another entry in the conversation

## When to ask instead of guessing

Ask a focused clarifying question — rather than completing the draft with an assumption —
whenever the missing information would change which accounts are used, whether the entry
balances, or the tax treatment. It's fine to complete a draft with a clearly labeled
assumption for minor things (e.g., defaulting posting date to transaction date when the user
didn't specify one) as long as the assumption is stated, not silent.

**Never invent:** invoice numbers, tax IDs, dates, party names, account codes, tax rates, FX
rates, approval evidence, or the existence of a supporting document. If it's not given and you
can't derive it, say it's missing.

## Corrections to a draft already shown to the user

If the user asks you to change a draft you already presented:

- Don't just silently overwrite the numbers and re-send the file. Say plainly what changed
  and why (e.g., "Updated the tax rate from 18% to 12% per your correction — this changes the
  Input GST line from ₹1,800 to ₹1,200 and the Accounts Payable total accordingly").
- If the *original* draft was already treated as final by the user (e.g., they said they
  posted it), don't just edit it — treat the change as a correcting/reversal entry instead,
  consistent with real accounting practice, and explain that distinction if it's relevant.
- Keep the old figures visible in your response (a short "before → after") rather than only
  showing the new state, so the user can see what moved.

## Rebuilding the workbook after a correction

Re-run `scripts/build_journal_entry.py` with the corrected JSON rather than hand-editing the
`.xlsx` — this keeps the SUMIF/balance-check formulas, hyperlinks between sheets, and the
Dashboard's live KPI formulas intact. Add an entry to that entry's `change_history` list
describing what changed rather than just quietly updating the figures. Re-run `recalc.py`
afterward, same as for the first build, and re-check that no formula errors were introduced.

If you're only correcting one or two entries out of a large batch, still regenerate the whole
JSON/workbook rather than trying to patch the `.xlsx` directly — the sheets are linked by row
position and formula, and hand-editing risks breaking those links.
