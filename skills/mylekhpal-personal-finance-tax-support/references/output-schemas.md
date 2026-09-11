# Structured Output Schemas

Every structured output, regardless of mode, must include this common envelope, and must never include raw secrets or complete sensitive identifiers (mask account numbers to last 4 digits; never include PAN/Aadhaar in full; never include passwords/OTPs/PINs/CVVs under any field).

## Common envelope (include in every schema below)

```json
{
  "user_or_household_ref": "string (opaque backend ID, never PAN/Aadhaar)",
  "reporting_period": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "source_document_refs": ["string (backend document IDs)"],
  "assumptions": ["string"],
  "confidence_level": "high | medium | low",
  "missing_information": ["string"],
  "recommended_next_action": "string",
  "professional_review_required": true,
  "skill_version": "mylekhpal-personal-finance-tax-support v1.0.0",
  "generated_at": "ISO-8601 timestamp, IST"
}
```

## household_financial_profile

```json
{
  "...envelope": "...",
  "income_sources": [{ "label": "string", "monthly_amount": 0 }],
  "dependants": 0,
  "location": "string",
  "stated_priorities": ["string"]
}
```

## bank_account_and_statement_metadata

```json
{
  "...envelope": "...",
  "bank_name": "string",
  "account_label_masked": "string (e.g. 'XXXX1234')",
  "statement_period": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "opening_balance": 0,
  "closing_balance": 0
}
```

## normalized_transaction

```json
{
  "...envelope": "...",
  "date": "YYYY-MM-DD",
  "description": "string",
  "amount": 0,
  "direction": "credit | debit",
  "account_label_masked": "string",
  "is_internal_transfer": false,
  "possible_duplicate_of": "transaction_id | null"
}
```

## expense_categorization

```json
{
  "...envelope": "...",
  "transaction_id": "string",
  "category": "essential | contractual_unavoidable | important_adjustable | discretionary | unclassified",
  "user_confirmed": false,
  "confidence_level": "high | medium | low"
}
```

## monthly_budget

```json
{
  "...envelope": "...",
  "income_total": 0,
  "categories": [{ "name": "string", "limit": 0, "actual": 0, "is_over_limit": false }],
  "savings_capacity": 0,
  "roadmap": { "three_month": "string", "six_month": "string", "twelve_month": "string" }
}
```

## liability

```json
{
  "...envelope": "...",
  "type": "home_loan | personal_loan | vehicle_loan | education_loan | credit_card | other",
  "outstanding_principal": 0,
  "interest_rate_pct": 0,
  "monthly_payment": 0,
  "remaining_tenure_months": 0
}
```

## financial_goal

```json
{
  "...envelope": "...",
  "goal_type": "string",
  "present_cost": 0,
  "target_date": "YYYY-MM-DD",
  "inflation_assumption_pct": 0,
  "inflation_adjusted_cost": 0,
  "existing_amount": 0,
  "monthly_savings_required": 0,
  "funding_gap": 0
}
```

## retirement_projection

```json
{
  "...envelope": "...",
  "current_age": 0,
  "retirement_age": 0,
  "scenarios": {
    "conservative": { "corpus_required": 0, "monthly_savings_required": 0 },
    "balanced": { "corpus_required": 0, "monthly_savings_required": 0 },
    "stress_test": { "corpus_required": 0, "monthly_savings_required": 0 }
  },
  "medical_reserve_estimate": 0
}
```

## tax_service_intake

```json
{
  "...envelope": "...",
  "likely_service": "string (e.g. 'ITR-1 salaried')",
  "documents_checklist": [{ "name": "string", "received": false }],
  "estimated_complexity": "simple | moderate | complex",
  "consent_to_refer_given": false
}
```

## departmental_case_intake

```json
{
  "...envelope": "...",
  "notice_reference_number": "string",
  "issuing_authority": "string",
  "date_issued": "YYYY-MM-DD",
  "requested_action": "string",
  "apparent_deadline": "YYYY-MM-DD",
  "factual_summary": "string"
}
```

## missing_information_request

```json
{
  "...envelope": "...",
  "requested_items": ["string"],
  "reason": "string"
}
```

## professional_referral_request

```json
{
  "...envelope": "...",
  "professional_type": "Chartered Accountant | SEBI-Registered Investment Adviser | Legal Professional | Financial Counsellor",
  "case_summary": "string",
  "consent_scope": ["string (documents/data covered by consent)"],
  "client_approval_obtained": false
}
```

## risk_and_disclaimer_notice

```json
{
  "...envelope": "...",
  "disclaimer_text": "string",
  "applies_to_mode": "string"
}
```
