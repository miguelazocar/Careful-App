<p align="center">
  <img src="assets/images/icon-rounded.png" width="104" alt="Ícono de Careful" />
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/images/wordmark-dark.png" />
    <img src="assets/images/wordmark-light.png" width="260" alt="Careful" />
  </picture>
</p>

<h3 align="center">Tu auto, toda su historia en un solo lugar.</h3>

<p align="center">
  Bitácora vehicular para Android: mantenimientos, reparaciones, accesorios, kilometraje y gastos,<br/>
  con avisos inteligentes antes de cada service. 100 % local, con respaldo e IA.
</p>

<p align="center">
  <img alt="Android" src="https://img.shields.io/badge/Android-8.0%2B-3DDC84?logo=android&logoColor=white" />
  <img alt="Expo SDK 58" src="https://img.shields.io/badge/Expo-SDK%2058-000020?logo=expo&logoColor=white" />
  <img alt="React Native" src="https://img.shields.io/badge/React%20Native-0.88-61DAFB?logo=react&logoColor=black" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" />
  <img alt="Offline first" src="https://img.shields.io/badge/datos-100%25%20locales-2EE8B6" />
  <a href="LICENSE"><img alt="Licencia MIT" src="https://img.shields.io/badge/licencia-MIT-1D2633" /></a>
</p>

---

**Careful** (juego de palabras entre *cuidado* y *Car*-eful) es una app para llevar la **historia completa de tus vehículos**: cada service, reparación, accesorio y kilómetro, con fotos y montos. Con esa historia calcula **cuándo toca el próximo mantenimiento, por kilómetros o por fecha (lo que ocurra primero)** y te avisa a tiempo. Y cuando vendas el auto, exportás todo su historial en PDF.

<p align="center">
  <img src="docs/screenshots/garage.png" width="200" alt="Garage" />
  <img src="docs/screenshots/vehicle.png" width="200" alt="Detalle del vehículo" />
  <img src="docs/screenshots/record.png" width="200" alt="Registrar mantenimiento" />
  <img src="docs/screenshots/agenda.png" width="200" alt="Agenda" />
</p>

## ✨ Funcionalidades

### 🚗 Garage
- Tarjetas grandes por auto: foto con **degradado diagonal**, marca, modelo, color, **patente estilo Mercosur** y **bandera del país**.
- Resumen: vehículos, services que requieren atención y gastos del año.
- Detalle por vehículo: kilometraje, uso promedio, próximos services con barra de progreso, ficha técnica e historial.

### 🧭 Alta de vehículo (wizard de 3 pasos)
1. **Tu auto** — foto + selector **marca → año → modelo → versión → color** con catálogo offline de **10 marcas** (Ford, Chevrolet, Volkswagen, Toyota, Citroën, Peugeot, Fiat, DS, Mercedes-Benz y Renault) desde el año 2000. Cada toque avanza solo y siempre hay "Otro".
2. **Registro** — patente, país, **kilometraje actual**, VIN (validado y decodificado), N° de motor y apodo.
3. **Fluidos** — tipo y cantidad de aceite y refrigerante, con **"Investigar automáticamente"**, y opcionalmente el último cambio de aceite.

IA en el alta: **escanear la cédula verde** completa los datos, y la **foto del auto** detecta patente y color.

### 🔧 Registro de actividad (botón ＋ central)
- **Mantenimiento o reparación** en 12 categorías con íconos: motor, caja, frenos, tren delantero, tren trasero, ruedas, sistema eléctrico, climatización, carrocería, tapicería, lavado e inspección. Selección múltiple de ítems y "Otro".
- **Accesorios**: luces, alfombras, parlantes, estéreo, polarizado, llantas, matafuego, fundas, alarma, GPS, cámara y más.
- **Solo kilometraje**: actualizar el odómetro en un toque.
- Fecha, km (con validación contra el historial), monto **sin símbolo de moneda**, taller, descripción con **"Mejorar texto"** y fotos.

### 📅 Agenda inteligente
- Cada ítem con intervalo (aceite, filtros, distribución, bujías, refrigerante, frenos, alineación, A/C, VTV, matafuego…) agenda el **próximo service por km o por fecha, lo que ocurra primero**.
- Como no hay odómetro en vivo, el vencimiento por km se convierte en una **fecha estimada según tu uso promedio**.
- Plan de mantenimiento **editable por vehículo** y recordatorios manuales (seguro, patente, VTV…).
- Calendario mensual + lista de vencidos y próximos.

### 🔔 Notificaciones
- **4 momentos**: al comenzar el mes, al comenzar la semana, el día anterior y el mismo día (sin duplicados).
- **Aviso cuando faltan menos de 1.000 km** (inmediato al cargar km y programado según tu uso).
- Recordatorio para actualizar el kilometraje.

### 🔐 Seguridad y privacidad
- **PIN** propio o **desbloqueo del teléfono** (huella / rostro / PIN del equipo).
- Se bloquea al salir y al volver pide desbloqueo directo, sin diálogos previos.
- **Sin cuentas ni servidores**: los datos viven en tu teléfono.

### ☁️ Respaldo y sincronización
- **Siempre automático**: una copia `.zip` (datos + fotos) **después de cada cambio** (una sola aunque hagas varios seguidos) y **una por día después de la medianoche**. Se conservan las 5 más recientes y una por día de las últimas 2 semanas.
- **Nube (Google Drive)**: carpeta «Careful Respaldos», **solo con Wi-Fi** o también con datos móviles, y restauración desde la lista de copias.
- Permiso mínimo `drive.file`: Careful solo ve los archivos que crea.
- **Copia de seguridad de Android** (Google One) con reglas propias.
- **Local**: carpeta del teléfono, **compartir** una copia por cualquier app y **restaurar** desde archivo.
- 👉 Cómo funciona y cómo configurarlo: [docs/GOOGLE-DRIVE.md](docs/GOOGLE-DRIVE.md).

### 🤖 Inteligencia artificial — dos motores, una interfaz
| | En el teléfono | Gemini (nube) |
|---|---|---|
| Costo | Gratis | Clave gratuita de Google AI Studio |
| Conexión | Offline | Requiere internet |
| Cédula y patente | OCR con ML Kit + parser propio | Visión multimodal |
| Fluidos | Catálogo offline | Búsqueda en manuales con Google Search |
| Mejorar texto | Reglas de estandarización | Redacción técnica |

En modo **Automático** usa Gemini si está configurado y cae a la IA local si no hay conexión.

### 📄 Más
- Historial agrupado por mes, filtros por auto y tipo, y **gráfico de gastos**.
- **Exportar historial en PDF** (ideal para la venta del auto).
- Archivar vehículos vendidos sin perder su historia.
- Tema **automático / claro / oscuro** (automático por defecto).

## 🧠 Decisiones de producto

La idea original se revisó punto por punto. Algunos ajustes: chasis y carrocería son el mismo dato (VIN) y se agregó el N° de motor; el km actual pasa a ser obligatorio en el alta; el "＋" tiene un acceso directo a "solo kilometraje"; se agregó la categoría **frenos**; el bloqueo no se dispara al usar la cámara; y los avisos que caen el mismo día se unifican.
👉 Detalle completo en [docs/LOGIC-REVIEW.md](docs/LOGIC-REVIEW.md).

## 🏗️ Arquitectura

```
src/
├── app/         Pantallas (Expo Router): tabs, vehículo, registro, recordatorios, ajustes
├── components/  UI reutilizable
├── data/        Catálogo de vehículos (JSON por marca)
├── db/          SQLite: migraciones, repositorios, snapshot de respaldo
├── domain/      Lógica pura: agenda, notificaciones, VIN, patentes, parser de cédula
├── services/    Fotos, notificaciones, respaldo y Google Drive, IA, PDF, seguridad
└── theme/       Tokens de diseño (claro/oscuro)
modules/
└── careful-google-auth/   Módulo nativo (Kotlin): autorización de Google para Drive
```

- **Offline-first** con SQLite y migraciones versionadas.
- **Lógica de dominio pura** y testeada; los repositorios se prueban contra **SQLite real** (`node:sqlite`).
- IA detrás de una interfaz `AiProvider` (nube y local intercambiables).

👉 Más en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 🚀 Empezar

Requisitos: Node.js 22+, Android SDK (Android Studio) y JDK 17+.

```bash
git clone https://github.com/miguelazocar/Careful-App.git
cd Careful-App
npm install
npm run check            # typecheck + lint + tests
npx expo run:android     # compila e instala en un emulador o teléfono
```

APK de release firmado (Windows):

```powershell
.\scripts\build-apk.ps1
```

👉 Guía completa (firma, EAS, versionado) en [docs/BUILD.md](docs/BUILD.md).

## 🗺️ Roadmap

IA on-device con Gemini Nano, cargas de combustible, vencimientos de documentación, transferencia del historial a un nuevo dueño, widgets e iOS.
👉 [docs/ROADMAP.md](docs/ROADMAP.md)

## 🎨 Identidad

Ícono, wordmark y paleta en [docs/brand/](docs/brand/). Los assets de la app se generan con `python scripts/generate-brand-assets.py`.

| Azul Careful | Menta | Tinta |
|---|---|---|
| `#0B63F6` | `#2EE8B6` | `#1D2633` |

## 📄 Licencia

[MIT](LICENSE) © 2026 Miguel Angel Azocar. Podés usar, modificar y distribuir el código libremente, manteniendo el aviso de copyright.

## 👤 Autor

**Miguel Angel Azocar** — [@miguelazocar](https://github.com/miguelazocar)

---

<sub>Los datos técnicos del catálogo (capacidades de aceite y refrigerante) son de referencia; verificá siempre el manual de tu vehículo. Marcas y modelos mencionados pertenecen a sus respectivos dueños y se usan solo para identificar vehículos. Los logos de marcas provienen de [Simple Icons](https://simpleicons.org) (CC0) y se muestran solo con ese fin.</sub>
