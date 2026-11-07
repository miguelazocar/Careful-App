# Compilar Careful

## Requisitos

- Node.js 22+ (probado con 24)
- Android SDK (Android Studio) con plataforma 35+ y NDK 27
- JDK 17+ (sirve el JBR incluido en Android Studio)

```bash
npm install
npm run check        # typecheck + lint + tests
```

## Desarrollo

La app usa módulos nativos que no están en Expo Go, así que se corre como *development build*:

```bash
npx expo run:android            # compila e instala en un emulador/dispositivo
npx expo start --dev-client     # luego, solo el bundler
```

## APK de release (local, Windows)

```powershell
.\scripts\build-apk.ps1                          # arm64-v8a, armeabi-v7a, x86_64
.\scripts\build-apk.ps1 -Abis "arm64-v8a"        # más rápido / más liviano
```

El APK queda en `dist/Careful-<versión>.apk`.

### Notas para Windows

- Las rutas de compilación C++ de la New Architecture superan los 260 caracteres. Hace falta:
  1. Rutas largas habilitadas: `HKLM\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled = 1`.
  2. **CMake 3.31.x** instalado desde el SDK Manager (trae Ninja 1.12, que soporta rutas largas). El plugin `plugins/with-windows-cmake.js` lo selecciona automáticamente al hacer prebuild en Windows (`CAREFUL_CMAKE_VERSION` permite cambiar la versión).
- El build de release usa R8; las reglas extra (por ejemplo para WorkManager) están en `app.json › expo-build-properties › extraProguardRules`.

### Firma

El plugin `plugins/with-release-signing.js` firma el release con la keystore propia si existen estas variables de entorno (el script las carga desde `%USERPROFILE%\.careful\signing.env`):

```
CAREFUL_KEYSTORE=C:\Users\<usuario>\.careful\careful-release.jks
CAREFUL_KEYSTORE_PASSWORD=...
CAREFUL_KEY_ALIAS=careful
CAREFUL_KEY_PASSWORD=...
```

> ⚠️ **Nunca subas la keystore ni las contraseñas al repositorio.** Guardá una copia segura: si se pierde, las actualizaciones del APK no se podrán instalar sobre la versión anterior (habría que desinstalar).

Sin esas variables, el build se firma con la clave debug de Expo (útil para colaboradores).

## EAS Build (nube)

```bash
npx eas-cli@latest build --platform android --profile preview
```

Genera un APK descargable desde expo.dev. Para Play Store usar `--profile production` (AAB) y Play App Signing.

## Versionado

Antes de cada release: subir `expo.version` y `expo.android.versionCode` en `app.json` y anotar los cambios en `CHANGELOG.md`.
