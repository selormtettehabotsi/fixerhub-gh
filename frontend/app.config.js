// M8: inject the Google Maps key from the environment instead of committing it.
// Expo loads app.json first, passes it here as `config`, and this file's output wins.
// The key lives in frontend/.env as EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (gitignored).
// Remember to restrict the key to the Android package / iOS bundle id in Google Cloud Console.
module.exports = ({ config }) => {
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? 'MISSING_GOOGLE_MAPS_KEY';
  return {
    ...config,
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
