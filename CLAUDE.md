# DiktuvAI Desktop

Electron desktop app for Bulgarian voice dictation. Runs as a system tray application with a hold-to-talk hotkey. Records audio, transcribes via OpenAI, optionally cleans up text with Groq LLM, and pastes the result into the active application.

## Tech Stack

- Electron 33 + electron-vite + TypeScript
- React 19 + Tailwind CSS 4 (renderer)
- better-sqlite3 (local history/dictionary/snippets)
- uiohook-napi (global keyboard shortcuts)
- electron-updater (auto-updates)
- electron-builder (packaging for macOS + Windows)

## Project Structure

```
src/
  main/              -- Electron main process
    main.ts          -- App lifecycle, window creation, tray setup
    dictation.ts     -- Dictation state machine (idle -> recording -> transcribing -> processing -> pasting)
    audio.ts         -- Audio recording (macOS: native Swift binary; Windows: ffmpeg/PowerShell)
    api.ts           -- OpenAI/Groq API calls (transcribe, cleanup, commands)
    paste.ts         -- Text insertion into active app, undo, sound effects
    shortcuts.ts     -- Global hotkey registration via uiohook-napi
    tray.ts          -- System tray icon and menu
    store.ts         -- Settings persistence (electron-store)
    db.ts            -- SQLite database for dictation history, dictionary, snippets
    ipc.ts           -- IPC handlers between main and renderer
    license.ts       -- License verification
    updater.ts       -- Auto-update logic
    preload.ts       -- Context bridge for renderer
  renderer/          -- React UI
    App.tsx           -- Main app with routing (settings, overlay, onboarding)
    components/
      settings/       -- Settings tabs (General, Account, Privacy, Personalization, Home)
      overlay/        -- Floating dictation status overlay
      onboarding/     -- First-launch wizard (7 steps)
      history/        -- Dictation history panel
    hooks/useAPI.ts   -- API communication hook
    i18n/             -- Bulgarian + English translations
```

## Architecture Flow

1. User holds configured hotkey (default: Right Option)
2. `shortcuts.ts` detects keydown via uiohook-napi, triggers `dictation.startDictationSession()`
3. `audio.ts` spawns a native Swift recorder binary (macOS) or ffmpeg/PowerShell (Windows), records 16kHz mono WAV
4. User releases hotkey -- `audio.stopRecording()` kills the recorder process, reads the WAV file
5. `api.ts` sends audio to OpenAI gpt-4o-transcribe for speech-to-text
6. If AI formatting is enabled, raw text is sent to Groq (llama-3.3-70b-versatile) for grammar/style cleanup
7. `paste.ts` inserts cleaned text into the previously active application via clipboard + Cmd/Ctrl+V
8. History is saved locally in SQLite

**Command mode**: Double-tap hotkey to give a voice command that transforms selected text (uses gpt-4o-mini).

## External APIs

- **OpenAI** -- gpt-4o-transcribe (STT), gpt-4o-mini (voice commands)
- **Groq** -- llama-3.3-70b-versatile (text cleanup, faster than OpenAI)
- **diktuvai.bg** -- Optional server proxy for transcription (license-based)

## How to Run

```bash
npm install
npm run dev          # electron-vite dev mode
npm run build        # build for production
npm run package:mac  # package .dmg for macOS
npm run package:win  # package .exe for Windows
```

## Key Conventions

- State machine pattern for dictation lifecycle (idle/recording/transcribing/processing/pasting/error)
- All UI text is bilingual (bg/en) via i18n files in `src/renderer/i18n/`
- Audio recording has multi-tier fallback: native Swift -> sox -> ffmpeg -> PowerShell
- Settings stored via electron-store, history via better-sqlite3
- Overlay window is always-on-top, transparent, non-focusable (never steals focus)
- Single instance lock -- only one app instance allowed
