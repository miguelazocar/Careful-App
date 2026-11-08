# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado [SemVer](https://semver.org/lang/es/).

## [1.1.0] — 2026-11-07

### Agregado
- **Sincronización directa con Google Drive**: respaldos automáticos en la carpeta «Careful Respaldos» (cada 1 h a 1 semana y tras cada registro), **solo con Wi-Fi** o también con datos móviles, subida manual y restauración desde la lista de respaldos de Drive.
- Módulo nativo `careful-google-auth` (Google Identity Services, `AuthorizationClient`), sin client ID ni secretos en el código.
- En una instalación nueva, la bienvenida ofrece restaurar un respaldo.
- Licencia MIT.

### Cambiado
- La pantalla de Respaldo se organiza en Google Drive, carpeta del teléfono, frecuencia (común a ambos destinos) y otros.
- Las subidas pendientes (sin Wi-Fi o sin red) se reintentan cuando vuelve la conexión o al abrir la app.

### Corregido
- La fecha del último respaldo podía mostrarse corrida un día de noche (se calculaba en UTC); ahora muestra día y hora locales.
- Una base vacía ya no se respalda automáticamente, así no desplaza respaldos buenos.

## [1.0.0] — 2026-11-07

Primera versión.

### Agregado
- Garage con tarjetas grandes por vehículo (foto con degradado diagonal, marca, modelo, color, patente estilo Mercosur y bandera).
- Wizard de alta en 3 pasos con catálogo offline de 10 marcas desde el año 2000 (marca → año → modelo → versión → color), datos registrales y fluidos.
- Escaneo de cédula verde y lectura de patente con IA (en el teléfono o con Gemini).
- "Investigar automáticamente" el aceite y el refrigerante (catálogo offline + Gemini con búsqueda web).
- Registro de mantenimientos por 12 categorías con íconos, accesorios y "solo kilometraje", con monto, taller, descripción, fotos y "Mejorar texto".
- Agenda inteligente: próximo service por km o fecha (lo que ocurra primero) con estimación de uso diario, recordatorios manuales y plan de mantenimiento editable.
- Notificaciones en 4 momentos (mes, semana, día anterior, mismo día) + aviso a menos de 1.000 km + recordatorio de actualizar el km.
- Historial agrupado por mes con filtros y gráfico de gastos.
- Exportación del historial del vehículo en PDF.
- Bloqueo con PIN o biometría del teléfono.
- Respaldo: Auto Backup de Android, respaldo automático a carpeta (1 h a 1 semana y tras cada registro), envío a Drive y restauración.
- Tema sistema / claro / oscuro.
