# NimChat UX v2 — Functional completeness

**Status:** Implementation note and manual regression plan. This change restores product operations missing from the mobile UX v2 experience; it does not redesign the conversation/surface model.

## Why

The UX v2 correctly made **Conversations → Messages / Surfaces → Focus** the main navigation, but it accidentally degraded everyday messaging and agent-observability tasks. A conversation-first product must let users **find people, start a direct conversation, invite others, accept invitations, and monitor agent work** without reverse-engineering hidden routes or losing information.

The redesign must change **where** functionality lives, not whether it exists.

## What changed

1. **Live agent status:** the compact inline `agent_status` activity component reads the latest trusted projected BRIAN block, not the original `m.ui.message` snapshot. The projection is passed from the room-level messages component into memoized timeline rows so changes to `m.plugin.state.updated` refresh the displayed status.
2. **Invite affordance in the conversation:** joined non-DM rooms expose “Convidar pessoa” in the room header, linking to the existing invitation screen. The pre-existing invite shortcut in the conversation list remains available.
3. **New conversation choices:** the main “Nova conversa” action opens a choice between **Mensagem direta** and **Criar sala**. Creating a room still uses the existing flow, preserving the new visual structure.
4. **DM initiation:** the new “Mensagem direta” screen resolves an **exact** username using `GET /users/by-username/{username}`, rejects self-DM, then calls `POST /dm/{userId}` and opens/creates that room. Nothing assumes a non-existent directory-search API.
5. **Incoming invitations:** rooms whose membership has `state: "invite"` get a dedicated “Convites recebidos” area with a three-dot menu: Accept (`POST /rooms/{roomId}/join`) or **Dispensar neste dispositivo**. A confirmed join opens immediately; refresh follows in the background. Local dismissal is explicitly reversible and does not change server membership.
6. **Language polish:** old English labels on the create-room/invite screens are updated to Portuguese.

## How / architecture

- All changes stay in **`apps/mobile`**; no changes to Nimlet, BRIAN event schemas, Agent Blocks, auth, or room permissions.
- `agent_status` remains a deliberate exception to full-surface references: it is concise and belongs in the timeline. Other stateful plugins continue to use **references** in Messages and **focus views** in Surfaces.
- The source of truth for status is the BRIAN projector over trusted `m.ui.message` and `m.plugin.state.updated` events; never update a status from untrusted senders or regress revision.
- A direct message remains a room owned by Nimlet. The client uses existing username resolution and DM endpoints.
- Invitations are visible before membership becomes `join`. A joined room is only opened after server confirmation; errors are actionable and local.
- User discovery is **exact-match only** until a properly authorized, namespace-scoped partial lookup API is designed.

## Validation matrix (manual, on Android)

- [ ] Open a room with an agent. Send a request generating `agent_status`; confirm running text/history evolves through at least two `m.plugin.state.updated` revisions, ends at completed/failed and remains expand/collapsible without duplicate timeline posts.
- [ ] Enter any joined group room → tap header “Convidar pessoa” → invite existing username → confirm success; invalid username produces clear feedback.
- [ ] Conversation list → Nova conversa → Mensagem direta → exact username → opens DM. Repeat: opens same room, no duplicate. Self and unknown users are rejected.
- [ ] Conversation list → Nova conversa → Criar sala → room creation behaves as before.
- [ ] Account B receives invite from A. B sees “Convites recebidos” and can accept; conversation is then present in joined list and can be opened. A failed acceptance shows error; invite is not silently hidden.
- [ ] Three-dot invitation menu → Dispensar neste dispositivo → refresh/restart: remains hidden locally. Show dismissed invitations → Restaurar convite: visible again; membership is still invite and other devices are unaffected.
- [ ] Messages → Surfaces → Focus → back → Messages still works and the surface remains tied to the originating room.
- [ ] Text, attachments, reactions, composer, pending messages and push notifications still work.
- [ ] Keyboard and accessibility labels on Android are usable at 320dp width and with large font settings.
- [ ] No regression from room_seq/cursor opaco introduced by Nimlet #9.

## CI commands to run before merging

```sh
npm test --workspace @nimchat/brian
npx tsc --noEmit --project apps/mobile/tsconfig.json
npx tsc --noEmit --project apps/web/tsconfig.json
cd apps/mobile && npx expo export --platform android
```

Use Node 22.18+ (Node 26 was used during the fix validation). Also run
`npm test --workspace @nimchat/mobile` for the session/invitation regressions.
The final validation report records results and commit SHAs; the Android manual matrix
above must be completed separately before declaring the PR ready.

## Invitation refresh after review

- The session provider owns one membership refresh controller: initial load, every 15 seconds
  while foregrounded, app resume and conversation-list focus. Pull-to-refresh and error retry
  reuse that controller; additional screens do not create additional polling loops.
- Concurrent refreshes share one request. Logout/disposal prevents an old response from
  hydrating another session. Backgrounding stops the membership polling timer.
- A confirmed join immediately updates the local membership and opens the room. A list
  request started before that join cannot revert it to `invite`; a later list failure
  does not turn a successful acceptance into an error.
- No endpoints or event schemas change. `/sync` continues to deliver events; memberships
  are refreshed through the existing room-list endpoint.
- Seventeen unit regressions cover polling, pause/resume, concurrent requests, late responses,
  failed refresh, acceptance failure, confirmed-join races, snapshot-only agent activity,
  forged creation cards, local dismissal/reload/isolation/storage failure and release configuration.

## Corrections after physical validation

The first fix APK was incorrectly built without the existing public trust IDs. The live server
continued publishing valid `agent_status` snapshots, but the client could not trust/render them.
Release builds now use `npm run build:release --workspace @nimchat/mobile`, which fails
before Gradle if either `EXPO_PUBLIC_BRIAN_AGENT_IDS` or `EXPO_PUBLIC_BRIAN_PUBLISHER_IDS` is absent.
Use JDK 21 and the standard signing configuration. The script forces the JS bundle task only,
because Gradle otherwise does not track changes to those Expo build-time variables.

The timeline also recovers inline status/history from a validated publisher snapshot when the
original creation card is outside the loaded history. Loading the original card replaces the
recovered row; untrusted lookalike cards cannot hide it. The real event ID remains the origin.

Local invite dismissal is stored by account in the app's private document storage. The menu
explains that the invitation remains active on the server and on other devices; a separate
show/restore action reverses dismissal. It never joins, leaves or sends a rejection event.

The release APK keeps the existing application ID, signing configuration, backend URL and
Firebase integration. Installation on the personal phone is a separately agreed manual
validation step; no QA application is installed or opened automatically.

## Known limits / separate follow-ups

- **Identity for DMs:** Nimlet's room listing currently returns generic room metadata (often name `direct`), not the other user's profile. A later API/data enhancement is needed for human-readable DM names and avatars across devices.
- **Partial people search:** Nimlet only offers exact username lookup. Autocomplete, contacts and discovery require explicit namespace-scoped API and privacy controls. Do not imply a broad directory search exists.
- **Declining invitations:** no server decline/reject endpoint exists. The user selected reversible local dismissal, labeled as such; it is not a server rejection.
- **Web parity:** web hasn't received the Android UX v2 restructuring. The restored functionality in this PR is the Android client only; web should be audited and brought to parity as a follow-up.
- **Server pagination:** `listRooms` may return a `next` cursor; robust pagination/infinite loading in the SDK remains separate.
- **Trust configuration:** approved publisher/agent IDs must still be configured correctly; this UI fix cannot substitute for trusted state updates.

## Changed files

- `apps/mobile/src/components/chat/{chat-messages,chat-item,room-header}.tsx`
- `apps/mobile/src/app/(main)/{index,_layout,new-dm,invite,create-room}.tsx`
- `apps/mobile/src/components/rooms/invite-inbox.tsx`

**Design contract:** surfaces belong to conversations; message references and short agent status remain in the timeline; fully interactive surfaces live in the Surfaces tab. UX polish cannot reduce functional capability.
