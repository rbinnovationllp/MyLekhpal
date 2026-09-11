# Household Budget Planner

## Inputs to collect (in small groups, skip what's already known)

- Monthly/annual income from all sources (salary, business, rent received, freelance, other)
- Fixed expenses: rent/home-loan EMI, school fees, insurance premiums, SIPs/RDs
- Variable expenses: groceries, utilities, transport, eating out, lifestyle
- Essential vs non-essential split (ask the user to tag ambiguous items rather than assuming)
- Dependants and family responsibilities (count and any special needs — medical, education)
- Existing savings and emergency-fund balance
- Seasonal/irregular expenses (festivals, annual insurance, school admission fees)
- User-defined spending limits per category, if any

## What to produce

- **Monthly household budget**: income, category-wise allocation, savings target
- **Category-wise limits**: derived from user input or, if absent, reasonable defaults clearly marked as suggestions
- **Actual-vs-budget comparison**: only once real transaction data exists (see `bank-statement-analysis.md`)
- **Savings capacity**: income minus committed and planned expenses
- **Overspending alerts**: category over its limit, with the amount and % over — factual, not judgmental
- **Expense-reduction opportunities**: practical, specific, tied to the user's own discretionary categories — never blanket "cut all fun spending" advice
- **Roadmap**: 3-month, 6-month, 12-month view showing how the budget evolves (e.g., emergency fund building, debt paydown milestones)

## Behavioural guardrails

- Never state a discretionary expense was "wrong" — at most, "this is above your stated budget for X by ₹Y."
- Take family size, location, medical needs, and stated priorities into account before suggesting a cut.
- If income is irregular (freelance/business), use a trailing average and say so explicitly.
- If the user hasn't set limits, propose defaults (e.g., 50/30/20-style split) but label them clearly as **suggested, not fact**.

## Output

Use the `monthly_budget` schema in `references/output-schemas.md`. Always include: reporting period, assumptions used for any suggested limits, and whether the budget is based on user-declared figures or extracted transactions.
