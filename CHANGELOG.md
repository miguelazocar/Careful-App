# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

### Cambiado
- **Garage**: la tarjeta de cada auto alinea los datos a la derecha, en este orden: patente (destacada), marca, modelo, color y kilometraje actual.
- **Garage**: se quitaron los resúmenes (vehículos, pendientes, gastos) y el cartel "Activá los avisos de service".
- **Los avisos de service están siempre activos**: se quitó el interruptor en Ajustes › Notificaciones. Solo dependen del permiso de notificaciones del teléfono.
- **El service se agenda desde el primer día**: si un auto no tiene ningún cambio de aceite registrado, se estima el primero. Es el próximo múltiplo del intervalo de km (por ejemplo, 50.000 km) o un año desde el alta, lo que ocurra primero. Se muestra como "Estimado" y se ajusta solo al registrar el service real.

- **Respaldo siempre automático**: se quitaron la frecuencia y "Además, tras cada registro".
  - Ahora se guarda una copia después de cada cambio. Si se hacen varios cambios seguidos, se espera al último y se guarda una sola.
  - Además, se guarda una copia por día, después de la medianoche.
  - Al conectar Drive o elegir una carpeta, ese destino queda activo sin más interruptores.
- **Respaldo**: la pantalla tiene dos secciones, **Nube** y **Local**, y arriba una explicación breve de qué hace y cómo.
- **Respaldo**: se conservan las 5 copias más recientes y una por día de las últimas 2 semanas, en lugar de las últimas 10. Así, muchos cambios seguidos no borran el historial.
- **Seguridad**: "PIN de Careful" pasa a llamarse "PIN de App".
- **Apariencia**: la opción "Sistema" pasa a llamarse "Automático" y es la predeterminada.

### Corregido
- Un cambio hecho mientras se subía una copia podía quedar sin respaldar hasta el día siguiente. Ahora se guarda otra copia al terminar.
- Si el teléfono deja de tener bloqueo de pantalla, el modo "Desbloqueo del teléfono" ya no deja la app trabada en la pantalla de bloqueo: se desactiva y avisa, igual que cuando se pierde el PIN.

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
- Con "Desbloqueo del teléfono", al volver a la app podía quedar en "Tocá para desbloquear" sin abrir nunca la huella o el PIN del equipo. La solicitud se lanzaba con la app todavía en segundo plano y quedaba colgada. Ahora se pide al volver a primer plano, y tocar el botón descarta cualquier solicitud trabada.
- Los avisos internos (por ejemplo, "Respaldo guardado") ya no rebotan: entran deslizándose suavemente, quedan unos 3 segundos y salen.
- "Investigar automáticamente" con Gemini terminaba en "sin datos confirmados":
  - solo se consultaba a Gemini si el catálogo no tenía ningún litraje;
  - la búsqueda web de Gemini no está disponible con todas las claves, por ejemplo con algunas gratuitas, y ese error se descartaba sin avisar.

  Ahora Gemini completa cualquier dato que le falte al catálogo, sin pisar los valores del catálogo. Si la búsqueda web no está disponible, responde con lo que sabe del motor, y si falla se muestra el motivo.

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
