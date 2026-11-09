# Generar el APK (Capacitor)

**Es opcional.** La app ya funciona como PWA: en Chrome de Android → menú ⋮ → *Instalar app*. El APK sirve si querés distribuirla como archivo o publicarla en una tienda.

Acode **no** puede ejecutar Android Studio ni el SDK. El plan es compilar en la nube.

## Opción A — GitHub Actions (gratis, recomendada)
1. Subí el proyecto a un repositorio de GitHub (desde el celular con la app de GitHub o la web).
2. En una máquina con Node (o en Codespaces/Termux), una sola vez:
   ```bash
   npm init -y
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap add android      # crea la carpeta android/ (subila al repo)
   ```
3. Creá `.github/workflows/apk.yml`:
   ```yaml
   name: APK
   on: workflow_dispatch
   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: 20 }
         - uses: actions/setup-java@v4
           with: { distribution: temurin, java-version: 17 }
         - run: npm install
         - run: mkdir -p www && cp -r index.html manifest.webmanifest sw.js icons images rive src www/
         - run: npx cap sync android
         - run: cd android && ./gradlew assembleDebug
         - uses: actions/upload-artifact@v4
           with:
             name: la-super-liga-apk
             path: android/app/build/outputs/apk/debug/app-debug.apk
   ```
4. En GitHub → Actions → *APK* → *Run workflow*. Al terminar, descargá el `.apk` desde "Artifacts" e instalalo en el celular (permitir "orígenes desconocidos").

## Opción B — Codespaces / PC
`mkdir -p www && cp -r index.html manifest.webmanifest sw.js icons images rive src www/ && npx cap sync android && npx cap open android` y compilar desde Android Studio.

## Notas
- `capacitor.config.json` ya define `appId` (`com.lasuperliga.app`), `appName` y `webDir: www` (la carpeta `www` se arma copiando los archivos de la app, como en el paso de arriba). Cambiá el `appId` antes de publicar.
- El APK **debug** sirve para uso personal. Para Play Store se necesita un APK/AAB **firmado** (keystore propio; no lo subas al repositorio).
- Dentro del APK el service worker funciona sobre `https://localhost` (`androidScheme: 'https'`).
- Íconos: reemplazá `public/icons/` y generá los del APK con `@capacitor/assets` si querés íconos adaptativos.
- **No probado**: la generación del APK no se ejecutó en el entorno de construcción; esta guía sigue el procedimiento estándar de Capacitor.
