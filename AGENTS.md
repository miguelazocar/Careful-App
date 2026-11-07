# Careful — guía para agentes y colaboradores

App Android (Expo SDK 58 / React Native 0.88, TypeScript estricto) para llevar la bitácora de mantenimiento de autos. Todo es local (SQLite); no hay servidor.

## Comandos

```bash
npm run check          # typecheck + lint + tests (correr antes de cada commit)
npx expo run:android   # development build en emulador/dispositivo
.\scripts\build-apk.ps1  # APK de release firmado (Windows)
```

Usar siempre `npx expo install <paquete>` para dependencias nativas.

## Convenciones

- Pantallas en `src/app/` (Expo Router). Nada que no sea pantalla dentro de `src/app/`.
- Lógica de negocio **pura** en `src/domain/` y `src/lib/` (sin imports de Expo/RN) y con tests en `__tests__/`.
- Acceso a datos solo vía repositorios de `src/db/`; toda escritura llama a `notifyDataChanged()`.
- Las claves de ítems (`motor.aceite`, …) se persisten: **no renombrarlas**, agregar nuevas.
- Migraciones: solo agregar al final de `MIGRATIONS` en `src/db/migrations.ts`.
- `android/` e `ios/` se generan (CNG): configurar en `app.json` o en `plugins/`.
- Textos de la UI en español rioplatense.
- Las APIs de Expo cambian entre SDKs: verificar en `node_modules/<paquete>/build/*.d.ts` o en https://docs.expo.dev/versions/v58.0.0/.
