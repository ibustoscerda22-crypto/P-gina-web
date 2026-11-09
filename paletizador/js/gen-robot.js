/* Generadores de programa de robot: ABB RAPID, FANUC TP (.LS), KUKA KRL.
   Arquitectura: el PLC es maestro y envía comandos (código, estaciones, X/Y/Z/Rz en el frame
   del palet). El robot sólo ejecuta, confirma (Ack) y reporta fin (Done). */
window.PAL = window.PAL || {};

PAL.genRobot = (function () {
  const I = () => PAL.iface;
  const f1 = (v) => Number(v).toFixed(1);
  const f3 = (v) => Number(v).toFixed(3);
  const f6 = (v) => Number(v).toFixed(6);
  const stamp = () => new Date().toISOString().slice(0, 16).replace("T", " ");

  function header(ctx, c) {
    const { cfg } = ctx;
    return [
      `${c} =====================================================================`,
      `${c} Proyecto : ${cfg.projectName}`,
      `${c} Robot    : ${cfg.robotBrand} ${cfg.robotModel} / ${cfg.robotCtrl}`,
      `${c} PLC      : ${cfg.plcBrand} ${cfg.plcModel} (maestro)  Bus: ${cfg.protocol}`,
      `${c} Generado : ${stamp()} por PalletCell Designer`,
      `${c} Mosaico  : ${ctx.pat.perLayer} cajas/capa x ${ctx.pat.layers} capas, caja ${cfg.boxL}x${cfg.boxW}x${cfg.boxH} mm`,
      `${c} REVISAR  : frames, TCP, carga y Home deben verificarse en la celda real.`,
      `${c} =====================================================================`
    ].join("\n");
  }

  /* ========================= ABB ========================= */
  function abbEio(ctx) {
    const dev = ctx.cfg.protocol === "PROFINET" ? "PN_Internal_Device" : "EN_Internal_Device";
    const L = [];
    L.push("EIO:CFG_1.0:6:1::");
    L.push("#");
    L.push(`# Señales de intercambio con el PLC (${ctx.cfg.protocol}) - 64 bytes IN / 64 bytes OUT`);
    L.push("# Las palabras llegan en little-endian (el PLC Siemens aplica SWAP), por eso el mapeo es directo.");
    L.push("#");
    L.push("EIO_SIGNAL:");
    L.push("");
    const sig = (name, type, map, extra) =>
      L.push(`      -Name "${name}" -SignalType "${type}" -Device "${dev}"\\\n      -DeviceMap "${map}"${extra || ""}`);
    I().PLC_TO_ROBOT.forEach((s) => { const a = I().robotAddr("ABB", true, s, ctx.cfg); sig(a.name, s.type === "BOOL" ? "DI" : "GI", a.map); });
    I().ROBOT_TO_PLC.forEach((s) => { const a = I().robotAddr("ABB", false, s, ctx.cfg); sig(a.name, s.type === "BOOL" ? "DO" : "GO", a.map); });
    L.push("");
    L.push("# Señales locales de la herramienta: ajusta -Device al módulo de E/S real del robot");
    const grip = ctx.cfg.gripper === "vacio"
      ? [["doVacuumOn", "DO", "0"], ["doBlowOff", "DO", "1"], ["doVacuumOnB", "DO", "2"], ["doSheetVac", "DO", "3"],
         ["diVacuumOK", "DI", "0"], ["diPartPresentTool", "DI", "1"], ["diVacuumOKB", "DI", "2"], ["diSheetOK", "DI", "3"]]
      : [["doValveClose", "DO", "0"], ["doValveOpen", "DO", "1"], ["doVacuumOnB", "DO", "2"], ["doSheetVac", "DO", "3"],
         ["diClampClosed", "DI", "0"], ["diClampOpened", "DI", "1"], ["diPartPresentTool", "DI", "2"], ["diVacuumOKB", "DI", "3"], ["diSheetOK", "DI", "4"]];
    L.push("# doVacuumOnB/diVacuumOKB = zona B de la herramienta (toma de 2 cajas); doSheetVac/diSheetOK = ventosas de lámina");
    grip.forEach(([n, t, m]) => L.push(`      -Name "${n}" -SignalType "${t}" -Device "LocalIO"\\\n      -DeviceMap "${m}"`));
    L.push("");
    L.push("#");
    L.push("EIO_CROSS:");
    L.push("");
    L.push(`      -Name "CC_LifeBit" -Res "doRob_LifeBit" -Act1 "diPLC_LifeBit" -Act1_invert`);
    L.push("");
    L.push("#");
    L.push("SYSSIG_IN:");
    L.push("");
    L.push(`      -Signal "diMotorsOn" -Action "MotorOn"`);
    L.push(`      -Signal "diProgStart" -Action "Start" -Arg1 "CONT"`);
    L.push(`      -Signal "diProgStop" -Action "Stop"`);
    L.push(`      -Signal "diResetFault" -Action "ResetError"`);
    L.push("");
    L.push("#");
    L.push("SYSSIG_OUT:");
    L.push("");
    L.push(`      -Status "MotOnState" -Signal "doMotorsOnState"`);
    L.push(`      -Status "CycleOn" -Signal "doProgRunning"`);
    L.push(`      -Status "AutoOn" -Signal "doAutoMode"`);
    L.push(`      -Status "EmStop" -Signal "doEStopActive"`);
    L.push("");
    return L.join("\n");
  }

  function abbMod(ctx) {
    const { cfg, lay } = ctx;
    const gm = ctx.checks.gripMass;
    const wob = (name, fr) => {
      const q = PAL.calc.quatZ(fr.rz);
      return `  PERS wobjdata ${name}:=[FALSE,TRUE,"",[[${f1(fr.x)},${f1(fr.y)},${f1(fr.z)}],[${q.map(f6).join(",")}]],[[0,0,0],[1,0,0,0]]];`;
    };
    const vac = cfg.gripper === "vacio";
    const np = ctx.pat.nPick || 1;
    const zoneCase = (inOut) => {
      const rows = [];
      lay.pallets.forEach((p) => rows.push(`    CASE ${p.id}:\n      ${inOut === "in" ? `WaitDI diPermitPallet${p.id},1\\MaxTime:=nZoneTmo\\TimeFlag:=bTmo;\n      IF NOT bTmo SetDO doOutPallet${p.id},0;` : `SetDO doOutPallet${p.id},1;`}`));
      lay.infeeds.forEach((f) => rows.push(`    CASE ${10 + f.id}:\n      ${inOut === "in" ? `WaitDI diPermitInfeed${f.id},1\\MaxTime:=nZoneTmo\\TimeFlag:=bTmo;\n      IF NOT bTmo SetDO doOutInfeed${f.id},0;` : `SetDO doOutInfeed${f.id},1;`}`));
      return rows.join("\n");
    };
    const wobCase = (prefix, items, base) => items.map((s) => `    CASE ${s.id}:\n      wobjCur:=${prefix}${s.id};`).join("\n");

    return `MODULE PalletPLC
${header(ctx, "  !")}

  !---------------- Herramienta y cargas ----------------
  ! TCP en la cara de contacto de la herramienta. Medir/verificar con método de 4 puntos o CAD.
  PERS tooldata tGripper:=[TRUE,[[0,0,${f1(cfg.toolTcpZ)}],[1,0,0,0]],[${f1(gm)},[0,0,${f1(cfg.toolTcpZ * 0.45)}],[1,0,0,0],0,0,0]];
  ! Carga útil (caja). Ejecutar LoadIdentify con la carga real si es posible.
  PERS loaddata ldBox:=[${f1(cfg.boxWeight)},[${np === 2 ? f1(cfg.boxL / 2) : 0},0,${f1(cfg.boxH / 2)}],[1,0,0,0],0,0,0];
  PERS loaddata ldBox2:=[${f1(cfg.boxWeight * 2)},[0,0,${f1(cfg.boxH / 2)}],[1,0,0,0],0,0,0];
  ! Cajas por toma de la herramienta (1 = simple, 2 = zonas A+B). Zona A = mitad +X de la herramienta.
  CONST num NPICK:=${np};

  !---------------- Workobjects (valores nominales del layout) ----------------
  ! Calibrar cada uno con el método de 3 puntos (ver pestaña Workobjects) y actualizar.
${lay.pallets.map((p) => wob("wobjPallet" + p.id, p.frame)).join("\n")}
${lay.infeeds.map((f) => wob("wobjInfeed" + f.id, f.frame)).join("\n")}
  PERS wobjdata wobjCur:=[FALSE,TRUE,"",[[0,0,0],[1,0,0,0]],[[0,0,0],[1,0,0,0]]];

  !---------------- Posiciones ----------------
  ! jHome: ENSEÑAR. Debe quedar fuera de todas las zonas de palet e infeed.
  PERS jointtarget jHome:=[[0,0,0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
  ! pSafeTop: punto de paso sobre el robot (wobj0) a altura segura; ENSEÑAR.
  PERS robtarget pSafeTop:=[[${f1(ctx.robot.reach * 0.35)},0,${f1(cfg.maxStackH + cfg.outfeedH - cfg.pedestalH + cfg.approachZ)}],[0,1,0,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
  ! Corrección angular de la brida si el eje X de la herramienta no coincide con el largo de la caja
  PERS num nRzOffset:=0;
  ! pSheetPick: toma de lámina sobre el magazín (wobj0); ENSEÑAR con la pila llena
  PERS robtarget pSheetPick:=[[${f1(lay.sheet ? lay.sheet.center.x : 0)},${f1(lay.sheet ? lay.sheet.center.y : 0)},${f1(cfg.outfeedH - cfg.pedestalH + 300)}],[0,1,0,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];

  !---------------- Velocidades ----------------
  PERS speeddata vFast:=[3000,500,5000,1000];
  PERS speeddata vApp:=[800,300,5000,1000];
  PERS speeddata vPlace:=[150,100,5000,1000];
  PERS num nGripTime:=0.25;
  PERS num nZoneTmo:=30;

  !---------------- Datos del comando ----------------
  VAR num nCmdID;
  VAR num nCmdCode;
  VAR num nPick;
  VAR num nPlace;
  VAR num nLayer;
  VAR num nBox;
  VAR num nX;
  VAR num nY;
  VAR num nZ;
  VAR num nRz;
  VAR num nAppZ;
  VAR num nAppXY;
  VAR num nOvr;
  VAR num nBoxL;
  VAR num nBoxW;
  VAR num nBoxH;
  VAR num nErr;
  VAR num nZones:=1;
  VAR num nBoxesDone:=0;
  VAR num nCycMs;
  VAR bool bTmo;
  VAR clock clkCycle;
  VAR robtarget pTgt;

  PROC main()
    Init;
    WHILE TRUE DO
      SetDO doReadyForCmd,1;
      WaitDI diCmdValid,1;
      SetDO doReadyForCmd,0;
      ReadCmd;
      SetDO doCmdDone,0;
      SetGO goCmdIDEcho,nCmdID;
      SetDO doCmdAck,1;
      WaitDI diCmdValid,0;
      SetDO doCmdAck,0;
      SetDO doCycleOn,1;
      SetGO goStatus,1;
      nErr:=0;
      ClkReset clkCycle;
      ClkStart clkCycle;
      TEST nCmdCode
      CASE 1:
        PickPlace;
      CASE 2:
        GoHome;
      CASE 3:
        SlipSheet;
      CASE 4:
        MaintPos;
      CASE 5:
        TestGripper;
      DEFAULT:
        nErr:=1;
      ENDTEST
      ClkStop clkCycle;
      nCycMs:=Round(ClkRead(clkCycle)*1000);
      IF nCycMs>65535 nCycMs:=65535;
      SetGO goCycleTime,nCycMs;
      SetGO goErrorCode,nErr;
      IF nErr=0 THEN
        SetGO goStatus,2;
        SetDO doFaultActive,0;
      ELSE
        SetGO goStatus,3;
        SetDO doFaultActive,1;
      ENDIF
      SetDO doCycleOn,0;
      SetDO doCmdDone,1;
    ENDWHILE
  ENDPROC

  PROC Init()
    ConfJ\\Off;
    ConfL\\Off;
    AccSet 100,100;
    SetDO doCmdAck,0;
    SetDO doCmdDone,0;
    SetDO doCycleOn,0;
    SetDO doHeldState,0;
    SetGO goStatus,0;
    SetGO goErrorCode,0;
    GripOff;
    GripLoad load0;
    ! Al arrancar se asume el robot fuera de todas las zonas tras ir a Home
    MoveAbsJ jHome,v500,fine,tGripper;
    SetAllZonesFree;
  ENDPROC

  PROC ReadCmd()
    nCmdID:=GInput(giCmdID);
    nCmdCode:=GInput(giCmdCode);
    nPick:=GInput(giPickStation);
    nPlace:=GInput(giPlaceStation);
    nLayer:=GInput(giLayer);
    nBox:=GInput(giBoxIndex);
    nX:=GInput(giPosX)/10;
    nY:=GInput(giPosY)/10;
    nZ:=GInput(giPosZ)/10;
    nRz:=GInput(giPosRz)/10;
    nAppZ:=GInput(giApproachZ);
    nAppXY:=GInput(giApproachXY);
    nOvr:=GInput(giSpeedOvr);
    nBoxL:=GInput(giBoxL);
    nBoxW:=GInput(giBoxW);
    nBoxH:=GInput(giBoxH);
    nZones:=GInput(giGripZones);
    IF nZones<1 nZones:=1;
    IF nOvr<1 OR nOvr>100 nOvr:=100;
    IF nAppZ<20 nAppZ:=${cfg.approachZ};
    SpeedRefresh nOvr;
  ENDPROC

  PROC PickPlace()
    IF nPick<1 OR nPick>${lay.infeeds.length} THEN
      nErr:=2;
      RETURN;
    ENDIF
    IF nPlace<1 OR nPlace>${lay.pallets.length} THEN
      nErr:=3;
      RETURN;
    ENDIF
    IF nX<0 OR nX>${cfg.palletL + 2 * cfg.overhang} OR nY<0 OR nY>${cfg.palletW + 2 * cfg.overhang} THEN
      nErr:=7;
      RETURN;
    ENDIF
    !------ Toma en el infeed ------
    SetGO goStep,10;
    SelWobjInfeed nPick;
    ! TCP al centro de las NPICK cajas que esperan contra el tope
    pTgt:=MakeTarget(-nBoxL*NPICK/2,nBoxW/2,nBoxH,0);
    CheckHold;
    EnterZone 10+nPick;
    IF nErr<>0 RETURN;
    MoveJ Offs(pTgt,0,0,nAppZ),vFast,z100,tGripper\\WObj:=wobjCur;
    MoveL Offs(pTgt,0,0,30),vApp,z5,tGripper\\WObj:=wobjCur;
    MoveL pTgt,vPlace,fine,tGripper\\WObj:=wobjCur;
    GripOn;
    WaitTime nGripTime;
    IF NOT GripOK() THEN
      GripOff;
      MoveL Offs(pTgt,0,0,nAppZ),vApp,fine,tGripper\\WObj:=wobjCur;
      LeaveZone 10+nPick;
      nErr:=4;
      RETURN;
    ENDIF
    IF nZones>=3 THEN
      GripLoad ldBox2;
    ELSE
      GripLoad ldBox;
    ENDIF
    MoveL Offs(pTgt,0,0,nAppZ),vApp,z50,tGripper\\WObj:=wobjCur;
    LeaveZone 10+nPick;
    !------ Colocación en el palet ------
    SetGO goStep,20;
    SelWobjPallet nPlace;
    pTgt:=MakeTarget(nX,nY,nZ,nRz);
    CheckHold;
    EnterZone nPlace;
    IF nErr<>0 RETURN;
    MoveJ Offs(pTgt,-nAppXY,-nAppXY,nAppZ),vFast,z100,tGripper\\WObj:=wobjCur;
    IF NOT GripOK() THEN
      nErr:=5;
      RETURN;
    ENDIF
    MoveL Offs(pTgt,-nAppXY,-nAppXY,20),vApp,z5,tGripper\\WObj:=wobjCur;
    MoveL pTgt,vPlace,fine,tGripper\\WObj:=wobjCur;
    GripOff;
    WaitTime nGripTime;
    GripLoad load0;
    MoveL Offs(pTgt,0,0,nAppZ),vApp,z50,tGripper\\WObj:=wobjCur;
    MoveJ pSafeTop,vFast,z200,tGripper\\WObj:=wobj0;
    LeaveZone nPlace;
    Incr nBoxesDone;
    SetGO goBoxesDone,nBoxesDone MOD 65536;
    SetGO goStep,0;
  ENDPROC

  PROC SlipSheet()
    ! Lámina separadora: toma en el magazín (pSheetPick) y deja centrada sobre la capa (X,Y,Z del PLC)
    IF nPlace<1 OR nPlace>${lay.pallets.length} THEN
      nErr:=3;
      RETURN;
    ENDIF
    SetGO goStep,30;
    CheckHold;
    MoveJ Offs(pSheetPick,0,0,nAppZ),vFast,z100,tGripper\\WObj:=wobj0;
    ! Si la pila del magazín baja, reemplazar por SearchL con sensor de contacto
    MoveL pSheetPick,vPlace,fine,tGripper\\WObj:=wobj0;
    SetDO doSheetVac,1;
    WaitTime 0.3;
    IF diSheetOK=0 THEN
      SetDO doSheetVac,0;
      MoveL Offs(pSheetPick,0,0,nAppZ),vApp,fine,tGripper\\WObj:=wobj0;
      nErr:=4;
      RETURN;
    ENDIF
    MoveL Offs(pSheetPick,0,0,nAppZ),vApp,z50,tGripper\\WObj:=wobj0;
    SelWobjPallet nPlace;
    pTgt:=MakeTarget(nX,nY,nZ,nRz);
    EnterZone nPlace;
    IF nErr<>0 RETURN;
    MoveJ Offs(pTgt,0,0,nAppZ),vFast,z100,tGripper\\WObj:=wobjCur;
    MoveL Offs(pTgt,0,0,10),vPlace,fine,tGripper\\WObj:=wobjCur;
    SetDO doSheetVac,0;
    WaitTime 0.2;
    MoveL Offs(pTgt,0,0,nAppZ),vApp,z50,tGripper\\WObj:=wobjCur;
    MoveJ pSafeTop,vFast,z200,tGripper\\WObj:=wobj0;
    LeaveZone nPlace;
    SetGO goStep,0;
  ENDPROC

  PROC GoHome()
    MoveJ pSafeTop,vApp,z200,tGripper\\WObj:=wobj0;
    MoveAbsJ jHome,vApp,fine,tGripper;
    SetAllZonesFree;
  ENDPROC

  PROC MaintPos()
    ! Posición de mantención (cambio de ventosas): ENSEÑAR
    GoHome;
  ENDPROC

  PROC TestGripper()
    GripOn;
    WaitTime 1;
    GripOff;
  ENDPROC

  FUNC robtarget MakeTarget(num x,num y,num z,num rz)
    VAR robtarget p:=[[0,0,0],[0,1,0,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
    p.trans:=[x,y,z];
    ! Herramienta apuntando hacia abajo (Rx=180) y giro de caja en Z del frame
    p.rot:=OrientZYX(rz+nRzOffset,0,180);
    RETURN p;
  ENDFUNC

  PROC SelWobjPallet(num n)
    TEST n
${wobCase("wobjPallet", lay.pallets)}
    ENDTEST
  ENDPROC

  PROC SelWobjInfeed(num n)
    TEST n
${wobCase("wobjInfeed", lay.infeeds)}
    ENDTEST
  ENDPROC

  ! Zonas: 1..4 = palets, 11..14 = infeeds
  PROC EnterZone(num z)
    bTmo:=FALSE;
    TEST z
${zoneCase("in")}
    ENDTEST
    IF bTmo nErr:=6;
  ENDPROC

  PROC LeaveZone(num z)
    TEST z
${zoneCase("out")}
    ENDTEST
  ENDPROC

  PROC SetAllZonesFree()
${lay.pallets.map((p) => `    SetDO doOutPallet${p.id},1;`).join("\n")}
${lay.infeeds.map((f) => `    SetDO doOutInfeed${f.id},1;`).join("\n")}
    SetDO doAtHome,1;
  ENDPROC

  ! Pausa PackML: termina el movimiento actual y espera a que el PLC libere Hold
  PROC CheckHold()
    SetDO doAtHome,0;
    IF diHold=1 THEN
      SetDO doHeldState,1;
      WaitDI diHold,0;
      SetDO doHeldState,0;
    ENDIF
  ENDPROC

  PROC GripOn()
${vac ? "    SetDO doBlowOff,0;\n    SetDO doVacuumOn,1;" : "    SetDO doValveOpen,0;\n    SetDO doValveClose,1;"}
    IF nZones>=3 SetDO doVacuumOnB,1;
  ENDPROC

  PROC GripOff()
${vac ? "    SetDO doVacuumOn,0;\n    PulseDO\\PLength:=0.2,doBlowOff;" : "    SetDO doValveClose,0;\n    SetDO doValveOpen,1;"}
    SetDO doVacuumOnB,0;
    SetDO doGripClosed,0;
    SetDO doGripOpen,1;
  ENDPROC

  FUNC bool GripOK()
    VAR bool ok;
    ok:=${vac ? "diVacuumOK=1" : "diClampClosed=1"} AND diPartPresentTool=1 AND (nZones<3 OR diVacuumOKB=1);
    IF ok THEN
      SetDO doGripClosed,1;
      SetDO doGripOpen,0;
      SetDO doPartPresent,1;
    ELSE
      SetDO doPartPresent,0;
    ENDIF
    RETURN ok;
  ENDFUNC
ENDMODULE
`;
  }

  /* ========================= FANUC ========================= */
  function lsHeader(name, comment) {
    const d = new Date();
    const ds = `${String(d.getFullYear()).slice(2)}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return `/PROG  ${name}
/ATTR
OWNER		= MNEDITOR;
COMMENT		= "${comment.slice(0, 16)}";
PROG_SIZE	= 0;
CREATE		= DATE ${ds}  TIME 12:00:00;
MODIFIED	= DATE ${ds}  TIME 12:00:00;
FILE_NAME	= ;
VERSION		= 0;
LINE_COUNT	= 0;
MEMORY_SIZE	= 0;
PROTECT		= READ_WRITE;
TCD:  STACK_SIZE	= 0,
      TASK_PRIORITY	= 50,
      TIME_SLICE	= 0,
      BUSY_LAMP_OFF	= 0,
      ABORT_REQUEST	= 0,
      PAUSE_REQUEST	= 0;
DEFAULT_GROUP	= 1,*,*,*,*;
CONTROL_CODE	= 00000000 00000000;
/MN
`;
  }
  function lsBody(lines) {
    return lines.map((l, i) => `${String(i + 1).padStart(4, " ")}:  ${l} ;`).join("\n") + "\n/POS\n/END\n";
  }
  const fDI = (n) => { const s = I().PLC_TO_ROBOT.find((x) => x.name === n); return s.byte * 8 + s.bit + 1; };
  const fDO = (n) => { const s = I().ROBOT_TO_PLC.find((x) => x.name === n); return s.byte * 8 + s.bit + 1; };
  const fGI = (n) => I().PLC_TO_ROBOT.filter((x) => x.type === "UINT").findIndex((x) => x.name === n) + 1;
  const fGO = (n) => I().ROBOT_TO_PLC.filter((x) => x.type === "UINT").findIndex((x) => x.name === n) + 1;

  function fanucMain(ctx) {
    const L = [
      "!" + "Paletizado esclavo de PLC",
      "!R[1..17]=datos comando",
      "UTOOL_NUM=1",
      "CALL PAL_HOME",
      "LBL[1]",
      `DO[${fDO("ReadyForCmd")}:ReadyForCmd]=ON`,
      `WAIT DI[${fDI("CmdValid")}:CmdValid]=ON`,
      `DO[${fDO("ReadyForCmd")}:ReadyForCmd]=OFF`,
      `R[1:CmdID]=GI[${fGI("CmdID")}]`,
      `R[2:CmdCode]=GI[${fGI("CmdCode")}]`,
      `R[3:PickSt]=GI[${fGI("PickStation")}]`,
      `R[4:PlaceSt]=GI[${fGI("PlaceStation")}]`,
      `R[5:Layer]=GI[${fGI("Layer")}]`,
      `R[6:Box]=GI[${fGI("BoxIndex")}]`,
      `R[7:X]=GI[${fGI("PosX")}]`,
      `R[8:Y]=GI[${fGI("PosY")}]`,
      `R[9:Z]=GI[${fGI("PosZ")}]`,
      `R[10:Rz]=GI[${fGI("PosRz")}]`,
      `R[11:AppZ]=GI[${fGI("ApproachZ")}]`,
      `R[12:AppXY]=GI[${fGI("ApproachXY")}]`,
      `R[13:Ovr]=GI[${fGI("SpeedOvr")}]`,
      `R[14:BoxL]=GI[${fGI("BoxL")}]`,
      `R[15:BoxW]=GI[${fGI("BoxW")}]`,
      `R[16:BoxH]=GI[${fGI("BoxH")}]`,
      `R[17:Zones]=GI[${fGI("GripZones")}]`,
      `DO[${fDO("CmdDone")}:CmdDone]=OFF`,
      `GO[${fGO("CmdIDEcho")}:CmdIDEcho]=R[1]`,
      `DO[${fDO("CmdAck")}:CmdAck]=ON`,
      `WAIT DI[${fDI("CmdValid")}:CmdValid]=OFF`,
      `DO[${fDO("CmdAck")}:CmdAck]=OFF`,
      `DO[${fDO("CycleOn")}:CycleOn]=ON`,
      `GO[${fGO("Status")}:Status]=1`,
      "R[20:Err]=0",
      "IF R[13]<1,R[13]=100",
      "IF R[13]>100,R[13]=100",
      "OVERRIDE=R[13]%",
      "SELECT R[2]=1,CALL PAL_PICKPLACE",
      "       =2,CALL PAL_HOME",
      "       =3,CALL PAL_SHEET",
      "       =4,CALL PAL_HOME",
      "       =5,CALL PAL_GRIPTEST",
      "       ELSE,R[20]=1",
      `GO[${fGO("ErrorCode")}:ErrorCode]=R[20]`,
      "IF R[20]=0,JMP LBL[2]",
      `GO[${fGO("Status")}:Status]=3`,
      `DO[${fDO("FaultActive")}:FaultActive]=ON`,
      "JMP LBL[3]",
      "LBL[2]",
      `GO[${fGO("Status")}:Status]=2`,
      `DO[${fDO("FaultActive")}:FaultActive]=OFF`,
      "LBL[3]",
      `DO[${fDO("CycleOn")}:CycleOn]=OFF`,
      `DO[${fDO("CmdDone")}:CmdDone]=ON`,
      "JMP LBL[1]"
    ];
    return lsHeader("PAL_MAIN", "Paletizado PLC") + lsBody(L);
  }

  function fanucPickPlace(ctx) {
    const { cfg, lay } = ctx;
    const nI = lay.infeeds.length, nP = lay.pallets.length;
    const L = [
      "!Validaciones",
      `IF R[3]<1,JMP LBL[92]`,
      `IF R[3]>${nI},JMP LBL[92]`,
      `IF R[4]<1,JMP LBL[93]`,
      `IF R[4]>${nP},JMP LBL[93]`,
      "!--- TOMA: UF 5..8 = infeeds ---",
      `GO[${fGO("Step")}:Step]=10`,
      "R[21]=R[3]+4",
      "UFRAME_NUM=R[21]",
      "!PR[10]=orientacion de referencia",
      "!herramienta abajo (ENSENAR)",
      "PR[11]=PR[10]",
      "R[25]=0-R[14]",
      ctx.pat.nPick === 2 ? "PR[11,1]=R[25]" : "PR[11,1]=R[25]/2",
      "PR[11,2]=R[15]/2",
      "PR[11,3]=R[16]",
      "PR[12]=PR[10]-PR[10]",
      "PR[12,3]=R[11]",
      "!Zona infeed",
      `R[22]=R[3]+${fDI("PermitInfeed1") - 1}`,
      `R[23]=R[3]+${fDO("OutInfeed1") - 1}`,
      "CALL PAL_HOLDCHK",
      "$WAITTMOUT=3000",
      "WAIT DI[R[22]]=ON TIMEOUT,LBL[96]",
      "DO[R[23]]=OFF",
      "J PR[11] 100% CNT50 Offset,PR[12]",
      "L PR[11] 300mm/sec FINE",
      "CALL PAL_GRIPON",
      "WAIT .25(sec)",
      "IF RI[1:ToolOK]=OFF,JMP LBL[94]",
      "IF (R[17]>=3 AND RI[3:ToolOKB]=OFF),JMP LBL[94]",
      "IF R[17]<3,JMP LBL[31]",
      "PAYLOAD[3]",
      "JMP LBL[32]",
      "LBL[31]",
      "PAYLOAD[2]",
      "LBL[32]",
      "L PR[11] 1500mm/sec CNT50 Offset,PR[12]",
      "DO[R[23]]=ON",
      "!--- COLOCACION: UF 1..4 = palets ---",
      `GO[${fGO("Step")}:Step]=20`,
      "UFRAME_NUM=R[4]",
      "PR[11]=PR[10]",
      "PR[11,1]=R[7]/10",
      "PR[11,2]=R[8]/10",
      "PR[11,3]=R[9]/10",
      "R[24]=R[10]/10",
      "PR[11,6]=PR[10,6]+R[24]",
      "PR[13]=PR[10]-PR[10]",
      "PR[13,1]=0-R[12]",
      "PR[13,2]=0-R[12]",
      "PR[13,3]=R[11]",
      `R[22]=R[4]+${fDI("PermitPallet1") - 1}`,
      `R[23]=R[4]+${fDO("OutPallet1") - 1}`,
      "CALL PAL_HOLDCHK",
      "WAIT DI[R[22]]=ON TIMEOUT,LBL[96]",
      "DO[R[23]]=OFF",
      "J PR[11] 100% CNT50 Offset,PR[13]",
      "IF RI[2:PartPres]=OFF,JMP LBL[95]",
      "PR[13,3]=20",
      "L PR[11] 1000mm/sec CNT10 Offset,PR[13]",
      "L PR[11] 150mm/sec FINE",
      "CALL PAL_GRIPOFF",
      "WAIT .25(sec)",
      "PAYLOAD[1]",
      "L PR[11] 1500mm/sec CNT50 Offset,PR[12]",
      "UFRAME_NUM=0",
      "J PR[2:SafeTop] 100% CNT100",
      "DO[R[23]]=ON",
      `GO[${fGO("Step")}:Step]=0`,
      "END",
      "LBL[92]",
      "R[20]=2",
      "END",
      "LBL[93]",
      "R[20]=3",
      "END",
      "LBL[94]",
      "CALL PAL_GRIPOFF",
      "L PR[11] 500mm/sec FINE Offset,PR[12]",
      "DO[R[23]]=ON",
      "R[20]=4",
      "END",
      "LBL[95]",
      "R[20]=5",
      "END",
      "LBL[96]",
      "R[20]=6"
    ];
    return lsHeader("PAL_PICKPLACE", "Toma y deja") + lsBody(L);
  }

  function fanucSmall(ctx) {
    const { cfg, lay } = ctx;
    const vac = cfg.gripper === "vacio";
    const free = lay.pallets.map((p) => `DO[${fDO("OutPallet" + p.id)}]=ON`).concat(lay.infeeds.map((f) => `DO[${fDO("OutInfeed" + f.id)}]=ON`));
    return {
      "PAL_HOME.LS": lsHeader("PAL_HOME", "Ir a Home") + lsBody([
        "!PR[2]=paso seguro sobre robot",
        "!PR[1]=Home (ENSENAR, coord. joint)",
        "UFRAME_NUM=0",
        "J PR[2:SafeTop] 50% CNT100",
        "J PR[1:Home] 50% FINE"
      ].concat(free, [`DO[${fDO("AtHome")}:AtHome]=ON`])),
      "PAL_HOLDCHK.LS": lsHeader("PAL_HOLDCHK", "Pausa PackML") + lsBody([
        `DO[${fDO("AtHome")}:AtHome]=OFF`,
        `IF DI[${fDI("Hold")}:Hold]=OFF,JMP LBL[1]`,
        `DO[${fDO("HeldState")}:Held]=ON`,
        `WAIT DI[${fDI("Hold")}:Hold]=OFF`,
        `DO[${fDO("HeldState")}:Held]=OFF`,
        "LBL[1]"
      ]),
      "PAL_GRIPON.LS": lsHeader("PAL_GRIPON", "Toma producto") + lsBody(vac
        ? [`RO[2:Soplado]=OFF`, `RO[1:Vacio]=ON`, `DO[${fDO("GripOpen")}:GripOpen]=OFF`, `DO[${fDO("GripClosed")}:GripClosed]=ON`, "IF R[17]<3,JMP LBL[1]", "RO[3:VacioB]=ON", "LBL[1]"]
        : [`RO[2:Abrir]=OFF`, `RO[1:Cerrar]=ON`, `DO[${fDO("GripOpen")}:GripOpen]=OFF`, `DO[${fDO("GripClosed")}:GripClosed]=ON`, "IF R[17]<3,JMP LBL[1]", "RO[3:VacioB]=ON", "LBL[1]"]),
      "PAL_GRIPOFF.LS": lsHeader("PAL_GRIPOFF", "Suelta producto") + lsBody(vac
        ? [`RO[1:Vacio]=OFF`, "RO[3:VacioB]=OFF", `RO[2:Soplado]=PULSE,0.2sec`, `DO[${fDO("GripClosed")}:GripClosed]=OFF`, `DO[${fDO("GripOpen")}:GripOpen]=ON`]
        : [`RO[1:Cerrar]=OFF`, "RO[3:VacioB]=OFF", `RO[2:Abrir]=ON`, `DO[${fDO("GripClosed")}:GripClosed]=OFF`, `DO[${fDO("GripOpen")}:GripOpen]=ON`]),
      "PAL_SHEET.LS": lsHeader("PAL_SHEET", "Lamina separadora") + lsBody([
        "!PR[3]=toma lamina en magazin (UF0)",
        "IF R[4]<1,JMP LBL[93]",
        `IF R[4]>${lay.pallets.length},JMP LBL[93]`,
        `GO[${fGO("Step")}:Step]=30`,
        "CALL PAL_HOLDCHK",
        "UFRAME_NUM=0",
        "PR[12]=PR[10]-PR[10]",
        "PR[12,3]=R[11]",
        "J PR[3:SheetPick] 100% CNT50 Offset,PR[12]",
        "L PR[3:SheetPick] 300mm/sec FINE",
        "RO[4:VacLamina]=ON",
        "WAIT .30(sec)",
        "IF RI[4:LaminaOK]=OFF,JMP LBL[94]",
        "L PR[3:SheetPick] 1500mm/sec CNT50 Offset,PR[12]",
        "UFRAME_NUM=R[4]",
        "PR[11]=PR[10]",
        "PR[11,1]=R[7]/10",
        "PR[11,2]=R[8]/10",
        "PR[11,3]=R[9]/10",
        `R[22]=R[4]+${fDI("PermitPallet1") - 1}`,
        `R[23]=R[4]+${fDO("OutPallet1") - 1}`,
        "WAIT DI[R[22]]=ON TIMEOUT,LBL[96]",
        "DO[R[23]]=OFF",
        "J PR[11] 100% CNT50 Offset,PR[12]",
        "L PR[11] 300mm/sec FINE",
        "RO[4:VacLamina]=OFF",
        "WAIT .20(sec)",
        "L PR[11] 1500mm/sec CNT50 Offset,PR[12]",
        "UFRAME_NUM=0",
        "J PR[2:SafeTop] 100% CNT100",
        "DO[R[23]]=ON",
        `GO[${fGO("Step")}:Step]=0`,
        "END",
        "LBL[93]",
        "R[20]=3",
        "END",
        "LBL[94]",
        "RO[4:VacLamina]=OFF",
        "L PR[3:SheetPick] 500mm/sec FINE Offset,PR[12]",
        "R[20]=4",
        "END",
        "LBL[96]",
        "R[20]=6"
      ]),
      "PAL_GRIPTEST.LS": lsHeader("PAL_GRIPTEST", "Test pinza") + lsBody(["CALL PAL_GRIPON", "WAIT 1.00(sec)", "CALL PAL_GRIPOFF"])
    };
  }

  function fanucFrames(ctx) {
    const { lay, cfg } = ctx;
    const row = (n, nm, fr) => `UFRAME[${n}]  ${nm.padEnd(10)} X=${f1(fr.x).padStart(9)}  Y=${f1(fr.y).padStart(9)}  Z=${f1(fr.z).padStart(8)}  W=   0.000  P=   0.000  R=${f3(fr.rz).padStart(9)}`;
    return `${header(ctx, "!")}
! Marcos de usuario nominales. Cargar en MENU > SETUP > Frames > User Frame (Direct Entry)
! y luego recalibrar con "Three Point" en la celda real.
${lay.pallets.map((p) => row(p.id, "PALET" + p.id, p.frame)).join("\n")}
${lay.infeeds.map((f) => row(4 + f.id, "INFEED" + f.id, f.frame)).join("\n")}
UTOOL[1]   PINZA      X=    0.000  Y=    0.000  Z=${f1(cfg.toolTcpZ).padStart(8)}  W=   0.000  P=   0.000  R=    0.000

! Registros de posición a ENSEÑAR:
!  PR[1]  Home (en joint), fuera de toda zona
!  PR[2]  SafeTop: punto de paso sobre la base a altura segura (UF0)
!  PR[10] Referencia de orientación: herramienta hacia abajo, eje X de la herramienta paralelo
!         al largo de la caja. Sólo se usan sus componentes W, P, R (X,Y,Z se sobreescriben).
! RI[1] = vacío OK / pinza cerrada ; RI[2] = producto presente ; RI[3] = vacío OK zona B ; RI[4] = lámina OK
! RO[1] = vacío ON / cerrar pinza   ; RO[2] = soplado / abrir   ; RO[3] = vacío zona B    ; RO[4] = ventosas lámina
! Cajas por toma: ${ctx.pat.nPick} (zona A = mitad +X de la herramienta). R[17] = zonas pedidas por el PLC (1 = A, 3 = A+B).
!  PR[3]  Toma de lámina separadora sobre el magazín (UF0), con la pila llena
! $WAITTMOUT: tiempo máximo de WAIT con TIMEOUT (verificar la unidad en tu versión de software)
! PAYLOAD[1] = pinza vacía (${ctx.checks.gripMass} kg) ; PAYLOAD[2] = pinza + 1 caja (${f1(ctx.checks.gripMass + cfg.boxWeight)} kg) ; PAYLOAD[3] = pinza + 2 cajas (${f1(ctx.checks.gripMass + 2 * cfg.boxWeight)} kg)
!
! Lógica de fondo (MENU > SETUP > BG Logic) — eco invertido del bit de vida:
!   DO[${fDO("Rob_LifeBit")}]=(!DI[${fDI("PLC_LifeBit")}]) ;
!   DO[${fDO("AutoMode")}]=(UO[...] remoto) ; DO[${fDO("SafetyOK")}]=(estado seguridad) — completar
`;
  }

  /* ========================= KUKA ========================= */
  function kukaConfig(ctx) {
    const { cfg, lay } = ctx;
    const o = cfg.kukaIOOffset;
    const L = [];
    L.push(";FOLD USER GLOBALS — pegar en R1\\System\\$config.dat");
    L.push(header(ctx, ";"));
    L.push(";---- Señales PLC -> Robot ----");
    I().PLC_TO_ROBOT.forEach((s) => {
      const n = s.byte * 8 + (s.bit || 0) + o;
      L.push(s.type === "BOOL" ? `SIGNAL i${s.name} $IN[${n}]` : `SIGNAL gi${s.name} $IN[${n}] TO $IN[${n + 15}]`);
    });
    L.push(";---- Señales Robot -> PLC ----");
    I().ROBOT_TO_PLC.forEach((s) => {
      const n = s.byte * 8 + (s.bit || 0) + o;
      L.push(s.type === "BOOL" ? `SIGNAL o${s.name} $OUT[${n}]` : `SIGNAL go${s.name} $OUT[${n}] TO $OUT[${n + 15}]`);
    });
    L.push(";---- Herramienta (E/S locales: ajustar a la tarjeta real) ----");
    L.push(`SIGNAL oGripOn $OUT[${cfg.kukaToolOut}]`);
    L.push(`SIGNAL oGripOff $OUT[${cfg.kukaToolOut + 1}]`);
    L.push(`SIGNAL iGripOK $IN[${cfg.kukaToolIn}]`);
    L.push(`SIGNAL oGripOnB $OUT[${cfg.kukaToolOut + 2}]   ; zona B (toma de 2 cajas)`);
    L.push(`SIGNAL oSheetVac $OUT[${cfg.kukaToolOut + 3}]  ; ventosas de lámina`);
    L.push(`SIGNAL iGripOKB $IN[${cfg.kukaToolIn + 2}]`);
    L.push(`SIGNAL iSheetOK $IN[${cfg.kukaToolIn + 3}]`);
    L.push(`SIGNAL iPartTool $IN[${cfg.kukaToolIn + 1}]`);
    L.push(";ENDFOLD");
    L.push("");
    L.push("; ---- Valores de BASE / TOOL (ingresar por HMI: Puesta en servicio > Medición > Base > Entrada numérica) ----");
    lay.pallets.forEach((p) => L.push(`; BASE_DATA[${p.id}]  PALET${p.id}  = {X ${f1(p.frame.x)}, Y ${f1(p.frame.y)}, Z ${f1(p.frame.z)}, A ${f3(p.frame.rz)}, B 0.0, C 0.0}`));
    lay.infeeds.forEach((f) => L.push(`; BASE_DATA[${4 + f.id}]  INFEED${f.id} = {X ${f1(f.frame.x)}, Y ${f1(f.frame.y)}, Z ${f1(f.frame.z)}, A ${f3(f.frame.rz)}, B 0.0, C 0.0}`));
    L.push(`; TOOL_DATA[1]  PINZA   = {X 0.0, Y 0.0, Z ${f1(cfg.toolTcpZ)}, A 0.0, B 0.0, C 0.0}`);
    L.push(`; LOAD_DATA[1]  pinza vacía      M=${ctx.checks.gripMass} kg, CDG Z=${f1(cfg.toolTcpZ * 0.45)}`);
    L.push(`; TOOL_DATA[2] = TOOL_DATA[1] ; LOAD_DATA[2] pinza+1 caja M=${f1(ctx.checks.gripMass + cfg.boxWeight)} kg ; LOAD_DATA[3] pinza+2 cajas M=${f1(ctx.checks.gripMass + 2 * cfg.boxWeight)} kg`);
    L.push("");
    L.push("; ---- sps.sub, sección USER PLC (bit de vida, eco invertido) ----");
    L.push("; oRob_LifeBit = NOT iPLC_LifeBit");
    L.push("; oAutoMode = $MODE_OP==#EX");
    L.push("; oProgRunning = $PRO_STATE1==#P_ACTIVE");
    L.push("; oMotorsOnState = $PERI_RDY");
    L.push("; Arranque externo (motores, inicio, paro, reset): configurar Automático Externo en");
    L.push("; Configuración > E/S > Automático externo, con $DRIVES_ON, $EXT_START, $CONF_MESS de las señales del PLC.");
    return L.join("\n") + "\n";
  }

  function kukaDat(ctx) {
    return `&ACCESS RVP
&REL 1
DEFDAT PALMAIN PUBLIC
${header(ctx, ";")}
DECL INT nCmdID=0
DECL INT nCmdCode=0
DECL INT nPick=0
DECL INT nPlace=0
DECL INT nLayer=0
DECL INT nBox=0
DECL REAL rX=0.0
DECL REAL rY=0.0
DECL REAL rZ=0.0
DECL REAL rRz=0.0
DECL REAL rAppZ=${f1(ctx.cfg.approachZ)}
DECL REAL rAppXY=${f1(ctx.cfg.approachXY)}
DECL REAL rBoxL=${f1(ctx.cfg.boxL)}
DECL REAL rBoxW=${f1(ctx.cfg.boxW)}
DECL REAL rBoxH=${f1(ctx.cfg.boxH)}
DECL INT nOvr=100
DECL INT nErr=0
DECL INT nZones=1
; Toma de lámina en el magazín (BASE 0): ENSEÑAR con la pila llena
DECL E6POS xSheetPick={X ${f1(ctx.lay.sheet ? ctx.lay.sheet.center.x : 0)},Y ${f1(ctx.lay.sheet ? ctx.lay.sheet.center.y : 0)},Z ${f1(ctx.cfg.outfeedH - ctx.cfg.pedestalH + 300)},A 0.0,B 0.0,C 180.0,S 2,T 2,E1 0.0,E2 0.0,E3 0.0,E4 0.0,E5 0.0,E6 0.0}
DECL INT nBoxesDone=0
DECL REAL rRzOffset=0.0
; Home y punto seguro: ENSEÑAR
DECL E6AXIS xHome={A1 0.0,A2 -90.0,A3 90.0,A4 0.0,A5 0.0,A6 0.0,E1 0.0,E2 0.0,E3 0.0,E4 0.0,E5 0.0,E6 0.0}
DECL E6POS xSafeTop={X ${f1(ctx.robot.reach * 0.35)},Y 0.0,Z ${f1(ctx.cfg.maxStackH + ctx.cfg.outfeedH - ctx.cfg.pedestalH + ctx.cfg.approachZ)},A 0.0,B 0.0,C 180.0,S 2,T 2,E1 0.0,E2 0.0,E3 0.0,E4 0.0,E5 0.0,E6 0.0}
ENDDAT
`;
  }

  function kukaSrc(ctx) {
    const { cfg, lay } = ctx;
    const o = cfg.kukaIOOffset;
    const bitIdx = (arr, n) => { const s = arr.find((x) => x.name === n); return s.byte * 8 + s.bit + o; };
    const dPermPal = bitIdx(I().PLC_TO_ROBOT, "PermitPallet1"), dPermInf = bitIdx(I().PLC_TO_ROBOT, "PermitInfeed1");
    const dOutPal = bitIdx(I().ROBOT_TO_PLC, "OutPallet1"), dOutInf = bitIdx(I().ROBOT_TO_PLC, "OutInfeed1");
    return `&ACCESS RVP
&REL 1
DEF PalMain( )
${header(ctx, ";")}
  INI_PAL()
  LOOP
    oReadyForCmd=TRUE
    WAIT FOR iCmdValid
    oReadyForCmd=FALSE
    ReadCmd()
    oCmdDone=FALSE
    goCmdIDEcho=nCmdID
    oCmdAck=TRUE
    WAIT FOR NOT iCmdValid
    oCmdAck=FALSE
    oCycleOn=TRUE
    goStatus=1
    nErr=0
    $TIMER[5]=0
    $TIMER_STOP[5]=FALSE
    SWITCH nCmdCode
    CASE 1
      PickPlace()
    CASE 2, 4
      GoHome()
    CASE 3
      SlipSheet()
    CASE 5
      GripOn()
      WAIT SEC 1.0
      GripOff()
    DEFAULT
      nErr=1
    ENDSWITCH
    $TIMER_STOP[5]=TRUE
    goCycleTime=$TIMER[5]
    goErrorCode=nErr
    IF nErr==0 THEN
      goStatus=2
      oFaultActive=FALSE
    ELSE
      goStatus=3
      oFaultActive=TRUE
    ENDIF
    oCycleOn=FALSE
    oCmdDone=TRUE
  ENDLOOP
END

DEF INI_PAL()
  BAS(#INITMOV,0)
  BAS(#TOOL,1)
  BAS(#BASE,0)
  $APO.CDIS=50.0
  $APO.CPTP=50
  oCmdAck=FALSE
  oCmdDone=FALSE
  oCycleOn=FALSE
  oHeldState=FALSE
  GripOff()
  PTP xHome
  AllZonesFree()
END

DEF ReadCmd()
  nCmdID=giCmdID
  nCmdCode=giCmdCode
  nPick=giPickStation
  nPlace=giPlaceStation
  nLayer=giLayer
  nBox=giBoxIndex
  rX=giPosX/10.0
  rY=giPosY/10.0
  rZ=giPosZ/10.0
  rRz=giPosRz/10.0
  rAppZ=giApproachZ
  rAppXY=giApproachXY
  rBoxL=giBoxL
  rBoxW=giBoxW
  rBoxH=giBoxH
  nZones=giGripZones
  IF nZones<1 THEN
    nZones=1
  ENDIF
  nOvr=giSpeedOvr
  IF (nOvr<1) OR (nOvr>100) THEN
    nOvr=100
  ENDIF
  IF rAppZ<20.0 THEN
    rAppZ=${f1(cfg.approachZ)}
  ENDIF
  $OV_PRO=nOvr
END

DEF PickPlace()
  DECL E6POS xT, xA
  IF (nPick<1) OR (nPick>${lay.infeeds.length}) THEN
    nErr=2
    RETURN
  ENDIF
  IF (nPlace<1) OR (nPlace>${lay.pallets.length}) THEN
    nErr=3
    RETURN
  ENDIF
  ; ---------- Toma (BASE 5..8) ----------
  goStep=10
  $BASE=BASE_DATA[4+nPick]
  $TOOL=TOOL_DATA[1]
  $LOAD=LOAD_DATA[1]
  xT=MakeTarget(-rBoxL*${ctx.pat.nPick}.0/2.0, rBoxW/2.0, rBoxH, 0.0)
  xA=xT
  xA.Z=xT.Z+rAppZ
  CheckHold()
  IF NOT EnterZone(${dPermInf - 1}+nPick, ${dOutInf - 1}+nPick) THEN
    nErr=6
    RETURN
  ENDIF
  PTP xA C_PTP
  LIN xT
  GripOn()
  WAIT SEC 0.25
  IF NOT (iGripOK AND iPartTool AND ((nZones<3) OR iGripOKB)) THEN
    GripOff()
    LIN xA
    $OUT[${dOutInf - 1}+nPick]=TRUE
    nErr=4
    RETURN
  ENDIF
  $TOOL=TOOL_DATA[2]
  IF nZones>=3 THEN
    $LOAD=LOAD_DATA[3]
  ELSE
    $LOAD=LOAD_DATA[2]
  ENDIF
  oGripClosed=TRUE
  oPartPresent=TRUE
  LIN xA C_DIS
  $OUT[${dOutInf - 1}+nPick]=TRUE
  ; ---------- Colocación (BASE 1..4) ----------
  goStep=20
  $BASE=BASE_DATA[nPlace]
  xT=MakeTarget(rX, rY, rZ, rRz)
  xA=xT
  xA.X=xT.X-rAppXY
  xA.Y=xT.Y-rAppXY
  xA.Z=xT.Z+rAppZ
  CheckHold()
  IF NOT EnterZone(${dPermPal - 1}+nPlace, ${dOutPal - 1}+nPlace) THEN
    nErr=6
    RETURN
  ENDIF
  PTP xA C_PTP
  IF NOT iPartTool THEN
    nErr=5
    RETURN
  ENDIF
  xA.Z=xT.Z+20.0
  LIN xA C_DIS
  LIN xT
  GripOff()
  WAIT SEC 0.25
  $TOOL=TOOL_DATA[1]
  $LOAD=LOAD_DATA[1]
  xA=xT
  xA.Z=xT.Z+rAppZ
  LIN xA C_DIS
  $BASE=$NULLFRAME
  PTP xSafeTop C_PTP
  $OUT[${dOutPal - 1}+nPlace]=TRUE
  nBoxesDone=nBoxesDone+1
  goBoxesDone=nBoxesDone
  goStep=0
END

DEFFCT E6POS MakeTarget(x:IN, y:IN, z:IN, rz:IN)
  DECL REAL x, y, z, rz
  DECL E6POS p
  p=$POS_ACT
  p.X=x
  p.Y=y
  p.Z=z
  p.A=rz+rRzOffset
  p.B=0.0
  p.C=180.0
  RETURN p
ENDFCT

DEFFCT BOOL EnterZone(nPerm:IN, nOut:IN)
  DECL INT nPerm, nOut
  $TIMER[6]=0
  $TIMER_STOP[6]=FALSE
  WHILE NOT $IN[nPerm]
    IF $TIMER[6]>30000 THEN
      $TIMER_STOP[6]=TRUE
      RETURN FALSE
    ENDIF
    WAIT SEC 0.05
  ENDWHILE
  $TIMER_STOP[6]=TRUE
  $OUT[nOut]=FALSE
  oAtHome=FALSE
  RETURN TRUE
ENDFCT

DEF GoHome()
  $BASE=$NULLFRAME
  PTP xSafeTop C_PTP
  PTP xHome
  AllZonesFree()
END

DEF AllZonesFree()
${lay.pallets.map((p) => `  $OUT[${dOutPal - 1 + p.id}]=TRUE`).join("\n")}
${lay.infeeds.map((f) => `  $OUT[${dOutInf - 1 + f.id}]=TRUE`).join("\n")}
  oAtHome=TRUE
END

DEF CheckHold()
  IF iHold THEN
    oHeldState=TRUE
    WAIT FOR NOT iHold
    oHeldState=FALSE
  ENDIF
END

DEF GripOn()
  oGripOff=FALSE
  oGripOn=TRUE
  IF nZones>=3 THEN
    oGripOnB=TRUE
  ENDIF
  oGripOpen=FALSE
END

DEF SlipSheet()
  DECL E6POS xT, xA
  IF (nPlace<1) OR (nPlace>${lay.pallets.length}) THEN
    nErr=3
    RETURN
  ENDIF
  goStep=30
  CheckHold()
  $BASE=$NULLFRAME
  xA=xSheetPick
  xA.Z=xSheetPick.Z+rAppZ
  PTP xA C_PTP
  LIN xSheetPick
  oSheetVac=TRUE
  WAIT SEC 0.3
  IF NOT iSheetOK THEN
    oSheetVac=FALSE
    LIN xA
    nErr=4
    RETURN
  ENDIF
  LIN xA C_DIS
  $BASE=BASE_DATA[nPlace]
  xT=MakeTarget(rX, rY, rZ, rRz)
  xA=xT
  xA.Z=xT.Z+rAppZ
  IF NOT EnterZone(${dPermPal - 1}+nPlace, ${dOutPal - 1}+nPlace) THEN
    nErr=6
    RETURN
  ENDIF
  PTP xA C_PTP
  xT.Z=xT.Z+10.0
  LIN xT
  oSheetVac=FALSE
  WAIT SEC 0.2
  LIN xA C_DIS
  $BASE=$NULLFRAME
  PTP xSafeTop C_PTP
  $OUT[${dOutPal - 1}+nPlace]=TRUE
  goStep=0
END

DEF GripOff()
  oGripOn=FALSE
  oGripOnB=FALSE
  PULSE(oGripOff, TRUE, 0.2)
  oGripClosed=FALSE
  oGripOpen=TRUE
  oPartPresent=FALSE
END
`;
  }

  function files(ctx) {
    const b = ctx.cfg.robotBrand;
    if (b === "ABB") return { "robot/ABB/PalletPLC.mod": abbMod(ctx), "robot/ABB/EIO_PLC.cfg": abbEio(ctx) };
    if (b === "FANUC") {
      const out = { "robot/FANUC/PAL_MAIN.LS": fanucMain(ctx), "robot/FANUC/PAL_PICKPLACE.LS": fanucPickPlace(ctx), "robot/FANUC/FRAMES_Y_SETUP.txt": fanucFrames(ctx) };
      const s = fanucSmall(ctx);
      Object.keys(s).forEach((k) => (out["robot/FANUC/" + k] = s[k]));
      return out;
    }
    return { "robot/KUKA/PalMain.src": kukaSrc(ctx), "robot/KUKA/PalMain.dat": kukaDat(ctx), "robot/KUKA/config_dat_y_sps.txt": kukaConfig(ctx) };
  }

  return { files };
})();
