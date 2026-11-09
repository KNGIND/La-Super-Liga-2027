// Configuración de Capacitor (OPCIONAL: solo para generar el APK; no afecta el desarrollo diario).
// Ver docs/android-apk.md. No importamos tipos de @capacitor/cli para no obligarte a instalarlo.
const config = {
  appId: 'com.lasuperliga.app',
  appName: 'La Súper Liga',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  android: { allowMixedContent: false },
};
export default config;
