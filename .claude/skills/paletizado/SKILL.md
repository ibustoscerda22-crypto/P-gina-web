---
name: paletizado
description: Convierte la descripción en palabras de una celda de paletizado ABB (robot, conveyor, cajas, pallet, capas, mosaico) en una celda JSON y genera RAPID, geometría de estación para RobotStudio y vista previa 3D. Úsalo cuando el usuario describa una celda de paletizado o pida cambiar una existente.
---

# Celda de paletizado desde una descripción

1. **Extrae los datos** de la descripción y crea `celdas/<nombre>.json` copiando la estructura de
   `celdas/irb460_cajas400x300_8capas.json`. `<nombre>` en minúsculas, sin espacios
   (ej. `irb460_cajas400x300_8capas`).
   - Todo en mm. "Pallet europeo" = 1200×800×144. "Pallet americano" = 1219×1016×140 (48×40 in).
   - Si falta un dato, usa el valor del ejemplo y dilo en la respuesta (no preguntes por cada detalle):
     masa de caja 15 kg, garra 250 mm / 40 kg, aproximación 300 mm.
   - Datos de robots ABB habituales (alcance mm / carga kg): IRB 460: 2403/110, IRB 660-180: 3150/180,
     IRB 660-250: 3150/250, IRB 760: 3180/450, IRB 4600-60/2.05: 2050/60. Si no conoces un modelo, pregunta.
   - Disposición: robot en el origen; pallet delante (centro a ~55 % del alcance, sobre +X) girado 90°
     para que el lado largo quede de frente al robot; conveyor a un lado (+Y), terminando delante del
     robot, con la caja a ~60 % del alcance. Mantén al menos 300 mm entre conveyor y pallet.
     Ángulos solo en múltiplos de 90°.
   - "mosaico alternado" → `"alternado"`; "en columnas" / "sin trabar" → `"columnas"`.
2. **Genera:** `python3 generador/generar.py celdas/<nombre>.json`
3. **Revisa `resumen.md`:** cuenta de cajas por capa, distancias frente al alcance, carga, advertencias.
   Si la distancia o la carga no cuadran, ajusta posiciones en el JSON y regenera antes de entregar.
4. **Responde** con: cajas por capa y total, altura del pallet, advertencias, y los pasos de
   README.md §3 que el usuario debe hacer en RobotStudio. Comprueba la vista 3D (`vista_previa.html`)
   si puedes renderizarla.
5. Haz commit del JSON y de `salida/<nombre>/`.

No edites a mano los archivos de `salida/`: cambia el JSON o el generador y regenera.
