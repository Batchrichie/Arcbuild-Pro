# Joint work plan: database + codebase sync

## Roles
- Codebase lead: frontend, auth, routing, services, tests, UI behavior.
- Database lead: schema, migrations, RLS, functions, security hardening.
- Shared owner: issue triage, regression checks, deployment validation.

## Working rules
1. Every security or schema change must have a matching code-path update when relevant.
2. No database fix is considered done without verifying the app behavior that depends on it.
3. Changes are grouped by issue class and shipped in small, reviewable steps.
4. Each step must include: migration or code change, validation, and rollback note if needed.

## Current priority order
1. RLS cleanup and policy consolidation.
2. Security-definer function and search_path hardening.
3. Auth and role-flow consistency (login, invite, redirects, portal access).
4. Service-layer and UI alignment with the live schema.
5. Regression testing and deployment verification.

## Sync checkpoints
- After each issue group, compare: DB migration + app behavior + tests.
- Keep one shared checklist of completed and pending items.
