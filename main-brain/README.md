# Web app and shared backend — Main Brain

Last consolidated: 2026-11-09. Local source/configuration reviewed; historical test and hosted observations are dated below. This documentation pass did not rerun application tests or inspect live services.

## Start here

This is the authoritative documentation entry point for this app. Source/configuration establish implementation; dated tests establish only what was tested; hosted observations establish only what was observed on that date. Requirements and historical plans are not completion evidence.

- [CURRENT STATE](CURRENT-STATE.md)
- [ARCHITECTURE](ARCHITECTURE.md)
- [TECH STACK](TECH-STACK.md)
- [WORKFLOWS](WORKFLOWS.md)
- [CHANGELOG](CHANGELOG.md)
- [ROADMAP](ROADMAP.md)
- [DECISIONS](DECISIONS.md)
- [Historical archive](archive/README.md)

## Shared ownership

The [web/backend architecture](../../C50-Project/main-brain/ARCHITECTURE.md) owns shared API, authentication, payment, database and storage contracts. [Web](../../C50-Project/main-brain/README.md), [Mobile](../../c50-mobile/main-brain/README.md), and [Admin](../../admin-panel/main-brain/README.md) own their client behavior and release evidence.

## Maintenance

1. Read CURRENT-STATE and ROADMAP before work, then the relevant architecture/workflow.
2. Update affected current documents after meaningful code/configuration changes. Record declared dependency ranges separately from installed/locked versions.
3. Append a dated CHANGELOG entry with change, rationale, validation, deployment/build outcome and unresolved work. Do not rewrite old entries as if later evidence existed then.
4. Update ROADMAP acceptance criteria and status; keep implemented, tested, deployed/built and device-verified separate.
5. Update shared contracts once in Web, then update affected client links/behavior. Keep specialist runbooks linked and synchronized.
6. Store configuration names only. Never record passwords, key values, access/refresh tokens, signed recovery links or sensitive payloads.
7. If evidence conflicts, inspect source or obtain dated verification; explicitly mark uncertainty. Do not silently promote old claims to current facts.

Archives are immutable history except credential redaction and necessary corrections clearly annotated with a date. Maintaining these files requires a developer/agent update; no background synchronization service exists.

## Latest feature — 2026-11-12

Test Series catalog synchronization is implemented and the Supabase changes are applied. See [current evidence](CURRENT-STATE.md), [shared/client architecture](ARCHITECTURE.md) and [workflow](WORKFLOWS.md). Hosted application deployment and updated Android APK/device verification remain outstanding.

## Latest session update — 2026-11-13

Session validation and logout privacy changes are implemented locally. See [current evidence](CURRENT-STATE.md) and [remaining release checks](ROADMAP.md); no deployment or new APK is implied.
