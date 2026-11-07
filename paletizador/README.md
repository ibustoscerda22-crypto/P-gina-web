# PalletCell Designer

App web para pre-ingeniería de **celdas paletizadoras robotizadas**: eliges robot, PLC y HMI, describes el
producto, los infeeds/outfeeds y la seguridad, y la app genera todo lo necesario para implementar en los
software de cada fabricante.

Abre `paletizador/index.html` en el navegador. No necesita servidor ni instalación; la configuración se guarda
en el navegador y se puede exportar e importar como JSON.

## Entradas

| Grupo | Datos |
|---|---|
| Robot (esclavo) | ABB (IRC5 / OmniCore), FANUC (R-30iB Plus / R-50iA), KUKA (KR C4 / KR C5) y modelo |
| PLC (maestro) | Siemens S7-1500/1200 (TIA Portal) o Allen-Bradley ControlLogix/CompactLogix/GuardLogix |
| HMI | WinCC Unified/Comfort/Basic o PanelView 5000 / PanelView Plus 7 / FactoryTalk Optix |
| Comunicación | PROFINET o EtherNet/IP, IPs, nombres PN, direcciones de E/S |
| Producto | Medidas, peso, cajas/min, cómo llega (rodillos, banda, cadena), N° de infeeds |
| Palet | Tipo, altura de pila, voladizo, separación, mosaico (trabado, espejo, columna), lámina separadora, N° de estaciones, entrada/salida manual o por transportador |
| Herramienta | Vacío, pinza o horquilla, masa, TCP, pedestal, aproximaciones |
| Seguridad | Puertas con bloqueo, cortinas de luz (resolución, tiempos), escáner, zonas seguras del robot |

## Salidas

- **Resumen**: verificación de carga, ciclo, alcance, avisos de diseño.
- **Layout**: vista superior a escala con robot, alcance, palets, infeeds, cerco, puertas, cortinas y frames.
- **Mosaico**: capas A/B, orden de colocación sin colisiones de aproximación y tabla de posiciones.
- **Workobjects**: frames nominales (wobjdata / UFRAME / BASE_DATA), procedimiento de calibración y
  **calculadora de 3 puntos** que entrega el frame en formato ABB, FANUC y KUKA y la desviación respecto al nominal.
- **Comunicación**: mapa de 64 + 64 bytes con direcciones PLC y señales del robot, handshake
  `CmdValid → CmdAck → CmdDone`, bit de vida y pasos de configuración en ambos lados.
- **Robot**: `PalletPLC.mod` + `EIO_PLC.cfg` (ABB), programas TP `.LS` (FANUC), `PalMain.src/.dat` + `SIGNAL` (KUKA).
- **PLC PackML**: máquina de estados ISA-TR88.00.02, secuenciador maestro, interfaz robot, estaciones e infeeds.
  Siemens: fuentes SCL importables en TIA Portal. Allen-Bradley: rutinas ST, UDTs y CSV de tags/alias.
  Incluye un **simulador PackML** interactivo.
- **HMI**: pantallas, navegación, guía de estilo ISA-101, tags y alarmas (CSV) y una maqueta navegable.
- **Seguridad**: dispositivos, funciones de seguridad con PL, distancia ISO 13855 y E/S de seguridad.
- **Archivos**: todo en un `.zip` con guía de implementación paso a paso y lista de materiales.

## Arquitectura de control

El PLC es el maestro: PackML decide si la celda produce, el secuenciador elige infeed y estación, toma la
posición del mosaico (DB_Pattern / PatA-PatB) y la envía al robot. El robot sólo ejecuta comandos
(`1 Pick&Place, 2 Home, 3 lámina, 4 mantención, 5 test pinza`) y responde con eco, estado y código de error.
Las coordenadas viajan en el frame del palet, por lo que al calibrar bien el frame todo el mosaico queda correcto
sin reenseñar puntos.

## Aviso

Es una herramienta de pre-ingeniería. Los valores de catálogo son nominales y el código es un punto de partida:
verifica fichas técnicas, simula (RobotStudio / ROBOGUIDE / KUKA.Sim, PLCSIM / Emulate) y valida la seguridad
con una evaluación de riesgos formal antes de la puesta en marcha.
