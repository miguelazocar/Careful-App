# Sincronización con Google Drive

Careful sube respaldos `.zip` (datos + fotos) a una carpeta **«Careful Respaldos»** en el Drive del usuario y los restaura desde ahí. No hay servidor intermedio: el teléfono habla directo con la API de Google Drive.

## Cómo funciona

| Pieza | Dónde | Qué hace |
|---|---|---|
| Autorización | [`modules/careful-google-auth`](../modules/careful-google-auth) (Kotlin) | Pide el permiso con el `AuthorizationClient` de Google Identity Services, que reemplaza a la API GoogleSignIn, hoy deprecada. No hace falta "iniciar sesión": solo se autoriza el acceso a Drive. |
| Cliente de Drive | [`src/lib/google-drive.ts`](../src/lib/google-drive.ts) | Cliente REST v3 mínimo y puro (con tests): carpeta, subida reanudable, listado, descarga, borrado y reintento con token nuevo ante un 401. |
| Política | [`src/domain/backup-policy.ts`](../src/domain/backup-policy.ts) | Cuándo toca respaldar, qué red se permite ("Solo con Wi-Fi") y qué copias viejas se borran. |
| Servicio | [`src/services/drive.ts`](../src/services/drive.ts) y [`backup.ts`](../src/services/backup.ts) | Conectar y desconectar, subir, listar, restaurar, y los disparadores automáticos. |

**Permiso `drive.file`**: la app solo ve los archivos que creó ella; el resto del Drive del usuario es invisible para Careful. Google lo clasifica como permiso **no sensible**, así que no requiere verificación de la app.

**Cuándo se sube**
- Cada 1 h a 1 semana, según la frecuencia elegida (WorkManager, también con la app cerrada).
- Si está activado, unos segundos después de cada registro.
- Si la subida quedó pendiente, porque no había Wi-Fi, no había conexión o falló, se reintenta cuando vuelve la red, cuando se abre la app o en la próxima ejecución periódica.

En el uso diario no aparece ninguna pantalla: si Google pide autorizar de nuevo, la app lo muestra como error en *Ajustes › Respaldo* y el usuario toca «Reconectar».

**Retención**: se conservan los últimos 10 respaldos en la carpeta. Una base vacía (instalación nueva o "Borrar todos los datos") **nunca** se sube automáticamente, para no desplazar respaldos buenos.

## Configurar Google Cloud (una sola vez)

Google identifica a la app por **nombre de paquete + huella SHA-1 del certificado de firma**. Por eso no hay client ID ni secreto en el código.

1. **Proyecto**: en [console.cloud.google.com](https://console.cloud.google.com) creá un proyecto (por ejemplo `Careful`).
2. **API**: en *APIs y servicios › Biblioteca*, habilitá **Google Drive API**.
3. **Google Auth Platform › Comenzar**:
   - Nombre de la app `Careful` y correo de asistencia.
   - Público **Externo**.
   - Correo de contacto.

   No subas logo: si lo subís, Google pide verificación de marca.
4. **Acceso a los datos**: agregá el permiso `https://www.googleapis.com/auth/drive.file`.
5. **Público**: **Publicar app** (*En producción*). En modo de prueba solo pueden usarla los usuarios de prueba, y Google puede pedir el permiso otra vez cada 7 días.
6. **Clientes › Crear cliente › Android**:
   - Nombre del paquete: `com.miguelazocar.careful`
   - SHA-1 de la keystore de release: `C1:8F:39:D3:64:3C:7D:16:73:9A:F1:DB:04:DF:DE:BD:55:EF:4A:AF`

   Se obtiene con `keytool -list -v -keystore careful-release.jks -alias careful`.

### Development builds

`npx expo run:android` firma con la keystore de debug (`android/app/debug.keystore`), que tiene **otra** huella. Para probar Drive en desarrollo, creá un **segundo cliente Android** con el mismo paquete y la SHA-1 de debug:

```bash
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

### Forks

Si publicás tu propia variante, cambiá `android.package` en `app.json`, firmala con tu keystore y repetí estos pasos en tu propio proyecto de Google Cloud.

## Problemas frecuentes

| Mensaje en la app | Causa | Solución |
|---|---|---|
| «Google no reconoce esta versión de la app» | El paquete o la SHA-1 del cliente Android no coinciden con el APK instalado (`DEVELOPER_ERROR`). | Revisá el cliente en *Clientes*. Un APK de debug necesita su propio cliente. |
| «La Google Drive API no está habilitada…» | Falta el paso 2. | Habilitala y esperá unos minutos. |
| «Google pide autorizar de nuevo» | El permiso se revocó desde la cuenta de Google o la app sigue en modo de prueba. | *Ajustes › Respaldo › Desconectar* y volver a conectar. |
| «Tu Google Drive no tiene espacio libre» | Cuota llena. | Liberar espacio en Drive. |

El usuario puede quitarle el acceso a Careful en cualquier momento desde [myaccount.google.com/connections](https://myaccount.google.com/connections).
