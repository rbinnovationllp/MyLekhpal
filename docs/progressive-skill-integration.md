# Progressive skill integration

MyLekhapal uses one controlled skill repository per service. The browser never receives a provider key, a prompt, a SKILL.md, private model metadata, or direct filesystem access.

## Runtime sequence

1. The business or personal-finance endpoint selects its own approved skill repository.
2. The model receives only the compact skill name, description and `/skills/.../SKILL.md` path, plus the relevant submitted context and runtime safety limits.
3. The first provider tool call is forced to `load_skill()`.
4. The complete, unmodified SKILL.md is returned as that tool result. The agent cannot return a draft before this occurs.
5. The model may request `list_references()` and `read_reference()`; a path outside that skill is rejected.
6. It returns a structured *draft*. MyLekhapal then performs access, account, balance, duplicate, period and persistence checks.

`list_skill_resources()` lists approved script/template resources but never provides shell or arbitrary filesystem access. The journal workbook script is available only to the isolated report-job worker; an Edge Function does not claim it executed the script.

## Skill separation

- Business Accounting: `/skills/my-journal-entry-preparation/SKILL.md`
- Personal Finance & Tax Support: `/skills/mylekhpal-personal-finance-tax-support/SKILL.md`

Each endpoint has only its own repository. A reference path is checked against that repository, so one service cannot load the other service's instructions or references.

## Private operational evidence

`private.skill_agent_runs` stores request ID, selected skill and path, whether `load_skill` ran, loaded reference paths, tool-call names, model, token counts and result status. It intentionally stores no raw document content, prompt, access token, refresh token or API key. This table has no browser/RLS policy.

## Auditable public metrics

- **Unique visitor:** an anonymous, rate-limited visitor identifier counted once per configured window after bot/internal-traffic filtering.
- **Registered business:** a non-test, non-deleted, non-suspended business that completed required onboarding.
- **Active subscribed business:** a registered business with a verified active subscription; trial, cancelled and failed-payment subscriptions are excluded.

## Verification limits

The source and deployed functions can be verified for the progressive-loading sequence. Functional-parity testing against the original hosted Claude skill still requires a valid authenticated MyLekhapal test user, a configured provider key, and comparable source documents. The browser-facing app must not expose the private diagnostic evidence.
