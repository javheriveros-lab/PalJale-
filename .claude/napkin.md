# Napkin Runbook

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Backend (Python/FastAPI) Gotchas
1. **[2026-10-09] `passlib[bcrypt]` breaks with bcrypt 4.1+/5.x**
   `CryptContext.hash()`/`.verify()` crash with `ValueError: password cannot be longer than 72 bytes` during passlib's own internal `detect_wrap_bug` self-test — not caused by a long user password, happens on first hash/verify call after install.
   Do instead: pin `bcrypt==4.0.1` in requirements.txt alongside `passlib[bcrypt]`. Also defensively truncate any password to 72 bytes (`password.encode('utf-8')[:72]`) before passing to passlib, since real long passwords hit the same ValueError even with a fixed bcrypt version.
2. **[2026-10-09] Any registration/login 500 reproduces fastest via direct curl, not UI**
   `curl -i -X POST <backend>/api/auth/register -d '{...}'` against the live/prod URL shows the real status code and body instantly — the frontend's error handling (or lack of it) otherwise hides whether it's a 500 (backend bug) vs 404 (wrong URL) vs HTML (misconfigured env var).
   Do instead: when a form "does nothing" or shows a cryptic client-side parse error, curl the backend endpoint directly first before touching frontend code.

## Deploy (Railway) Gotchas
1. **[2026-10-09, still unresolved as of 2026-10-19] Backend Railway service serves a stale commit despite correct repo+branch**
   Confirmed both repo AND branch are correct (`javheriveros-lab/PalJale-`, `main`) via the dashboard, yet `/api/health` (added 2026-10-09) still 404s ten days and five pushes later, and a traceback showed line numbers from old `auth.py`. Not yet root-caused — next things to check in the dashboard, not yet tried: Deployments tab's active commit hash vs `git log`, whether "Automatic Deploys" is toggled on, and a manual "Redeploy" on the latest commit.
   Do instead: don't re-diagnose from scratch each session — this is the single blocking issue for the whole backend. Before doing anything else backend-related, `curl https://paljale-production.up.railway.app/api/health` and compare against the latest local commit; if still 404, point the user straight at the Deployments tab/manual redeploy, don't re-walk repo/branch checks that already passed.
2. **[2026-10-09] `EXPO_PUBLIC_BACKEND_URL` pasted as a markdown link breaks every API call silently**
   Someone pasted `[https://host](https://host)` (markdown link syntax) into Railway's env var instead of the plain URL. Expo bakes it into the static web bundle at build time; the browser then resolves the malformed absolute URL as relative to the frontend's own origin, and `serve -s dist` (SPA mode) returns `index.html` (200, HTML) for that unmatched path — surfaces as `Unexpected token <, <!DOCTYPE... is not valid JSON` in the app, nowhere near the real cause.
   Do instead: when debugging that exact error string, immediately `curl` the deployed JS bundle and `grep` for the backend URL literal to see exactly what got baked in, rather than guessing at CORS/network causes.
3. **[2026-10-08] `dockerfilePath`/build context are always relative to repo root, never "Root Directory"**
   Confirmed repeatedly: Railway's Docker build context is the repo root regardless of a service's "Root Directory" setting, so `COPY` paths inside a scoped service's Dockerfile need explicit subfolder prefixes (e.g. `COPY frontend/...`), and `dockerfilePath` itself must be root-relative (e.g. `frontend/Dockerfile`).
   Do instead: always write Dockerfile COPY paths and the `dockerfilePath` setting as repo-root-relative, never relative to the service's Root Directory.
4. **[2026-10-08] A repo-root `railway.json` leaks into every service connected to that repo**
   One service's `build.dockerfilePath`/`deploy.startCommand` in a root-level `railway.json` was picked up by an unrelated second service in the same project.
   Do instead: never keep a root-level `railway.json` in a multi-service repo; give each service its own `railway.json` inside its own subfolder.
5. **[2026-10-08] `serve -s dist` needs an explicit bind address, bare `$PORT` is ambiguous**
   502s resolved only after changing the start command to `serve -s dist -l tcp://0.0.0.0:$PORT`.
   Do instead: always bind `serve` explicitly to `tcp://0.0.0.0:$PORT`, never just `-l $PORT`.
6. **[2026-10-08] Public Networking domain has its own target port, separate from the container's actual listen port**
   A 502 traced back to Railway's Networking tab pointing at the wrong port (8081) while the container listened on 8080.
   Do instead: when a service is "online" but the public domain 502s, check Settings → Networking's target port against what the container actually binds, before touching app code.
7. **[2026-10-08] Docker Hub anonymous pulls 429 on Railway builds**
   Do instead: use the AWS public ECR mirror, `public.ecr.aws/docker/library/<image>`, instead of a bare Docker Hub image name.

## Frontend (Expo/React Native Web) Gotchas
1. **[2026-10-09] `Alert.alert()` is a no-op on web**
   `react-native-web`'s `Alert.alert` does literally nothing — any error path that only calls `Alert.alert` is invisible on web, making real failures look like "the button does nothing."
   Do instead: never rely on `Alert.alert` alone for user-facing errors on a screen that also runs on web. Pair it with an inline `<Text>` error state (and `Platform.OS === 'web'` → `window.alert` or a visible banner), plus `console.error` for devtools.
2. **[2026-10-09] `@stripe/stripe-react-native` / `react-native-maps` crash the web bundle merely by being imported**
   Even code gated behind `Platform.OS !== 'web'` at runtime still crashes Metro's web bundle/SSR at import time with `Importing native-only module codegenNativeComponent`.
   Do instead: split into `Foo.tsx` (native, imports the native SDK) + `Foo.web.tsx` (no native import) and import the plain name (`./Foo`, no `.web` suffix) from callers — Metro resolves per-platform automatically for ordinary module imports.
3. **[2026-10-08] Expo Router route files (`app/**/*.web.tsx`) are NOT reliably platform-resolved**
   Unlike ordinary component imports, `.web.tsx` siblings of route files (e.g. `app/_layout.web.tsx`) were silently ignored by this project's Expo Router/static-render version.
   Do instead: for route-level platform branching, use a single route file with a `Platform.OS` check inside it that delegates to the plain-component split pattern above — never a `.web.tsx` route file.
4. **[2026-10-19] `Pressable`'s `style={({hovered}) => ...}` callback is this project's hover-microinteraction pattern**
   react-native-web exposes real `:hover` through Pressable's function-style prop; works for buttons, cards, chips alike, gated with `IS_WEB &&` since native has no pointer.
   Do instead: reuse this exact pattern for any new hoverable element instead of reaching for a new library; combine with web-only `transitionProperty`/`transitionDuration` style keys (cast `as any`, RN's StyleSheet types don't know them) for a smooth, not-instant hover.

## Design Tooling Guardrails
1. **[2026-10-19] `design-taste-frontend` (tasteskill) assumes a Next.js/Tailwind v4/Motion/GSAP/shadcn stack**
   This repo is Expo/React Native (+ react-native-web), styled with hand-rolled `StyleSheet` tokens, no Tailwind/Next/Motion/GSAP/shadcn installed and no plan to add them.
   Do instead: when this skill is invoked here, apply only its content-level judgment (anti-slop copy rules, card/hierarchy/trust-signal patterns, AI-tell bans) translated into the existing RN/StyleSheet/token architecture — never install or suggest its Next.js/Tailwind/Motion/GSAP stack into this project.
2. **[2026-10-19] The `impeccable` CLI (`scripts/impeccable detect`/`context`) works even when "impeccable" isn't in a turn's Skill-tool listing**
   It's a standalone binary at a fixed path, not gated by which skills a given message exposes.
   Do instead: if `impeccable` is unavailable via the Skill tool this turn, still shell out to `"<skill-base-dir>/scripts/impeccable" detect --json <files>` directly for a mechanical UI-slop scan.

## User Directives
1. **[2026-10-09] Stripe/payments backend changes need explicit push approval every time**
   User wants the Stripe payments backend (payments.py, connect.py, admin_bank.py, cart.py, database.py, requirements.txt, tests/) treated as a separate, held-back change set — never bundled silently into another commit.
   Do instead: keep those files staged/committed separately and wait for an explicit "sí, sube los cambios de Stripe" (or equivalent) before pushing them, even when other unrelated fixes are approved and pushed.
