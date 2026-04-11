# DiktuvAI Code Signing & Notarization

## Status (2026-04-11)

✅ **Code signing — DONE**
- Apple Developer Program активен (Vasil Ralchev, Team ID: WTL2KVDPVM)
- Developer ID Application certificate инсталиран в Keychain
- Apple intermediate CAs (G2 + WWDR + Root) инсталирани
- electron-builder подписва .app + DMG успешно
- Identity: `Developer ID Application: Vasil Ralchev (WTL2KVDPVM)`
- Cert SHA1: `4874C23633CC930B9AA633B123F99E9FFC12E671`
- Cert expira: 2031-04-12

⏳ **Notarization — STUCK on Apple side**
- 3 submissions всички "In Progress" повече от 12 часа
- Submission IDs (за reference):
  - `c306a4f8-a570-4f1d-bc51-05edaac62234` (DiktuvAI.zip, 2026-04-11 10:54)
  - `4f745ec8-b220-4c1a-9355-1d2a28dd5c82` (DiktuvAI-notarize.zip, 2026-04-11 19:44)
  - `cf9f07b1-1037-4d53-a3b1-5f071349944c` (DiktuvAI-1.2.1-arm64-signed.dmg, 2026-04-11 20:19)
- Apple notary service backlog за нови developer accounts
- Известно е че първа submission може да отнеме 24+ часа

## Files

- **Signed DMG (unnotarized):** `~/diktuvai-release/DiktuvAI-1.2.1-arm64-signed.dmg` (115MB)
- **Signed .app:** `~/diktuvai-release/mac-arm64/DiktuvAI.app`
- Build output: `~/diktuvai-release/` (NOT inside `~/Documents/` because iCloud xattrs break codesign)
- Certs: `~/Documents/DiktuvAI/desktop/build/certs/` (gitignored)
- Env vars: `~/Documents/DiktuvAI/desktop/.env.signing` (gitignored)

## Resume Notarization

Когато Apple service се разчисти:

```bash
cd ~/Documents/DiktuvAI/desktop
set -a && source .env.signing && set +a

# Check submission history first
xcrun notarytool history --key "$APPLE_API_KEY" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_API_ISSUER"

# If old submissions completed (Accepted), staple them:
xcrun stapler staple ~/diktuvai-release/DiktuvAI-1.2.1-arm64-signed.dmg

# Otherwise submit fresh:
xcrun notarytool submit ~/diktuvai-release/DiktuvAI-1.2.1-arm64-signed.dmg \
  --key "$APPLE_API_KEY" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_API_ISSUER" \
  --wait --timeout 30m

# Then staple
xcrun stapler staple ~/diktuvai-release/DiktuvAI-1.2.1-arm64-signed.dmg

# Verify notarization
spctl --assess --verbose=2 --type open --context context:primary-signature \
  ~/diktuvai-release/DiktuvAI-1.2.1-arm64-signed.dmg
```

## Build Process Gotchas

1. **iCloud Drive xattrs break codesign.** Build output MUST be outside `~/Documents/`. `package.json` has `directories.output: /Users/inatr/diktuvai-release`.

2. **`afterPack` hook** in `build/afterPack.js` strips xattrs from .app before signing. Required.

3. **Env vars for notarization** (in `.env.signing`):
   - `APPLE_API_KEY` (path to .p8 file, NOT the content)
   - `APPLE_API_KEY_ID`
   - `APPLE_API_ISSUER` (NOT `APPLE_API_KEY_ISSUER`)
   - `APPLE_TEAM_ID`

4. **Don't use `notarize.teamId` in package.json** — use `notarize: true` and `APPLE_TEAM_ID` env var.

5. **Manual DMG creation** if electron-builder fails on notarization step:
   ```bash
   hdiutil create -volname "DiktuvAI" -srcfolder mac-arm64/DiktuvAI.app \
     -ov -format UDZO DiktuvAI-X.Y.Z-arm64-signed.dmg
   codesign --sign "Developer ID Application: Vasil Ralchev (WTL2KVDPVM)" \
     --timestamp DiktuvAI-X.Y.Z-arm64-signed.dmg
   ```

## Without Notarization (Temporary Workaround)

Users can right-click DMG → Open to bypass Gatekeeper. But this is ugly UX —
notarization will fix it. Don't publicly publish unnotarized builds.
