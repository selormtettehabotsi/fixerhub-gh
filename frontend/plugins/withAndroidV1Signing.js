const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * FixerHub config plugin — force legacy v1 (JAR) APK signing ON.
 *
 * WHY: The Android Gradle Plugin auto-DISABLES v1 signing when
 * minSdkVersion >= 24 (ours is 24), producing a v2-only APK. That is
 * spec-legal, but several OEM installers — MIUI (Xiaomi), older EMUI
 * (Huawei), some Samsung One UI builds on Android 8/9 — still require the
 * legacy JAR signature block and fail with "There was a problem parsing
 * the package" without it. Re-enabling v1 alongside v2 fixes those phones.
 *
 * HOW: `signingConfigs.all { }` applies to EVERY signing config in the
 * container, including the `release` config EAS injects with your keystore
 * — and, because NamedDomainObjectContainer.all() is a live action, it
 * fires even on configs added after this block runs.
 */
const SNIPPET = [
  '',
  '    // FixerHub: force v1 + v2 signing on every signing config (OEM installer compatibility)',
  '    signingConfigs {',
  '        all {',
  '            enableV1Signing = true',
  '            enableV2Signing = true',
  '        }',
  '    }',
  '',
].join('\n');

module.exports = function withAndroidV1Signing(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    if (cfg.modResults.contents.includes('FixerHub: force v1 + v2 signing')) return cfg;
    // Insert immediately after the opening of the top-level `android {` block.
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /^android\s*\{/m,
      (match) => `${match}\n${SNIPPET}`
    );
    return cfg;
  });
};
