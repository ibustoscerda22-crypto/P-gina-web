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
   - Datos de robots: tabla `ROBOTS` en `web/generador.js`. Si el modelo no está, pregunta su alcance y carga y añádelo ahí.
   - Disposición: usa `layoutAutomatico` de `web/generador.js` (misma regla que la página web):
     `node -e 'import("./web/generador.js").then(g=>console.log(JSON.stringify(g.layoutAutomatico(SPEC))))'`
     o calcula igual: pallet en (0.56·alcance redondeado a 50, 0) girado 90°; conveyor en +Y a 300 mm
     del pallet, avanzando hacia +X, con el pick a 0.6·alcance. Ángulos solo en múltiplos de 90°.
   - "mosaico alternado" → `"alternado"`; "en columnas" / "sin trabar" → `"columnas"`.
2. **Genera:** `node generador/generar.mjs celdas/<nombre>.json`
3. **Revisa `resumen.md`:** cuenta de cajas por capa, distancias frente al alcance, carga, advertencias.
   Si la distancia o la carga no cuadran, ajusta posiciones en el JSON y regenera antes de entregar.
4. **Responde** con: cajas por capa y total, altura del pallet, advertencias, y recuerda que puede
   simularla desde la página (README, "Uso diario") o cargando los archivos a mano. Comprueba la vista 3D (`vista_previa.html`)
   si puedes renderizarla.
5. Haz commit del JSON y de `salida/<nombre>/`.

La lógica vive en `web/generador.js` y la comparten la página, la línea de comandos y el Add-in:
si cambias el cálculo, cámbialo ahí. Para probar la página sin RobotStudio, sirve `web/` en el
puerto 8765 con un servidor que responda `/api/estado` y `/api/simular`.

No edites a mano los archivos de `salida/`: cambia el JSON o el generador y regenera.
