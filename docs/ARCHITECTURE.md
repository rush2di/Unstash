# Architecture

Status: written during Phase 1 (Repository Audit) of `PROJECT_PLAN.md`.

---

## 1. Current architecture (audit result)

The repository was the default `create-expo-app` starter with one addition (Uniwind).

| Area | Finding |
| --- | --- |
| Framework | Expo SDK **57.0.0**, React Native **0.86.3**, React **19.2.3** |
| Navigation | **Expo Router 57** (`expo-router/entry` as main). Routes in `src/app/`. `NativeTabs` from `expo-router/unstable-native-tabs` |
| New Architecture | **Enabled** (default and only mode on RN 0.86) |
| Native projects | **None.** No `ios/` or `android/` directory. Continuous Native Generation via `app.json` + config plugins |
| TypeScript | **Strict.** `extends expo/tsconfig.base`, path alias `@/*` to `./src/*`, `@/assets/*` to `./assets/*` |
| Styling | **Uniwind 1.12** (Tailwind CSS v4 for React Native) plus the starter's `StyleSheet` themed components |
| State management | **None** |
| Persistence | **None** |
| Notifications | **None** |
| Native modules | None beyond Expo SDK packages |
| Backend | **None** |
| Tests | **None.** No runner configured |
| Lint | `expo lint` script only; no ESLint config file was present |

Existing code worth reusing: `ThemedText`, `ThemedView`, `useTheme`, and the `Colors`/`Spacing` tokens in `src/constants/theme.ts`.

Starter screens (`explore.tsx`, the Expo welcome screen, and their helper components) are template content, not product code.

### Deviation from the plan's target structure

`PROJECT_PLAN.md` §3 places routes in `/app`. This repository places them in `/src/app`, which the plan permits
("Adjust this structure to match the repository if code already exists"). Routes therefore stay in `src/app/`,
and all non-route code stays in `src/`.

---

## 2. Proposed architecture

```text
src/
├── app/                    Expo Router routes only
│   ├── _layout.tsx         Providers: SQLite, share intake, notification routing
│   ├── (tabs)/             Home, Collections, Settings
│   ├── item/[id].tsx       Saved item detail
│   ├── collection/[id].tsx Collection detail
│   ├── reminder/[id].tsx   Reminder completion screen
│   ├── save.tsx            Save sheet (share ingestion target)
│   └── api/                API routes (+api.ts), server-only
│
├── server/                 Server-only code: preview resolution, rate limiting
│
├── components/             Presentational components
├── features/               Feature-level hooks and screen logic
├── db/                     Schema, migrations, adapter, repositories
├── services/               instagram/, notifications/, storage/
├── stores/                 Zustand stores
├── types/                  Domain types
├── utils/                  Pure helpers
└── constants/              Design tokens
```

### Dependency decisions

Added, each with a concrete reason (plan §2 forbids speculative dependencies):

| Package | Reason |
| --- | --- |
| `expo-sqlite` | Local-first relational store with migrations and indexes (plan §5) |
| `expo-notifications` | Local reminder scheduling (plan §15) |
| `expo-file-system` | Thumbnail cache on disk (plan §11) |
| `expo-crypto` | `randomUUID()` for IDs, avoids a `uuid` package plus a polyfill |
| `zustand` | One reactive store over SQLite so lists update after writes without prop drilling |
| `expo-share-intent` | iOS Share Extension and Android share intent, with the config plugin both require |
| `vitest` | Test runner for the pure logic layer |

The preview resolver runs as an **Expo Router API route** rather than a separate Node
package, so there is no second project to deploy or maintain. It needs `web.output: "server"`.

Deliberately **not** added yet:

- **TanStack Query** — the only network call is preview resolution. A small dedicated queue covers it.
  Revisit at Phase 15 (cloud sync).
- **A separate backend framework** — one endpoint on `node:http` became one API route on Web APIs.
- **Supabase** — Phase 15. The app stays local-first until then.
- **A date library** — `Intl.DateTimeFormat` and plain `Date` arithmetic cover the reminder presets.

---

## 3. Data flow

```text
                 write                    read
UI  ──────────────────────▶  repository  ────────▶  SQLite
 ▲                               │
 │                               ▼
 └───────  zustand store  ◀── reload after write
```

- SQLite is the single source of truth on device.
- Repositories own all SQL. They accept a `SqlDatabase` port, so they are testable off-device.
- The Zustand store holds the last read result and re-reads after every mutation. The UI never queries SQL directly.
- Business logic (URL parsing, reminder presets, preview state transitions) lives in pure modules with no React and no
  Expo imports, per plan principle 13.

### The `SqlDatabase` port

`expo-sqlite` cannot run under Node, so repository tests would otherwise need a device. The repositories depend on a
narrow interface (`execAsync`, `runAsync`, `getAllAsync`, `getFirstAsync`) with two implementations:

- **device** — a thin pass-through to `expo-sqlite`
- **tests** — an adapter over Node's built-in `node:sqlite`

The same migration SQL and the same queries run in both. Tests exercise real SQL rather than a hand-written fake.

---

## 4. Native share architecture

The share sheet is the primary ingestion path (plan §7), and it needs native targets on both platforms:

- **iOS** — a Share Extension: a second app target with its own bundle id and an App Group, so the extension can hand
  the URL to the host app.
- **Android** — an `intent-filter` for `ACTION_SEND` with `text/plain`.

```text
Instagram ──share──▶ Share Extension / Intent ──▶ expo-share-intent
                                                        │
                                                        ▼
                                             useShareIntent() in _layout
                                                        │
                                                 parseInstagramUrl()
                                                        │
                                          valid ────────┴──────── invalid
                                            │                        │
                                     router.push('/save')      explain and dismiss
```

`expo-share-intent` supplies both native targets and the config plugin. Writing this by hand would mean a custom
Expo module plus a prebuild plugin for the extension target — the same work, unmaintained.

### Known limitation

A share extension cannot run in **Expo Go**. Testing the share flow requires a development build
(`npx expo prebuild` then `npx expo run:ios` / `run:android`). Everything else in the app runs in Expo Go.

The `save` screen also accepts a pasted URL, so the save flow is reachable without a development build.

---

## 5. Preview architecture

Preview resolution lives in an Expo Router API route, `src/app/api/instagram/preview+api.ts`.
It is server-only, so the Exabase API key never reaches the client, and the mobile app never
fetches instagram.com itself.

```text
save item immediately  ──▶  previewStatus = 'pending'
                                   │
                                   ▼
                    POST /api/instagram/preview        (EAS Hosting / Cloudflare Workers)
                                   │
                        ┌──────────┴──────────┐
                        ▼                     ▼
                  1. Exabase           2. Open Graph tags
                  (if key set)         (fallback, no key)
                        │                     │
                        └──────────┬──────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
             metadata resolved              both sources failed
                    │                             │
          download thumbnail                previewStatus = 'failed'
                    │                             │
       cachedThumbnailPath set             fallback card shown
                    │
          previewStatus = 'available'
```

### Why two sources

Each can break independently, so a failure in one falls through to the other. The response
carries a `source` field (`exabase` | `opengraph`) for debugging.

| | Exabase | Open Graph |
| --- | --- | --- |
| Key required | Yes, server-side | No |
| Author | Yes, parsed from `(@handle)` in `title` | Yes, from the canonical `og:url` |
| Caption | `description` | `og:description` |
| Thumbnail | Rehosted on `cdn.exabase.io`, **URL expires in 7 days** | Instagram CDN, signed and expiring |
| Media unavailable | HTTP 200, `description: "Private media"`, `image: null` | No usable `og:` tags |
| Who maintains the scraping | Exabase | Us |

Both thumbnail URLs expire, which is why the app downloads and caches the image locally at
resolve time and renders the local file.

The Exabase endpoint (`GET https://api.exabase.io/v2/link`, header `X-Api-Key`) was taken
from the `@exabase/sdk` package and verified against live Instagram URLs. The published docs
list a different path and auth header, and both 404.

### Rules

Taken from plan §9, §10 and §24:

- Saving never waits on preview resolution, and never fails because of it.
- The client never fetches instagram.com directly. Only the API route does.
- Only **public** metadata is read. No credentials, no cookies, no private APIs, no client
  impersonation, no rate-limit evasion.
- The route only ever fetches a URL its own parser normalised, and a normalised URL always
  points at `www.instagram.com`. That is also the SSRF guard.
- `instagramUrl` is always the source of truth. Preview data is cache.

### What Instagram actually serves (measured, 2026-09-20)

Verified against a live public post rather than assumed:

| Observation | Consequence |
| --- | --- |
| A real public post serves `og:description`, `og:image`, `og:title`, `og:type`, `og:url` to an anonymous request | Open Graph extraction works; no token needed |
| A shortcode that does not exist returns **HTTP 200** with a generic shell page and no `og:` tags | Absence of tags means "no preview", not "network error" |
| `og:type` is `article` even on image posts | Media type cannot be read from `og:type`. It comes from `og:video`, else the reel path, else the presence of `og:image` |
| `og:title` is often absent; `og:url` is `https://www.instagram.com/{username}/p/{shortcode}/` | The author handle is read from `og:url` first |

Meta's `instagram_oembed` was tested and rejected: with or without a token it returns only
`html`, `provider_name`, `provider_url`, `type`, `version`, `width`. `thumbnail_url` and
`author_name` are not documented response fields any more, and the embed HTML contains no
image URL.

### Rate limiting caveat

Each Cloudflare Worker isolate keeps its own in-memory counter, so the limiter is a
best-effort guard against a single misbehaving client, not a global quota. A shared store
(Workers KV) would be needed for a real limit.

## 6. Reminder architecture

```text
SavedItem ──▶ Reminder row (scheduled) ──▶ Notifications.scheduleNotificationAsync
                    │                                   │
                    │                            notificationId
                    │◀──────────────────────────────────┘
                    │
     user taps notification ──▶ deep link remindme://reminder/{id}
                    │
              reminder screen ──▶ Done | Remind me again | Open in Instagram
```

- Local notifications only. No push server in the MVP.
- Every `Reminder` row stores the `notificationId` so it can be cancelled.
- Cancelling a reminder, deleting an item, or archiving an item all cancel the OS notification first, then update rows.
- Reminders in the past are never scheduled; they are stored as overdue and surfaced in the UI.
- The notification opens the app's own item view, never Instagram directly (plan §16).

---

## 7. Risks and blockers

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Instagram may withhold Open Graph tags from server-side requests | Previews fail for some or all items | Measured as working today (see §5). The fallback card is a first-class state, not an error path, so items stay fully usable |
| Thumbnail URLs expire | Broken images later | Cache to disk on first resolve and render the local file |
| Share extension needs a development build | Cannot demo the main flow in Expo Go | Documented; the save screen also accepts a pasted URL |
| Notification permission denied | Reminders silently do nothing | Permission state is surfaced in Settings with a route to system settings |
| No CI configured | Regressions | `typecheck`, `lint` and `test` scripts added; run them each phase |
| Backend not deployed | Previews unresolved in a real build | Resolver host is configurable; falls back to `failed` when unset |

---

## 8. Recommended implementation sequence

Follows plan §28. Sprint 1 through Sprint 4 deliver the MVP loop defined in plan §26.

1. **Sprint 1 — Foundation:** architecture doc, database, models, repositories, Instagram URL parser, unit tests.
2. **Sprint 2 — Saving:** share intake, save screen, collections.
3. **Sprint 3 — Preview:** backend resolver, preview queue, thumbnail cache, fallback UI, item detail.
4. **Sprint 4 — Reminders:** permissions, picker, scheduling, deep links, completion and rescheduling.
5. **Sprint 5 — Polish:** home screen, collections screen, search, filters, empty and error states, accessibility.
6. **Sprint 6 — Beta:** analytics, crash reporting, edge cases, store testing tracks.
7. **Sprint 7 — Cloud:** auth, Supabase, sync engine, conflict resolution.

---

## 9. Local patch: expo-modules-jsi

`patches/expo-modules-jsi@57.1.0.patch` works around two upstream incompatibilities between
**Expo SDK 57 and Xcode 26.2 / Swift 6.2.3**. Both were verified on this machine, and both are
filed upstream and still unfixed.

`expo-modules-jsi` ships only a 124 KB *stub* xcframework, so every local iOS build compiles it
from source. That is why these are hard build failures rather than something the prebuilt
binaries hide.

### 1. `SWIFT_RETURNS_RETAINED` on C++ constructors

Swift 6.2 rejects that attribute on constructors of a `SWIFT_SHARED_REFERENCE` type:

```text
'RuntimeScheduler' cannot be annotated with either SWIFT_RETURNS_RETAINED or
SWIFT_RETURNS_UNRETAINED because it is not returning a SWIFT_SHARED_REFERENCE type
```

The patch removes the attribute from both `RuntimeScheduler` constructors, which is the fix
[expo/expo#50067](https://github.com/expo/expo/issues/50067) recommends.

**Ownership is unchanged.** Swift already imports constructors of a shared-reference type as
`+1`, so the attribute was redundant. Measured with an instrumented build of the same pattern:
1000 constructions produced 0 extra retains, 1000 releases and 1000 deallocations — balanced,
no leak and no over-release.

### 2. `sending 'x' risks causing data races`

Seven diagnostics in `JavaScriptRuntime.swift` where raw pointers are captured by a
`@JavaScriptActor`-isolated closure. The package already guards these with
`nonisolated(unsafe) let`, which Swift 6.2.3 no longer honours
([expo/expo#47539](https://github.com/expo/expo/issues/47539)).

The patch boxes the pointers in `NonisolatedUnsafeVar` instead. That is **the package's own
workaround**: `JavaScriptRuntime.swift` line 516 already uses it, commented *"to work around a
Swift 6.2.3 compiler bug"*. Expo applied it at one site and missed the other seven. The patch
applies the same pattern to the rest, so no threading behaviour changes — only what the
compiler is told.

Two alternatives were tested and rejected:

| Attempt | Outcome |
| --- | --- |
| Disable the `NonisolatedNonsendingByDefault` upcoming feature | Same 7 errors |
| `swiftLanguageModes: [.v6]` → `[.v5]` | Traded the 7 errors for 2 different ones; the package genuinely needs Swift 6 mode |

Downgrading `expo-modules-jsi` does not help either: 57.0.8 carries the identical header, and
`expo-modules-core@57.0.18` pins `~57.1.0`. Version 58.0.2 is also unfixed.

### Removing the patch

Drop `patches/expo-modules-jsi@57.1.0.patch` and its entry in `pnpm-workspace.yaml` once Expo
ships a fix, then run `pnpm install && (cd ios && pod install)`.

EAS cloud builds use an older Swift and do not need this patch.

---

## 10. Schema v2 and the four-tab layout

Migration v2 (`src/db/schema.ts`) adds collection `emoji` and `color`, reminder `repeat`
(`once` | `daily` | `weekly`) and `note`, and a `settings` key-value table. It was verified
upgrading a real v1 database on the simulator with no data loss, and by `tests/db/v2.test.ts`.

- **Repeating reminders** keep one row whose `scheduledAt` is the next occurrence. Every
  refresh rolls missed occurrences forward (`rollRepeatingReminders`), so a repeating reminder
  is never overdue. The OS notification uses a `DAILY` or `WEEKLY` trigger.
- **Tags** are derived from caption hashtags at display time, never stored.
- **Captions** pass through `cleanInstagramCaption`, which strips Instagram's
  "N likes, M comments - user on date:" wrapper. It runs in the API route and again at display
  time, so rows saved before it existed also read correctly.

Not built, because no preview source provides the data: like counts, author profile photos
(an initial-letter avatar stands in), and reel duration. iCloud Sync is Sprint 7.
