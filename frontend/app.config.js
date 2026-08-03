// M8: inject the Google Maps key from the environment instead of committing it.
// Expo loads app.json first, passes it here as `config`, and this file's output wins.
// The key lives in frontend/.env as EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (gitignored).
// Remember to restrict the key to the Android package / iOS bundle id in Google Cloud Console.
module.exports = ({ config }) => {
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? 'MISSING_GOOGLE_MAPS_KEY';
  return {
    ...config,
    // expo-sqlite: synchronous kv-store used for the theme preference
    // withAndroidV1Signing: re-enable v1 APK signing so OEM installers (MIUI/EMUI) can parse the APK
    // expo-build-properties: allow cleartext (http) traffic so a release APK can reach the
    //   dev/LAN backend over plain HTTP (release builds block cleartext by default). Remove
    //   or set false once the backend is served over HTTPS.
    plugins: [
      ...(config.plugins ?? []),
      'expo-sqlite',
      './plugins/withAndroidV1Signing',
      ['expo-build-properties', { android: { usesCleartextTraffic: true } }],
    ],
    android: {
      ...config.android,
      // FCM credential. google-services.json is a secret, so it's kept out of
      // git — but EAS Build only uploads files git tracks, so the builder never
      // got it and the APK shipped without push notifications.
      //
      // It's supplied as an EAS *file* environment variable: EAS writes the
      // file onto the builder and exposes its path in GOOGLE_SERVICES_JSON.
      // That expansion has to happen HERE, not in app.json — app.json is static
      // JSON, so "$GOOGLE_SERVICES_JSON" is read as a literal filename and the
      // build dies with ENOENT. Only a dynamic config can read process.env.
      //
      // Unset locally, so it falls back to the real file on disk.
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile,
      config: { ...config.android?.config, googleMaps: { apiKey: mapsKey } },
    },
    ios: {
      ...config.ios,
      config: { ...config.ios?.config, googleMapsApiKey: mapsKey },
    },
  };
};
