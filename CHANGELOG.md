# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

### Agregado
- **Registrar con el botón ＋ en tres opciones**: Servicio / Mantenimiento, Accesorios o Kilometraje.
  - **Servicio**: «¿Qué se hizo?» muestra las categorías (Motor, Caja, Frenos, Tren delantero, Ruedas, Sistema eléctrico, Climatización, Lavado…); cada una abre sus tareas y se pueden elegir varias.
  - Las tareas del plan de mantenimiento piden **cada cuántos km y cada cuántos meses toca la próxima**. Vienen precargados con el plan del vehículo y se pueden cambiar: los km aceptan solo números enteros y los meses se ajustan con − y +.
  - Siempre se piden kilometraje, monto, descripción y una foto opcional.
  - **Accesorios** y **Kilometraje** se cargan en un panel rápido. Accesorio pide qué se puso (texto libre), una **etiqueta** opcional (Luces, Estéreo, Alarma…) para encontrarlo y filtrar, descripción, monto, km, **fecha** (hoy por defecto, se puede elegir otra) y foto. Kilometraje pide solo el km actual y una descripción.
- **Pestaña Aceite de la ficha**: muestra «Cambio cada X km o N meses», el próximo cambio y una barra de cuánto falta. El intervalo base se edita en el paso Aceite del asistente.
- **Cada servicio nuevo reemplaza al anterior**: el próximo vencimiento y el conteo de km empiezan de nuevo desde ese día y ese kilometraje.
- **Plan de mantenimiento con 6 tareas de motor**: cambio de aceite y filtro, filtro de aire del motor, filtro de aire del habitáculo, filtro de combustible, bujías y kit de distribución. Son las únicas que se agendan y avisan; el resto queda solo en el historial. Las seis se agendan desde el primer día: hasta registrarlas, el vencimiento es una estimación (el próximo múltiplo del intervalo de km o el plazo desde el alta).
- **Filtros junto con el cambio de aceite**: la tarjeta del cambio de aceite pregunta «¿También cambiaste?» con filtro de aire del motor, del habitáculo y de combustible. Marcarlos reinicia también sus contadores de km y meses.
- **Archivar con motivo**: venta, pérdida, robo, cedido, embargado, siniestro, baja / desguace u otro, más un detalle opcional. El auto sale del garage, de la agenda y de los avisos, y queda en **Archivados** (botón al final del garage) con su historial, su informe PDF y la opción de restaurarlo.
- **Adjuntos en servicios y accesorios**: además de sacar o elegir fotos, se puede **subir un archivo** (factura en PDF, garantía en Word, planilla…, hasta 20 MB). Se ve con su nombre, se abre con la app del teléfono que corresponda y viaja en los respaldos. El historial indica cuántos archivos tiene cada registro y el PDF del vehículo los lista.
- **Avisos semanales**: desde que faltan 1.000 km o un mes para el vencimiento (lo que llegue primero), hasta que se registre el servicio, aunque ya esté vencido. Además, «Mañana» y «Hoy» el día del vencimiento.
- **Informe del vehículo en PDF**, para entregar a un comprador:
  - **Resumen**: km recorridos desde el alta, gasto total y por rubro, costo por km, servicios, cambios de aceite, accesorios y uso promedio.
  - **Ficha técnica completa** y **estado de cada servicio** (al día, pronto o vencido).
  - **Historial detallado** con fotos.
- **«Investigar con IA»** en los pasos Aceite y Refrigerante. Busca en internet los datos del fabricante para el año, la marca, el modelo, el motor y la versión exactos, con fuentes fiables: manual, sitio oficial y buscadores de lubricantes. Completa también el intervalo de cambio de aceite y muestra las fuentes consultadas.
- **Catálogo del mercado argentino completo**: 88 marcas, unos 1.000 modelos y unas 11.500 versiones, de 1997 a 2026.
  - Los nombres y años salen de cuatro ediciones de las listas de la Cámara del Comercio Automotor (2011, 2016, 2021 y 2026).
  - Se eligen primero la marca y el año. Después aparecen solo los modelos de ese año y las versiones de ese modelo en ese año.
  - «Otro modelo» es la única forma de escribir el modelo y la versión a mano.
  - Ver [docs/CATALOG.md](docs/CATALOG.md).
- **Ficha del vehículo nueva**: foto arriba y un recuadro con pestañas (**Vehículo**, **Aceite**, **Refrigerante**) que se ve completo, sin scroll. La pestaña Vehículo arranca con **total gastado, kilometraje actual y próximo cambio de aceite (en km)**. Abajo hay accesos a **＋ Evento**, Kilometraje, Services e Historial.
- **Datos de aceite**:
  - tipo (mineral, semi-sintético o sintético);
  - cantidad;
  - marca, modelo y versión.
- **Datos de refrigerante**:
  - tipo (inorgánico, orgánico o híbrido);
  - cantidad total y concentración (30, 40, 50 o 60 %);
  - **cuánto refrigerante y cuánta agua desmineralizada usar** (por ejemplo, 6 L al 40 % = 2,4 L + 3,6 L);
  - marca, modelo y versión.
- **Tipo de patente** en el paso Registro: Mercosur (Argentina, Brasil, Uruguay y Paraguay, con «MERCOSUR» y la bandera del país), Argentina 1995–2016 (negra), Chile, Perú y los 27 países de la Unión Europea (franja azul con las estrellas y la bandera), más «Otro país». La patente se dibuja con ese diseño en el garage, en la ficha, en el selector y en el reporte PDF; ya no se muestra la bandera suelta al lado del número. Los autos cargados antes toman el diseño según su país y el formato de la patente.
- **Logos de las marcas**, de [Simple Icons](https://simpleicons.org) (CC0), en la ficha y en el asistente.
- **Editar o borrar datos ya guardados pide la seguridad activa** (PIN de App o desbloqueo del teléfono).
- Se puede probar en **Expo Go**. Las funciones que necesitan módulos nativos propios (OCR del teléfono, Google Drive) avisan que no están disponibles en lugar de cerrar la app.

### Cambiado
- **Reporte del vehículo en PDF**: botón **«Descargar reporte PDF»** a la vista en la ficha del auto, que lo genera y abre el menú para compartirlo o guardarlo. El reporte va en este orden: 1) datos del vehículo (ficha, uso y plan de mantenimiento), 2) historial completo de servicios, reparaciones y accesorios, 3) resumen de servicios y mantenimientos (cantidad, gasto, promedio y desglose por rubro), 4) resumen de accesorios (desglose por etiqueta) y 5) total general (gasto total, km recorridos y costo por km).
- **Pantalla de bloqueo**: el fondo azul lleva un mosaico de íconos de servicios (aceite, filtros, batería, cubiertas, frenos, lavado…) casi transparente.
- **Agenda en lista cronológica**, sin el calendario mensual: primero los vencidos y después mes por mes, con la fecha de cada service a la izquierda. Filtros por auto y por tipo de mantenimiento (y recordatorios).
- **Historial**: se quitó el gráfico de gastos de los últimos 6 meses. Queda el registro completo por mes, con filtros por auto y por tipo (servicio, accesorios, kilometraje); al filtrar accesorios aparecen sus etiquetas en uso para filtrar por cada una.
- **Nombres del catálogo corregidos**:
  - Sin palabras duplicadas por la negrita de los PDF («5P 5P 1,4 1,4 FIRE FIRE» → «5P 1,4 FIRE»).
  - Unos 35 errores de tipeo de las listas corregidos (TITANIUN, LUXYRY, LIMTED…).
  - Modelos con su nombre real: «Odyssey», «Renegade», «C4 Lounge», «i10», «MX-5», «218i», «Audi S3/S4/S5»…
  - Modelos duplicados unificados («F 430» y «F430»; «DS 3» y «3»).
  - Versiones repetidas por escribirse con y sin barra unificadas: «A/T» y «AT» (automática), «M/T» y «MT» (manual), «7/A» y «7A», «7/P» y «7P». Eran 331; por ejemplo, el Tracker 2016 mostraba «LTZ A/T 4X4 AWD» y «LTZ AT 4X4 AWD».
- Notificaciones: los avisos «al comenzar el mes» y «al comenzar la semana» pasan a ser un **aviso semanal** que empieza 1 mes o 1.000 km antes.
- **Asistente de alta y edición en 4 pasos** que entran en una pantalla: Auto, Registro, Aceite, Refrigerante. Cada dato se elige desde un panel, y al elegir uno se abre el siguiente. Al editar, se abre directo en el paso de la pestaña desde la que se tocó Editar.
- Combustible: **GNC, Gasolina o Diésel**.
- Se quitó el "apodo" del vehículo: ahora siempre se muestran la marca y el modelo.
- **Ninguna animación rebota**: los paneles y las tarjetas se deslizan y frenan suave. Un PIN incorrecto muestra un aviso en lugar de sacudir los puntos.
- **Garage**: la tarjeta de cada auto alinea los datos a la derecha, en este orden: patente (destacada), marca, modelo, color y kilometraje actual.
- **Garage**: se quitaron los resúmenes (vehículos, pendientes, gastos) y el cartel "Activá los avisos de service".
- **Los avisos de service están siempre activos**: se quitó el interruptor en Ajustes › Notificaciones. Solo dependen del permiso de notificaciones del teléfono.
- **El service se agenda desde el primer día**: si un auto no tiene ningún cambio de aceite registrado, se estima el primero. Es el próximo múltiplo del intervalo de km (por ejemplo, 50.000 km) o un año desde el alta, lo que ocurra primero. Se muestra como "Estimado" y se ajusta solo al registrar el service real.

- **Respaldo siempre automático**: se quitaron la frecuencia y "Además, tras cada registro".
  - Ahora se guarda una copia después de cada cambio. Si se hacen varios cambios seguidos, se espera al último y se guarda una sola.
  - Además, se guarda una copia por día, después de la medianoche.
  - Al conectar Drive o elegir una carpeta, ese destino queda activo sin más interruptores.
- **Respaldo**: la pantalla tiene dos secciones, **Nube** y **Local**, y arriba una explicación breve de qué hace y cómo.
- **Respaldo en un solo archivo**: cada respaldo reemplaza al anterior, `careful-respaldo.zip`, en lugar de acumular una copia por fecha. En Google Drive se actualiza el mismo archivo; en la carpeta local se reescribe. Las copias con fecha que había se borran en el siguiente respaldo.
- **Seguridad**: "PIN de Careful" pasa a llamarse "PIN de App".
- **Apariencia**: la opción "Sistema" pasa a llamarse "Automático" y es la predeterminada.

### Corregido
- **Montos**: al escribir la quinta cifra el monto se cortaba («12.345» quedaba «1,23»), porque el punto de miles se tomaba como coma decimal. Ahora se pueden cargar montos de millones; la coma (o el punto recién tecleado) marca los decimales.
- En Expo Go, la app mostraba un error al abrir porque no podía crear el canal de notificaciones. Ahora los avisos usan el canal por defecto si el propio no se puede crear.
- Al editar un vehículo, "Kilometraje actual" mostraba el kilometraje con el que se lo dio de alta. Ahora muestra el actual, y un valor mayor se guarda como una lectura nueva.
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
