/**
 * Windows-only build fix.
 *
 * The C++ codegen object paths of New Architecture libraries exceed Windows' 260-char MAX_PATH.
 * Ninja 1.10 (bundled with CMake 3.22.1, the AGP default) cannot handle them, while Ninja 1.12+
 * (CMake 3.31.x) can — provided Windows long paths are enabled (LongPathsEnabled=1).
 *
 * Only applied when prebuild runs on Windows, so Linux/macOS/EAS builds keep AGP defaults.
 * Override the version with CAREFUL_CMAKE_VERSION if a different one is installed.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// careful-windows-cmake';

module.exports = function withWindowsCmake(config) {
  if (process.platform !== 'win32') return config;
  const version = process.env.CAREFUL_CMAKE_VERSION || '3.31.6';
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language === 'groovy' && !cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += `\n${MARKER}\nandroid.externalNativeBuild.cmake.version = "${version}"\n`;
    }
    return cfg;
  });
};
