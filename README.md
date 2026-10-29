# RobotStudio Paletizado

Escribe en una página web lo que quieres que haga el robot (modelo, conveyor, cajas, pallet, capas,
mosaico). La página calcula la celda y la simula en **ABB RobotStudio** con un clic.

```
 Navegador                          RobotStudio 2025 (tu PC)
┌──────────────────────────┐       ┌────────────────────────────────────────────┐
│ http://localhost:8765    │       │ PaletizadoAddin                            │
│ 1. Describes la celda    │ POST  │  • actualiza conveyor, pallet, caja, garra │
│ 2. Vista 3D + resumen    │ ────► │  • carga MPaletizado.mod en el controlador │
│ 3. "Simular en           │       │    virtual (T_ROB1)                        │
│    RobotStudio"          │ ◄──── │  • inicia la simulación                    │
└──────────────────────────┘  log  └────────────────────────────────────────────┘
```

La página genera:

| Archivo | Para qué sirve |
|---|---|
| `MPaletizado.mod` | Programa RAPID: tooldata, wobjs, todas las posiciones de place calculadas y el ciclo pick & place |
| `estacion.txt` | Geometría de la celda (conveyor, pallet, caja, garra) que construye el Add-in |
| `EIO_paletizado.cfg` | Señales virtuales `doVacuum` y `doNewBox` |
| `resumen.md` | Cajas por capa, alcances, carga y advertencias |

## Uso diario

1. Abre RobotStudio con tu **estación base** (sección 2).
2. Pestaña **Paletizado → Abrir página**, o abre <http://localhost:8765> en el navegador.
3. Escribe la celda y pulsa **Interpretar texto**, por ejemplo:
   > Robot IRB 460, conveyor de 2000×600 mm a 800 mm de altura, cajas de 400×300×250 mm,
   > pallet europeo, 8 capas, mosaico alternado
4. Revisa los datos, la vista 3D y las advertencias, y pulsa **Simular en RobotStudio**.

Las posiciones del pallet y del conveyor se calculan solas según el alcance del robot. Puedes fijarlas a
mano en *Avanzado*. **Descargar .zip** te da los mismos archivos para cargarlos sin el Add-in.

## Instalación (una sola vez)

### 1. Licencia y herramientas

- **RobotStudio 2025** con la **licencia de prueba Premium** (30 días), en *Archivo → Opciones → Licencias*.
  Hace falta para los Add-ins y los Smart Components.
- Para compilar el Add-in: [.NET 8 SDK](https://dotnet.microsoft.com/download) o Visual Studio 2022
  Community. Ambos son gratuitos.

### 2. Compilar e instalar el Add-in

```bat
cd addin\PaletizadoAddin
dotnet build -c Release
```

Si RobotStudio no está en `C:\Program Files (x86)\ABB\RobotStudio 2025`, indica la carpeta que contiene
`Bin\ABB.Robotics.RobotStudio.dll`:

```bat
dotnet build -c Release -p:RobotStudioDir="C:\Program Files\ABB\RobotStudio 2025"
```

Se generan dos versiones: `bin\Release\net8.0-windows\` y `bin\Release\net48\`. Copia
`PaletizadoAddin.dll` y `PaletizadoAddin.rsaddin` de **net8.0-windows** a la carpeta `Bin\Addins` de la
instalación de RobotStudio (necesita permisos de administrador). Reinicia RobotStudio: debe aparecer la
pestaña **Paletizado**, y la ventana *Salida* debe mostrar `[Paletizado] Página de paletizado disponible en http://localhost:8765/`.
Si el Add-in no carga, prueba con los archivos de **net48**.

### 3. Preparar la estación base

La estación base contiene lo que no cambia entre celdas: el robot, su controlador virtual, las señales,
la garra unida al robot y el Smart Component que mueve las cajas. Se prepara una vez por modelo de robot.

1. *Archivo → Nuevo → Solución con estación y controlador de robot*, modelo **IRB 460** (110 kg / 2.4 m).
   El robot queda en el origen, que es como lo espera la página.
2. *Controlador → Configuración → Cargar parámetros* → `EIO_paletizado.cfg` (está en
   `salida/irb460_cajas400x300_8capas/`) → reinicia el controlador.
3. En la pestaña *RAPID*, abre `Module1` y **borra su `PROC main()`** si lo tiene: solo puede haber un `main`.
4. Abre la página y pulsa **Simular en RobotStudio** una vez. Se crean `Conveyor`, `Conveyor_Tope`,
   `Pallet`, `Caja`, `Garra` y `Vista_PalletLleno`. En esta primera vez la simulación corre, pero las cajas
   todavía no se mueven.
5. **Garra al robot:** en el navegador *Diseño*, arrastra `Garra` sobre el robot y responde **Sí** a
   "¿Actualizar posición?".
6. **Smart Component:** *Modelado → Componente inteligente*, nómbralo `SC_Paletizado` y añade:
   - `Source` con **Source = Caja** y **Transient = True** (así las copias se borran al reiniciar)
   - `Attacher` con **Parent = Garra** y **Mount = False**
   - `Detacher` con **KeepPosition = True**
   - `LogicGate` con **Operator = NOT**

   En *Propiedades y vínculos*: `Source.Copy → Attacher.Child` y `Attacher.Child → Detacher.Child`.
   En *Señales y conexiones*, crea las entradas `diNewBox` y `diVacuum` y conecta
   `diNewBox → Source.Execute`, `diVacuum → Attacher.Execute`, `diVacuum → LogicGate.InputA` y
   `LogicGate.Output → Detacher.Execute`.
   En *Simulación → Lógica de estación*: `doNewBox → SC_Paletizado.diNewBox` y
   `doVacuum → SC_Paletizado.diVacuum`.
7. **Guarda la estación** (por ejemplo `Base_Paletizado_IRB460`). A partir de aquí, cada clic en
   *Simular en RobotStudio* rehace la celda sobre esta estación. La `Caja` y la `Garra` se conservan, así
   que el Smart Component sigue funcionando. Usa *Guardar como* si quieres conservar una celda concreta.

> ⚠️ **Estado:** el Add-in compila contra una réplica de la API de RobotStudio, pero **no se ha probado
> dentro de RobotStudio** (se desarrolló en Linux). Las llamadas menos seguras (iniciar o parar la
> simulación, buscar piezas unidas al robot) usan reflexión para no romper la compilación. Si algo falla,
> la página y la ventana *Salida* de RobotStudio muestran el error: cópialo y se corrige.

## Revisar el alcance

La página hace comprobaciones aproximadas (distancia horizontal, carga y altura de la brida). La
verificación real la hace RobotStudio: si una posición de la última capa no es alcanzable, la simulación
se detiene con un error de posición. En ese caso sube el **pedestal**, reduce la **aproximación** o el
número de capas.

## Problemas frecuentes

| Mensaje | Solución |
|---|---|
| "RobotStudio no conectado" en la página | RobotStudio no está abierto, o el Add-in no cargó. Mira la ventana *Salida* |
| "No hay ninguna estación abierta" | Abre la estación base |
| "falta la señal doVacuum / doNewBox" | Paso 3.2: carga `EIO_paletizado.cfg` y reinicia el controlador |
| Error de RAPID "main ambiguo" o "main duplicado" | Paso 3.3: borra el `main` de `Module1` |
| "la celda es para IRB 660 pero el robot de la estación es IRB 460" | Prepara una estación base con ese robot |
| Las cajas no se mueven | Revisa el Smart Component y la Lógica de estación (paso 3.6) |

## Sin RobotStudio: línea de comandos y Claude

El mismo generador funciona sin navegador (Node 18 o superior, sin dependencias):

```bash
node generador/generar.mjs celdas/irb460_cajas400x300_8capas.json
```

Escribe los archivos en `salida/<celda>/`, junto con `vista_previa.html` (vista 3D que se abre con doble
clic). En Claude Code, dentro de este repositorio, basta con describir la celda en palabras: Claude sigue
`.claude/skills/paletizado/SKILL.md`.

## Estructura

```
web/index.html               página (formulario, interpretación del texto, vista 3D, envío a RobotStudio)
web/generador.js             generador: mosaico, RAPID, geometría, comprobaciones (navegador y Node)
web/vista3d.js               vista 3D (three.js)
addin/PaletizadoAddin/       Add-in de RobotStudio (C#): servidor local, geometría, controlador virtual
generador/generar.mjs        línea de comandos
celdas/                      celdas guardadas (JSON)
salida/<celda>/              archivos generados
.claude/skills/paletizado/   instrucciones para Claude
```
