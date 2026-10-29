# RobotStudio Paletizado

Describe una celda de paletizado con palabras (robot, conveyor, cajas, pallet, capas, mosaico) y obtén:

| Archivo (en `salida/<celda>/`) | Para qué sirve |
|---|---|
| `MPaletizado.mod` | Programa RAPID completo: tooldata, wobjs, las posiciones de place calculadas y el ciclo pick & place |
| `EIO_paletizado.cfg` | Señales virtuales `doVacuum` y `doNewBox` |
| `estacion.txt` | Geometría de la celda (conveyor, pallet, caja, garra), que construye el Add-in |
| `vista_previa.html` | Vista 3D en el navegador con la animación del apilado, para revisar antes de abrir RobotStudio |
| `resumen.md` | Cajas por capa, alcances, carga y advertencias |

```
celdas/*.json  ──►  generador/generar.py  ──►  salida/<celda>/…  ──►  RobotStudio (Add-in + RAPID)
```

## 1. Pedir una celda nueva

En Claude Code, dentro de este repositorio, escribe por ejemplo:

> Robot IRB 460, conveyor de 2000×600 mm a 800 mm de altura, cajas de 400×300×250 mm,
> pallet europeo 1200×800, 8 capas, mosaico alternado

Claude crea `celdas/<nombre>.json`, ejecuta el generador y te muestra el resumen
(sigue `.claude/skills/paletizado/SKILL.md`). También puedes editar el JSON tú y ejecutar:

```bash
python3 generador/generar.py celdas/irb460_cajas400x300_8capas.json
```

Solo necesita Python 3, sin dependencias.

### Campos del JSON (mm y grados)

| Campo | Significado |
|---|---|
| `robot.modelo`, `alcance_mm`, `carga_max_kg` | Datos del robot (para las comprobaciones) |
| `robot.base_z_mm` | Altura del pedestal (0 = robot sobre el suelo) |
| `conveyor.largo_mm/ancho_mm/altura_mm` | Medidas del conveyor; `altura_mm` = superficie de la cinta |
| `conveyor.fin_xy_mm` | Punto final de la cinta (donde está el tope), respecto a la base del robot |
| `conveyor.direccion_deg` | Sentido de avance (múltiplo de 90°) |
| `caja.*` | Largo, ancho, alto y masa de la caja |
| `pallet.*` | Medidas, centro y giro (múltiplo de 90°) del pallet |
| `capas` | Número de capas |
| `mosaico` | `"alternado"` (capas trabadas) o `"columnas"` (misma capa siempre) |
| `garra.largo_tcp_mm`, `masa_kg` | Distancia brida → ventosas y peso de la garra |
| `movimiento.*` | Distancia de aproximación y velocidades RAPID |

## 2. Preparar RobotStudio (una sola vez)

Necesitas **RobotStudio 2025**. Para Smart Components y Add-ins activa la
**licencia de prueba Premium** (30 días), en *Archivo → Opciones → Licencias*.

### Compilar e instalar el Add-in

1. Instala el [.NET 8 SDK](https://dotnet.microsoft.com/download) o Visual Studio 2022 Community.
2. En `addin/PaletizadoAddin`:
   ```bat
   dotnet build -c Release
   ```
   Si RobotStudio no está en `C:\Program Files (x86)\ABB\RobotStudio 2025`, indica la ruta:
   `dotnet build -c Release -p:RobotStudioDir="C:\ruta\a\RobotStudio 2025"`
   (la carpeta que contiene `Bin\ABB.Robotics.RobotStudio.dll`).
3. Copia `PaletizadoAddin.dll` y `PaletizadoAddin.rsaddin` desde `bin\Release\net8.0-windows\`
   a la carpeta de Add-ins de RobotStudio (por ejemplo `C:\Program Files (x86)\ABB\RobotStudio 2025\Bin\Addins`),
   o cárgalo desde la pestaña *Complementos (Add-Ins)*.
4. Reinicia RobotStudio: aparece la pestaña **Paletizado → Crear celda**.

> ⚠️ El Add-in **no se ha podido compilar ni probar** en el entorno donde se generó (no hay RobotStudio
> en Linux). Si al compilar o al ejecutarlo aparece un error, copia el mensaje completo y se corrige.

## 3. Montar y simular la celda

1. **Estación y robot:** *Archivo → Nuevo → Solución con estación y controlador de robot*,
   modelo **IRB 460** (110 kg / 2.4 m). El robot queda en el origen, que es como lo espera el generador.
2. **Señales:** *Controlador → Configuración → Cargar parámetros* → `EIO_paletizado.cfg` → reinicia el controlador.
3. **Geometría:** *Paletizado → Crear celda* → elige `salida/<celda>/estacion.txt`.
   Se crean `Conveyor`, `Conveyor_Tope`, `Pallet`, `Caja`, `Garra` y `Vista_PalletLleno` (oculta;
   actívala para ver el pallet terminado).
4. **Garra al robot:** en el navegador *Diseño*, arrastra `Garra` sobre `IRB460…` y responde **Sí** a
   "¿Actualizar posición?".
5. **RAPID:** pestaña *RAPID* → `T_ROB1` → clic derecho → *Cargar módulo* → `MPaletizado.mod`.
   Si `Module1` ya tiene un `PROC main()`, bórralo (solo puede haber un `main`).
   Opcional: *Inicio → Sincronizar → Sincronizar con estación* para ver `wPallet`, `wConveyor` y `pPick`.
6. **Smart Component (cajas que se mueven):** *Modelado → Componente inteligente*, nómbralo `SC_Paletizado` y añade:
   - `Source` con **Source = Caja**
   - `Attacher` con **Parent = Garra**, **Mount = False**
   - `Detacher` con **KeepPosition = True**
   - `LogicGate` con **Operator = NOT**

   En *Propiedades y vínculos*: `Source.Copy → Attacher.Child` y `Attacher.Child → Detacher.Child`.
   En *Señales y conexiones*, crea las entradas `diNewBox` y `diVacuum`, y conecta:
   `diNewBox → Source.Execute`, `diVacuum → Attacher.Execute`, `diVacuum → LogicGate.InputA`,
   `LogicGate.Output → Detacher.Execute`.
   En *Simulación → Lógica de estación*: `doNewBox (controlador) → SC_Paletizado.diNewBox` y
   `doVacuum → SC_Paletizado.diVacuum`.
7. **Simular:** *Simulación → Configuración* (punto de entrada `main`) → **Reproducir**.

## 4. Revisar el alcance

El generador hace comprobaciones aproximadas (distancia horizontal, carga, altura). La verificación real
la hace RobotStudio: si una posición de la última capa no es alcanzable, la simulación se detiene con
un error de posición. En ese caso sube `robot.base_z_mm` (pedestal), reduce `movimiento.aproximacion_mm`
o el número de capas, y vuelve a generar.

## Estructura

```
celdas/                      especificaciones de celdas (JSON)
generador/generar.py         generador (Python 3, sin dependencias)
generador/vista_previa_plantilla.html
addin/PaletizadoAddin/       Add-in de RobotStudio (C#, .NET 8)
salida/<celda>/              archivos generados
.claude/skills/paletizado/   instrucciones para que Claude convierta descripciones en celdas
```
