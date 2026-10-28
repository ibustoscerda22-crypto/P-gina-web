# Calistenia: app para iPhone para empezar con calistenia

App nativa de iOS (SwiftUI, iOS 16 o superior) con un plan para principiantes,
entrenamiento guiado con temporizador y seguimiento de progreso. Todo queda guardado
en el teléfono; no necesita internet ni cuenta.

## Qué trae

- **Plan de 3 niveles** (Fundamentos → Construcción → Primeros retos), cada uno con una
  rutina A y una B de cuerpo completo. La app alterna A y B y te dice cuál toca hoy.
- **Entrenamiento guiado**: calentamiento, series y repeticiones, cuenta regresiva para
  los ejercicios por tiempo (plancha, colgado…), descansos automáticos con "+15 s" y
  "Saltar", vibración al cambiar de paso y pantalla siempre encendida.
- **23 ejercicios explicados** paso a paso, con errores comunes y su versión más fácil
  y más difícil (por ejemplo: flexión en pared → inclinada → de rodillas → completa → pike).
- **Progreso**: meta de 3 entrenamientos por semana, racha de semanas, minutos totales e
  historial. Al terminar marcas si fue Fácil, Bien o Difícil, y la app te sugiere subir de
  nivel cuando estás listo (6 sesiones en el nivel y las 3 últimas sin "Difícil").

## Cómo instalarla en tu iPhone

La carpeta `Calistenia.swiftpm` es un proyecto de **Swift Playgrounds**. Tienes dos caminos:

### Opción A: con un iPad (sin Mac)
1. Instala **Swift Playgrounds** desde la App Store en el iPad.
2. Pasa la carpeta `Calistenia.swiftpm` al iPad (iCloud Drive o AirDrop).
3. Ábrela en Swift Playgrounds y toca ▶︎ para probarla.
4. Para publicarla en TestFlight o la App Store necesitas una cuenta de Apple Developer.

### Opción B: con un Mac
1. Instala **Xcode** desde la Mac App Store.
2. Descarga este repositorio (rama `app-calistenia`) y abre `Calistenia.swiftpm` con Xcode.
3. Conecta tu iPhone por cable y elígelo arriba como destino.
4. En *Signing & Capabilities* elige tu Apple ID como equipo (sirve una cuenta gratuita).
5. Presiona ▶︎ (Cmd+R). La primera vez, en el iPhone ve a
   *Ajustes → General → VPN y gestión de dispositivos* y confía en tu perfil de desarrollador.
   Con una cuenta gratuita la app se debe reinstalar cada 7 días.

## Estructura

```
Calistenia.swiftpm/
  Package.swift                 Configuración de la app (nombre, ícono, color)
  CalisteniaApp.swift           Punto de entrada y pestañas
  Modelos/Modelos.swift         Ejercicio, Rutina, Bloque, Sesión…
  Modelos/Catalogo.swift        Los ejercicios y el plan de 3 niveles (edítalo a gusto)
  Modelos/ProgresoStore.swift   Historial, racha y nivel actual (guardado en el teléfono)
  Vistas/EntrenarView.swift     Pantalla principal: rutina de hoy y plan
  Vistas/RutinaDetalleView.swift
  Vistas/EntrenamientoView.swift  Entrenamiento guiado con temporizador
  Vistas/BibliotecaView.swift   Lista de ejercicios y detalle con técnica
  Vistas/ProgresoView.swift     Estadísticas e historial
```

Para cambiar repeticiones, descansos o agregar ejercicios, edita `Modelos/Catalogo.swift`.

> Aviso: esta app es informativa. Si tienes lesiones o alguna condición de salud,
> consulta a un profesional antes de empezar, y detente si sientes dolor articular.
