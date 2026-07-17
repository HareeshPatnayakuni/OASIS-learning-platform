# Module 5 — Implementation Notes
## Device Management

## 1. What was already there vs. what was built

Module 2 built far more of this than the brief's phrasing ("Implement
the original OASIS requirement...") might suggest — it wasn't a
suggestion, it was accurate. Already in place, unchanged by this module:

- The `DeviceSession` and `RefreshToken` models, explicitly built for
  "the 2-device login limit" (schema comment, verbatim, from Module 2).
- `AuthService.enforceDeviceLimit`, called on every login: a known
  device never counts against the limit; a genuinely new 3rd device is
  **rejected outright** with a clear `DEVICE_LIMIT_REACHED` error naming
  the limit — never a silent eviction of an existing session. This is
  Feature #1, in full, already.
- Refresh tokens scoped to the device they were issued on; a token
  presented with a mismatched `deviceId` is already rejected the same as
  an invalid one.
- `parseDeviceLabel` (now `parseDeviceInfo`, see §2), whose own comment
  said it exists for "a future 'manage your devices' screen" — this
  module *is* that screen.

**What was genuinely missing, confirmed by reading the code, not
assumed:** no way to *list* devices, no way to remove a *specific* other
device (only "remove this one" via normal logout, or "remove all"), and
— a real, confirmed gap — `countDeviceSessions` counted every
`DeviceSession` row unconditionally, with no awareness of whether its
refresh token had actually expired. A student who let a session expire
naturally (closed the tab, never explicitly logged out) would stay
locked at their device limit **forever**, since nothing ever removed the
stale row. That's Feature #4, and it was a real bug, not a hypothetical
one — confirmed by reading `countDeviceSessions`'s one-line implementation
before writing any new code.

## 2. Design decisions

- **No new backend module for "auth logic," genuinely just a thin
  routing layer.** `modules/devices/` has a controller and routes only —
  no repository, no separate service. Both new endpoints construct an
  `AuthService` (Module 2) and call it directly. Every piece of state
  this feature touches (`DeviceSession`, `RefreshToken`) is already
  owned by `AuthRepository`; building a parallel repository would have
  meant either duplicating that ownership or awkwardly re-exporting it,
  both worse than just reusing `AuthService` as the module boundary it
  already is.
- **One shared "is this device still valid" query, used by both
  enforcement and listing.** `AuthRepository.getValidDeviceIds` (private,
  new) — a device counts only if it has an unexpired, unrevoked refresh
  token. `countDeviceSessions` (login-time limit check) and
  `listActiveDeviceSessions` (My Devices) both call it. This was
  deliberate: if the two used separate logic, they could disagree —
  the list could show 1 device while login enforcement still believed
  there were 2. A single source of truth was the whole point of the fix,
  not just closing the immediate bug.
- **Stale sessions are cleaned up opportunistically, on read — no
  scheduled job.** Explicitly out of scope ("Scheduled cleanup jobs"),
  and unnecessary: `listActiveDeviceSessions` deletes any session it
  finds with no valid token attached, every time it's called. A stale
  row is gone the next time anyone looks, without a cron job existing
  anywhere.
- **`browser`/`operatingSystem` are new, separate columns on
  `DeviceSession`** (alongside the pre-existing combined `deviceLabel`,
  kept as-is). The brief lists Device name, Browser, and Operating
  System as three separate fields; the alternative — re-parsing the
  combined "Chrome on Windows" string back apart on every read — is
  fragile (what does a browser-only or OS-only label split into?) for
  no real benefit. This is the one schema change in this module, and
  it's purely additive: two new nullable columns, nothing removed or
  retyped.
- **`parseDeviceLabel.ts` → `parseDeviceInfo.ts`**, one function renamed
  to `parseDeviceInfo`, now returning `{label, browser, operatingSystem}`
  instead of just a string. Small, self-contained, exactly one caller
  (`auth.service.ts`) — a contained, low-risk rename rather than adding
  a second, oddly-named function alongside the old one.
- **`currentDeviceId` travels as a query parameter**, not a new header.
  Access tokens deliberately don't carry `deviceId` (checked directly in
  `middleware/authenticate.ts` — the payload is `{sub, role}`, nothing
  else, and that's intentional, kept minimal on purpose), so there's no
  way for the backend to know which device is "current" without the
  frontend saying so. `GET /devices` and `DELETE /devices/:deviceId` are
  both bodyless requests, so a query param (validated the same way every
  other GET's query params already are in this codebase) was the
  natural choice over introducing a new custom-header convention for a
  single value.
- **Removing a device always revokes its tokens *and* deletes its
  session row, together, never one without the other.** Revoking without
  deleting would leave a phantom row still counting against the limit;
  deleting without revoking would free the limit slot while leaving a
  still-usable refresh token in the removed device's hands — the exact
  security property ("removed devices cannot continue using refresh
  tokens") the brief calls out explicitly.
- **"Cannot remove itself" is checked before anything else** in
  `removeDevice` — a plain equality check between `targetDeviceId` and
  `currentDeviceId`, before even looking up whether the target device
  exists. Simplest possible implementation of a security requirement
  that's explicitly named in the brief, not layered under other checks
  where it'd be easy to accidentally bypass by reordering later.
- **Frontend: one page, for students, not three.** The brief's Features
  section says "Students can view.../Students can remove..." in every
  bullet point — consistently, not incidentally. The backend itself is
  role-agnostic (`authenticate` only, no `requireRole` — the 2-device
  limit already applied identically to every role before this module,
  and still does), so a Teacher or Admin "My Devices" page is a trivial
  future addition with zero backend changes needed. Built what the brief
  asked for; didn't invent two more pages it didn't.
- **Native `confirm()` for the removal confirmation**, matching this
  codebase's own established pattern (Module 3D/4B's admin course
  archive/restore and announcement actions all use the same). No new
  modal component for a single yes/no confirmation.

## 3. Backend

**New module** (`backend/src/modules/devices/`): `devices.controller.ts`,
`devices.routes.ts`, `devices.validators.ts`.

**Extended** (Module 2's `auth` module — additive only, no existing
method's behavior changed for existing callers): `auth.types.ts`
(`DeviceSummary` type, `DeviceSessionRecord` gains `browser`/
`operatingSystem`, `AuthRepository` gains `listActiveDeviceSessions`/
`revokeRefreshTokensForDevice`, `upsertDeviceSession`'s signature widened
from a bare label string to `{label, browser, operatingSystem}`),
`auth.repository.ts` (`getValidDeviceIds` shared helper; `login()`'s own
device-limit-enforcement *behavior* is unchanged — only what counts as
"valid" underneath it is now correct), `auth.service.ts`
(`listMyDevices`, `removeDevice`), `parseDeviceInfo.ts` (renamed from
`parseDeviceLabel.ts`).

**Endpoints:**
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/devices` | Any authenticated role | List active devices, newest-active-first, current device marked |
| DELETE | `/devices/:deviceId` | Any authenticated role | Remove another device — revokes its tokens, deletes its session |

## 4. Database

One additive schema change: `DeviceSession.browser` and
`DeviceSession.operatingSystem`, both nullable strings. No other model
touched. Migration not generated in this sandbox (no network path to
`binaries.prisma.sh`, same limitation as every prior module) — run
`npx prisma migrate dev --name add_device_browser_os` in a real
environment.

## 5. Security checklist

- Token revocation: `revokeRefreshTokensForDevice` revokes every
  matching, not-yet-revoked refresh token for the target device — not
  just the most recent one, covering any not-yet-rotated-out historical
  tokens too.
- Removed devices cannot continue using refresh tokens: confirmed by a
  test asserting every refresh token for the removed device has
  `revokedAt` set after `removeDevice` runs.
- Current device cannot accidentally remove itself: `targetDeviceId ===
  currentDeviceId` is checked first, before the target device lookup,
  and rejected with a clear message directing the user to log out
  instead.
- Device limit cannot be bypassed: `countDeviceSessions` and the login
  flow's enforcement are unchanged in behavior for the normal case
  (still exactly 2, still rejects a genuine 3rd) — the only change is
  that a session with no valid token left correctly stops counting,
  which closes a bug rather than opening one.

### Access token behavior on device removal (reviewed before freeze)

Removing a device revokes its **refresh** token (confirmed above) but
has no effect on an **access** token already in that device's
possession — `middleware/authenticate.ts` verifies access tokens
statelessly (JWT signature + expiry only; the payload is `{sub, role}`,
no `deviceId`, no database lookup at all), so a removed device's
existing access token keeps working until it naturally expires
(`JWT_ACCESS_EXPIRY`, 15 minutes by default).

**Accepted as-is for the MVP, not a gap that needs closing**: this is
the identical, already-documented trade-off `authenticate.ts`'s own
comment describes for account deactivation ("a deliberate, bounded
staleness window, not an oversight"). The window is short (≤15 min) and
hard-bounded — the device can never refresh past it, since its refresh
token is already revoked. Closing it completely would mean a DB lookup
on every authenticated request across the entire application, to
narrow a window where nothing catastrophic or irreversible is reachable
via this application's API alone. If a stricter, database-checked
access-token revocation ever becomes a real product requirement (e.g.
compliance-driven), that's a deliberate future change, not something to
retrofit quietly here.

## 6. Testing

**Backend: 13 new tests** in `tests/unit/auth/auth.service.test.ts`
(kept in the existing file — this is Module 2's own service gaining new
methods, not a new module with its own repository to test in isolation).
One new test in the existing `AuthService.login` block confirms a 3rd
device is now accepted once an existing device's refresh token has
expired (Automatic Cleanup, proven, not asserted). New
`AuthService.listMyDevices` (4 tests: current-device marking,
browser/OS parsed correctly and matching the combined label, expired
sessions excluded) and `AuthService.removeDevice` (5 tests: success
including token revocation, freeing a slot for a new login, refusing to
remove the current device, 404 for a nonexistent device, and a second
removal attempt 404ing rather than double-revoking) describe blocks
added at the end of the same file. 277 backend tests total, all passing.

**Live-verified**: `GET /devices` and `DELETE /devices/:deviceId` both
confirmed reachable (past routing/auth/validation, to the stub boundary)
by Student, Teacher, *and* Admin tokens alike — confirming the
deliberately role-agnostic design actually behaves that way, not just on
paper. Missing `currentDeviceId` correctly `400`s with a clear message.
No token correctly `401`s. Both endpoints confirmed present with zero
parser errors in the live OpenAPI spec (75 paths, up from 73). All
frontend pages, including the new My Devices page, live-checked at `200`
with zero error-boundary indicators.

## 7. Known gaps / deferred (explicitly out of scope per the brief)

Push notifications, login history analytics, location maps, email/SMS
alerts, trusted devices, device nicknames — none built. No Teacher/Admin
"My Devices" frontend page (see §2) — the backend already supports it if
a future module wants it.
