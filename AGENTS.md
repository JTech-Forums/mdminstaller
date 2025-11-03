# Repository Guidelines

## Project Structure & Module Organization
- Root: `server.js` (dev server), `build.js` (static site build to `docs/`), `template.html` (main UI), `console.html` (console view), `CNAME` (Pages), images, and config.
- Assets: `css/`, `js/` (browser code), and `apk/` (per‑vendor metadata).
- JS layout:
  - `js/ui/` UI helpers (e.g., `ui-manager.js`, `cards.js`).
  - `js/adb/` WebUSB/ADB logic (e.g., `apk-installer.js`).
  - `js/data/` static data (e.g., `kits.js`).
- APK entries: `apk/<Vendor>/` with icon (`icon.*` or `*.svg`), `command.txt` for post‑install steps, optional `url.txt` to override APK URL.

## Build, Test, and Development Commands
- `npm install` — install deps (Node >= 14).
- `npm run dev` or `npm start` — start dev server on `PORT` (default 8000).
  - PowerShell: `$env:PORT=8080; npm run dev`
- `npm run build` — build static site to `docs/` and generate `docs/apks.json`.
- `npm run serve-https` — serve locally with TLS (expects `cert.pem`).

## Coding Style & Naming Conventions
- JavaScript: 2‑space indent, single quotes, semicolons.
- File names: kebab‑case in `js/` (e.g., `apk-installer.js`).
- Constants: `UPPER_SNAKE_CASE`; variables/functions: `camelCase`; classes: `PascalCase`.
- No linter configured; match existing style and keep modules small and focused.

## Testing Guidelines
- Manual checks:
  - Run `npm run dev`, open `http://localhost:8000`.
  - Verify `/api/apks` returns expected JSON after changes to `apk/`.
  - Exercise install flows (Chrome + WebUSB) and confirm post‑install commands apply.
- Static build sanity: `npm run build`, then serve `docs/` (e.g., `npx http-server docs`).

## Commit & Pull Request Guidelines
- Use Conventional Commits (recommended): `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
  - Example: `feat(adb): add retry on device reconnect`
- PRs should include:
  - Clear description, linked issue(s), and before/after screenshots for UI.
  - Test plan (manual steps) and note of risks/rollbacks.
  - Build passes (`npm run build`) and no console errors on load.

## Security & Configuration Tips
- Do not commit secrets; temporary files like `tmp_cred.js`/`tmp_adb.js` must not contain real credentials.
- Prefer `url.txt` per app over embedding APKs; default APK URL is derived from the folder name.
- For HTTPS dev, generate a self‑signed `cert.pem` if needed.

## Agent‑Specific Notes
- Place new UI code under `js/ui/` and ADB logic under `js/adb/`.
- When adding a vendor, create `apk/<Vendor>/` with an icon and `command.txt`; include `url.txt` if the APK URL differs from the default.
