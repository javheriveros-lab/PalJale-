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
1. **[2026-10-09] Railway service can show correct repo+branch in Settings but still serve a stale commit**
   Confirmed repo = correct GitHub repo, branch = `main`, yet the running container's traceback (file/line numbers) matched an old commit, not the latest pushed one. Root cause not yet isolated to one specific setting — check the Deployments tab's active commit hash against `git log` first, and check whether "Automatic Deploys" is toggled on; if a deploy is stuck, manually trigger "Redeploy" on the latest commit from the Deployments tab.
   Do instead: never assume a `git push` reached Railway. Verify via `curl` against a brand-new endpoint added in that exact commit (e.g. `/api/health`) — a 404 there proves the deploy is stale even if the dashboard says "online".
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

## User Directives
1. **[2026-10-09] Stripe/payments backend changes need explicit push approval every time**
   User wants the Stripe payments backend (payments.py, connect.py, admin_bank.py, cart.py, database.py, requirements.txt, tests/) treated as a separate, held-back change set — never bundled silently into another commit.
   Do instead: keep those files staged/committed separately and wait for an explicit "sí, sube los cambios de Stripe" (or equivalent) before pushing them, even when other unrelated fixes are approved and pushed.
