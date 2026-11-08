# Revisión de lógica y decisiones de producto

Este documento compara la idea original ([App-Idea-Raw.md](App-Idea-Raw.md)) con lo que se construyó en la versión 1.0, y explica **por qué** se ajustó cada punto. La regla general fue: respetar la intención, cerrar huecos lógicos y reducir toques.

## 1. Alta de vehículo

| Idea original | Decisión | Motivo |
|---|---|---|
| "Serial de chasis" y "serial de carrocería" como campos separados | Un solo campo **N° de chasis / carrocería (VIN)** + **N° de motor** | Chasis y carrocería son el mismo identificador (VIN, ISO 3779). Lo que la cédula verde trae aparte es el número de motor. |
| No pedía el kilometraje actual | **Kilometraje actual obligatorio** en el paso 2 | Sin un km base no se puede calcular ningún service por distancia. |
| — | **Último cambio de aceite (opcional)** en el paso 3 | Permite que la agenda funcione desde el primer día. |
| Flujo marca → año → modelo → variante → color | Igual, **cada toque avanza solo**, con migas para volver a cualquier paso y **"Otro" con texto libre** en cada nivel | Un catálogo nunca está completo: el usuario no puede quedar bloqueado. |
| — | **Validación del VIN**: largo, caracteres válidos, fabricante y año decodificados, aviso si no coincide con lo elegido | Detecta errores de tipeo. |
| — | Patente con formato automático (`AB 123 CD` / `ABC 123`) y país con bandera | Visual y consistente. |
| "Investigar automáticamente" fluidos | Primero el **catálogo offline**; si no hay datos confirmados, **Gemini con búsqueda web** | Gratis y offline cuando se puede; nube cuando hace falta. |

## 2. Registro de actividad

| Idea original | Decisión | Motivo |
|---|---|---|
| "+" → 2 opciones; "Solo registrar kilometraje" escondido dentro de mantenimiento | "+" → **3 opciones**: Mantenimiento/reparación, Accesorio, **Solo kilometraje** | Actualizar el km es la acción más frecuente: un toque menos. |
| Preguntar el auto **al final** del registro | El auto se elige **arriba del formulario**, preseleccionado (el último usado o el que estás viendo) y **se omite si hay un solo auto** | Menos toques y menos errores: el contexto se define antes de completar los datos. |
| Categorías: motor, caja, tapicería, lavado, ruedas, tren delantero, tren trasero, eléctrico | Se agregan **Frenos**, **Climatización**, **Carrocería** e **Inspección (VTV / service oficial)**, y **"Otro" con texto** en cada categoría | Los frenos son un mantenimiento de seguridad clave y faltaban. |
| Monto "sin símbolo" | Se guarda en **centavos (entero)** y se muestra con formato `12.500,50` | Evita errores de redondeo con decimales. |
| — | **Validación del odómetro**: avisa si el km es menor que un registro anterior o mayor que uno posterior (se puede guardar igual) | Un km mal cargado arruina todas las estimaciones. |
| Fotos adjuntas | Se comprimen (máx. 1600 px, JPEG) y se guardan con **ruta relativa** | Ahorra espacio y hace que los respaldos funcionen en otro teléfono. |
| Accesorios | Lista ampliada y **el matafuego agenda su recarga anual** | En Argentina el matafuego vence cada año. |

## 3. Calendario y notificaciones

| Idea original | Decisión | Motivo |
|---|---|---|
| Agenda solo el cambio de aceite | **Cada ítem con intervalo** agenda el próximo (aceite, filtros, distribución, bujías, refrigerante, líquido de frenos, alineación, A/C, VTV, matafuego…) con **intervalos editables por vehículo** | Misma lógica, más valor. Los valores por defecto son conservadores y se ajustan al manual. |
| — | **Recordatorios manuales** (seguro, patente, VTV, licencia) por fecha y/o km | Obligaciones del auto que no son "mantenimiento". |
| "Según km o fecha, lo que ocurra primero" | Igual. Como la app **no tiene odómetro en vivo**, el vencimiento por km se convierte en **fecha estimada** según el uso promedio (calculado con el historial de km) | Sin esto, el aviso por km solo existiría al abrir la app. |
| Aviso a menos de 1.000 km | Doble: **inmediato** al cargar un km que deja < 1.000 km, y **programado** para la fecha estimada. Umbral configurable | Cubre ambos casos. |
| — | **Recordatorio de actualizar el km** si pasan 30 días sin cargarlo | Mantiene precisas las estimaciones. |
| 4 avisos: inicio de mes, inicio de semana, día anterior, mismo día | Igual, más: **se omiten los momentos ya pasados**, **si dos caen el mismo día se envía solo el más específico**, hora configurable (9:00 por defecto), semana que empieza el lunes | Evita avisos duplicados o tardíos. |

## 4. Seguridad

| Idea original | Decisión | Motivo |
|---|---|---|
| PIN o desbloqueo del teléfono | PIN propio (4 o 6 dígitos, guardado con hash + sal en el Keystore) **o** biometría con respaldo al PIN/patrón del equipo | Igual a lo pedido. |
| Se bloquea al salir | Igual, **excepto** cuando la propia app abre la cámara, la galería, el menú compartir o el selector de archivos | Si no, la app se bloquearía cada vez que sacás una foto. |
| Al entrar pide desbloqueo directo sin alertas previas | Igual: el diálogo biométrico se abre solo | — |
| Contenido visible en multitarea | Igual (sin `FLAG_SECURE`) | — |
| — | Si la base se restaura en otro teléfono con bloqueo por PIN, **se desactiva el bloqueo** en vez de dejar al usuario afuera | El PIN vive en el Keystore del teléfono y no viaja en los respaldos. |

## 5. Respaldo y Google Drive

Tres capas, de la más automática a la más manual:

1. **Sincronización directa con Google Drive** (desde la 1.1): respaldos `.zip` (datos + fotos) en la carpeta «Careful Respaldos» del Drive del usuario, cada **1 hora a 1 semana** y opcionalmente **tras cada registro**, con **"Solo con Wi-Fi"** (por defecto) o Wi-Fi + datos móviles. Restauración desde la lista de respaldos de Drive. Detalle técnico y configuración en [GOOGLE-DRIVE.md](GOOGLE-DRIVE.md).
2. **Copia de seguridad de Android (Google One)**: reglas propias que incluyen la base de datos y excluyen secretos y fotos (límite de 25 MB). Se restaura sola al reinstalar.
3. **Carpeta del teléfono** (por ejemplo, una carpeta sincronizada por otra app) con la misma frecuencia, y **compartir / restaurar** cualquier `.zip` a mano.

Decisiones:
- **Permiso `drive.file`** en vez de acceso completo al Drive: la app solo ve lo que crea. Es un permiso "no sensible" y no requiere la verificación de Google.
- **Carpeta visible** en vez de la carpeta oculta `appDataFolder`: el usuario ve sus respaldos, puede descargarlos y no depende de la app para recuperarlos.
- **Nombre «Careful Respaldos»** y no «Careful», para no mezclarse con una carpeta que el usuario ya tenga con ese nombre (la app no puede ver carpetas ajenas).
- **Sin pantallas en segundo plano**: si Google pide reautorizar, la subida queda pendiente y la app lo informa en Ajustes en lugar de interrumpir.
- **Una base vacía nunca se sube automáticamente**, así una instalación nueva o "Borrar todos los datos" no desplaza respaldos buenos de los 10 que se conservan. En una instalación nueva, al conectar Drive se ofrece directamente restaurar.
- "Solo con Wi-Fi" trata como "no Wi-Fi" a las conexiones desconocidas (VPN, Bluetooth), así nunca gasta datos móviles por error.

Los respaldos **no incluyen** ajustes ligados al dispositivo (bloqueo, carpeta, cuenta de Drive, clave de IA).

## 6. Inteligencia artificial

La arquitectura soporta **las dos opciones desde el inicio**, con la misma interfaz (`AiProvider`):

- **En el teléfono (gratis, offline)**: OCR con ML Kit para leer la cédula y la patente, parser propio de la cédula verde, catálogo offline de fluidos y "Mejorar texto" basado en reglas.
- **Gemini (nube)**: con la clave gratuita del usuario de Google AI Studio (guardada cifrada). Lee fotos, busca en manuales con Google Search y redacta como un jefe de taller.
- **Automático**: usa Gemini si hay clave y conexión; si no, cae a la IA local.

## 7. Otras mejoras

- Tema **Sistema / Claro / Oscuro**.
- **Archivar** un vehículo (vendido) sin perder su historial, además de eliminarlo.
- **Exportar el historial en PDF**: el valor central de una bitácora es demostrar el mantenimiento al vender el auto.
- Gráfico de gastos de los últimos 6 meses e historial agrupado por mes con filtros.
- Datos 100 % locales: sin cuentas ni servidores.
