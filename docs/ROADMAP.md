# Roadmap

## Próximas versiones

### Sincronización directa con Google Drive
- Inicio de sesión con Google y subida del respaldo a `appDataFolder` (oculta y privada para la app).
- Opciones **solo Wi-Fi / Wi-Fi + datos móviles** y sincronización tras cada registro.
- **Requisito del desarrollador** (una sola vez):
  1. Crear un proyecto en Google Cloud Console y habilitar la *Google Drive API*.
  2. Configurar la pantalla de consentimiento OAuth (modo prueba con tu email como tester).
  3. Crear un cliente OAuth tipo **Android** con el paquete `com.miguelazocar.careful` y el SHA-1 de la keystore de release: `C1:8F:39:D3:64:3C:7D:16:73:9A:F1:DB:04:DF:DE:BD:55:EF:4A:AF` (se obtiene con `keytool -list -v -keystore careful-release.jks`).
  4. Crear un cliente **Web** y guardar su ID en la configuración de la app.

### IA
- Modelo on-device (Gemini Nano vía ML Kit GenAI) en teléfonos compatibles, para "Mejorar texto" sin conexión con calidad de LLM.
- Lectura de facturas/tickets para completar monto, taller y trabajos.

### Producto
- Cargas de combustible y consumo (km/L).
- Vencimientos de documentación con adjuntos (seguro, VTV, cédula, licencia).
- Transferencia del historial a un nuevo dueño (exportar/importar un vehículo).
- Widgets de pantalla de inicio (próximo service, km).
- iOS (el código es multiplataforma; falta configurar firma y probar).
- Más marcas en el catálogo y datos de fluidos verificados.
- Multi-idioma (es / pt / en).
