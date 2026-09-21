# RemindMe

Save Instagram posts and reels through the native share sheet, and get reminded to actually
go back to them.

The problem it solves: you save things on Instagram and never see them again.

```text
Instagram → Share → RemindMe → Save + reminder → Notification → Revisit
```

## Status

The MVP loop defined in `PROJECT_PLAN.md` §26 is built. See `PROJECT_PLAN.md` for the
sprint checklist and `docs/ARCHITECTURE.md` for the design and its trade-offs.

## Requirements

- Node 22 or newer (the tests use the built-in `node:sqlite`)
- pnpm
- Xcode for iOS, Android Studio for Android

## Getting started

```bash
pnpm install
pnpm start
```

### The share flow needs a development build

The iOS Share Extension and the Android share intent are native targets. **Expo Go cannot run
them.** Build a development client:

```bash
npx expo prebuild        # generates ios/ and android/
pnpm ios                 # or: pnpm android
```

On iOS you also need to set a Development Team on both the app target and the
`RemindMeShare` extension target in Xcode before the extension will build.

Everything except the share sheet runs in Expo Go. The save screen accepts a pasted link, so
the whole save → remind → revisit loop is reachable without a native build.

## Installing on an iPhone

The app is signed with a **free personal Apple team**, so:

- An install lasts **7 days**. Run `pnpm ios:device` again to renew it.
- The first install needs trust on the phone: **Settings → General → VPN & Device
  Management → your Apple ID → Trust**.
- The bundle ID is `com.remindme.app.saves`; `com.remindme.app` belongs to another developer.

```bash
pnpm ios:device            # builds Release and installs on the connected iPhone
```

Free teams cannot sign App Groups or Push Notifications, so two local changes keep the full
feature set working:

- `expo-share-intent` is patched (`iosAppGroup: false` in `app.json`): the share extension
  passes the link inside the deep link (`remindme://save?url=…`) instead of through an App Group.
- `plugins/without-push-entitlement.js` drops `aps-environment`. Reminders are local
  notifications, which do not need it.

On a paid team, remove both and set `appleTeamId` to that team.

## Preview service

Previews are resolved by an **Expo Router API route**, so the mobile app never fetches
instagram.com itself and the Exabase key never reaches the client:

```
src/app/api/instagram/preview+api.ts   →  POST /api/instagram/preview
src/app/api/health+api.ts              →  GET  /api/health
```

It runs on the dev server automatically:

```bash
cp .env.example .env     # then fill in the values
pnpm start
curl -X POST http://localhost:8081/api/instagram/preview \
  -H 'content-type: application/json' \
  -d '{"url":"https://www.instagram.com/p/SHORTCODE/"}'
```

A device cannot reach `localhost` on your machine, so set
`EXPO_PUBLIC_PREVIEW_API_URL` to your LAN address there.

### Two sources, tried in order

1. **Exabase** link preview (`EXABASE_API_KEY`) — returns author, caption and a rehosted
   thumbnail. They absorb Instagram's markup changes.
2. **Instagram Open Graph tags** — read directly, no key needed.

Either can break independently; a failure in the first falls through to the second. The
response says which one answered, in a `source` field.

**The app works with neither.** Saved items keep the "Preview unavailable" state, which is a
designed state rather than an error. The Instagram link is always the source of truth.

Neither source uses credentials, cookies, private APIs or client impersonation.

### Deploying

API routes deploy to EAS Hosting (Cloudflare Workers):

```bash
npx expo export --platform web
eas deploy
```

`EXABASE_API_KEY` is a **server-side secret**. Set it with `eas env:create`, never with the
`EXPO_PUBLIC_` prefix — that would inline it into the app bundle.

Then point the app at the deployment by setting `EXPO_PUBLIC_PREVIEW_API_URL` to the
deployed URL.

## Patched dependency

`expo-modules-jsi` is patched locally (`patches/expo-modules-jsi@57.1.0.patch`) so the iOS
build works on **Xcode 26.2 / Swift 6.2.3**. Without it the build fails while compiling
`ExpoModulesJSI` from source. pnpm applies the patch on install; no extra step is needed.

See `docs/ARCHITECTURE.md` §9 for what it changes and when to remove it.

## Checks

```bash
pnpm typecheck           # app and tests
pnpm lint
pnpm test                # 207 tests
```

## Layout

```text
src/
├── app/            Expo Router routes (screens + api/*+api.ts)
├── components/     Presentational components
├── features/       Feature hooks and orchestration
├── db/             Schema, migrations, repositories
├── services/       instagram/, notifications/, storage/
├── stores/         Zustand store over SQLite
├── types/          Domain model
└── utils/          Pure helpers

src/server/         Server-only code for the API routes
tests/              Vitest suites
docs/               Architecture notes
```

## Privacy

The app stores your saved links on your device. It never asks for your Instagram password,
never stores Instagram cookies or session tokens, and never reads your Instagram account. It
only ever sees content you explicitly share to it.
