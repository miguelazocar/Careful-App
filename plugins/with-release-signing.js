/**
 * Signs release builds with Careful's own keystore when these env vars are present:
 *   CAREFUL_KEYSTORE, CAREFUL_KEYSTORE_PASSWORD, CAREFUL_KEY_ALIAS, CAREFUL_KEY_PASSWORD
 * Without them, Expo's default (debug) signing is kept, so contributors can still build.
 * The keystore and its passwords must never be committed (see docs/BUILD.md).
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// careful-release-signing';

const BLOCK = `
${MARKER}
def carefulKeystore = System.getenv("CAREFUL_KEYSTORE")
if (carefulKeystore) {
    android.signingConfigs.create("carefulRelease") {
        storeFile file(carefulKeystore)
        storePassword System.getenv("CAREFUL_KEYSTORE_PASSWORD")
        keyAlias System.getenv("CAREFUL_KEY_ALIAS")
        keyPassword System.getenv("CAREFUL_KEY_PASSWORD")
    }
    android.buildTypes.release.signingConfig android.signingConfigs.carefulRelease
}
`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language === 'groovy' && !cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += BLOCK;
    }
    return cfg;
  });
};
