# Package notes

This package was built from the MyLekhapal Personal Finance & Tax Support specification. The specification previously existed as a build brief; this package provides the actual `SKILL.md`, `references/`, and `agents/` files.

## Package structure

```text
mylekhpal-personal-finance-tax-support/
├── SKILL.md
├── agents/
│   └── openai.yaml
└── references/
    ├── household-budgeting.md
    ├── bank-statement-analysis.md
    ├── liabilities-and-goals.md
    ├── retirement-planning.md
    ├── tax-service-intake.md
    ├── professional-referrals.md
    ├── regulated-advice-boundaries.md
    └── output-schemas.md
```

## Integration notes

- `SKILL.md` uses progressive disclosure: it routes a request to the relevant reference file instead of loading all references for every request.
- The guardrails are part of the skill: do not collect OTPs, passwords, PINs or CVVs; do not file or submit returns; do not provide specific investment recommendations; preserve household isolation; produce drafts rather than actions.
- `agents/openai.yaml` documents the function/tool mapping for compatible non-Claude agent runtimes. A Claude-based runtime uses `SKILL.md` and the matching `references/` files directly.
- This package does not itself provide application authentication, consent, payments, document storage, professional verification/assignment, audit logs or user-interface workflows. Those functions remain the responsibility of the MyLekhapal application backend.

This note is descriptive only. It does not alter the skill instructions or any supporting reference file.
