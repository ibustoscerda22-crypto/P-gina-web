# Resumen: irb460_cajas400x300_8capas

Robot IRB 460, conveyor 2000x600 a 800 mm, cajas 400x300x250, pallet europeo 1200x800, 8 capas, mosaico alternado

- Robot: **IRB 460-110/2.4** (alcance 2403 mm)
- Cajas totales: **60** en 8 capas
- Altura del pallet cargado: **2144 mm** desde el suelo
- Carga en muñeca: 55 kg (garra + caja)
- Distancia horizontal de pick: 1442 mm; rango de place: 1150-1614 mm
- TCP más alto: 2144 mm; brida más alta (con aproximación): 2694 mm sobre la base del robot

| Capa | Mosaico | Cajas |
|---|---|---|
| 1 | A | 8 |
| 2 | B | 7 |
| 3 | A | 8 |
| 4 | B' | 7 |
| 5 | A | 8 |
| 6 | B | 7 |
| 7 | A | 8 |
| 8 | B' | 7 |

## Advertencias

- Con estas medidas la capa completa (8 cajas) solo admite una disposición; para trabar capas se alternan capas de 8 y de 7 cajas. Usa "mosaico": "columnas" para 8 cajas en todas las capas (sin trabado).
- La brida debe subir hasta 2694 mm sobre la base del robot (última capa + aproximación). Comprueba la alcanzabilidad de la última capa en RobotStudio; si no llega, sube base_z_mm (pedestal) o reduce capas / aproximación.
