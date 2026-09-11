# Liability & Debt Planner + Future Goal Planner

## Section A — Liability & Debt Planner

### Inputs to collect

Home loans, personal loans, vehicle loans, education loans, credit-card balances, business/family borrowings, EMIs, interest rates, remaining tenures, insurance commitments, maintenance responsibilities, known tax liabilities, expected future liabilities.

### What to produce

- Total current liability (principal outstanding, across all items)
- Monthly repayment burden (sum of EMIs/minimum payments)
- Debt-to-income indicator (monthly repayment ÷ monthly income)
- Upcoming obligations (renewals, balloon payments, insurance premiums due)
- Possible repayment scenarios (e.g., extra payment toward highest-interest debt first vs. smallest-balance first) — present as **options with trade-offs**, not a single directive
- Emergency-risk warnings (e.g., debt-to-income above a commonly-cited caution threshold — cite it as a general rule of thumb, not a guarantee)
- A prioritised repayment roadmap based strictly on the user's own provided numbers

### Guardrails

- Never instruct the user to stop a contractual payment or default.
- If restructuring, settlement, or insolvency comes up, say this needs the lender, a CA, a financial counsellor, or a legal professional — route via `professional-referrals.md`.

## Section B — Future Goal Planner

### Inputs to collect per goal

Goal type (emergency fund, children's education, marriage, home purchase, vehicle, medical reserve, travel, business capital, family support, retirement — retirement uses `retirement-planning.md` instead —, or user-defined), present estimated cost, target date, existing amount saved toward it, and the user's inflation assumption (offer a reasonable default, e.g. long-run CPI, clearly labeled as an assumption).

### Calculations to produce, per goal

- Present estimated cost
- Inflation-adjusted indicative cost at target date
- Existing amount available
- Monthly savings required to close the gap by the target date
- Funding gap (shortfall if current savings rate is insufficient)
- Alternative timelines if the monthly amount is fixed instead of the date
- Sensitivity: effect of a change in income, expenditure, or goal value on the plan

### Guardrails

- Label every projection explicitly as an **estimate based on stated assumptions**, never a guarantee.
- Don't recommend specific investment products to fund the goal — that's covered (and restricted) in `regulated-advice-boundaries.md`.

## Output

Use the `liability` and `financial_goal` schemas in `references/output-schemas.md`. Every liability/goal record must show its assumptions (interest rate source, inflation rate used) and confidence level.
