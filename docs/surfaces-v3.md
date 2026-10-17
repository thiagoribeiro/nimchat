# NimChat surfaces v3

Server side: [agent-blocks](https://github.com/thiagoribeiro/agent-blocks) (see its `docs/surfaces-v3.md`).
Base: `master` 71821d3, including merged Android/Web UX v2 repairs. Nimlet and the BRIAN specification, including copied canonical schemas/catalog, stay unchanged.

## User behavior

- Main tabs: Conversas and Compartilhadas. Reserved private rooms `#shared-surface:<UUID>#` are never presented as conversations; accepted surfaces open directly in focus. Their name classifies navigation, not authorization. A validated, trusted plugin binding is required to render the object.
- Personal surfaces remain under each conversation. Checklist and monthly bills support transfer; the original becomes a read-only historical shortcut. Old links navigate to the destination only when membership is joined. Approval and running workflow instances cannot be moved.
- The source selector offers existing conversations integrated with Brian. The administrative adapter verifies that the publisher and bot already participate; it never adds service access to a human-only conversation.
- Sharing includes all joined humans from the origin and additional selected usernames. This is a one-time snapshot, not ongoing room-membership mirroring. The initiator joins; others accept normal invitations. Only the owner manages access/transfers/archive; invited editors can edit/rename.
- Shared focus includes recent Brian responses and real activity, plus Pedir ao Brian. All requests and commands use the technical room's own context. Shortcuts do not execute commands in another room.
- `@` selection stores schema-valid `reference` blocks in message metadata (`surface_references`) while keeping `m.room.message` text readable. Identity is independent of title. Ordinary references render only as navigation and never authorize a read/command.
- A waiting agent activity offers Responder a esta solicitação. The composer visibly identifies the selected target and sends `metadata.continuation_of`. Only the corresponding final producer result completes the parent wait. Unrelated text, partial answers and forms do not silently close it.
- Creation dates come from the original UI event and remain separate from activity. The plugin preserves the original timestamp through transfer. Missing origins show unavailable and can be paginated.

## Durable interaction

`packages/sdk` owns the queue and store adapters; `packages/brian` supplies overlays and projection. Android/Web use the same queue. Intent is saved before delivery, with stable transaction ID and immutable payload. The queue serializes per instance, overlays per field/item, and allows rapid checklist toggles. Transport acceptance never clears pending state. Only an authoritative correlated result does.

Offline/timeout retains uncertainty and retry uses the same ID. Definitive transport or plugin rejection removes only its overlay. Publisher identity, room, plugin, instance and command event must match; an unrelated revision is not an acknowledgement. Account/server/namespace scope isolates storage. Legacy default-deployment pending commands are imported without assigning new transaction IDs.

A complete paginated membership refresh revokes room caches, drafts and pending commands. A confirmed join is a partial upsert and must not erase other rooms. Late sync/history for revoked rooms is ignored. Invitations keep the existing reversible device-local dismissal.

## Monthly bills

Application-owned renderer validation adds `monthly_bills` without editing spec schemas. Values are safe integer BRL cents. Suggested values are explicitly distinct from confirmed values/payments. Payment uses a human confirmation control and is not a delegable agent command. Timezone defaults to America/Sao_Paulo; months materialize on access/command, day 31 clamps to month end, historical entries survive recurrence edits/archive, and new months use the most recent preceding confirmed value with its source period. There is no bank integration or autonomous payment.

## Build and release

Runtime and connector support must be deployed before enabling new client controls. See the Agent Blocks companion `docs/surfaces-v3.md` for isolated administration, migration and recovery instructions. Keep the existing public trust UUIDs and app/signing identity.

Build-time flags, default off for new sharing/monthly controls:

- Web: `NEXT_PUBLIC_BRIAN_SHARING_ENABLED=true`, `NEXT_PUBLIC_BRIAN_MONTHLY_BILLS_ENABLED=true`.
- Android: `EXPO_PUBLIC_BRIAN_SHARING_ENABLED=true`, `EXPO_PUBLIC_BRIAN_MONTHLY_BILLS_ENABLED=true`.
- Optional rename kill switch: `*_BRIAN_SURFACE_NAMES_ENABLED=false` with matching runtime setting.
- Cache namespace: `*_NIMLET_NAMESPACE`, default `default`; server scope uses the existing public backend URL.

Rollback controls first. Shared navigation and moved-source rejection must stay available; do not replace the runtime with a version that ignores tombstones. Shared state has one operational room and is never restored by merging two copies.

Validation: tests for BRIAN/projector, SDK queue races and storage, Web/Android unit regressions, TypeScript, release Web build, Android export/APK, browser tests, plus the real three-account Nimlet/plugin integration in Agent Blocks. The browser suite includes responsive shared focus, metadata references, optimistic toggles, payment confirmation and revocation. Physical Android interaction/production deployment remain release validation, separate from local builds.
