# NimChat Web — UX v2 parity and functional completeness

## Why
The web client remained a Slack/Discord-derived page while the Android client adopted a **conversation-first** NimChat UX. BRIAN workflows, approvals, polls, forms and checklists were mostly text fallbacks on the web. A redesign must preserve everyday chat: new conversations, DMs, invites, attachments, reactions and agent activity.

## What
- Room-owned **Mensagens | Superfícies** navigation. Routes: `/rooms/:roomId`, `/rooms/:roomId/surfaces`, `/rooms/:roomId/surfaces/:plugin/:instanceId`.
- Shared RoomProvider maintains history and one trusted BRIAN projection across nested routes.
- Timeline renders plain BRIAN blocks inline; stateful plugin blocks become a **compact link to the surface**, except `agent_status`, which stays inline and collapsible and consumes the latest trusted projected state.
- Surface list: pinned, active, recent and archived by room. Focus view: plugin renderer, pin/dismiss preference events, and link back to originating message.
- Plugin renderers: approval, workflow, checklist, poll, form_stateful and agent_status.
- Restored web operations: **Nova conversa** (DM or room), exact-username DM via `resolveUsername` + `getOrCreateDM`, invitation shortcut in room header, and acceptance of received invitations.
- NimChat colors, theme, Portuguese labels and contextual navigation instead of the previous Discord donor layout.
- Composer preserves text on failed sends. Attachments and reactions remain available.

## How
- No changes to Nimlet core, BRIAN schemas or Agent Blocks.
- The event store remains authoritative; BRIAN `project()` computes state using trusted publishers and monotonic revision numbers.
- Room ownership is maintained through URLs and `instanceKey(roomId, plugin, instanceId)`.
- `m.plugin.command` remains the only stateful action transport. Surface preferences use `m.ui.surface.preference.updated`.
- Web user discovery uses **exact usernames only**. A directory/partial search and resolving the other party's name in DMs require separate backend design.
- Unknown plugin or malformed blocks continue to use the supplied fallback text.
- App shell/sidebar and dialogs work on desktop and narrow screens.

## Functional validation
- [ ] Open an agent conversation; verify `agent_status` running → state updates → completed, including expandable activity.
- [ ] Agent creates workflow, approval, checklist, poll and form: each appears as a link in Messages and an interactive surface under the same conversation.
- [ ] Verify a publisher `m.plugin.state.updated` advances the renderer; lower or untrusted revisions do not override it.
- [ ] Approve/reject, checklist toggle, poll vote and form submit publish commands, and the UI renders updated snapshots.
- [ ] Pin/dismiss and terminal states correctly affect the corresponding room's list.
- [ ] Navigate origin ↔ focus view and confirm room-specific linking (same instance ID in different rooms cannot collide).
- [ ] Convidar in room header, accept invitation in sidebar, create a room, start DM by exact username, reopen existing DM.
- [ ] Invalid/self username and failed API requests show feedback, do not navigate to bogus rooms.
- [ ] Text, attachments, reactions, emoji, history pagination, /sync, login and responsive sidebar still operate normally.
- [ ] Keyboard navigation, touch targets and light/dark contrast reviewed in browser.

## Pre-merge checks
```sh
npm ci
npm test --workspace @nimchat/brian
npx tsc --noEmit --project apps/web/tsconfig.json
npm run build --workspace @nimchat/web
```

Use Node 22.18+ (Node 26 was used during fix validation). Run
`npm test --workspace @nimchat/web` for the membership, draft and command regressions.
The final validation report records the tested commit SHAs and remaining Android manual gate.

## Fixes after review

- `Layers` uses the icon exported by the current dependency, without upgrading the UI stack.
- The session owns one foreground membership refresh loop, every 15 seconds; returning to
  a visible page refreshes immediately. Manual refresh shares the same request. Old-session
  responses are ignored and confirmed joins survive stale list responses or refresh failures.
- The mobile home page exposes the existing conversation drawer. Navigation and new
  conversation actions close the drawer; keyboard navigation retains accessible focus.
- Forms keep a full draft initialized from saved values, including booleans, zero and
  empty strings. Unrelated snapshots update untouched fields; own correlated responses
  reconcile values/errors. Pending and terminal forms cannot submit new commands.
- Workflow steps use `title`; polls display `question` and cannot submit an empty vote.
- Commands persist per user and room/plugin/instance. HTTP acceptance records the event ID;
  only a valid trusted publisher response for that exact command confirms or rejects it.
  Retry after transport failure or 30 seconds without acknowledgement reuses the transaction
  and payload. A `refresh` response may legitimately retain its revision. Pending commands
  remain observable when focus is closed and are recovered after reload.

## Production browser regression suite

The web workspace includes 31 unit tests and a Playwright suite. Browser tests launch the
traced standalone server with the same asset layout used by the Dockerfile, not a dev server.
Install Chromium with `npx playwright install chromium` or set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to an existing compatible browser.

```sh
NEXT_PUBLIC_BRIAN_AGENT_IDS=review-agent \
NEXT_PUBLIC_BRIAN_PUBLISHER_IDS=review-publisher \
npm run build:release --workspace @nimchat/web

# Optional isolated Nimlet/Postgres/Redis integration; localhost is required.
NIMCHAT_TEST_BACKEND_URL=http://127.0.0.1:38086 \
npm run test:e2e --workspace @nimchat/web
```

The fifteen renderer/navigation regressions intercept API calls and never send fixtures to
production. The additional integration test uses two accounts on the explicitly supplied
local backend, covering registration/login, live invite/acceptance, room creation, DM/self/404,
sync, pagination, attachment upload/download and reactions. Without that local URL it is
explicitly skipped. Test publisher IDs are build-time fixtures: build deployment artifacts
with the real deployment's trusted IDs, as already required by the Dockerfile.

## Corrections after physical validation

Agent activity remains inline even when only a publisher snapshot is loaded. Completion and
expanded history survive reload; loading the original card avoids a duplicate recovered row.
An untrusted lookalike creation card cannot suppress a trusted report.

The invitation three-dot menu offers **Aceitar convite** and **Dispensar neste dispositivo**.
Dismissal is localStorage per account, explicitly explained and reversible with show/restore.
It never changes server membership or sends events; another device continues seeing the invite.
Persistence failure leaves the invitation visible and shows a retryable error.

`build:release` refuses missing `NEXT_PUBLIC_BRIAN_AGENT_IDS` or
`NEXT_PUBLIC_BRIAN_PUBLISHER_IDS`. Docker uses this command; ordinary development builds remain
available. The existing Radix dropdown's collection dependency is transpiled for Next 13's
production minifier. Browser regressions cover snapshot-only status, dismissal/reload/restore,
unchanged server membership and mobile keyboard/focus behavior against the production bundle.

## Follow-ups and limitations
1. **Backend DM participant identity**: `GET /rooms` does not currently include the peer's identity; existing DMs may appear as "Mensagem direta".
2. **Directory search**: no partial search endpoint exists. Do not suggest discovery beyond exact username.
3. **Invites**: the current endpoint supports acceptance but not server rejection; the user selected local dismissal with explicit device-only wording.
4. **Renderer maturity**: pending/idempotency and saved form values have automated regressions;
   live provider execution against the deployed Agent Blocks remains an integration follow-up.
5. **Read activity**: full per-surface unseen/update badges require persistent read state and cross-device semantics.
6. **Visual QA**: polish responsive density, message grouping and surface transitions after functional parity tests.
7. **Event origins**: deep-link seek is bounded to ten historical pages; empty histories and snapshots without creation card should degrade gracefully.

## Related
- Preserve `agent_status` inline by exception; never hide current agent work solely behind surfaces.
