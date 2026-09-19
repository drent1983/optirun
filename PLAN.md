# OptiRun — Análisis de técnica de carrera (uso personal)

Prototipo web, 100 % local y gratuito, para analizar videos de móvil de carrera en superficie plana,
medir métricas biomecánicas por zancada, mostrar un semáforo por métrica, sugerir ejercicios y
seguir la evolución en el tiempo por banda de ritmo.

## 1. Decisiones fijadas

| Tema | Decisión |
|---|---|
| Usuario | Personal, un solo corredor, sin entrenador, sin menores |
| Superficie | Plana (calle, pista, cinta) |
| Fuente de video | Móvil, cámara normal (30 fps mínimo, 60 fps recomendado) |
| Planos | Lateral (principal) y frontal (complementario) |
| Fotos | Solo si hacen falta para una postura estática; no en el MVP |
| Plataforma | Web (navegador), sin servidor |
| Coste | Cero. Todo corre en el navegador |
| Almacenamiento | Solo landmarks del esqueleto, eventos y métricas. El video no se guarda |
| Diagnóstico | Reglas biomecánicas con umbrales configurables. Semáforo por métrica |
| LLM | Opcional, solo para el informe narrativo y elegir ejercicios del catálogo |
| Lenguaje | TypeScript |

## 2. Stack

- **Vite + React + TypeScript**: SPA, sin backend.
- **MediaPipe Pose Landmarker** (`@mediapipe/tasks-vision`, modelo `pose_landmarker_heavy`): 33 puntos incluidos talón y punta del pie. Corre en WebAssembly/WebGL.
- **Dexie** (IndexedDB): sesiones, landmarks por frame, métricas.
- **Recharts**: gráficos de evolución.
- **Zod**: validación del JSON de umbrales y del catálogo de ejercicios.
- **Vitest**: pruebas de las funciones puras (ángulos, eventos, reglas).

## 3. Estructura propuesta

```
src/
  app/                 # rutas y layout
  capture/             # carga de video, extracción de frames, pose
    videoFrames.ts     # requestVideoFrameCallback -> frames
    pose.ts            # wrapper MediaPipe
    smoothing.ts       # One Euro / Savitzky-Golay
  gait/                # biomecánica pura, sin DOM
    calibration.ts     # px -> m usando estatura
    events.ts          # contacto inicial / despegue
    angles.ts          # ángulos articulares
    metrics/           # una función por métrica
    rules.ts           # motor de semáforo
    thresholds.json    # umbrales por métrica y banda de ritmo
    drills.json        # catálogo hallazgo -> ejercicios
  store/               # Dexie schema y repositorios
  ui/                  # componentes: overlay, semáforo, gráficos
  report/              # informe narrativo (LLM opcional)
```

Regla de oro: todo lo que hay en `gait/` es puro y testeable sin navegador.

## 4. Pipeline

1. **Ingesta**: el usuario carga el video e indica plano, ritmo del tramo (min/km) y estatura.
2. **Extracción**: `requestVideoFrameCallback` recorre el video y ejecuta la pose en modo `VIDEO`. Se guarda por frame: timestamp, 33 landmarks (x, y, z, visibility).
3. **Suavizado**: filtro One Euro por landmark. Sin esto los ángulos y los eventos son ruidosos.
4. **Calibración**: longitud del esqueleto en píxeles (tobillo, cadera, hombro, oreja) contra la estatura real. Da el factor px a metros para oscilación vertical y distancias.
5. **Eventos de zancada** (plano lateral, pierna cercana a cámara):
   - Contacto inicial: mínimo local de la altura del talón con velocidad horizontal del tobillo cambiando de signo.
   - Despegue: la punta del pie comienza a subir tras el contacto.
   - Se descartan el primer y el último ciclo. Se exige un mínimo de 8 zancadas válidas.
6. **Métricas por zancada**: media y desviación.
7. **Reglas**: cada métrica pasa por su umbral (dependiente del ritmo en cadencia y tiempo de contacto) y sale verde, amarillo o rojo. Si la confianza media de los puntos implicados es baja, la métrica se marca como "no fiable" y no entra en el semáforo.
8. **Ejercicios**: cada hallazgo amarillo o rojo se cruza con `drills.json`.
9. **Persistencia**: sesión guardada en IndexedDB con metadatos. Exportación e importación JSON.

## 5. Métricas y umbrales iniciales

Los umbrales son orientativos (Souza 2016, Folland 2017, Moore 2016). Se ajustarán con los videos propios.
Cadencia y tiempo de contacto se evalúan por banda de ritmo.

| Métrica | Plano | Cálculo | Verde | Amarillo | Rojo |
|---|---|---|---|---|---|
| Cadencia | Lateral | Contactos/min | 170-185 | 160-170 | <160 |
| Tiempo de contacto | Lateral | (despegue - contacto) / fps | <240 ms | 240-280 | >280 |
| Oscilación vertical | Lateral | Amplitud vertical del punto medio de caderas (cm) | <8 | 8-10 | >10 |
| Ángulo de tronco | Lateral | Hombro-cadera vs vertical | 5-10° adelante | 0-5 o 10-15 | 0 o >15 |
| Tipo de pisada | Lateral | Talón vs punta en el frame de contacto | Medio | Talón suave | Talón marcado + tibia adelantada |
| Overstriding | Lateral | Ángulo de tibia al contacto; distancia tobillo-cadera / longitud de pierna | Tibia ±5° | 5-10° | >10° hacia delante |
| Ángulo de rodilla | Lateral | Al contacto y flexión máx. en vuelo | 160-170° al contacto | 170-175 | >175 |
| Extensión de cadera | Lateral | Muslo tras la vertical en el despegue | >15° | 10-15° | <10° |
| Braceo | Lateral / Frontal | Ángulo de codo; cruce de muñeca sobre la línea media | 80-100°, sin cruce | Cruce leve | Cruce marcado, hombros elevados |
| Caída pélvica | Frontal | Inclinación de la línea de caderas en apoyo medio | <5° | 5-8° | >8° |
| Cruce de rodilla | Frontal | Rodilla hacia dentro respecto a cadera-tobillo | Alineada | Leve | Valgo claro |

### Bandas de ritmo

`<4:00`, `4:00-4:45`, `4:45-5:30`, `5:30-6:15`, `>6:15` min/km. La evolución se compara solo dentro de la misma banda, o graficando métrica contra ritmo.

## 6. Catálogo inicial de ejercicios

| Hallazgo | Ejercicios |
|---|---|
| Cadencia baja | Correr con metrónomo +5 %; skipping corto; carreras de 20 s a cadencia alta |
| Overstriding / talón marcado | Metrónomo +5 %; A-skips; wall drill; zancadas descalzo en césped |
| Oscilación vertical alta | Cadencia +5 %; saltos a la comba bajos; carrera "silenciosa" |
| Tronco vertical / sin inclinación | Falling drill; carrera con inclinación desde tobillo |
| Poca extensión de cadera | Movilidad de flexores de cadera; bounding; puente de glúteo |
| Braceo con cruce | Braceo sentado frente al espejo; correr con bastones cortos |
| Caída pélvica | Plancha lateral; puente de glúteo a una pierna; sentadilla a una pierna |
| Cruce de rodilla | Monster walks con banda; step-down controlado |

## 7. Protocolo de grabación

- Cámara a la altura de la cadera, perpendicular al recorrido, a 3-5 m, sin zoom.
- 60 fps si el móvil lo permite. 30 fps es el mínimo aceptable.
- Ropa ajustada y contraste con el fondo. Buena luz. Sin sombras fuertes.
- Tramo de 15-20 s a ritmo estable. Grabar ambos lados para simetría.
- Anotar el ritmo (reloj o cinta) en el momento de la grabación.
- Cinta de correr con cámara en trípode es el escenario más repetible.

## 8. Fases

### Fase 1: esqueleto sobre el video (semanas 1-2)
- Scaffold Vite + React + TS. Dexie con esquema de sesiones.
- Cargar video, reproducir con el overlay de MediaPipe.
- Guardar landmarks por frame en IndexedDB.
- **Criterio de salida**: el esqueleto sigue bien las piernas y los pies en tus propios videos.

### Fase 2: eventos y métricas temporales (semanas 3-4)
- Suavizado, calibración, detección de contacto y despegue.
- Cadencia, tiempo de contacto, oscilación vertical.
- Vista frame a frame para validar los eventos contra el video.
- Tests en `gait/` con secuencias sintéticas.
- **Criterio de salida**: cadencia coincide con el conteo manual ±2 ppm.

### Fase 3: ángulos, pisada y reglas (semanas 5-6)
- Ángulo de tronco, rodilla, tibia, extensión de cadera, tipo de pisada, overstriding, braceo lateral.
- Motor de reglas con `thresholds.json` y semáforo en la UI.
- Catálogo de ejercicios enlazado.

### Fase 4: plano frontal (semana 7)
- Caída pélvica, cruce de rodilla, cruce de brazos, asimetría izquierda/derecha.

### Fase 5: evolución e informe (semana 8)
- Historial por banda de ritmo, gráfico por métrica, comparación de esqueletos lado a lado.
- Exportar / importar JSON.
- Informe narrativo opcional con LLM a partir del JSON de métricas.

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| 30 fps da ±33 ms en tiempo de contacto | Grabar a 60 fps; mostrar el margen de error junto al valor |
| Perspectiva y cámara no perpendicular | Protocolo de grabación; aviso si la longitud del esqueleto varía >10 % durante el video |
| Pierna lejana ocluida | Medir solo la pierna cercana; grabar ambos lados |
| Pose poco fiable (ropa, luz) | Confianza mínima por métrica; marcar "no fiable" |
| Comparar ritmos distintos | Bandas de ritmo obligatorias en cada sesión |
| Umbrales genéricos | Configurables en JSON; ajustar con datos propios |

## 10. Siguiente paso

Arrancar la Fase 1: scaffold del proyecto, carga de video y overlay de pose.
