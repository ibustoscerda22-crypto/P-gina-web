#!/usr/bin/env python3
"""Generador de celdas de paletizado para ABB RobotStudio.

Lee una especificación JSON (celdas/*.json) y genera en salida/<nombre>/:
  - MPaletizado.mod       módulo RAPID con wobjs, tooldata y todas las posiciones de place
  - EIO_paletizado.cfg    señales virtuales doVacuum / doNewBox
  - estacion.txt          geometría de la celda para el Add-in de RobotStudio
  - vista_previa.html     vista 3D en el navegador (three.js) con animación del apilado
  - resumen.md            mosaico, cantidades, alcances y advertencias

Convenciones:
  - Unidades en mm y grados.
  - El marco mundo de la estación coincide con la base del robot (0,0,0).
    El suelo queda en z = -robot.base_z_mm (base_z_mm > 0 = robot sobre pedestal).
  - Coordenadas locales del pallet: X a lo largo de "largo_mm", Y a lo largo de "ancho_mm",
    origen en una esquina del pallet a nivel de suelo.

Uso:  python3 generador/generar.py celdas/mi_celda.json [--salida salida]
"""
import argparse
import json
import math
import sys
import unicodedata
from pathlib import Path

ORIENTACIONES = (0, 90)  # 0: largo de la caja a lo largo de X local; 90: a lo largo de Y local


# ---------------------------------------------------------------- mosaico

def dims(caja, o):
    return (caja["largo_mm"], caja["ancho_mm"]) if o == 0 else (caja["ancho_mm"], caja["largo_mm"])


def bloque(x0, y0, nx, ny, bx, by, o):
    return [(x0 + (i + 0.5) * bx, y0 + (j + 0.5) * by, bx, by, o)
            for i in range(nx) for j in range(ny)]


def patrones_candidatos(PL, PW, caja):
    """Rejillas simples y combinaciones de dos bloques con orientaciones distintas."""
    cands = []
    for o in ORIENTACIONES:
        bx, by = dims(caja, o)
        nx, ny = int(PL // bx), int(PW // by)
        if nx and ny:
            cands.append(("rejilla", bloque((PL - nx * bx) / 2, (PW - ny * by) / 2, nx, ny, bx, by, o)))
    for o1 in ORIENTACIONES:
        o2 = 90 - o1
        b1x, b1y = dims(caja, o1)
        b2x, b2y = dims(caja, o2)
        # división a lo largo de Y: franja inferior con o1, franja superior con o2
        for k1 in range(1, int(PW // b1y) + 1):
            n1x = int(PL // b1x)
            n2x, n2y = int(PL // b2x), int((PW - k1 * b1y) // b2y)
            if n1x and n2x and n2y:
                alto = k1 * b1y + n2y * b2y
                y0 = (PW - alto) / 2
                cands.append(("bloques_y",
                              bloque((PL - n1x * b1x) / 2, y0, n1x, k1, b1x, b1y, o1)
                              + bloque((PL - n2x * b2x) / 2, y0 + k1 * b1y, n2x, n2y, b2x, b2y, o2)))
        # división a lo largo de X: franja izquierda con o1, franja derecha con o2
        for k1 in range(1, int(PL // b1x) + 1):
            n1y = int(PW // b1y)
            n2x, n2y = int((PL - k1 * b1x) // b2x), int(PW // b2y)
            if n1y and n2x and n2y:
                ancho = k1 * b1x + n2x * b2x
                x0 = (PL - ancho) / 2
                cands.append(("bloques_x",
                              bloque(x0, (PW - n1y * b1y) / 2, k1, n1y, b1x, b1y, o1)
                              + bloque(x0 + k1 * b1x, (PW - n2y * b2y) / 2, n2x, n2y, b2x, b2y, o2)))
    return cands


def firma(rects):
    return tuple(sorted((round(x, 1), round(y, 1), o) for x, y, _, _, o in rects))


def transformar(rects, PL, PW, espejo_x=False, espejo_y=False):
    return [(PL - x if espejo_x else x, PW - y if espejo_y else y, bx, by, o)
            for x, y, bx, by, o in rects]


def equivalentes(a, b, PL, PW):
    fb = firma(b)
    return any(firma(transformar(a, PL, PW, ex, ey)) == fb
               for ex in (False, True) for ey in (False, True))


def elegir_mosaico(spec):
    p, caja = spec["pallet"], spec["caja"]
    PL, PW = p["largo_mm"], p["ancho_mm"]
    cands = patrones_candidatos(PL, PW, caja)
    if not cands:
        sys.exit("ERROR: la caja no cabe en el pallet.")
    # A: máximo de cajas; a igualdad, menos tipos de bloque (rejilla primero)
    cands.sort(key=lambda c: (-len(c[1]), c[0] != "rejilla"))
    tipo_a, A = cands[0]
    notas = []
    capas = []
    modo = spec.get("mosaico", "alternado")
    B = None
    if modo == "alternado":
        distintos = [c for c in cands if not equivalentes(A, c[1], PL, PW)]
        if distintos:
            B = distintos[0][1]
            if len(B) < len(A):
                notas.append(
                    f"Con estas medidas la capa completa ({len(A)} cajas) solo admite una disposición; "
                    f"para trabar capas se alternan capas de {len(A)} y de {len(B)} cajas. "
                    f'Usa "mosaico": "columnas" para {len(A)} cajas en todas las capas (sin trabado).')
        else:
            notas.append("No existe un mosaico alternativo; se usa el mismo en todas las capas.")
    for k in range(spec["capas"]):
        if B is None or k % 2 == 0:
            capas.append(("A", A))
        elif (k // 2) % 2 == 0:
            capas.append(("B", B))
        else:  # B girada 180° para cruzar también las juntas de las capas B
            capas.append(("B'", transformar(B, PL, PW, True, True)))
    return capas, notas


# ---------------------------------------------------------------- geometría

def rot2(x, y, deg):
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    return x * c - y * s, x * s + y * c


def wrap180(a):
    a = (a + 180.0) % 360.0 - 180.0
    return 180.0 if a == -180.0 else a


def quat_z(deg):
    h = math.radians(deg) / 2
    return [round(math.cos(h), 6), 0, 0, round(math.sin(h), 6)]


def calcular(spec):
    p, cv, caja, robot = spec["pallet"], spec["conveyor"], spec["caja"], spec["robot"]
    garra, mov = spec["garra"], spec["movimiento"]
    base_z = robot.get("base_z_mm", 0)
    suelo = -base_z
    PL, PW, PH = p["largo_mm"], p["ancho_mm"], p["alto_mm"]
    cx, cy = p["centro_xy_mm"]
    prot = p["rotacion_deg"]
    cdir = cv["direccion_deg"]
    for nombre, ang in (("pallet.rotacion_deg", prot), ("conveyor.direccion_deg", cdir)):
        if ang % 90:
            sys.exit(f"ERROR: {nombre} debe ser múltiplo de 90° (la geometría se crea alineada a ejes).")

    def pallet_a_mundo(x, y):
        dx, dy = rot2(x - PL / 2, y - PW / 2, prot)
        return cx + dx, cy + dy

    esquina = pallet_a_mundo(0, 0)
    capas, notas = elegir_mosaico(spec)

    # ---- pick: caja apoyada contra el tope al final del conveyor, largo a lo largo de la cinta
    ex, ey = cv["fin_xy_mm"]
    ux, uy = rot2(1, 0, cdir)
    pick_xy = (ex - ux * caja["largo_mm"] / 2, ey - uy * caja["largo_mm"] / 2)
    pick_z_mundo = cv["altura_mm"] + caja["alto_mm"] + suelo

    # ---- place: lista ordenada de cajas
    places = []
    for k, (nombre_patron, rects) in enumerate(capas):
        z_tcp = PH + (k + 1) * caja["alto_mm"]  # en wPallet (origen a nivel de suelo)
        capa = []
        for x, y, bx, by, o in rects:
            wx, wy = pallet_a_mundo(x, y)
            # ángulo de la garra: elegir el equivalente (±180°) más cercano al de pick
            dif = wrap180(prot + o - cdir)
            if dif > 90:
                dif -= 180
            elif dif < -90:
                dif += 180
            theta = wrap180(cdir + dif - prot)
            capa.append(dict(capa=k + 1, patron=nombre_patron, x=x, y=y, z=z_tcp, theta=theta,
                             o=o, bx=bx, by=by, wx=wx, wy=wy, wz=z_tcp + suelo,
                             r=math.hypot(wx, wy)))
        capa.sort(key=lambda c: -c["r"])  # primero las más lejanas al robot
        places.extend(capa)

    # ---- verificaciones aproximadas
    adv = list(notas)
    alcance = robot["alcance_mm"]
    r_pick = math.hypot(*pick_xy)
    r_max = max(max(c["r"] for c in places), r_pick)
    r_min = min(min(c["r"] for c in places), r_pick)
    z_tcp_max = max(c["wz"] for c in places)
    z_aprox_max = z_tcp_max + mov["aproximacion_mm"]
    z_brida_max = z_aprox_max + garra["largo_tcp_mm"]
    if r_max > alcance - 100:
        adv.append(f"Distancia horizontal máxima {r_max:.0f} mm cerca o fuera del alcance ({alcance} mm).")
    if r_min < 700:
        adv.append(f"Hay un punto a solo {r_min:.0f} mm de la base: riesgo de colisión con el robot.")
    carga = garra["masa_kg"] + caja["masa_kg"]
    if carga > robot["carga_max_kg"]:
        adv.append(f"Carga {carga} kg (garra + caja) supera la capacidad de {robot['carga_max_kg']} kg.")
    adv.append(
        f"La brida debe subir hasta {z_brida_max:.0f} mm sobre la base del robot (última capa + aproximación). "
        "Comprueba la alcanzabilidad de la última capa en RobotStudio; si no llega, sube base_z_mm "
        "(pedestal) o reduce capas / aproximación.")

    return dict(spec=spec, capas=capas, places=places, esquina=esquina, suelo=suelo,
                pick_xy=pick_xy, pick_z_mundo=pick_z_mundo,
                checks=dict(r_max=r_max, r_min=r_min, r_pick=r_pick, z_tcp_max=z_tcp_max,
                            z_brida_max=z_brida_max, carga=carga),
                advertencias=adv)


# ---------------------------------------------------------------- RAPID

def ascii_rapid(texto):
    """RAPID solo admite ISO-8859-1 de forma fiable: quitar tildes y eñes."""
    return unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii")


def f(v):
    return f"{v:.1f}".rstrip("0").rstrip(".") if abs(v) > 1e-9 else "0"


def generar_rapid(d):
    s = d["spec"]
    caja, garra, mov, cv, p = s["caja"], s["garra"], s["movimiento"], s["conveyor"], s["pallet"]
    places = d["places"]
    n = len(places)
    qp = quat_z(p["rotacion_deg"])
    qc = quat_z(cv["direccion_deg"])
    ex, ey = d["esquina"]
    px, py = d["pick_xy"]
    zc = cv["altura_mm"] + d["suelo"]
    filas = []
    capa_actual = None
    for i, c in enumerate(places):
        if c["capa"] != capa_actual:
            capa_actual = c["capa"]
            filas.append(f"    ! capa {c['capa']} (mosaico {c['patron']})")
        sep = "," if i < n - 1 else ""
        filas.append(f"    [{f(c['x'])},{f(c['y'])},{f(c['z'])},{f(c['theta'])}]{sep}")
    cajas_por_capa = ", ".join(str(sum(1 for c in places if c["capa"] == k + 1)) for k in range(s["capas"]))
    q = lambda v: ",".join(f"{x:.6f}".rstrip("0").rstrip(".") if abs(x) > 1e-9 else "0" for x in v)
    return f"""MODULE MPaletizado
    !***********************************************************
    ! Celda: {s['nombre']}
    ! {s.get('descripcion', '')}
    ! Robot: {s['robot']['modelo']}
    ! Generado por generador/generar.py - no editar a mano,
    ! cambia el JSON de la celda y vuelve a generar.
    !
    ! Cajas por capa: {cajas_por_capa}  (total {n})
    ! Señales necesarias (EIO_paletizado.cfg):
    !   doNewBox  -> crea una caja nueva en el conveyor (Smart Component Source)
    !   doVacuum  -> 1 = coge la caja (Attacher), 0 = la suelta (Detacher)
    !***********************************************************

    ! Garra de vacío: TCP en la cara de las ventosas, Z hacia abajo
    PERS tooldata tGarra := [TRUE,[[0,0,{f(garra['largo_tcp_mm'])}],[1,0,0,0]],[{f(garra['masa_kg'])},[0,0,{f(garra['largo_tcp_mm'] / 2)}],[1,0,0,0],0,0,0]];
    ! Carga de una caja, centro de gravedad en el centro de la caja (bajo el TCP)
    PERS loaddata lCaja := [{f(caja['masa_kg'])},[0,0,{f(caja['alto_mm'] / 2)}],[1,0,0,0],0,0,0];

    ! Pallet: origen en la esquina del pallet a nivel de suelo
    TASK PERS wobjdata wPallet := [FALSE,TRUE,"",[[{f(ex)},{f(ey)},{f(d['suelo'])}],[{q(qp)}]],[[0,0,0],[1,0,0,0]]];
    ! Conveyor: origen en el punto de pick sobre la cinta, X en el sentido de avance
    TASK PERS wobjdata wConveyor := [FALSE,TRUE,"",[[{f(px)},{f(py)},{f(zc)}],[{q(qc)}]],[[0,0,0],[1,0,0,0]]];

    CONST jointtarget jHome := [[0,0,0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
    ! Pick: TCP en la cara superior de la caja
    CONST robtarget pPick := [[0,0,{f(caja['alto_mm'])}],[0,1,0,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
    ! Plantilla de place; la posición y el giro se rellenan desde nPlace
    CONST robtarget pPlaceBase := [[0,0,0],[0,1,0,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];

    CONST num nAprox := {f(mov['aproximacion_mm'])};
    CONST num nTotal := {n};
    ! Posiciones de place en wPallet: [x, y, z TCP, giro garra en grados]
    CONST num nPlace{{{n},4}} := [
{chr(10).join(filas)}
    ];

    PROC main()
        ConfJ\\Off;
        ConfL\\Off;
        Reset doVacuum;
        GripLoad load0;
        MoveAbsJ jHome\\NoEOffs, {mov['vel_rapida']}, z50, tGarra;
        FOR i FROM 1 TO nTotal DO
            CogerCaja;
            DejarCaja i;
        ENDFOR
        MoveAbsJ jHome\\NoEOffs, {mov['vel_rapida']}, z50, tGarra;
        TPWrite "Pallet completo: " \\Num:=nTotal;
    ENDPROC

    PROC CogerCaja()
        PulseDO\\PLength:=0.2, doNewBox;
        MoveJ Offs(pPick,0,0,nAprox), {mov['vel_rapida']}, z50, tGarra\\WObj:=wConveyor;
        MoveL pPick, {mov['vel_lenta']}, fine, tGarra\\WObj:=wConveyor;
        Set doVacuum;
        GripLoad lCaja;
        WaitTime 0.2;
        MoveL Offs(pPick,0,0,nAprox), {mov['vel_aprox']}, z50, tGarra\\WObj:=wConveyor;
    ENDPROC

    PROC DejarCaja(num idx)
        VAR robtarget pT;
        pT := pPlaceBase;
        pT.trans := [nPlace{{idx,1}}, nPlace{{idx,2}}, nPlace{{idx,3}}];
        pT.rot := OrientZYX(nPlace{{idx,4}}, 0, 180);
        MoveJ Offs(pT,0,0,nAprox), {mov['vel_rapida']}, z50, tGarra\\WObj:=wPallet;
        MoveL pT, {mov['vel_lenta']}, fine, tGarra\\WObj:=wPallet;
        Reset doVacuum;
        GripLoad load0;
        WaitTime 0.2;
        MoveL Offs(pT,0,0,nAprox), {mov['vel_aprox']}, z50, tGarra\\WObj:=wPallet;
    ENDPROC
ENDMODULE
"""


EIO = """EIO:CFG_1.0:6:1::
#
EIO_SIGNAL:

      -Name "doVacuum" -SignalType "DO"

      -Name "doNewBox" -SignalType "DO"
"""


# ---------------------------------------------------------------- estación

def caja_mundo(cx, cy, z0, lx, ly, lz):
    """Caja alineada a ejes definida por su centro en XY y su base z0 -> (x0,y0,z0,lx,ly,lz)."""
    return (cx - lx / 2, cy - ly / 2, z0, lx, ly, lz)


def girar_dims(lx, ly, deg):
    return (ly, lx) if round(deg) % 180 else (lx, ly)


def generar_geometria(d):
    s = d["spec"]
    cv, p, caja, garra = s["conveyor"], s["pallet"], s["caja"], s["garra"]
    suelo = d["suelo"]
    partes = []  # (nombre, (r,g,b), (tx,ty,tz), oculto, [cajas relativas al marco de la parte])

    # Pedestal
    if s["robot"].get("base_z_mm", 0) > 0:
        partes.append(("Pedestal", (90, 90, 90), (0, 0, 0), False,
                       [caja_mundo(0, 0, suelo, 900, 900, -suelo)]))

    # Conveyor: cinta, patas y tope
    ex, ey = cv["fin_xy_mm"]
    cdir = cv["direccion_deg"]
    ux, uy = rot2(1, 0, cdir)
    L, W, H = cv["largo_mm"], cv["ancho_mm"], cv["altura_mm"]
    mx, my = ex - ux * L / 2, ey - uy * L / 2
    lx, ly = girar_dims(L, W, cdir)
    cinta = [caja_mundo(mx, my, suelo + H - 100, lx, ly, 100)]
    patas = []
    for a in (-L / 2 + 60, L / 2 - 60):
        for b in (-W / 2 + 40, W / 2 - 40):
            ox, oy = rot2(a, b, cdir)
            patas.append(caja_mundo(mx + ox, my + oy, suelo, 80, 80, H - 100))
    tx, ty = ex + ux * 10, ey + uy * 10
    tlx, tly = girar_dims(20, W, cdir)
    tope = [caja_mundo(tx, ty, suelo + H, tlx, tly, 80)]
    partes.append(("Conveyor", (60, 60, 70), (0, 0, 0), False, cinta + patas))
    partes.append(("Conveyor_Tope", (200, 160, 0), (0, 0, 0), False, tope))

    # Pallet tipo europeo simplificado: 3 tablas inferiores, 9 tacos, tablero superior
    PL, PW, PH = p["largo_mm"], p["ancho_mm"], p["alto_mm"]
    pcx, pcy = p["centro_xy_mm"]
    prot = p["rotacion_deg"]
    cuerpos = []
    h_tabla, h_tablero = 22, 44
    h_taco = PH - h_tabla - h_tablero
    for j in (0.5 * 100, PW / 2, PW - 0.5 * 100):
        ox, oy = rot2(0, j - PW / 2, prot)
        dx, dy = girar_dims(PL, 100, prot)
        cuerpos.append(caja_mundo(pcx + ox, pcy + oy, suelo, dx, dy, h_tabla))
        for i in (72.5, PL / 2, PL - 72.5):
            ox, oy = rot2(i - PL / 2, j - PW / 2, prot)
            dx, dy = girar_dims(145, 100, prot)
            cuerpos.append(caja_mundo(pcx + ox, pcy + oy, suelo + h_tabla, dx, dy, h_taco))
    dx, dy = girar_dims(PL, PW, prot)
    cuerpos.append(caja_mundo(pcx, pcy, suelo + h_tabla + h_taco, dx, dy, h_tablero))
    partes.append(("Pallet", (196, 150, 90), (0, 0, 0), False, cuerpos))

    # Caja plantilla en el punto de pick (la usa el Smart Component Source)
    px, py = d["pick_xy"]
    clx, cly = girar_dims(caja["largo_mm"], caja["ancho_mm"], cdir)
    partes.append(("Caja", (205, 160, 100), (px, py, suelo + H), False,
                   [(-clx / 2, -cly / 2, 0, clx, cly, caja["alto_mm"])]))

    # Garra: en su marco local Z va de la brida (0) a las ventosas (largo_tcp); se crea
    # a un lado sobre el suelo, apoyada en la brida, para luego unirla al robot.
    T = garra["largo_tcp_mm"]
    g = [(-100, -100, 0, 200, 200, 40),                      # placa de brida
         (-40, -40, 40, 80, 80, max(T - 120, 10)),           # mástil
         (-caja["largo_mm"] / 2 - 20, -caja["ancho_mm"] / 2 - 20, T - 80,
          caja["largo_mm"] + 40, caja["ancho_mm"] + 40, 60),  # cuerpo de vacío
         (-caja["largo_mm"] / 2, -caja["ancho_mm"] / 2, T - 20,
          caja["largo_mm"], caja["ancho_mm"], 20)]            # ventosas / espuma
    partes.append(("Garra", (40, 90, 200), (0, -1600, suelo), False, g))

    # Pallet lleno (oculto): sirve para revisar el mosaico sin simular
    llenas = []
    for c in d["places"]:
        dx, dy = girar_dims(c["bx"], c["by"], prot)
        llenas.append(caja_mundo(c["wx"], c["wy"], c["wz"] - caja["alto_mm"] + 1, dx - 2, dy - 2,
                                 caja["alto_mm"] - 2))
    partes.append(("Vista_PalletLleno", (205, 160, 100), (0, 0, 0), True, llenas))
    return partes


def generar_estacion_txt(d, partes):
    s = d["spec"]
    lineas = [
        "# Geometría de la celda para PaletizadoAddin (RobotStudio).",
        f"# Celda: {s['nombre']}  -  robot {s['robot']['modelo']} en el origen.",
        "# PART <nombre> <r> <g> <b> <x> <y> <z> <oculto 0|1>   marco de la parte (mm, mundo)",
        "# BOX  <x0> <y0> <z0> <lx> <ly> <lz>                   caja alineada a ejes, relativa a la parte (mm)",
        f"ROBOT {s['robot']['modelo']}",
    ]
    for nombre, (r, g, b), (tx, ty, tz), oculto, cajas in partes:
        lineas.append(f"PART {nombre} {r} {g} {b} {f(tx)} {f(ty)} {f(tz)} {int(oculto)}")
        lineas += [("BOX " + " ".join(f(v) for v in c)) for c in cajas]
    return "\n".join(lineas) + "\n"


# ---------------------------------------------------------------- vista previa / resumen

def generar_html(d, partes):
    s = d["spec"]
    datos = dict(
        nombre=s["nombre"], descripcion=s.get("descripcion", ""), modelo=s["robot"]["modelo"],
        alcance=s["robot"]["alcance_mm"], suelo=d["suelo"],
        partes=[dict(nombre=n, color=c, t=t, oculto=o, cajas=b) for n, c, t, o, b in partes
                if n != "Vista_PalletLleno"],
        places=[dict(x=c["wx"], y=c["wy"], z=c["wz"], capa=c["capa"],
                     lx=girar_dims(c["bx"], c["by"], s["pallet"]["rotacion_deg"])[0],
                     ly=girar_dims(c["bx"], c["by"], s["pallet"]["rotacion_deg"])[1])
                for c in d["places"]],
        alto_caja=s["caja"]["alto_mm"],
    )
    plantilla = (Path(__file__).parent / "vista_previa_plantilla.html").read_text(encoding="utf-8")
    return plantilla.replace("/*__DATOS__*/null", json.dumps(datos))


def generar_resumen(d):
    s = d["spec"]
    ck = d["checks"]
    por_capa = {}
    for c in d["places"]:
        por_capa.setdefault((c["capa"], c["patron"]), 0)
        por_capa[(c["capa"], c["patron"])] += 1
    altura = s["pallet"]["alto_mm"] + s["capas"] * s["caja"]["alto_mm"]
    out = [f"# Resumen: {s['nombre']}", "", s.get("descripcion", ""), "",
           f"- Robot: **{s['robot']['modelo']}** (alcance {s['robot']['alcance_mm']} mm)",
           f"- Cajas totales: **{len(d['places'])}** en {s['capas']} capas",
           f"- Altura del pallet cargado: **{altura} mm** desde el suelo",
           f"- Carga en muñeca: {ck['carga']} kg (garra + caja)",
           f"- Distancia horizontal de pick: {ck['r_pick']:.0f} mm; rango de place: "
           f"{ck['r_min']:.0f}-{ck['r_max']:.0f} mm",
           f"- TCP más alto: {ck['z_tcp_max']:.0f} mm; brida más alta (con aproximación): "
           f"{ck['z_brida_max']:.0f} mm sobre la base del robot", "",
           "| Capa | Mosaico | Cajas |", "|---|---|---|"]
    out += [f"| {k} | {pat} | {n} |" for (k, pat), n in sorted(por_capa.items())]
    out += ["", "## Advertencias", ""] + [f"- {a}" for a in d["advertencias"]]
    return "\n".join(out) + "\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("celda", help="archivo JSON de la celda")
    ap.add_argument("--salida", default=str(Path(__file__).resolve().parent.parent / "salida"))
    args = ap.parse_args()
    spec = json.loads(Path(args.celda).read_text(encoding="utf-8"))
    d = calcular(spec)
    partes = generar_geometria(d)
    dest = Path(args.salida) / spec["nombre"]
    dest.mkdir(parents=True, exist_ok=True)
    (dest / "MPaletizado.mod").write_text(ascii_rapid(generar_rapid(d)), encoding="ascii")
    (dest / "EIO_paletizado.cfg").write_text(EIO, encoding="utf-8")
    (dest / "estacion.txt").write_text(generar_estacion_txt(d, partes), encoding="utf-8")
    (dest / "vista_previa.html").write_text(generar_html(d, partes), encoding="utf-8")
    resumen = generar_resumen(d)
    (dest / "resumen.md").write_text(resumen, encoding="utf-8")
    print(resumen)
    print(f"Archivos generados en {dest}")


if __name__ == "__main__":
    main()
