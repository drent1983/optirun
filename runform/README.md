# OptiRun

Aplicación web para analizar la técnica de carrera a partir de videos grabados con el móvil.
Detecta el esqueleto del corredor frame a frame, identifica cada apoyo del pie, calcula métricas
biomecánicas, las evalúa con un semáforo, propone ejercicios para lo que está fuera de rango y
permite seguir la evolución entre sesiones.

Todo se ejecuta en el navegador. No hay servidor, no hay cuenta y el video nunca sale del
ordenador: solo se guardan los puntos del esqueleto y las métricas.

El plan original del proyecto, con las decisiones de alcance, está en [../PLAN.md](../PLAN.md).

---

## Índice

1. [Qué hace](#1-qué-hace)
2. [Puesta en marcha](#2-puesta-en-marcha)
3. [Cómo grabar](#3-cómo-grabar)
4. [Uso de la aplicación](#4-uso-de-la-aplicación)
5. [Arquitectura](#5-arquitectura)
6. [Pipeline de análisis](#6-pipeline-de-análisis)
7. [Métricas y umbrales](#7-métricas-y-umbrales)
8. [Ejercicios](#8-ejercicios)
9. [Modelo de datos y almacenamiento](#9-modelo-de-datos-y-almacenamiento)
10. [Desarrollo](#10-desarrollo)
11. [Cómo extender](#11-cómo-extender)
12. [Limitaciones conocidas](#12-limitaciones-conocidas)
13. [Historial de fases](#13-historial-de-fases)
14. [Referencias](#14-referencias)

---

## 1. Qué hace

| Capacidad | Detalle |
|---|---|
| Estimación de pose | 33 puntos del cuerpo por frame con MediaPipe Pose Landmarker (modelo heavy), en WebAssembly/WebGL |
| Detección de zancada | Contacto inicial y despegue de cada pie a partir de la altura del pie y su velocidad vertical |
| Métricas temporales | Cadencia, tiempo de contacto por pie, tiempo de vuelo, oscilación vertical en cm |
| Métricas angulares (plano lateral) | Inclinación de tronco, rodilla y tibia al contacto, pie adelantado, ángulo del pie y tipo de pisada, extensión de cadera, ángulo de codo |
| Métricas frontales (plano frontal) | Caída pélvica, cruce de rodilla, cruce de brazos |
| Semáforo | Verde, amarillo o rojo por métrica según umbrales configurables |
| Ejercicios | Catálogo de 18 ejercicios mapeados a cada hallazgo y a su dirección (valor alto o bajo) |
| Evolución | Gráficos por métrica filtrados por plano y banda de ritmo, tabla, comparación de dos sesiones métrica a métrica y esqueletos superpuestos |
| Persistencia | IndexedDB en el navegador, exportación e importación en JSON |
| Interfaz | Tema claro y oscuro, navegación lateral, flujo por pasos, atajos de teclado, línea de tiempo de apoyos |

## 2. Puesta en marcha

Requisitos: Node 20 o superior y un navegador con WebGL (Chrome o Edge recomendados).

```bash
npm install
npm run setup:mediapipe   # copia el WASM de MediaPipe y descarga el modelo (30 MB) a public/
npm run dev
```

Abre la URL que muestra Vite. La primera vez que proceses un video el navegador carga el modelo
desde `public/mediapipe/`; después queda en caché.

`public/mediapipe/` no se versiona. Si clonas el repo en otra máquina, vuelve a ejecutar
`npm run setup:mediapipe`.

## 3. Cómo grabar

La calidad del análisis depende más de la grabación que del algoritmo.

- Cámara a la altura de la cadera, perpendicular al recorrido, a 3 o 5 metros. Sin zoom.
- 60 fps si el móvil lo permite. A 30 fps cada frame son 33 ms de incertidumbre en el tiempo de contacto.
- Ropa ajustada y con contraste frente al fondo. Buena luz, sin sombras fuertes.
- Tramo de 15 a 20 segundos a ritmo estable. Anota el ritmo del reloj o de la cinta.
- Plano lateral para la mayoría de métricas. Plano frontal (de frente o de espaldas) para caída pélvica y cruces.
- Graba desde ambos lados si quieres comparar simetría.
- Cinta de correr con trípode es el escenario más repetible entre sesiones.

## 4. Uso de la aplicación

### Inicio
Resumen de la última sesión con tres métricas clave, comparación automática con la sesión
anterior del mismo plano y banda de ritmo, y los tres hallazgos prioritarios con su ejercicio.

### Analizar
1. Arrastra o elige un video.
2. Indica plano de cámara, ritmo en min/km, estatura y fps (se detectan automáticamente).
3. Pulsa **Procesar video**. Verás el esqueleto dibujándose frame a frame, el porcentaje y el tiempo restante.
4. Revisa los resultados en tres pestañas:
   - **Video**: esqueleto suavizado sobre el video, anillo amarillo en cada contacto, línea de tiempo con los apoyos.
   - **Métricas**: tarjetas agrupadas con semáforo, rango objetivo y barra de posición.
   - **Ejercicios**: hallazgos ordenados por gravedad con sus ejercicios.
5. Pulsa **Guardar sesión** para conservarla.

Atajos con la pestaña Video activa:

| Tecla | Acción |
|---|---|
| `←` `→` | Un frame atrás o adelante |
| `Shift` + flechas | Cinco frames |
| `[` `]` | Apoyo anterior o siguiente |
| `Espacio` | Reproducir o pausar |

### Sesiones
Lista de sesiones guardadas con sus luces. Al pulsar una se abre su detalle completo.
Botones para exportar todo a JSON e importar un JSON exportado (omite duplicados).

### Evolución
- Filtros por plano y banda de ritmo. Un aviso recuerda que mezclar ritmos distorsiona cadencia y tiempo de contacto.
- Un gráfico por métrica con la banda verde de referencia, color del semáforo en cada punto y tooltip.
- Interruptor para ver los mismos datos como tabla.
- Comparación de dos sesiones A y B: tabla de diferencias y esqueletos superpuestos en contacto, apoyo medio y despegue, normalizados por longitud de pierna.

### Guía
Protocolo de grabación, límites del método y la tabla de umbrales generada desde el código.

## 5. Arquitectura

Aplicación de una sola página con Vite, React 19 y TypeScript. Sin router: la navegación es un
estado en `App.tsx`.

```
runform/
├── index.html                  Entrada, fuente Inter, favicon
├── public/
│   ├── favicon.svg
│   └── mediapipe/              WASM y modelo (generado, no versionado)
├── scripts/
│   └── setup-mediapipe.mjs     Copia el WASM y descarga el modelo
├── src/
│   ├── main.tsx                Montaje de React
│   ├── App.tsx                 Shell: navegación, tema claro/oscuro, páginas
│   ├── index.css               Tokens de diseño, componentes, animaciones, responsive
│   │
│   ├── capture/                Todo lo que toca el video y el modelo
│   │   ├── pose.ts             Crea el PoseLandmarker (GPU con fallback a CPU) y detecta por frame
│   │   └── videoFrames.ts      Carga el video, estima fps, recorre frame a frame con seek
│   │
│   ├── gait/                   Biomecánica pura. Sin DOM. Todo testeable en Node
│   │   ├── types.ts            Índices de landmarks, conexiones, FramePose, bandas de ritmo
│   │   ├── smoothing.ts        Relleno de huecos, suavizado gaussiano, estadísticos
│   │   ├── calibration.ts      Píxel a metro a partir de la estatura y la longitud de pierna
│   │   ├── events.ts           Detección de contacto y despegue, con diagnóstico
│   │   ├── angles.ts           Ángulos articulares, sentido de la marcha, lado cercano, frontal
│   │   ├── metrics.ts          Agrega todo en GaitMetrics
│   │   ├── rules.ts            Umbrales, grupos, semáforo
│   │   ├── drills.ts           Catálogo de ejercicios y mapeo hallazgo → ejercicios
│   │   ├── series.ts           Series temporales y comparación entre sesiones
│   │   ├── analyze.ts          Orquesta el pipeline completo
│   │   └── *.test.ts           Tests con Vitest
│   │
│   ├── store/
│   │   └── db.ts               Dexie (IndexedDB): esquema, guardar, borrar, exportar, importar
│   │
│   └── ui/
│       ├── icons.tsx           Iconos SVG de trazo, sin dependencias
│       ├── drawSkeleton.ts     Esqueleto sobre el video, HUD, leyenda, anillo de contacto
│       ├── compareSkeleton.ts  Normaliza y superpone dos esqueletos
│       ├── ContactTimeline.tsx Barra de apoyos bajo el video
│       ├── VideoAnalyzer.tsx   Página Analizar
│       ├── MetricsPanel.tsx    Tarjetas de métricas agrupadas y diagnóstico
│       ├── DrillsPanel.tsx     Recomendaciones y ejercicios
│       ├── HomePage.tsx        Página Inicio
│       ├── SessionsPage.tsx    Página Sesiones
│       ├── EvolutionPage.tsx   Página Evolución
│       ├── GuidePage.tsx       Página Guía
│       └── charts/
│           └── LineChart.tsx   Gráfico de línea SVG propio
│
├── vite.config.ts
├── vitest.config.ts
└── tsconfig*.json
```

Regla de diseño: `src/gait/` no importa nada de React ni del DOM. Recibe arrays de `FramePose`
y devuelve números. La interfaz solo pinta.

### Dependencias

| Paquete | Para qué |
|---|---|
| `@mediapipe/tasks-vision` | Estimación de pose |
| `dexie`, `dexie-react-hooks` | IndexedDB con consultas reactivas |
| `react`, `react-dom` | Interfaz |
| `zod` | Reservado para validar JSON importado (aún no usado) |
| `vitest` | Tests |
| `oxlint` | Lint |

## 6. Pipeline de análisis

Entrada: un video, plano, ritmo, estatura y fps. Salida: un objeto `Analysis`.

1. **Extracción** (`capture/videoFrames.ts`, `capture/pose.ts`). El video se recorre con `currentTime`
   y el evento `seeked`, no reproduciéndolo. Así se procesan todos los frames aunque la inferencia
   sea más lenta que el video. Por frame se guardan 33 puntos normalizados con su visibilidad.

2. **Relleno de huecos** (`smoothing.ts`). Frames sin pose se interpolan linealmente si el hueco
   es corto (hasta fps/10 frames). Huecos largos quedan en null.

3. **Suavizado** (`smoothing.ts`). Ventana gaussiana centrada, radio 2 a 30 fps y 3 a 60 fps.
   Al ser offline no introduce retardo.

4. **Calibración** (`calibration.ts`). Longitud de pierna en píxeles (mediana de muslo + pierna
   sobre todos los frames) frente a la fracción antropométrica 0,491 de la estatura. Da píxeles
   por metro para la oscilación vertical.

5. **Detección de apoyos** (`events.ts`). Por pie:
   - Altura del punto más bajo del pie (talón, punta o tobillo visibles) por frame.
   - Suelo = percentil 95, techo = percentil 5. Apoyo grueso = altura por encima de suelo − 25 % del rango.
   - Refinado de bordes: el pie debe estar a menos del 12 % del rango del suelo y con velocidad
     vertical baja. Si el refinado deja un tramo demasiado corto, se conserva el grueso.
   - Filtro de duración 100 a 500 ms. Se descartan el primero y el último apoyo.
   - Se devuelve además un objeto de diagnóstico que la interfaz muestra si no hay apoyos suficientes.

6. **Métricas** (`metrics.ts`, `angles.ts`).
   - Cadencia: mediana de intervalos entre contactos consecutivos, descartando pasos perdidos.
   - Tiempo de contacto: despegue − contacto, por pie y total.
   - Tiempo de vuelo: entre despegue de un pie y contacto del otro.
   - Oscilación vertical: amplitud del centro de caderas dentro de cada paso, en cm.
   - Ángulos laterales: se calculan solo en el lado más visible (el cercano a la cámara). El sentido
     de la marcha se deduce de la dirección talón → punta, así los signos son correctos mire a
     izquierda o derecha.
   - Ángulos frontales: en el frame de apoyo medio de cada contacto.

7. **Evaluación** (`rules.ts`). Cada umbral define banda verde, bandas amarillas, planos válidos y
   mínimo de muestras. Fuera de verde y amarillo es rojo. Sin muestras suficientes, "sin datos".

8. **Recomendación** (`drills.ts`). Los hallazgos amarillos y rojos se ordenan por gravedad y se
   cruzan con el catálogo según la dirección de la desviación. No se repiten ejercicios.

## 7. Métricas y umbrales

Los umbrales son orientativos, para ritmos de rodaje de 4:30 a 6:00 min/km, y salen de la
bibliografía. La fuente de verdad es `src/gait/rules.ts`; esta tabla la resume.

| Métrica | Plano | Unidad | Verde | Qué indica fuera de rango |
|---|---|---|---|---|
| Cadencia | ambos | ppm | 170 a 190 | Baja: zancadas largas. Alta: pasos cortos poco eficientes |
| Tiempo de contacto | ambos | ms | ≤ 240 | Alto: el pie frena y empuja demasiado tiempo |
| Tiempo de vuelo | ambos | ms | 80 a 160 | Bajo: carrera arrastrada. Alto: saltas demasiado |
| Oscilación vertical | ambos | cm | ≤ 8 | Alta: energía en subir y bajar |
| Inclinación de tronco | lateral | ° | 4 a 12 | Baja: pie adelantado. Alta: flexión desde la cintura |
| Extensión de cadera | lateral | ° | ≥ 15 | Baja: poco empuje hacia atrás |
| Rodilla al contacto | lateral | ° | 150 a 170 | Alta: pierna rígida. Baja: aterrizaje "sentado" |
| Tibia al contacto | lateral | ° | −6 a 6 | Alta: overstriding |
| Pie adelantado | lateral | % pierna | 0 a 22 | Alto: aterriza lejos del centro de masas |
| Ángulo del pie | lateral | ° | −8 a 10 | Alto: talón marcado. Bajo: antepié marcado |
| Ángulo de codo | lateral | ° | 75 a 105 | Bajo: hombros tensos. Alto: braceo largo |
| Caída pélvica | frontal | ° | −3 a 5 | Alta: glúteo medio poco activo |
| Cruce de rodilla | frontal | % caderas | −8 a 12 | Alto: valgo dinámico |
| Cruce de brazos | frontal | % frames | ≤ 10 | Alto: rotación de tronco compensada por las piernas |

El tipo de pisada se clasifica por contacto a partir del ángulo del pie: talón si supera 8°,
antepié si baja de −5°, media en el resto. Se muestra como reparto porcentual, no como semáforo.

Bandas de ritmo para comparar sesiones: `<4:00`, `4:00-4:45`, `4:45-5:30`, `5:30-6:15`, `>6:15` min/km.

## 8. Ejercicios

Catálogo en `src/gait/drills.ts`. Cada ejercicio tiene nombre, cómo se hace y dosis. El mapeo
indica qué ejercicios corresponden a cada métrica según el valor esté alto o bajo.

| Hallazgo | Ejercicios |
|---|---|
| Cadencia baja | Metrónomo, skipping bajo, A-skips |
| Contacto largo | Metrónomo, skipping bajo, comba baja |
| Vuelo corto o largo | Skipping y bounding, o metrónomo y carrera silenciosa |
| Oscilación alta | Metrónomo, carrera silenciosa, comba baja |
| Tronco vertical o muy inclinado | Falling drill, wall drill, puente de glúteo |
| Rodilla rígida al contacto | A-skips, wall drill, metrónomo |
| Tibia adelantada / pie adelantado | Metrónomo, wall drill, A-skips, rectas descalzo, falling drill |
| Talón o antepié marcado | Rectas descalzo, metrónomo, elevaciones de gemelo excéntricas |
| Poca extensión de cadera | Movilidad de flexores, bounding, puente de glúteo |
| Codo cerrado o brazo extendido | Sacudir hombros, braceo frente al espejo |
| Caída pélvica | Plancha lateral, puente de glúteo a una pierna, sentadilla a una pierna |
| Cruce de rodilla | Monster walks, step-down, sentadilla a una pierna |
| Cruce de brazos | Braceo frente al espejo, sacudir hombros |

## 9. Modelo de datos y almacenamiento

Base de datos IndexedDB llamada `runform` (nombre interno conservado tras el cambio de marca para
no perder sesiones), tabla `sessions`, definida en `src/store/db.ts`.

```ts
interface Session {
  id?: number;
  createdAt: number;          // epoch ms
  name: string;               // nombre del archivo sin extensión
  plane: 'lateral' | 'frontal';
  paceSecPerKm: number;
  paceBand: PaceBand;
  heightCm: number;
  fps: number;
  durationSec: number;
  videoWidth: number;
  videoHeight: number;
  frameCount: number;
  detectionRate: number;      // fracción de frames con pose
  frames: FramePose[];        // esqueleto suavizado, 33 puntos por frame
  analysis?: {
    calibration: Calibration | null;
    contacts: Contact[];      // apoyos: lado, frame de contacto, frame de despegue
    metrics: GaitMetrics;
  };
}
```

Un video de 20 s a 60 fps ocupa alrededor de 1 MB en IndexedDB. El video original no se guarda.

Exportación: un JSON con `{ version: 1, sessions: Session[] }`. Importación: mismo formato,
omite sesiones con misma fecha de creación y nombre.

## 10. Desarrollo

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga |
| `npm run build` | Comprobación de tipos y build de producción en `dist/` |
| `npm run preview` | Sirve `dist/` |
| `npm test` | Tests unitarios una vez |
| `npm run test:watch` | Tests en modo observación |
| `npm run lint` | Lint de `src/` con oxlint |
| `npm run setup:mediapipe` | Regenera `public/mediapipe/` |

### Tests

Los tests viven junto al código en `src/gait/` y cubren:

- Utilidades de ritmo y bandas.
- Suavizado, interpolación y estadísticos.
- Calibración con una carrera sintética.
- Detección de apoyos y métricas temporales sobre una carrera sintética con cadencia, tiempo de
  contacto y oscilación conocidos.
- Ángulos con puntos construidos a mano: tronco, rodilla, tibia, cadera, pie, sentido de la marcha,
  caída pélvica, cruce de rodilla, cruce de brazos.
- Semáforo, recomendaciones, series de evolución y comparación entre sesiones.

La interfaz no tiene tests automáticos. Se valida a mano con videos reales.

### Convenciones

- TypeScript estricto. Sin `any`.
- La biomecánica no depende del DOM. Si una función necesita el canvas o el video, va en `ui/` o `capture/`.
- Los colores se definen como tokens CSS en `:root` y se redefinen en `:root[data-theme='dark']`.
- Los iconos son trazos SVG en `ui/icons.tsx`. Para añadir uno, añade su `path` al mapa.
- Textos de la interfaz en español.

## 11. Cómo extender

**Añadir una métrica**
1. Calcúlala en `metrics.ts` (o en `angles.ts` si es geométrica) y añade el campo a `GaitMetrics` como `MetricValue`.
2. Añade su umbral en `rules.ts`: etiqueta, unidad, grupo, icono, planos, bandas y textos de interpretación.
3. Si tiene ejercicios, añade la entrada en el mapa de `drills.ts`.
4. Añade un test con puntos construidos a mano.
5. La interfaz, la guía y la evolución la recogen automáticamente.

**Ajustar umbrales**
Edita las bandas en `rules.ts`. La Guía y las tarjetas se actualizan solas.

**Añadir un ejercicio**
Añade la entrada en `DRILLS` de `drills.ts` y referencia su id en el mapa de la métrica.

**Cambiar el modelo de pose**
`capture/pose.ts` apunta a `public/mediapipe/models/pose_landmarker_heavy.task`. Los modelos
`lite` y `full` son más rápidos y menos precisos; cambia la URL en `scripts/setup-mediapipe.mjs`.

## 12. Limitaciones conocidas

- Una sola cámara en 2D. Lo que se sale del plano se distorsiona; la cámara debe estar perpendicular.
- A 30 fps el tiempo de contacto tiene ±33 ms de error. Graba a 60 fps.
- Los ángulos laterales se miden solo en la pierna cercana a la cámara. La lejana queda parcialmente ocluida.
- Los umbrales son de bibliografía general y no están ajustados a cada corredor ni a cada ritmo.
  El valor está en compararse con uno mismo a un ritmo parecido.
- La detección de apoyos se validó con datos sintéticos y con videos reales en cinta. En exterior,
  con cámara en movimiento o suelo irregular, puede necesitar ajuste de umbrales en `events.ts`.
- El ritmo lo introduce el usuario; no se estima del video.
- No hay tests automáticos de interfaz.

## 13. Historial de fases

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Carga de video, pose frame a frame, esqueleto sobre el video, guardado en IndexedDB | Hecha |
| 2 | Suavizado, calibración, detección de apoyos, cadencia, contacto, vuelo, oscilación, semáforo | Hecha |
| 3 | Ángulos laterales, tipo de pisada, pie adelantado, catálogo de ejercicios | Hecha |
| 4 | Plano frontal: caída pélvica, cruce de rodilla, cruce de brazos | Hecha |
| 5 | Evolución por banda de ritmo, comparación A/B, importación JSON | Hecha |
| UX | Navegación, tema claro/oscuro, iconos, Inicio, animaciones, atajos, línea de tiempo | Hecha |
| Opcional | Informe narrativo con LLM a partir del JSON de métricas | Pendiente |
| Siguientes ideas | Ángulos dibujados sobre el video en el contacto, modo fantasma con sesión anterior, radar de "huella técnica", PWA instalable, esqueleto 3D | Propuestas |

## 14. Referencias

- Souza, R. B. (2016). An evidence-based videotaped running biomechanics analysis. *Physical Medicine and Rehabilitation Clinics*.
- Folland, J. P. et al. (2017). Running technique is an important component of running economy and performance. *Medicine & Science in Sports & Exercise*.
- Moore, I. S. (2016). Is there an economical running technique? *Sports Medicine*.
- Drillis, R. y Contini, R. (1966). Body segment parameters. Proporciones antropométricas usadas en la calibración.
- MediaPipe Pose Landmarker: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
