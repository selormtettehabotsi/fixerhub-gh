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
      config: { ...config.android?.config, googleMaps: { apiKey: mapsKey } },
    },
    ios: {
      ...config.ios,
      config: { ...config.ios?.config, googleMapsApiKey: mapsKey },
    },
  };
};
