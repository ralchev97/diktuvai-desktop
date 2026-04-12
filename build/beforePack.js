// Build the native fn-key addon for the target architecture before packaging.
// electron-builder calls this hook once per arch (arm64, x64).
// The compiled .node file lands in native/fn-key/build/Release/fn_key.node,
// which extraResources then copies into the app bundle.
const { execSync } = require('child_process')
const path = require('path')

exports.default = async function beforePack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const arch = context.arch === 1 ? 'x64' : context.arch === 3 ? 'arm64' : 'x64'
  const nativeDir = path.join(context.appDir, 'native', 'fn-key')

  console.log(`[beforePack] Building fn_key native addon for ${arch}`)
  try {
    execSync(
      `node-gyp rebuild --arch=${arch}`,
      {
        cwd: nativeDir,
        stdio: 'inherit',
        env: {
          ...process.env,
          // Ensure node-gyp can find node-addon-api from root node_modules
          NODE_PATH: path.join(context.appDir, 'node_modules'),
        },
      }
    )
    console.log(`[beforePack] fn_key native addon built successfully for ${arch}`)
  } catch (err) {
    console.error(`[beforePack] Failed to build fn_key for ${arch}:`, err.message)
    throw err
  }
}
