# Handoff

## Completed

- Added single-owner Supabase auth across the app.
- Gated the SPA before mount-time API consumers run.
- Centralized bearer-token attachment in the shared API client.
- Added one-refresh/one-retry handling for `401` responses.
- Protected the full `/api` namespace with server-side owner validation.
- Added `GET /api/auth/session` for owner confirmation.
- Replaced protected browser-native file/image URL usage with authenticated blob fetching for generated Python files.
- Added auth-focused frontend and server tests.
- Updated `.env.example`, `README.md`, `package.json`, and installed `@supabase/supabase-js`.

## Main Files

- `src/lib/supabase-client.ts`
- `src/auth/AuthProvider.tsx`
- `src/auth/RequireOwner.tsx`
- `src/auth/LoginPage.tsx`
- `src/auth/auth-controller.ts`
- `src/lib/api-auth.ts`
- `src/lib/api-resources.ts`
- `src/lib/api.ts`
- `server/auth/config.ts`
- `server/auth/supabase.ts`
- `server/auth/require-owner.ts`
- `server/auth/request-context.ts`
- `server/app.ts`
- `server/config.ts`
- `server/python-exec.ts`

## Required Env

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
APP_OWNER_EMAIL=
```

## Supabase Setup Notes

- Disable public sign-ups in the Supabase project.
- Create the owner account manually before deployment.
- Browser code only uses the `VITE_` values.
- Server-side token validation uses `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

## Verification Run

- `npm run test:api-client`
- `npx tsx --test server/auth/require-owner.test.ts`
- `npm run lint`
- `npm test`
- `npm run build`

## Notes

- `package-lock.json` changed because `@supabase/supabase-js` was installed.
- There were unrelated pre-existing worktree changes in `server/db/*`, `server/ownership.ts`, and some existing tests. They were left untouched.
- Current protected blob handling was implemented for Python generated files. If other protected resources later move to direct `<img>`, `<a>`, or `window.open` flows, they should use the same authenticated blob pattern.
