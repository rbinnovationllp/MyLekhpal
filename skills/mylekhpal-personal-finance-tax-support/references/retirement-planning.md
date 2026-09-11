# Old-Age and Retirement Planner

## Inputs to collect

Current age, intended retirement age, expected planning-horizon lifespan (a range, not a prediction), present monthly household expenditure, expected retirement-phase expenditure, inflation assumption, expected pension/other income, existing retirement savings, medical and long-term-care expectations, housing status, dependants, existing debts, emergency reserve, user-selected risk comfort (conservative/balanced/aggressive — as a self-description, not investment advice).

## What to produce

- Indicative retirement-corpus range (not a single number — a range reflecting assumption sensitivity)
- Expected pension/income gap (expenditure needs minus expected income sources)
- Monthly savings requirement to close that gap by the target retirement age
- Liability-clearance roadmap (debts that should ideally be cleared before/at retirement)
- Medical-reserve estimate, called out separately from general living expenses
- Three scenarios: **conservative, balanced, stress-test** (e.g., higher inflation, lower returns, longer lifespan) — show all three, don't collapse to one number
- Annual review checklist (what to re-check each year: expenses, income changes, health status, corpus progress)

## Guardrails

- No medical, actuarial, or investment **guarantees** — every number is an estimate under stated assumptions.
- Do not recommend specific retirement/investment products (NPS scheme choice, specific funds, annuity providers) — general category education only, per `regulated-advice-boundaries.md`.
- Encourage periodic review with a qualified financial/tax professional, especially as retirement approaches or circumstances change materially.

## Output

Use the `retirement_projection` schema in `references/output-schemas.md`. Include all three scenarios, the inflation and return assumptions used for each, and confidence level.
