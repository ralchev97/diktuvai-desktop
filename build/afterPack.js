// Strip extended attributes (resource forks) from the packaged .app before codesign.
// Without this, codesign fails with "resource fork, Finder information, or similar detritus not allowed".
const { execSync } = require('child_process')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`
  console.log(`[afterPack] Stripping xattrs from ${appPath}`)
  try {
    execSync(`xattr -cr "${appPath}"`, { stdio: 'inherit' })
    console.log('[afterPack] xattrs cleared')
  } catch (err) {
    console.error('[afterPack] xattr cleanup failed:', err.message)
    throw err
  }
}
