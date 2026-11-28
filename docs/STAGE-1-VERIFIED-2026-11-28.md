# StudyFlow — Stage 1 Stability Record
Date: 2026-11-28
Environment: Railway preview only
Verified preview commit before this record: `a05ba29b3d5345939c7a498e134d2f8eeee1103d`
Backup branch: `checkpoint/studyflow-stage1-verified-2026-11-28`

## Scope completed

- Consolidated the app's legacy theme overrides behind `overrides/client/src/design-quality.css` and imported it last from `main.tsx`.
- Standardized the shell, navigation, surface hierarchy, typography, forms, controls, dialogs, status colors, light/dark tokens and mobile dock.
- Reconciled auth-screen legacy `!important` colors so the login card, active tab, brand mark and submit action follow the current dark wine/gold identity.
- Completed page-specific styles for the home AI decision panel, curriculum map hero, task overview, session-finish dialog, and functional operations workspace (including its 3D scene shell, layer controls, forms, tasks, goals, schedule, learning and metrics).
- Extended `scripts/visual-qa.cjs` to exercise actual loaded CSS against responsive specimens and login/registration states across mobile (390x844), tablet (768x1024) and desktop (1440x960).
- Preserved the preview branch's richer planner engine, structured study-method/subtask model, teacher scheduling, progress-state reconciliation, persistent daily plan lifecycle, and existing data integrations.

## Verification evidence

Workflow: https://github.com/omarabdobltagy-svg/studyflow-platform/actions/runs/46122752460

- TypeScript check: passed.
- Production build: passed.
- Additive database migrations on isolated CI MySQL: passed.
- Unit tests: 45 files, 287 tests passed.
- Chromium responsive visual QA: 21 checks passed (7 checks across 3 viewports).
- Screenshot artifact: `studyflow-responsive-visual-qa`, artifact id `15254555932`.
- Railway preview deployment: `bd4a7871-4563-4f54-9a30-4e315aa4b421`, status SUCCESS; service was Online, one replica running, zero critical or warning issues at verification.
- Production `main` and the production Railway service were not changed by these design commits.

## Planner reconciliation with main

The three main-only commits were reviewed individually. Their important annual-plan invariant is already implemented more comprehensively on the preview branch:

- `buildPlannerProgressSnapshot` derives completed and eligible curriculum nodes from branch-aware frontiers, explicit learning states and completed SQ3R records.
- `applyPlannerProgressGuard` blocks curriculum tasks already confirmed as studied.
- `applyPlannerCurriculumCoverageGuard` ensures all eligible annual curriculum checkpoints are represented once, drops stale/ineligible node IDs, and excludes completed lessons.
- Existing tests in `overrides/server/planGenerator.test.ts` cover branch-level progress, explicit study states, curriculum coverage and uniqueness of official programming checkpoint IDs.
- The preview UI uses richer structured `PlanStep` data (curriculum node IDs, study-method stages, structured review subtasks, priorities, schedule states, resource evidence and quality checks); the main-only string-subtask implementation must not replace it.
- The violet CSS from the main-only planner commit is intentionally not ported; the verified preview design system owns visual styling.

A two-parent ancestry reconciliation commit will record `main` as merged history while retaining the verified preview tree. This is a merge into the preview branch only; it does not merge the PR into production.

## Data and rollout guardrails

- No production database reset, drop, recreation or destructive migration was performed.
- Keep Railway production attached to `main`; stage 2 is preview-branch only until separately verified and explicitly promoted.
- Never convert unverified manual backlog counts into fabricated lesson IDs or assignments.
- Never mark a lesson complete without a recorded student action or authorized source.
- Preserve teacher obligations, explicit student learning state, curriculum branch identities, source provenance and existing student records.
- Distinguish completion from mastery; avoid unsupported progress scores and false AI claims.
- Keep provider/API secrets server-side; do not place them in client bundles or commits.

## Stage 2 starting point

Use the current verified preview tree as the baseline. Audit and extend the existing implementation before replacing anything. In particular, inspect:

- Student/context model and identity/permissions.
- `server/plannerEngine.ts`, `server/planGenerator.ts`, `server/plannerMemory.ts`, `server/planLifecycle.ts`, `server/proactiveTaskReconciliation.ts`.
- Curriculum catalogue and learning progress state helpers in `shared/sie-catalog.ts` and `shared/sie-learning-progress.ts`.
- The existing assistant, AI activity trace, CurriculumMap, Study, Planner, Tasks, and WorkspaceInteractionHub modules.
- Existing database schema, migrations, source integrations, and test fixtures.

Architectural target: bounded Student Intelligence, Curriculum Intelligence, Adaptive Planning, Progress Intelligence and Assistant capabilities behind explicit domain contracts, provenance-aware facts, student-controlled state changes, deterministic policy checks, durable jobs/memory, and inspectable evaluation. Implement as cohesive vertical slices, not as a speculative rewrite or unconnected agent labels.
