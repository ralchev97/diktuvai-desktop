# DiktuvAI Desktop

Electron desktop app for Bulgarian voice dictation. Runs as a system tray application with a hold-to-talk hotkey. Records audio, transcribes via OpenAI, optionally cleans up text with Groq LLM, and pastes the result into the active application.

## Tech Stack

- Electron 33 + electron-vite + TypeScript
- React 19 + Tailwind CSS 4 (renderer)
- better-sqlite3 (local history/dictionary/snippets)
- uiohook-napi (global keyboard shortcuts)
- electron-updater (auto-updates)
- electron-builder (packaging for macOS + Windows)
- electron-store (settings + JWT auth token persistence)

## Auth & Billing Flow (in-app, WhisperFlow-style)

All signup, login, and subscription management happens **inside the app** — there is no web dashboard.

1. **First launch** → onboarding shows `LoginStep`: email input → 6-digit code input (auto-submitted)
2. App calls `POST /api/auth/request-code` (email) → server sends OTP
3. User enters code → app calls `POST /api/auth/verify-code` → receives JWT
4. JWT stored in `electron-store` as `authToken`, user email as `userEmail`
5. New users get 14-day Pro trial automatically, no card required
6. Every hour, `license:refresh` re-validates the token and plan via `/api/license/verify`
7. **Upgrade**: Account tab → "Надгради" button (€5 Starter / €10 Pro) → app calls `/api/stripe/checkout` → opens returned URL in system browser → user pays on Stripe hosted Checkout → returns to app → clicks "Обнови статуса" → app re-fetches plan
8. **Manage subscription**: Account tab → "Manage" → opens `/api/stripe/portal` URL in browser

There is **no OAuth, no magic link, no web login**. Just email + 6-digit code.

## Project Structure

```
src/
  main/              -- Electron main process
    main.ts          -- App lifecycle, window creation, tray setup
    dictation.ts     -- Dictation state machine
    audio.ts         -- Audio recording
    api.ts           -- OpenAI/Groq API calls (direct or via proxy with Bearer JWT)
    paste.ts         -- Text insertion
    shortcuts.ts     -- Global hotkeys
    tray.ts          -- System tray
    store.ts         -- Settings persistence
    db.ts            -- SQLite (history, dictionary, snippets)
    ipc.ts           -- IPC handlers
    license.ts       -- requestCode / verifyCode / refreshLicense / createCheckoutUrl / createPortalUrl
    updater.ts       -- Auto-update logic
    preload.ts       -- Context bridge for renderer
  renderer/          -- React UI
    App.tsx           -- Main app with routing
    components/
      settings/
        AccountTab.tsx    -- Plan display, Upgrade/Manage buttons, Refresh button
        ...
      overlay/        -- Floating dictation status overlay
      onboarding/
        LoginStep.tsx     -- 2-step OTP auth UI (email → code)
        ...
    hooks/useAPI.ts   -- Window.diktuvai API types
    i18n/             -- Bulgarian + English translations
```

## Architecture Flow (Dictation)

1. User holds configured hotkey (default: Right Option)
2. `shortcuts.ts` detects keydown, triggers `dictation.startDictationSession()`
3. `audio.ts` spawns a native Swift recorder binary (macOS) or ffmpeg/PowerShell (Windows), records 16kHz mono WAV
4. User releases hotkey → `audio.stopRecording()` kills recorder, reads WAV
5. `api.ts` sends audio to OpenAI gpt-4o-transcribe (or to the server proxy with `Authorization: Bearer <authToken>`)
6. If AI formatting is enabled, raw text → Groq (llama-3.3-70b-versatile) for cleanup
7. `paste.ts` inserts cleaned text via clipboard + Cmd/Ctrl+V
8. History saved locally in SQLite

**Command mode**: Double-tap hotkey for voice command that transforms selected text (uses gpt-4o-mini).

## External APIs

- **OpenAI** — gpt-4o-transcribe (STT), gpt-4o-mini (voice commands)
- **Groq** — llama-3.3-70b-versatile (text cleanup, fast inference)
- **diktuvai.bg** — Server proxy for transcription + auth + Stripe (JWT-based)

## How to Run

```bash
npm install
npm run dev          # electron-vite dev mode
npm run build        # build for production (tsc + vite)
npm run package:mac  # package .dmg for macOS
npm run package:win  # package .exe for Windows
```

## Key Conventions

- State machine pattern for dictation lifecycle
- Bilingual UI (bg/en) via i18n
- Multi-tier audio fallback: native Swift → sox → ffmpeg → PowerShell
- Settings via electron-store; history/dictionary/snippets via better-sqlite3
- Overlay is always-on-top, transparent, non-focusable
- Single instance lock
- **Transcription pipeline is frozen** — do not modify without explicit testing (v1.2.0+)
- Auth tokens stored in electron-store as `authToken` (JWT). `userEmail` also stored for display.
- `authToken` is automatically attached as Bearer header by `main/api.ts` for proxy transcription
