const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web build loads SQLite as WebAssembly. The web export (which also carries
// the API routes) cannot bundle without this.
config.resolver.assetExts.push('wasm');

// withUniwindConfig must stay the outermost wrapper.
module.exports = withUniwindConfig(config, {
  cssEntryFile: './src/global.css',
  dtsFile: './src/uniwind-types.d.ts',
});
