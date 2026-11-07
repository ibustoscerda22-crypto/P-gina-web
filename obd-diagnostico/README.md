# OBD Diagnóstico

App web (PWA) para diagnosticar el auto por el puerto **OBD-II** con un adaptador **ELM327**.
Configurada para el **Chevrolet Onix Activ 2018**, pero sirve para cualquier auto con OBD-II
(en Chile, todos los autos a gasolina desde ~2008).

## Qué hace

- **Escaneo completo**: luz de check engine, VIN, códigos de falla almacenados, pendientes y permanentes,
  monitores de emisiones y medición de sensores.
- **Explicación en español** de más de 150 códigos (P, C, U), con severidad y causas frecuentes.
- **Hallazgos automáticos**: sobrecalentamiento, batería o alternador, mezcla pobre o rica,
  ralentí anormal, termostato, sensor de oxígeno lento y monitores incompletos.
- **Puntaje de salud** de 0 a 100.
- **Datos en vivo**: RPM, velocidad, temperatura, batería, carga y mariposa con gráficos, más todos los sensores.
- **Borrar códigos** (con advertencia).
- **Informe** descargable en `.txt` o para compartir por WhatsApp o correo.
- **Historial** de escaneos guardado en el mismo teléfono.
- **Terminal** para enviar comandos directos al ELM327.
- **Modo demo**: simula un auto con falla P0171 para probar sin el vehículo.
- Funciona **sin internet** una vez abierta (se puede "Agregar a la pantalla de inicio").

## Qué adaptador comprar

| Dispositivo | Adaptador que funciona |
|---|---|
| Android (Chrome) | **Bluetooth LE / 4.0**: Vgate iCar Pro BLE, Veepeak OBDCheck BLE, vLinker MC+/FS BLE, OBDLink CX |
| PC (Chrome / Edge) | Bluetooth LE, USB, o Bluetooth clásico emparejado (aparece como puerto COM → botón "USB / Serie") |
| iPhone | Safari no permite Bluetooth: usa el navegador gratuito **Bluefy** con un adaptador BLE |

> Los ELM327 azules baratos que solo dicen "Bluetooth" (clásico, v1.5) y los adaptadores **Wi-Fi**
> **no** funcionan desde el navegador del celular.

## Cómo usarla

1. Enchufa el adaptador en el puerto OBD-II (bajo el tablero, lado del conductor).
2. Pon la llave en contacto o enciende el motor.
3. Abre la app → **Bluetooth** → elige el adaptador → **Escanear vehículo**.

## Publicarla (necesita HTTPS para usar Bluetooth)

Es solo HTML, CSS y JavaScript, sin compilación. Opciones:

- **Netlify Drop**: entra a https://app.netlify.com/drop y arrastra la carpeta `obd-diagnostico`.
  Te da una dirección `https://...` al instante.
- **GitHub Pages**: Settings → Pages → rama `main`, carpeta `/ (root)`. La app quedará en
  `https://<usuario>.github.io/P-gina-web/obd-diagnostico/` (en repos privados GitHub Pages requiere plan pago).

Para probarla en el computador: `cd obd-diagnostico && python3 -m http.server 8080` y abre
http://localhost:8080 (localhost cuenta como seguro).

## Estructura

```
index.html          Interfaz
styles.css          Estilos (tema claro y oscuro)
js/app.js           Lógica de la interfaz, escaneo, modo en vivo, informe e historial
js/transport.js     Conexión Bluetooth LE (Web Bluetooth) y USB/Serie (Web Serial)
js/elm327.js        Protocolo ELM327 / OBD-II: inicialización, PIDs, DTC, VIN, monitores
js/pids.js          Sensores soportados y sus fórmulas
js/dtc.js           Base de códigos de falla en español
js/analysis.js      Reglas de diagnóstico y puntaje de salud
js/simulator.js     Auto simulado para el modo demo
sw.js               Caché para uso sin internet
```

## Advertencias

- No uses el teléfono mientras manejas.
- Borrar los códigos no repara la falla y deja los monitores de emisiones incompletos
  (puede afectar la revisión técnica).
- OBD-II genérico lee el motor y las emisiones. Para ABS, airbags o la caja automática
  se necesita un escáner con los protocolos propietarios de GM.
- El informe es orientativo. Confirma cualquier reparación con un mecánico.
