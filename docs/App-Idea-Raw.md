App development: vehicle log features
Concepto General de la App
App de bitácora vehicular: registra historial de mantenimientos, servicios y accesorios por auto

Plataforma inicial: Android con React Native + Expo (multiplataforma, iOS después)

Base de datos local en el teléfono, sin servidor centralizado

Diseño: máxima atracción visual, mínimos toques, UX de primer nivel

Pantalla Principal y Navegación
Pantalla principal: lista de autos como rectángulos grandes

Foto del vehículo a la izquierda con degradado diagonal

Datos a la derecha: marca, modelo, color, patente, bandera del país

Botón “+” arriba a la derecha para agregar un auto

Barra inferior con 5 iconos:

Icono de auto (pantalla principal)

Historial (últimos movimientos con resumen breve)

Botón “+” central (más grande que el resto) para registrar actividad

Calendario (próximos servicios programados)

Engranaje (configuraciones)

Alta de Vehículo (Wizard)
Pantalla 1: foto del auto + datos registrales

Marca, modelo, año, variante, color, patente, serial de chasis, serial de carrocería

Flujo de selección: marca → año → modelo → variante → color

Marcas incluidas desde año 2000: Ford, Chevrolet, Volkswagen, Toyota, Citroën, Peugeot, Fiat, DS, Mercedes Benz, Renault

Pantalla 2: datos técnicos de fluidos

Tipo y cantidad de aceite (litros), tipo y cantidad de refrigerante

IA en el alta:

Foto de cédula verde → extrae todos los datos registrales automáticamente

Foto del auto → detecta patente y color

Botón “Investigar automáticamente” → busca en manuales oficiales el tipo/cantidad de aceite y refrigerante

Registro de Servicios y Accesorios
Al tocar “+” → dos opciones:

Reparación o Mantenimiento

Accesorios

Reparación o Mantenimiento: selección visual por categorías con iconos

Categorías: motor, caja, tapicería, lavado, ruedas, tren delantero, tren trasero, sistema eléctrico

Dentro de cada categoría: ítems seleccionables múltiples (ej. cambio de aceite, filtro, etc.)

Campos adicionales: descripción libre, kilometraje, monto (sin símbolo de moneda), fotos adjuntas

Opción especial: “Solo registrar kilometraje” (actualiza el odómetro en el historial)

IA: botón “Mejorar texto” que estandariza la descripción en formato técnico y directo

Accesorios: luces, alfombras, parlantes, estéreo, polarizado, llantas, matafuego, fundas, etc.

Al registrar: el sistema pregunta a qué auto de los dados de alta corresponde el registro

Calendario, Notificaciones, Configuración y Seguridad
Calendario inteligente:

Al registrar cambio de aceite, agenda automáticamente el próximo según km o fecha (lo que ocurra primero)

Notificaciones push en 4 momentos: al entrar el mes, al entrar la semana, un día antes y el mismo día

Alerta por kilometraje: avisa cuando faltan menos de 1.000 km para el próximo servicio

Configuraciones:

Tema claro / oscuro

Sincronización con Google Drive (respaldo de base de datos local)

Respaldo automático: mínimo cada 1 hora, máximo cada 1 semana

Sincronización adicional por cada acción registrada (si está activo)

Opción: solo WiFi o WiFi + datos móviles

Seguridad: PIN o método de desbloqueo del teléfono (huella / Face ID)

Se bloquea al salir; al entrar pide desbloqueo directo sin alertas previas

El contenido de la app es visible en el multitarea (no se oculta)

IA (a integrar progresivamente):

Opción A: cuenta de Google del usuario para acceder a modelos Gemini vía API

Opción B: modelo local pequeño que corra en el propio teléfono sin costo de tokens

Próximos Pasos
Investigar modelos y variantes por marca desde el año 2000

Cubrir Ford, Chevrolet, VW, Toyota, Citroën, Peugeot, Fiat, DS, Mercedes Benz y Renault para poblar el selector dinámico marca → año → modelo → variante.

Definir estrategia de integración de IA

Evaluar cuenta Google/Gemini vía API vs. modelo local pequeño sin costo de tokens; la arquitectura de la app debe soportar ambas opciones desde el inicio.

Iniciar desarrollo con React Native + Expo para Android

Construir el wizard de alta de vehículo y la pantalla principal como primer hito, con la base de datos local ya estructurada para soportar IA y sincronización futura.

-- 
Referncia de aplicacion y sentido: https://play.google.com/store/apps/details?id=com.historycar.app

no tomes diseño ni visual de esta app, quierop que tomes la referencia de negocios y logica, siobre todo el sentido