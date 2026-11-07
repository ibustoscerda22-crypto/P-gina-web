/* Generador de lógica PLC (maestro) con modelo de estados PackML (ISA-TR88.00.02).
   Siemens: fuentes externas SCL para TIA Portal (Fuentes externas > Generar bloques).
   Allen-Bradley: rutinas Structured Text + UDTs + CSV de tags/alias para Studio 5000. */
window.PAL = window.PAL || {};

PAL.genPLC = (function () {
  const I = () => PAL.iface;
  const stamp = () => new Date().toISOString().slice(0, 16).replace("T", " ");

  /* E/S físicas comunes */
  function ioList(ctx) {
    const { cfg, lay } = ctx;
    const di = [
      ["EStopOK", "Paro de emergencia OK (desde programa de seguridad / relé)"],
      ["SafetyOK", "Cerco y puertas cerrados, seguridad OK"],
      ["PB_Reset", "Pulsador Reset (fuera del cerco, con vista a la celda)"],
      ["PB_Start", "Pulsador Start"],
      ["PB_Stop", "Pulsador Stop"]
    ];
    lay.infeeds.forEach((f) => di.push([`InfeedAtPick${f.id}`, `Infeed ${f.id}: producto en tope de toma (fotocélula)`]));
    lay.pallets.forEach((p) => di.push([`PalletPresent${p.id}`, `Estación ${p.id}: palet presente y centrado`]));
    lay.pallets.forEach((p) => di.push([`ZoneSafe${p.id}`, `Estación ${p.id}: zona libre de personas (cortina/escáner OK o muting)`]));
    if (cfg.palletExit === "conveyor") lay.pallets.forEach((p) => di.push([`OutfeedFree${p.id}`, `Salida ${p.id}: transportador aguas abajo libre`]));
    const dq = [];
    lay.infeeds.forEach((f) => dq.push([`InfeedRun${f.id}`, `Marcha transportador infeed ${f.id}`]));
    lay.pallets.forEach((p) => dq.push([`OutfeedRun${p.id}`, `Marcha transportador/estación palet ${p.id}`]));
    lay.pallets.forEach((p) => dq.push([`LampPalletDone${p.id}`, `Baliza palet ${p.id} completo (retirar)`]));
    dq.push(["LightGreen", "Torre de luz verde (Execute)"], ["LightAmber", "Torre de luz ámbar (Suspended/Held/Idle)"],
      ["LightRed", "Torre de luz roja (Aborted / falla)"], ["Buzzer", "Bocina"], ["LampReset", "Lámpara del pulsador Reset"]);
    const addr = (i) => `${Math.floor(i / 8)}.${i % 8}`;
    return { di: di.map((d, i) => ({ name: d[0], desc: d[1], s7: "%I" + addr(i), ab: `Local:1:I.Pt${String(i).padStart(2, "0")}.Data` })),
             dq: dq.map((d, i) => ({ name: d[0], desc: d[1], s7: "%Q" + addr(i), ab: `Local:2:O.Pt${String(i).padStart(2, "0")}.Data` })) };
  }

  /* ===================== SIEMENS ===================== */
  function s7UdtIO(name, list) {
    const L = [`TYPE "${name}"`, "VERSION : 0.1", "   STRUCT"];
    for (let b = 0; b < 4; b++)
      for (let bit = 0; bit < 8; bit++) {
        const s = list.find((x) => x.type === "BOOL" && x.byte === b && x.bit === bit);
        L.push(s ? `      ${s.name} : Bool;   // B${b}.${bit} ${s.desc}` : `      Spare_${b}_${bit} : Bool;`);
      }
    const words = list.filter((x) => x.type === "UINT");
    words.forEach((w) => L.push(`      ${w.name} : Word;   // B${w.byte} ${w.desc}${w.unit ? " [" + w.unit + "]" : ""}`));
    const used = words.length ? words[words.length - 1].byte + 2 : 4;
    L.push(`      Spare : Array[${used}..63] of Byte;`);
    L.push("   END_STRUCT;", "", "END_TYPE", "");
    return L.join("\n");
  }

  function s7Types(ctx) {
    return `// ${ctx.cfg.projectName} - Tipos de datos. Generado ${stamp()}
${s7UdtIO("typeRobotOut", I().PLC_TO_ROBOT)}
${s7UdtIO("typeRobotIn", I().ROBOT_TO_PLC)}
TYPE "typeBoxPos"
VERSION : 0.1
   STRUCT
      X : Int;    // 0.1 mm en frame del palet
      Y : Int;    // 0.1 mm
      Rz : Int;   // 0.1 grados
   END_STRUCT;

END_TYPE

TYPE "typePackTags"
VERSION : 0.1
   STRUCT
      Command : Struct
         UnitMode : Int;
         UnitModeChangeRequest : Bool;
         CntrlCmd : Int;          // 1 Reset 2 Start 3 Stop 4 Hold 5 Unhold 6 Suspend 7 Unsuspend 8 Abort 9 Clear
         CmdChangeRequest : Bool;
         MachSpeed : Real;        // cajas/min objetivo
      END_STRUCT;
      Status : Struct
         UnitModeCurrent : Int;   // 1 Production 2 Maintenance 3 Manual
         StateCurrent : Int;      // 0..17 según PackML
         MachSpeed : Real;
         CurMachSpeed : Real;
      END_STRUCT;
      Admin : Struct
         ProdProcessedCount : DInt;
         ProdDefectiveCount : DInt;
         PalletCount : DInt;
         StopReason : Int;
         Warning : Int;
         AccTimeSinceReset : DInt;   // s
         StateCurrentTime : DInt;    // s
      END_STRUCT;
   END_STRUCT;

END_TYPE

TYPE "typeHMI"
VERSION : 0.1
   STRUCT
      Cmd : Struct
         Reset : Bool;
         Start : Bool;
         Stop : Bool;
         Hold : Bool;
         Unhold : Bool;
         Suspend : Bool;
         Unsuspend : Bool;
         Abort : Bool;
         Clear : Bool;
         ModeReq : Int;
         AckAlarms : Bool;
         RobotHome : Bool;
         RobotGripTest : Bool;
         RobotMaintPos : Bool;
         ForcePalletDone : Array[1..4] of Bool;
         ResetCounters : Bool;
      END_STRUCT;
      Sts : Struct
         State : Int;
         Mode : Int;
         ActivePallet : Int;
         Layer : Array[1..4] of Int;
         BoxInLayer : Array[1..4] of Int;
         PalletComplete : Array[1..4] of Bool;
         PalletReady : Array[1..4] of Bool;
         InfeedReady : Array[1..4] of Bool;
         RobotCommOK : Bool;
         RobotBusy : Bool;
         RobotAtHome : Bool;
         RobotStep : Int;
         RobotError : Int;
         CycleTime : Int;
         BoxesPerMin : Real;
         AlarmWord : Array[0..1] of Word;
      END_STRUCT;
      Recipe : Struct
         ProductID : Int;
         BoxL : Int;          // mm
         BoxW : Int;
         BoxH : Int;
         BoxWeight : Int;     // 0.1 kg
         PerLayer : Int;
         Layers : Int;
         SpeedOvr : Int;      // %
         ApproachZ : Int;     // mm
         ApproachXY : Int;    // mm
         SlipSheet : Bool;
         TargetPallets : Int; // 0 = sin límite
      END_STRUCT;
      PackTags : "typePackTags";
   END_STRUCT;

END_TYPE
`;
  }

  function s7Functions(ctx) {
    return `// ${ctx.cfg.projectName} - Bloques. Generado ${stamp()}
// Orden de compilación: 01_Types.udt -> 02_Blocks.scl -> 03_DataBlocks.db -> 04_Main.scl

FUNCTION "FC_ToRobWord" : Word
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
   VAR_INPUT
      Value : Int;
      Swap : Bool;
   END_VAR
BEGIN
	// El robot espera little-endian; S7 es big-endian -> intercambio de bytes
	IF #Swap THEN
	    #FC_ToRobWord := SWAP(INT_TO_WORD(#Value));
	ELSE
	    #FC_ToRobWord := INT_TO_WORD(#Value);
	END_IF;
END_FUNCTION

FUNCTION "FC_FromRobWord" : Int
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
   VAR_INPUT
      Value : Word;
      Swap : Bool;
   END_VAR
BEGIN
	IF #Swap THEN
	    #FC_FromRobWord := WORD_TO_INT(SWAP(#Value));
	ELSE
	    #FC_FromRobWord := WORD_TO_INT(#Value);
	END_IF;
END_FUNCTION

FUNCTION_BLOCK "FB_PackML"
TITLE = 'Máquina de estados PackML (ISA-TR88.00.02)'
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
   VAR_INPUT
      CmdReset : Bool;
      CmdStart : Bool;
      CmdStop : Bool;
      CmdHold : Bool;
      CmdUnhold : Bool;
      CmdSuspend : Bool;
      CmdUnsuspend : Bool;
      CmdAbort : Bool;
      CmdClear : Bool;
      ModeReq : Int := 1;
      AbortCond : Bool;      // Emergencia, pérdida de comunicación
      HoldCond : Bool;       // Falla interna que requiere al operador
      SuspendCond : Bool;    // Falta producto / falta palet (externo)
      SC : Bool;             // State Complete del estado activo (lógica de máquina)
   END_VAR
   VAR_OUTPUT
      State : Int;
      Mode : Int;
      StateChanged : Bool;
      TimeInState : DInt;    // s
   END_VAR
   VAR
      rReset {InstructionName := 'R_TRIG'; LibVersion := '1.0'} : R_TRIG;
      rStart {InstructionName := 'R_TRIG'; LibVersion := '1.0'} : R_TRIG;
      rStop {InstructionName := 'R_TRIG'; LibVersion := '1.0'} : R_TRIG;
      rHold {InstructionName := 'R_TRIG'; LibVersion := '1.0'} : R_TRIG;
      rUnhold {InstructionName := 'R_TRIG'; LibVersion := '1.0'} : R_TRIG;
      rSuspend {InstructionName := 'R_TRIG'; LibVersion := '1.0'} : R_TRIG;
      rUnsuspend {InstructionName := 'R_TRIG'; LibVersion := '1.0'} : R_TRIG;
      rAbort {InstructionName := 'R_TRIG'; LibVersion := '1.0'} : R_TRIG;
      rClear {InstructionName := 'R_TRIG'; LibVersion := '1.0'} : R_TRIG;
      tSec {InstructionName := 'TON_TIME'; LibVersion := '1.0'} : TON_TIME;
      prevState : Int;
      justChanged : Bool;
      initDone : Bool;
      sc : Bool;
   END_VAR
BEGIN
	IF NOT #initDone THEN
	    #State := 2;   // Stopped tras arranque en frío
	    #Mode := 1;
	    #initDone := TRUE;
	END_IF;

	#rReset(CLK := #CmdReset);
	#rStart(CLK := #CmdStart);
	#rStop(CLK := #CmdStop);
	#rHold(CLK := #CmdHold);
	#rUnhold(CLK := #CmdUnhold);
	#rSuspend(CLK := #CmdSuspend);
	#rUnsuspend(CLK := #CmdUnsuspend);
	#rAbort(CLK := #CmdAbort);
	#rClear(CLK := #CmdClear);

	// SC no se acepta en el primer ciclo de un estado nuevo
	#sc := #SC AND NOT #justChanged;

	IF (#AbortCond OR #rAbort.Q) AND #State <> 8 AND #State <> 9 THEN
	    #State := 8;  // Aborting
	ELSE
	    CASE #State OF
	        1:  // Clearing
	            IF #sc THEN #State := 2; END_IF;
	        2:  // Stopped
	            IF #rReset.Q THEN #State := 15; END_IF;
	        3:  // Starting
	            IF #rStop.Q THEN #State := 7;
	            ELSIF #sc THEN #State := 6;
	            END_IF;
	        4:  // Idle
	            IF #rStop.Q THEN #State := 7;
	            ELSIF #rStart.Q THEN #State := 3;
	            END_IF;
	        5:  // Suspended
	            IF #rStop.Q THEN #State := 7;
	            ELSIF #HoldCond OR #rHold.Q THEN #State := 10;
	            ELSIF #rUnsuspend.Q OR NOT #SuspendCond THEN #State := 14;
	            END_IF;
	        6:  // Execute
	            IF #rStop.Q THEN #State := 7;
	            ELSIF #HoldCond OR #rHold.Q THEN #State := 10;
	            ELSIF #SuspendCond OR #rSuspend.Q THEN #State := 13;
	            ELSIF #sc THEN #State := 16;
	            END_IF;
	        7:  // Stopping
	            IF #sc THEN #State := 2; END_IF;
	        8:  // Aborting
	            IF #sc THEN #State := 9; END_IF;
	        9:  // Aborted
	            IF #rClear.Q THEN #State := 1; END_IF;
	        10: // Holding
	            IF #rStop.Q THEN #State := 7;
	            ELSIF #sc THEN #State := 11;
	            END_IF;
	        11: // Held
	            IF #rStop.Q THEN #State := 7;
	            ELSIF #rUnhold.Q AND NOT #HoldCond THEN #State := 12;
	            END_IF;
	        12: // Unholding
	            IF #rStop.Q THEN #State := 7;
	            ELSIF #HoldCond OR #rHold.Q THEN #State := 10;
	            ELSIF #sc THEN #State := 6;
	            END_IF;
	        13: // Suspending
	            IF #rStop.Q THEN #State := 7;
	            ELSIF #HoldCond OR #rHold.Q THEN #State := 10;
	            ELSIF #sc THEN #State := 5;
	            END_IF;
	        14: // Unsuspending
	            IF #rStop.Q THEN #State := 7;
	            ELSIF #HoldCond OR #rHold.Q THEN #State := 10;
	            ELSIF #sc THEN #State := 6;
	            END_IF;
	        15: // Resetting
	            IF #rStop.Q THEN #State := 7;
	            ELSIF #sc THEN #State := 4;
	            END_IF;
	        16: // Completing
	            IF #rStop.Q THEN #State := 7;
	            ELSIF #sc THEN #State := 17;
	            END_IF;
	        17: // Complete
	            IF #rStop.Q THEN #State := 7;
	            ELSIF #rReset.Q THEN #State := 15;
	            END_IF;
	        ELSE
	            #State := 8;
	    END_CASE;
	END_IF;

	// Cambio de modo sólo en Stopped o Aborted
	IF #ModeReq <> #Mode AND #ModeReq >= 1 AND #ModeReq <= 3 AND (#State = 2 OR #State = 9) THEN
	    #Mode := #ModeReq;
	END_IF;

	#StateChanged := #State <> #prevState;
	#justChanged := #StateChanged;
	IF #StateChanged THEN
	    #TimeInState := 0;
	END_IF;
	#tSec(IN := NOT #tSec.Q, PT := T#1S);
	IF #tSec.Q THEN
	    #TimeInState := #TimeInState + 1;
	END_IF;
	#prevState := #State;
END_FUNCTION_BLOCK

FUNCTION_BLOCK "FB_RobotIF"
TITLE = 'Interfaz PLC maestro -> robot esclavo (handshake CmdValid/Ack/Done)'
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
   VAR_INPUT
      RobIn : "typeRobotIn";
      MotorsOn : Bool;
      ProgStart : Bool;
      ProgStop : Bool;
      ResetFault : Bool;
      Hold : Bool;
      GoHome : Bool;
      PermitPallet : Array[1..4] of Bool;
      PermitInfeed : Array[1..4] of Bool;
      InfeedReady : Array[1..4] of Bool;
      PalletReady : Array[1..4] of Bool;
      SlipSheetReady : Bool;
      DryRun : Bool;
      MaintMode : Bool;
      ManualMode : Bool;
      Execute : Bool;          // flanco de subida = enviar comando
      CmdCode : Int;
      PickStation : Int;
      PlaceStation : Int;
      Layer : Int;
      BoxIndex : Int;
      PosX : Int;
      PosY : Int;
      PosZ : Int;
      PosRz : Int;
      ApproachZ : Int;
      ApproachXY : Int;
      SpeedOvr : Int;
      ProductID : Int;
      BoxL : Int;
      BoxW : Int;
      BoxH : Int;
      BoxWeight : Int;
      GripZones : Int;
      SwapBytes : Bool := TRUE;
      AckTimeoutT : Time := T#3S;
      CmdTimeoutT : Time := T#60S;
   END_VAR
   VAR_OUTPUT
      RobOut : "typeRobotOut";
      Busy : Bool;
      Done : Bool;
      Error : Bool;
      ErrorCode : Int;           // 100 = timeout Ack, 101 = timeout comando, otros = robot
      CommOK : Bool;
      OutPallet : Array[1..4] of Bool;
      OutInfeed : Array[1..4] of Bool;
      MotorsOnState : Bool;
      ProgRunning : Bool;
      AutoMode : Bool;
      RobFault : Bool;
      AtHome : Bool;
      HeldState : Bool;
      ReadyForCmd : Bool;
      PartPresent : Bool;
      SafetyOK : Bool;
      Step : Int;
      CycleTimeMs : Int;
      BoxesDone : Int;
   END_VAR
   VAR
      rExec {InstructionName := 'R_TRIG'; LibVersion := '1.0'} : R_TRIG;
      tLife {InstructionName := 'TON_TIME'; LibVersion := '1.0'} : TON_TIME;
      tLifeChk {InstructionName := 'TON_TIME'; LibVersion := '1.0'} : TON_TIME;
      tAck {InstructionName := 'TON_TIME'; LibVersion := '1.0'} : TON_TIME;
      tCmd {InstructionName := 'TON_TIME'; LibVersion := '1.0'} : TON_TIME;
      lifeBit : Bool;
      hs : Int;      // 0 libre, 10 esperando Ack, 20 esperando Done
      cmdId : Int;
      echo : Int;
      i : Int;
   END_VAR
BEGIN
	// ---- Bit de vida: PLC conmuta cada 500 ms, el robot devuelve el valor invertido
	#tLife(IN := NOT #tLife.Q, PT := T#500MS);
	IF #tLife.Q THEN
	    #lifeBit := NOT #lifeBit;
	END_IF;
	#tLifeChk(IN := (#RobIn.Rob_LifeBit = #lifeBit), PT := T#2S);
	#CommOK := NOT #tLifeChk.Q;

	// ---- Estado del robot
	#MotorsOnState := #RobIn.MotorsOnState;
	#ProgRunning := #RobIn.ProgRunning;
	#AutoMode := #RobIn.AutoMode;
	#RobFault := #RobIn.FaultActive;
	#AtHome := #RobIn.AtHome;
	#HeldState := #RobIn.HeldState;
	#ReadyForCmd := #RobIn.ReadyForCmd;
	#PartPresent := #RobIn.PartPresent;
	#SafetyOK := #RobIn.SafetyOK;
	#OutPallet[1] := #RobIn.OutPallet1;
	#OutPallet[2] := #RobIn.OutPallet2;
	#OutPallet[3] := #RobIn.OutPallet3;
	#OutPallet[4] := #RobIn.OutPallet4;
	#OutInfeed[1] := #RobIn.OutInfeed1;
	#OutInfeed[2] := #RobIn.OutInfeed2;
	#OutInfeed[3] := #RobIn.OutInfeed3;
	#OutInfeed[4] := #RobIn.OutInfeed4;
	#echo := "FC_FromRobWord"(Value := #RobIn.CmdIDEcho, Swap := #SwapBytes);
	#Step := "FC_FromRobWord"(Value := #RobIn.Step, Swap := #SwapBytes);
	#CycleTimeMs := "FC_FromRobWord"(Value := #RobIn.CycleTime, Swap := #SwapBytes);
	#BoxesDone := "FC_FromRobWord"(Value := #RobIn.BoxesDone, Swap := #SwapBytes);

	// ---- Handshake de comando
	#rExec(CLK := #Execute);
	CASE #hs OF
	    0:
	        IF #rExec.Q AND #CommOK THEN
	            #cmdId := #cmdId + 1;
	            IF #cmdId > 32000 OR #cmdId < 1 THEN #cmdId := 1; END_IF;
	            #RobOut.CmdID := "FC_ToRobWord"(Value := #cmdId, Swap := #SwapBytes);
	            #RobOut.CmdCode := "FC_ToRobWord"(Value := #CmdCode, Swap := #SwapBytes);
	            #RobOut.PickStation := "FC_ToRobWord"(Value := #PickStation, Swap := #SwapBytes);
	            #RobOut.PlaceStation := "FC_ToRobWord"(Value := #PlaceStation, Swap := #SwapBytes);
	            #RobOut.Layer := "FC_ToRobWord"(Value := #Layer, Swap := #SwapBytes);
	            #RobOut.BoxIndex := "FC_ToRobWord"(Value := #BoxIndex, Swap := #SwapBytes);
	            #RobOut.PosX := "FC_ToRobWord"(Value := #PosX, Swap := #SwapBytes);
	            #RobOut.PosY := "FC_ToRobWord"(Value := #PosY, Swap := #SwapBytes);
	            #RobOut.PosZ := "FC_ToRobWord"(Value := #PosZ, Swap := #SwapBytes);
	            #RobOut.PosRz := "FC_ToRobWord"(Value := #PosRz, Swap := #SwapBytes);
	            #RobOut.ApproachZ := "FC_ToRobWord"(Value := #ApproachZ, Swap := #SwapBytes);
	            #RobOut.ApproachXY := "FC_ToRobWord"(Value := #ApproachXY, Swap := #SwapBytes);
	            #RobOut.SpeedOvr := "FC_ToRobWord"(Value := #SpeedOvr, Swap := #SwapBytes);
	            #RobOut.ProductID := "FC_ToRobWord"(Value := #ProductID, Swap := #SwapBytes);
	            #RobOut.BoxL := "FC_ToRobWord"(Value := #BoxL, Swap := #SwapBytes);
	            #RobOut.BoxW := "FC_ToRobWord"(Value := #BoxW, Swap := #SwapBytes);
	            #RobOut.BoxH := "FC_ToRobWord"(Value := #BoxH, Swap := #SwapBytes);
	            #RobOut.BoxWeight := "FC_ToRobWord"(Value := #BoxWeight, Swap := #SwapBytes);
	            #RobOut.GripZones := "FC_ToRobWord"(Value := #GripZones, Swap := #SwapBytes);
	            #RobOut.CmdValid := TRUE;
	            #Busy := TRUE;
	            #Done := FALSE;
	            #Error := FALSE;
	            #ErrorCode := 0;
	            #hs := 10;
	        END_IF;
	    10: // Esperar Ack con eco del ID
	        IF #RobIn.CmdAck AND #echo = #cmdId THEN
	            #RobOut.CmdValid := FALSE;
	            #hs := 20;
	        ELSIF #tAck.Q THEN
	            #RobOut.CmdValid := FALSE;
	            #Error := TRUE;
	            #ErrorCode := 100;
	            #Busy := FALSE;
	            #hs := 0;
	        END_IF;
	    20: // Esperar Done
	        IF #RobIn.CmdDone AND NOT #RobIn.CmdAck AND #echo = #cmdId THEN
	            #ErrorCode := "FC_FromRobWord"(Value := #RobIn.ErrorCode, Swap := #SwapBytes);
	            #Error := #ErrorCode <> 0;
	            #Done := NOT #Error;
	            #Busy := FALSE;
	            #hs := 0;
	        ELSIF #tCmd.Q OR NOT #CommOK THEN
	            #Error := TRUE;
	            #ErrorCode := 101;
	            #Busy := FALSE;
	            #hs := 0;
	        END_IF;
	END_CASE;
	#tAck(IN := #hs = 10, PT := #AckTimeoutT);
	#tCmd(IN := #hs = 20, PT := #CmdTimeoutT);

	// ---- Bits de control y permisos
	#RobOut.PLC_LifeBit := #lifeBit;
	#RobOut.MotorsOn := #MotorsOn;
	#RobOut.ProgStart := #ProgStart;
	#RobOut.ProgStop := #ProgStop;
	#RobOut.ResetFault := #ResetFault;
	#RobOut.Hold := #Hold;
	#RobOut.GoHome := #GoHome;
	#RobOut.PermitPallet1 := #PermitPallet[1];
	#RobOut.PermitPallet2 := #PermitPallet[2];
	#RobOut.PermitPallet3 := #PermitPallet[3];
	#RobOut.PermitPallet4 := #PermitPallet[4];
	#RobOut.PermitInfeed1 := #PermitInfeed[1];
	#RobOut.PermitInfeed2 := #PermitInfeed[2];
	#RobOut.PermitInfeed3 := #PermitInfeed[3];
	#RobOut.PermitInfeed4 := #PermitInfeed[4];
	#RobOut.InfeedReady1 := #InfeedReady[1];
	#RobOut.InfeedReady2 := #InfeedReady[2];
	#RobOut.InfeedReady3 := #InfeedReady[3];
	#RobOut.InfeedReady4 := #InfeedReady[4];
	#RobOut.PalletReady1 := #PalletReady[1];
	#RobOut.PalletReady2 := #PalletReady[2];
	#RobOut.PalletReady3 := #PalletReady[3];
	#RobOut.PalletReady4 := #PalletReady[4];
	#RobOut.SlipSheetReady := #SlipSheetReady;
	#RobOut.DryRun := #DryRun;
	#RobOut.MaintMode := #MaintMode;
	#RobOut.ManualMode := #ManualMode;
END_FUNCTION_BLOCK

FUNCTION_BLOCK "FB_Cell"
TITLE = 'Celda paletizadora: PackML + secuenciador + estaciones'
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
   VAR_INPUT
      EStopOK : Bool;
      SafetyOK : Bool;
      PB_Reset : Bool;
      PB_Start : Bool;
      PB_Stop : Bool;
      InfeedAtPick : Array[1..4] of Bool;
      PalletPresent : Array[1..4] of Bool;
      ZoneSafe : Array[1..4] of Bool;
      OutfeedFree : Array[1..4] of Bool;
      RobIn : "typeRobotIn";
   END_VAR
   VAR_OUTPUT
      RobOut : "typeRobotOut";
      InfeedRun : Array[1..4] of Bool;
      OutfeedRun : Array[1..4] of Bool;
      LampPalletDone : Array[1..4] of Bool;
      LightGreen : Bool;
      LightAmber : Bool;
      LightRed : Bool;
      Buzzer : Bool;
      LampReset : Bool;
   END_VAR
   VAR_IN_OUT
      HMI : "typeHMI";
   END_VAR
   VAR
      PML : "FB_PackML";
      ROB : "FB_RobotIF";
      tStarve {InstructionName := 'TON_TIME'; LibVersion := '1.0'} : TON_TIME;
      tAct {InstructionName := 'TON_TIME'; LibVersion := '1.0'} : TON_TIME;
      tBlink {InstructionName := 'TON_TIME'; LibVersion := '1.0'} : TON_TIME;
      blink : Bool;
      seq : Int;
      exec : Bool;
      sc : Bool;
      holdLatch : Bool;
      workAvail : Bool;
      activeP : Int := 1;
      lastInfeed : Int;
      pickSel : Int;
      placeSel : Int;
      layer : Array[1..4] of Int := [4(1)];
      box : Array[1..4] of Int := [4(1)];
      complete : Array[1..4] of Bool;
      palletReady : Array[1..4] of Bool;
      infeedReady : Array[1..4] of Bool;
      wasPresent : Array[1..4] of Bool;
      i : Int;
      k : Int;
      cmdCode : Int;
      posX : Int;
      posY : Int;
      posRz : Int;
      posZ : Int;
      totalPallets : Int;
      manualReq : Int;
   END_VAR
   VAR CONSTANT
      N_INFEED : Int := ${ctx.lay.infeeds.length};
      N_PALLET : Int := ${ctx.lay.pallets.length};
   END_VAR
BEGIN
	REGION Estaciones de palet
	    FOR #i := 1 TO #N_PALLET DO
	        // Palet nuevo: al retirar el palet completo se reinician los contadores
	        IF #wasPresent[#i] AND NOT #PalletPresent[#i] THEN
	            #complete[#i] := FALSE;
	            #layer[#i] := 1;
	            #box[#i] := 1;
	        END_IF;
	        #wasPresent[#i] := #PalletPresent[#i];
	        IF #HMI.Cmd.ForcePalletDone[#i] THEN
	            #complete[#i] := TRUE;
	            #HMI.Cmd.ForcePalletDone[#i] := FALSE;
	        END_IF;
	        #palletReady[#i] := #PalletPresent[#i] AND NOT #complete[#i] AND #ZoneSafe[#i];
	        #LampPalletDone[#i] := #complete[#i] AND #PalletPresent[#i];
	        // Salida: con transportador, evacuar cuando está completo, el robot fuera y aguas abajo libre
	        #OutfeedRun[#i] := ${ctx.cfg.palletExit === "conveyor" ? "#complete[#i] AND #ROB.OutPallet[#i] AND #OutfeedFree[#i] AND #PML.State <> 9 AND #PML.State <> 8" : "FALSE  // retiro manual con grúa horquilla"};
	    END_FOR;
	END_REGION

	REGION Infeeds
	    FOR #i := 1 TO #N_INFEED DO
	        #infeedReady[#i] := #InfeedAtPick[#i];
	        // Avanza mientras no haya producto en el tope y el robot esté fuera de la zona
	        #InfeedRun[#i] := NOT #InfeedAtPick[#i] AND #ROB.OutInfeed[#i]
	            AND (#PML.State = 6 OR #PML.State = 3 OR #PML.State = 13 OR #PML.State = 5 OR #PML.State = 14);
	    END_FOR;
	END_REGION

	REGION Disponibilidad de trabajo
	    #workAvail := FALSE;
	    FOR #i := 1 TO #N_PALLET DO
	        FOR #k := 1 TO #N_INFEED DO
	            IF #palletReady[#i] AND #infeedReady[#k] THEN
	                #workAvail := TRUE;
	            END_IF;
	        END_FOR;
	    END_FOR;
	    #tStarve(IN := #PML.State = 6 AND NOT #workAvail AND NOT #ROB.Busy, PT := T#5S);
	END_REGION

	REGION Fallas que llevan a Held (requieren operador)
	    IF #ROB.Error OR (#ROB.RobFault AND #PML.State = 6) OR NOT #SafetyOK THEN
	        #holdLatch := TRUE;
	    END_IF;
	    IF #HMI.Cmd.AckAlarms AND NOT #ROB.RobFault AND #SafetyOK THEN
	        #holdLatch := FALSE;
	        #HMI.Cmd.AckAlarms := FALSE;
	    END_IF;
	END_REGION

	REGION State Complete (SC) por estado
	    #tAct(IN := NOT #PML.StateChanged, PT := T#1S);
	    CASE #PML.State OF
	        1:  #sc := #EStopOK AND #SafetyOK AND #tAct.Q;                                       // Clearing
	        3:  #sc := #tAct.Q AND #ROB.ReadyForCmd;                                             // Starting
	        6:  #sc := #HMI.Recipe.TargetPallets > 0 AND #totalPallets >= #HMI.Recipe.TargetPallets AND NOT #ROB.Busy; // Execute -> Completing
	        7, 13, 16: #sc := NOT #ROB.Busy;                                                     // Stopping / Suspending / Completing
	        8:  #sc := #tAct.Q;                                                                  // Aborting
	        10: #sc := NOT #ROB.Busy OR #ROB.HeldState;                                          // Holding
	        12: #sc := NOT #ROB.HeldState AND #tAct.Q;                                           // Unholding
	        14: #sc := #tAct.Q;                                                                  // Unsuspending
	        15: #sc := #ROB.CommOK AND #ROB.MotorsOnState AND #ROB.ProgRunning AND #ROB.AutoMode AND NOT #ROB.RobFault AND #tAct.Q; // Resetting
	        ELSE
	            #sc := FALSE;
	    END_CASE;
	END_REGION

	REGION PackML
	    #PML(CmdReset := #HMI.Cmd.Reset OR #PB_Reset OR #HMI.PackTags.Command.CntrlCmd = 1,
	         CmdStart := #HMI.Cmd.Start OR #PB_Start OR #HMI.PackTags.Command.CntrlCmd = 2,
	         CmdStop := #HMI.Cmd.Stop OR #PB_Stop OR #HMI.PackTags.Command.CntrlCmd = 3,
	         CmdHold := #HMI.Cmd.Hold OR #HMI.PackTags.Command.CntrlCmd = 4,
	         CmdUnhold := #HMI.Cmd.Unhold OR #HMI.PackTags.Command.CntrlCmd = 5,
	         CmdSuspend := #HMI.Cmd.Suspend OR #HMI.PackTags.Command.CntrlCmd = 6,
	         CmdUnsuspend := #HMI.Cmd.Unsuspend OR #HMI.PackTags.Command.CntrlCmd = 7,
	         CmdAbort := #HMI.Cmd.Abort OR #HMI.PackTags.Command.CntrlCmd = 8,
	         CmdClear := #HMI.Cmd.Clear OR #HMI.PackTags.Command.CntrlCmd = 9,
	         ModeReq := #HMI.Cmd.ModeReq,
	         AbortCond := NOT #EStopOK OR (NOT #ROB.CommOK AND #PML.State <> 2 AND #PML.State <> 9),
	         HoldCond := #holdLatch,
	         SuspendCond := #tStarve.Q OR (#PML.State = 5 AND NOT #workAvail),
	         SC := #sc);
	    // Los comandos del HMI son pulsos: se borran tras procesarse
	    #HMI.Cmd.Reset := FALSE; #HMI.Cmd.Start := FALSE; #HMI.Cmd.Stop := FALSE;
	    #HMI.Cmd.Hold := FALSE; #HMI.Cmd.Unhold := FALSE; #HMI.Cmd.Suspend := FALSE;
	    #HMI.Cmd.Unsuspend := FALSE; #HMI.Cmd.Abort := FALSE; #HMI.Cmd.Clear := FALSE;
	    #HMI.PackTags.Command.CntrlCmd := 0;
	END_REGION

	REGION Secuenciador (el PLC decide qué hace el robot)
	    CASE #seq OF
	        0:
	            #exec := FALSE;
	            #manualReq := 0;
	            IF #HMI.Cmd.RobotHome THEN #manualReq := 2; END_IF;
	            IF #HMI.Cmd.RobotMaintPos THEN #manualReq := 4; END_IF;
	            IF #HMI.Cmd.RobotGripTest THEN #manualReq := 5; END_IF;
	            #HMI.Cmd.RobotHome := FALSE;
	            #HMI.Cmd.RobotMaintPos := FALSE;
	            #HMI.Cmd.RobotGripTest := FALSE;
	            IF #manualReq > 0 AND #PML.Mode <> 1 AND NOT #ROB.Busy AND #ROB.ReadyForCmd THEN
	                #cmdCode := #manualReq;
	                #seq := 10;
	            ELSIF #PML.State = 6 AND #PML.Mode = 1 AND NOT #ROB.Busy AND #ROB.ReadyForCmd THEN
	                // 1) Estación de palet: seguir con la activa; si no está lista, la siguiente lista
	                #placeSel := 0;
	                IF #activeP >= 1 AND #activeP <= #N_PALLET THEN
	                    IF #palletReady[#activeP] THEN #placeSel := #activeP; END_IF;
	                END_IF;
	                IF #placeSel = 0 THEN
	                    FOR #i := 1 TO #N_PALLET DO
	                        IF #placeSel = 0 AND #palletReady[#i] THEN #placeSel := #i; END_IF;
	                    END_FOR;
	                END_IF;
	                // 2) Infeed: round-robin entre los que tienen producto
	                #pickSel := 0;
	                FOR #i := 1 TO #N_INFEED DO
	                    #k := ((#lastInfeed + #i - 1) MOD #N_INFEED) + 1;
	                    IF #pickSel = 0 AND #infeedReady[#k] THEN #pickSel := #k; END_IF;
	                END_FOR;
	                IF #placeSel > 0 AND #pickSel > 0 THEN
	                    #activeP := #placeSel;
	                    #lastInfeed := #pickSel;
	                    #k := #box[#placeSel];
	                    IF (#layer[#placeSel] MOD 2) = 1 THEN
	                        #posX := "DB_Pattern".LayerA[#k].X;
	                        #posY := "DB_Pattern".LayerA[#k].Y;
	                        #posRz := "DB_Pattern".LayerA[#k].Rz;
	                    ELSE
	                        #posX := "DB_Pattern".LayerB[#k].X;
	                        #posY := "DB_Pattern".LayerB[#k].Y;
	                        #posRz := "DB_Pattern".LayerB[#k].Rz;
	                    END_IF;
	                    #posZ := #layer[#placeSel] * #HMI.Recipe.BoxH * 10;
	                    #cmdCode := 1;
	                    #seq := 10;
	                END_IF;
	            END_IF;
	        10: // Enviar
	            #exec := TRUE;
	            IF #ROB.Busy THEN
	                #exec := FALSE;
	                #seq := 20;
	            ELSIF #ROB.Error THEN
	                #exec := FALSE;
	                #seq := 0;
	            END_IF;
	        20: // Esperar fin
	            IF #ROB.Done THEN
	                IF #cmdCode = 1 THEN
	                    #HMI.PackTags.Admin.ProdProcessedCount := #HMI.PackTags.Admin.ProdProcessedCount + 1;
	                    #box[#placeSel] := #box[#placeSel] + 1;
	                    IF #box[#placeSel] > #HMI.Recipe.PerLayer THEN
	                        #box[#placeSel] := 1;
	                        #layer[#placeSel] := #layer[#placeSel] + 1;
	                        IF #layer[#placeSel] > #HMI.Recipe.Layers THEN
	                            #layer[#placeSel] := 1;
	                            #complete[#placeSel] := TRUE;
	                            #totalPallets := #totalPallets + 1;
	                            #HMI.PackTags.Admin.PalletCount := #HMI.PackTags.Admin.PalletCount + 1;
	                        END_IF;
	                    END_IF;
	                END_IF;
	                #seq := 0;
	            ELSIF #ROB.Error THEN
	                #HMI.PackTags.Admin.ProdDefectiveCount := #HMI.PackTags.Admin.ProdDefectiveCount + 1;
	                #seq := 0;
	            ELSIF NOT #ROB.Busy THEN
	                #seq := 0;
	            END_IF;
	    END_CASE;
	    IF #PML.State = 8 OR #PML.State = 9 THEN
	        #seq := 0;
	        #exec := FALSE;
	    END_IF;
	    IF #HMI.Cmd.ResetCounters THEN
	        #totalPallets := 0;
	        #HMI.PackTags.Admin.ProdProcessedCount := 0;
	        #HMI.PackTags.Admin.ProdDefectiveCount := 0;
	        #HMI.PackTags.Admin.PalletCount := 0;
	        #HMI.Cmd.ResetCounters := FALSE;
	    END_IF;
	END_REGION

	REGION Interfaz robot
	    #ROB(RobIn := #RobIn,
	         MotorsOn := #EStopOK AND #PML.State <> 8 AND #PML.State <> 9 AND #PML.State <> 1,
	         ProgStart := #PML.State = 15 AND #ROB.MotorsOnState AND NOT #ROB.ProgRunning,
	         ProgStop := #PML.State = 2 OR #PML.State = 9,
	         ResetFault := #PML.State = 15 OR #PML.State = 1,
	         Hold := #PML.State = 10 OR #PML.State = 11,
	         GoHome := #PML.State = 7,
	         PermitPallet := #palletReady,
	         PermitInfeed := #infeedReady,
	         InfeedReady := #infeedReady,
	         PalletReady := #palletReady,
	         MaintMode := #PML.Mode = 2,
	         ManualMode := #PML.Mode = 3,
	         Execute := #exec,
	         CmdCode := #cmdCode,
	         PickStation := #pickSel,
	         PlaceStation := #placeSel,
	         Layer := #layer[#activeP],
	         BoxIndex := #box[#activeP],
	         PosX := #posX,
	         PosY := #posY,
	         PosZ := #posZ,
	         PosRz := #posRz,
	         ApproachZ := #HMI.Recipe.ApproachZ,
	         ApproachXY := #HMI.Recipe.ApproachXY,
	         SpeedOvr := #HMI.Recipe.SpeedOvr,
	         ProductID := #HMI.Recipe.ProductID,
	         BoxL := #HMI.Recipe.BoxL,
	         BoxW := #HMI.Recipe.BoxW,
	         BoxH := #HMI.Recipe.BoxH,
	         BoxWeight := #HMI.Recipe.BoxWeight,
	         GripZones := 255,
	         SwapBytes := TRUE,
	         RobOut => #RobOut);
	END_REGION

	REGION Señalización y HMI
	    #tBlink(IN := NOT #tBlink.Q, PT := T#500MS);
	    IF #tBlink.Q THEN #blink := NOT #blink; END_IF;
	    #LightGreen := #PML.State = 6 OR ((#PML.State = 5 OR #PML.State = 3) AND #blink);
	    #LightAmber := #PML.State = 4 OR #PML.State = 11 OR #PML.State = 2 OR #PML.State = 17 OR (#PML.State = 5 AND NOT #blink);
	    #LightRed := #PML.State = 9 OR #PML.State = 8 OR #holdLatch;
	    #Buzzer := (#PML.State = 8) OR (#holdLatch AND #PML.State = 10);
	    #LampReset := (#PML.State = 2 OR #PML.State = 17 OR #PML.State = 9) AND #blink;

	    #HMI.Sts.State := #PML.State;
	    #HMI.Sts.Mode := #PML.Mode;
	    #HMI.PackTags.Status.StateCurrent := #PML.State;
	    #HMI.PackTags.Status.UnitModeCurrent := #PML.Mode;
	    #HMI.PackTags.Admin.StateCurrentTime := #PML.TimeInState;
	    #HMI.Sts.ActivePallet := #activeP;
	    FOR #i := 1 TO 4 DO
	        #HMI.Sts.Layer[#i] := #layer[#i];
	        #HMI.Sts.BoxInLayer[#i] := #box[#i];
	        #HMI.Sts.PalletComplete[#i] := #complete[#i];
	        #HMI.Sts.PalletReady[#i] := #palletReady[#i];
	        #HMI.Sts.InfeedReady[#i] := #infeedReady[#i];
	    END_FOR;
	    #HMI.Sts.RobotCommOK := #ROB.CommOK;
	    #HMI.Sts.RobotBusy := #ROB.Busy;
	    #HMI.Sts.RobotAtHome := #ROB.AtHome;
	    #HMI.Sts.RobotStep := #ROB.Step;
	    #HMI.Sts.RobotError := #ROB.ErrorCode;
	    #HMI.Sts.CycleTime := #ROB.CycleTimeMs;
	    IF #ROB.CycleTimeMs > 0 THEN
	        #HMI.Sts.BoxesPerMin := 60000.0 / INT_TO_REAL(#ROB.CycleTimeMs);
	    END_IF;
	    // Alarmas (palabra 0): bit -> texto en la lista de alarmas del HMI
	    #HMI.Sts.AlarmWord[0].%X0 := NOT #EStopOK;
	    #HMI.Sts.AlarmWord[0].%X1 := NOT #SafetyOK;
	    #HMI.Sts.AlarmWord[0].%X2 := NOT #ROB.CommOK;
	    #HMI.Sts.AlarmWord[0].%X3 := #ROB.RobFault;
	    #HMI.Sts.AlarmWord[0].%X4 := #ROB.Error AND #ROB.ErrorCode = 100;
	    #HMI.Sts.AlarmWord[0].%X5 := #ROB.Error AND #ROB.ErrorCode = 101;
	    #HMI.Sts.AlarmWord[0].%X6 := #ROB.Error AND (#ROB.ErrorCode = 4 OR #ROB.ErrorCode = 5);
	    #HMI.Sts.AlarmWord[0].%X7 := #ROB.Error AND #ROB.ErrorCode = 6;
	    #HMI.Sts.AlarmWord[0].%X8 := NOT #ROB.AutoMode;
	    #HMI.Sts.AlarmWord[0].%X9 := #PML.State = 5;
	    #HMI.Sts.AlarmWord[0].%X10 := #ROB.Error AND #ROB.ErrorCode <> 0 AND #ROB.ErrorCode < 100 AND #ROB.ErrorCode <> 4 AND #ROB.ErrorCode <> 5 AND #ROB.ErrorCode <> 6;
	    #HMI.Sts.AlarmWord[1].%X0 := #complete[1] AND #PalletPresent[1];
	    #HMI.Sts.AlarmWord[1].%X1 := #complete[2] AND #PalletPresent[2];
	    #HMI.Sts.AlarmWord[1].%X2 := #complete[3] AND #PalletPresent[3];
	    #HMI.Sts.AlarmWord[1].%X3 := #complete[4] AND #PalletPresent[4];
	END_REGION
END_FUNCTION_BLOCK
`;
  }

  function s7DataBlocks(ctx) {
    const { cfg, pat } = ctx;
    const n = Math.max(1, pat.perLayer);
    const assign = (arr, nm) => arr.map((b, i) => `   ${nm}[${i + 1}].X := ${Math.round(b.x * 10)};\n   ${nm}[${i + 1}].Y := ${Math.round(b.y * 10)};\n   ${nm}[${i + 1}].Rz := ${Math.round(b.rot * 10)};`).join("\n");
    return `// ${cfg.projectName} - Bloques de datos. Generado ${stamp()}
DATA_BLOCK "DB_Pattern"
TITLE = 'Mosaico: ${pat.perLayer} cajas/capa, ${pat.layers} capas (${cfg.patternType})'
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
NON_RETAIN
   STRUCT
      PerLayer : Int;
      Layers : Int;
      LayerA : Array[1..${n}] of "typeBoxPos";   // capas impares
      LayerB : Array[1..${n}] of "typeBoxPos";   // capas pares
   END_STRUCT;

BEGIN
   PerLayer := ${pat.perLayer};
   Layers := ${pat.layers};
${assign(pat.layerA, "LayerA")}
${assign(pat.layerB, "LayerB")}

END_DATA_BLOCK

DATA_BLOCK "DB_HMI"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
   STRUCT
      HMI : "typeHMI";
   END_STRUCT;

BEGIN
   HMI.Cmd.ModeReq := 1;
   HMI.Recipe.ProductID := 1;
   HMI.Recipe.BoxL := ${Math.round(cfg.boxL)};
   HMI.Recipe.BoxW := ${Math.round(cfg.boxW)};
   HMI.Recipe.BoxH := ${Math.round(cfg.boxH)};
   HMI.Recipe.BoxWeight := ${Math.round(cfg.boxWeight * 10)};
   HMI.Recipe.PerLayer := ${pat.perLayer};
   HMI.Recipe.Layers := ${pat.layers};
   HMI.Recipe.SpeedOvr := 100;
   HMI.Recipe.ApproachZ := ${Math.round(cfg.approachZ)};
   HMI.Recipe.ApproachXY := ${Math.round(cfg.approachXY)};
   HMI.Recipe.SlipSheet := ${cfg.slipSheet ? "TRUE" : "FALSE"};
   HMI.Recipe.TargetPallets := 0;

END_DATA_BLOCK

DATA_BLOCK "iCell"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
"FB_Cell"

BEGIN

END_DATA_BLOCK
`;
  }

  function s7Main(ctx) {
    const io = ioList(ctx);
    const di = (n) => (io.di.find((x) => x.name === n) || {}).s7 || "FALSE";
    const { lay, cfg } = ctx;
    const L = [];
    lay.infeeds.forEach((f) => L.push(`	"iCell".InfeedAtPick[${f.id}] := ${di("InfeedAtPick" + f.id)};`));
    lay.pallets.forEach((p) => {
      L.push(`	"iCell".PalletPresent[${p.id}] := ${di("PalletPresent" + p.id)};`);
      L.push(`	"iCell".ZoneSafe[${p.id}] := ${di("ZoneSafe" + p.id)};`);
      L.push(`	"iCell".OutfeedFree[${p.id}] := ${cfg.palletExit === "conveyor" ? di("OutfeedFree" + p.id) : "TRUE"};`);
    });
    const Q = [];
    io.dq.forEach((q) => {
      const m = q.name.match(/^(InfeedRun|OutfeedRun|LampPalletDone)(\d)$/);
      Q.push(`	${q.s7} := "iCell".${m ? `${m[1]}[${m[2]}]` : q.name};   // ${q.desc}`);
    });
    return `// ${cfg.projectName} - OB1. Generado ${stamp()}
// ANTES de importar: crear en la tabla de variables PLC
//   "Robot_In"  : "typeRobotIn"  en %I${cfg.plcInStart}.0   (64 bytes desde el robot)
//   "Robot_Out" : "typeRobotOut" en %Q${cfg.plcOutStart}.0  (64 bytes hacia el robot)
// Las E/S físicas usan direcciones absolutas; renómbralas según tu hardware.
ORGANIZATION_BLOCK "Main"
TITLE = "Main Program Sweep (Cycle)"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1

BEGIN
${L.join("\n")}

	"iCell"(EStopOK := ${di("EStopOK")},
	        SafetyOK := ${di("SafetyOK")},
	        PB_Reset := ${di("PB_Reset")},
	        PB_Start := ${di("PB_Start")},
	        PB_Stop := NOT ${di("PB_Stop")},   // pulsador NC
	        RobIn := "Robot_In",
	        RobOut => "Robot_Out",
	        HMI := "DB_HMI".HMI);

${Q.join("\n")}
END_ORGANIZATION_BLOCK
`;
  }

  /* ===================== ALLEN-BRADLEY ===================== */
  function abAliasCSV(ctx) {
    const rows = [
      'remark,"CSV-Import-Export"',
      `remark,"Date = ${new Date().toUTCString()}"`,
      'remark,"Version = RSLogix 5000 v33.00"',
      'remark,"Owner = "', 'remark,"Company = "', "0.3",
      "TYPE,SCOPE,NAME,DESCRIPTION,DATATYPE,SPECIFIER,ATTRIBUTES"
    ];
    const att = '"(RADIX := Decimal, ExternalAccess := Read/Write)"';
    I().PLC_TO_ROBOT.forEach((s) => rows.push(`ALIAS,,RobO_${s.name},"${s.desc}","","${I().plcAddr("Allen-Bradley", true, s, ctx.cfg)}",${att}`));
    I().ROBOT_TO_PLC.forEach((s) => rows.push(`ALIAS,,RobI_${s.name},"${s.desc}","","${I().plcAddr("Allen-Bradley", false, s, ctx.cfg)}",${att}`));
    const io = ioList(ctx);
    io.di.forEach((d) => rows.push(`ALIAS,,IO_${d.name},"${d.desc}","","${d.ab}",${att}`));
    io.dq.forEach((d) => rows.push(`ALIAS,,IO_${d.name},"${d.desc}","","${d.ab}",${att}`));
    const tag = (n, t, d) => rows.push(`TAG,,${n},"${d}","${t}","",${att}`);
    tag("PML", "UDT_PackML", "Máquina de estados PackML");
    tag("ROB", "UDT_RobotIF", "Interfaz robot");
    tag("CELL", "UDT_Cell", "Datos internos de la celda");
    tag("HMI", "UDT_HMI", "Interfaz HMI y PackTags");
    tag("PatA", "UDT_BoxPos[61]", "Mosaico capas impares (índice 1..n)");
    tag("PatB", "UDT_BoxPos[61]", "Mosaico capas pares (índice 1..n)");
    return rows.join("\r\n") + "\r\n";
  }

  function abUDTs(ctx) {
    return `UDTs a crear en Studio 5000 (Data Types > User-Defined > New Data Type)
Generado ${stamp()} — ${ctx.cfg.projectName}

UDT_BoxPos
  X        INT   0.1 mm en frame del palet
  Y        INT   0.1 mm
  Rz       INT   0.1 grados

UDT_PackML
  State          DINT   Estado PackML actual (0..17)
  Mode           DINT   1 Production 2 Maintenance 3 Manual
  ModeReq        DINT
  PrevState      DINT
  StateChanged   BOOL
  JustChanged    BOOL
  SC             BOOL   State Complete (de la lógica de máquina)
  AbortCond      BOOL
  HoldCond       BOOL
  SuspendCond    BOOL
  CmdReset .. CmdClear   BOOL (9)     comandos ya combinados
  MemReset .. MemClear   BOOL (9)     memorias de flanco
  TimeInState    DINT   s
  tSec           TIMER
  InitDone       BOOL

UDT_RobotIF
  Execute, ExecMem, Busy, Done, Error, CommOK, LifeBit   BOOL
  HS, CmdId, Echo, ErrorCode                             DINT
  CmdCode, PickStation, PlaceStation, Layer, BoxIndex     INT
  PosX, PosY, PosZ, PosRz, ApproachZ, ApproachXY          INT
  tLife, tLifeChk, tAck, tCmd                             TIMER

UDT_Cell
  Seq, ActiveP, LastInfeed, PickSel, PlaceSel, CmdCode, I, K, TotalPallets, ManualReq   DINT
  Layer[5], Box[5]                     DINT  (índices 1..4)
  Complete[5], PalletReady[5], InfeedReady[5], WasPresent[5]   BOOL
  HoldLatch, WorkAvail, Blink, Exec    BOOL
  tStarve, tAct, tBlink                TIMER

UDT_HMI
  Cmd_Reset, Cmd_Start, Cmd_Stop, Cmd_Hold, Cmd_Unhold, Cmd_Suspend, Cmd_Unsuspend, Cmd_Abort, Cmd_Clear  BOOL
  Cmd_ModeReq          DINT
  Cmd_AckAlarms, Cmd_RobotHome, Cmd_RobotGripTest, Cmd_RobotMaintPos, Cmd_ResetCounters  BOOL
  Cmd_ForcePalletDone[5]  BOOL
  Sts_State, Sts_Mode, Sts_ActivePallet, Sts_RobotStep, Sts_RobotError, Sts_CycleTime   DINT
  Sts_Layer[5], Sts_BoxInLayer[5]           DINT
  Sts_PalletComplete[5], Sts_PalletReady[5], Sts_InfeedReady[5]   BOOL
  Sts_RobotCommOK, Sts_RobotBusy, Sts_RobotAtHome  BOOL
  Sts_AlarmWord[2]       DINT  (bits de alarma)
  Rcp_ProductID, Rcp_BoxL, Rcp_BoxW, Rcp_BoxH, Rcp_BoxWeight, Rcp_PerLayer, Rcp_Layers   DINT
  Rcp_SpeedOvr, Rcp_ApproachZ, Rcp_ApproachXY, Rcp_TargetPallets   DINT
  Rcp_SlipSheet          BOOL
  PT_UnitModeCurrent, PT_StateCurrent, PT_CntrlCmd     DINT   (PackTags)
  PT_ProdProcessedCount, PT_ProdDefectiveCount, PT_PalletCount, PT_StateCurrentTime  DINT

Módulo del robot (I/O Configuration > Ethernet > New Module):
  ${ctx.cfg.robotBrand === "FANUC" ? "FANUC: usar el EDS de R-30iB/R-50iA o 'Generic Ethernet Module' Data-INT, Input 101 (32 INT), Output 151 (32 INT), Config 100 (0), RPI 8-20 ms." : "Usar el archivo EDS del controlador " + ctx.cfg.robotBrand + " o 'Generic Ethernet Module' Data-INT con 32 INT de entrada y 32 INT de salida (instancias de ensamblado según manual del adapter)."}
  Nombre del módulo: Robot   -> tags Robot:I.Data[0..31] / Robot:O.Data[0..31]
  Si el EDS crea otra estructura (p. ej. Robot:I1.Data), ajustar los alias del CSV.
`;
  }

  function abRoutines(ctx) {
    const { cfg, pat, lay } = ctx;
    const nI = lay.infeeds.length, nP = lay.pallets.length;
    const out = {};
    const pre = (t) => `// ${cfg.projectName} - ${t}\n// Generado ${stamp()} por PalletCell Designer\n`;

    out["R00_Main.st"] = pre("Rutina principal (Program: Palletizer, Main Routine)") + `
IF S:FS THEN
    JSR(R05_LoadPattern,0);
    PML.State := 2;
    PML.Mode := 1;
    HMI.Cmd_ModeReq := 1;
    CELL.ActiveP := 1;
    FOR CELL.I := 1 TO 4 DO
        CELL.Layer[CELL.I] := 1;
        CELL.Box[CELL.I] := 1;
    END_FOR;
END_IF;
JSR(R40_Stations,0);
JSR(R30_Conditions,0);
JSR(R10_PackML,0);
JSR(R35_Sequencer,0);
JSR(R20_RobotIF,0);
JSR(R60_HMI,0);
`;

    const assign = (arr, nm) => arr.map((b, i) => `${nm}[${i + 1}].X := ${Math.round(b.x * 10)}; ${nm}[${i + 1}].Y := ${Math.round(b.y * 10)}; ${nm}[${i + 1}].Rz := ${Math.round(b.rot * 10)};`).join("\n");
    out["R05_LoadPattern.st"] = pre(`Mosaico ${pat.perLayer} cajas/capa x ${pat.layers} capas`) + `
HMI.Rcp_ProductID := 1;
HMI.Rcp_BoxL := ${Math.round(cfg.boxL)};
HMI.Rcp_BoxW := ${Math.round(cfg.boxW)};
HMI.Rcp_BoxH := ${Math.round(cfg.boxH)};
HMI.Rcp_BoxWeight := ${Math.round(cfg.boxWeight * 10)};
HMI.Rcp_PerLayer := ${pat.perLayer};
HMI.Rcp_Layers := ${pat.layers};
HMI.Rcp_SpeedOvr := 100;
HMI.Rcp_ApproachZ := ${Math.round(cfg.approachZ)};
HMI.Rcp_ApproachXY := ${Math.round(cfg.approachXY)};
HMI.Rcp_SlipSheet := ${cfg.slipSheet ? 1 : 0};
// Capa A (impares)
${assign(pat.layerA, "PatA")}
// Capa B (pares)
${assign(pat.layerB, "PatB")}
`;

    out["R10_PackML.st"] = pre("Máquina de estados PackML ISA-TR88.00.02") + `
// Flancos de comando
PML.SC := PML.SC AND NOT PML.JustChanged;

IF (PML.AbortCond OR (PML.CmdAbort AND NOT PML.MemAbort)) AND PML.State <> 8 AND PML.State <> 9 THEN
    PML.State := 8;
ELSE
    CASE PML.State OF
    1:  IF PML.SC THEN PML.State := 2; END_IF;
    2:  IF PML.CmdReset AND NOT PML.MemReset THEN PML.State := 15; END_IF;
    3:  IF PML.CmdStop AND NOT PML.MemStop THEN PML.State := 7;
        ELSIF PML.SC THEN PML.State := 6; END_IF;
    4:  IF PML.CmdStop AND NOT PML.MemStop THEN PML.State := 7;
        ELSIF PML.CmdStart AND NOT PML.MemStart THEN PML.State := 3; END_IF;
    5:  IF PML.CmdStop AND NOT PML.MemStop THEN PML.State := 7;
        ELSIF PML.HoldCond OR (PML.CmdHold AND NOT PML.MemHold) THEN PML.State := 10;
        ELSIF (PML.CmdUnsuspend AND NOT PML.MemUnsuspend) OR NOT PML.SuspendCond THEN PML.State := 14; END_IF;
    6:  IF PML.CmdStop AND NOT PML.MemStop THEN PML.State := 7;
        ELSIF PML.HoldCond OR (PML.CmdHold AND NOT PML.MemHold) THEN PML.State := 10;
        ELSIF PML.SuspendCond OR (PML.CmdSuspend AND NOT PML.MemSuspend) THEN PML.State := 13;
        ELSIF PML.SC THEN PML.State := 16; END_IF;
    7:  IF PML.SC THEN PML.State := 2; END_IF;
    8:  IF PML.SC THEN PML.State := 9; END_IF;
    9:  IF PML.CmdClear AND NOT PML.MemClear THEN PML.State := 1; END_IF;
    10: IF PML.CmdStop AND NOT PML.MemStop THEN PML.State := 7;
        ELSIF PML.SC THEN PML.State := 11; END_IF;
    11: IF PML.CmdStop AND NOT PML.MemStop THEN PML.State := 7;
        ELSIF PML.CmdUnhold AND NOT PML.MemUnhold AND NOT PML.HoldCond THEN PML.State := 12; END_IF;
    12, 14:
        IF PML.CmdStop AND NOT PML.MemStop THEN PML.State := 7;
        ELSIF PML.HoldCond OR (PML.CmdHold AND NOT PML.MemHold) THEN PML.State := 10;
        ELSIF PML.SC THEN PML.State := 6; END_IF;
    13: IF PML.CmdStop AND NOT PML.MemStop THEN PML.State := 7;
        ELSIF PML.HoldCond OR (PML.CmdHold AND NOT PML.MemHold) THEN PML.State := 10;
        ELSIF PML.SC THEN PML.State := 5; END_IF;
    15: IF PML.CmdStop AND NOT PML.MemStop THEN PML.State := 7;
        ELSIF PML.SC THEN PML.State := 4; END_IF;
    16: IF PML.CmdStop AND NOT PML.MemStop THEN PML.State := 7;
        ELSIF PML.SC THEN PML.State := 17; END_IF;
    17: IF PML.CmdStop AND NOT PML.MemStop THEN PML.State := 7;
        ELSIF PML.CmdReset AND NOT PML.MemReset THEN PML.State := 15; END_IF;
    ELSE
        PML.State := 8;
    END_CASE;
END_IF;

// Memorias de flanco
PML.MemReset := PML.CmdReset;   PML.MemStart := PML.CmdStart;   PML.MemStop := PML.CmdStop;
PML.MemHold := PML.CmdHold;     PML.MemUnhold := PML.CmdUnhold; PML.MemSuspend := PML.CmdSuspend;
PML.MemUnsuspend := PML.CmdUnsuspend; PML.MemAbort := PML.CmdAbort; PML.MemClear := PML.CmdClear;

// Cambio de modo sólo en Stopped / Aborted
IF PML.ModeReq <> PML.Mode AND PML.ModeReq >= 1 AND PML.ModeReq <= 3 AND (PML.State = 2 OR PML.State = 9) THEN
    PML.Mode := PML.ModeReq;
END_IF;

PML.StateChanged := PML.State <> PML.PrevState;
PML.JustChanged := PML.StateChanged;
IF PML.StateChanged THEN PML.TimeInState := 0; END_IF;
PML.tSec.PRE := 1000;
PML.tSec.TimerEnable := NOT PML.tSec.DN;
TONR(PML.tSec);
IF PML.tSec.DN THEN PML.TimeInState := PML.TimeInState + 1; END_IF;
PML.PrevState := PML.State;
`;

    out["R20_RobotIF.st"] = pre("Interfaz PLC maestro -> robot (handshake CmdValid/Ack/Done). EtherNet/IP little-endian: sin SWAP") + `
// Bit de vida
ROB.tLife.PRE := 500;
ROB.tLife.TimerEnable := NOT ROB.tLife.DN;
TONR(ROB.tLife);
IF ROB.tLife.DN THEN ROB.LifeBit := NOT ROB.LifeBit; END_IF;
RobO_PLC_LifeBit := ROB.LifeBit;
// El robot devuelve el bit invertido: iguales por más de 2 s = falla de comunicación
ROB.tLifeChk.PRE := 2000;
ROB.tLifeChk.TimerEnable := NOT (RobI_Rob_LifeBit XOR ROB.LifeBit);
TONR(ROB.tLifeChk);
ROB.CommOK := NOT ROB.tLifeChk.DN;
ROB.Echo := RobI_CmdIDEcho;

CASE ROB.HS OF
0:
    IF ROB.Execute AND NOT ROB.ExecMem AND ROB.CommOK THEN
        ROB.CmdId := ROB.CmdId + 1;
        IF ROB.CmdId > 32000 OR ROB.CmdId < 1 THEN ROB.CmdId := 1; END_IF;
        RobO_CmdID := ROB.CmdId;
        RobO_CmdCode := ROB.CmdCode;
        RobO_PickStation := ROB.PickStation;
        RobO_PlaceStation := ROB.PlaceStation;
        RobO_Layer := ROB.Layer;
        RobO_BoxIndex := ROB.BoxIndex;
        RobO_PosX := ROB.PosX;
        RobO_PosY := ROB.PosY;
        RobO_PosZ := ROB.PosZ;
        RobO_PosRz := ROB.PosRz;
        RobO_ApproachZ := ROB.ApproachZ;
        RobO_ApproachXY := ROB.ApproachXY;
        RobO_SpeedOvr := HMI.Rcp_SpeedOvr;
        RobO_ProductID := HMI.Rcp_ProductID;
        RobO_BoxL := HMI.Rcp_BoxL;
        RobO_BoxW := HMI.Rcp_BoxW;
        RobO_BoxH := HMI.Rcp_BoxH;
        RobO_BoxWeight := HMI.Rcp_BoxWeight;
        RobO_GripZones := 255;
        RobO_CmdValid := 1;
        ROB.Busy := 1; ROB.Done := 0; ROB.Error := 0; ROB.ErrorCode := 0;
        ROB.HS := 10;
    END_IF;
10:
    IF RobI_CmdAck AND ROB.Echo = ROB.CmdId THEN
        RobO_CmdValid := 0;
        ROB.HS := 20;
    ELSIF ROB.tAck.DN THEN
        RobO_CmdValid := 0;
        ROB.Error := 1; ROB.ErrorCode := 100; ROB.Busy := 0;
        ROB.HS := 0;
    END_IF;
20:
    IF RobI_CmdDone AND NOT RobI_CmdAck AND ROB.Echo = ROB.CmdId THEN
        ROB.ErrorCode := RobI_ErrorCode;
        ROB.Error := ROB.ErrorCode <> 0;
        ROB.Done := NOT ROB.Error;
        ROB.Busy := 0;
        ROB.HS := 0;
    ELSIF ROB.tCmd.DN OR NOT ROB.CommOK THEN
        ROB.Error := 1; ROB.ErrorCode := 101; ROB.Busy := 0;
        ROB.HS := 0;
    END_IF;
END_CASE;
ROB.ExecMem := ROB.Execute;
ROB.tAck.PRE := 3000;
ROB.tAck.TimerEnable := ROB.HS = 10;
TONR(ROB.tAck);
ROB.tCmd.PRE := 60000;
ROB.tCmd.TimerEnable := ROB.HS = 20;
TONR(ROB.tCmd);

// Bits de control
RobO_MotorsOn := IO_EStopOK AND PML.State <> 8 AND PML.State <> 9 AND PML.State <> 1;
RobO_ProgStart := PML.State = 15 AND RobI_MotorsOnState AND NOT RobI_ProgRunning;
RobO_ProgStop := PML.State = 2 OR PML.State = 9;
RobO_ResetFault := PML.State = 15 OR PML.State = 1;
RobO_Hold := PML.State = 10 OR PML.State = 11;
RobO_GoHome := PML.State = 7;
RobO_MaintMode := PML.Mode = 2;
RobO_ManualMode := PML.Mode = 3;
${lay.pallets.map((p) => `RobO_PermitPallet${p.id} := CELL.PalletReady[${p.id}];\nRobO_PalletReady${p.id} := CELL.PalletReady[${p.id}];`).join("\n")}
${lay.infeeds.map((f) => `RobO_PermitInfeed${f.id} := CELL.InfeedReady[${f.id}];\nRobO_InfeedReady${f.id} := CELL.InfeedReady[${f.id}];`).join("\n")}
`;

    out["R30_Conditions.st"] = pre("Condiciones PackML: Abort / Hold / Suspend / State Complete y comandos") + `
// Disponibilidad de trabajo
CELL.WorkAvail := 0;
FOR CELL.I := 1 TO ${nP} DO
    FOR CELL.K := 1 TO ${nI} DO
        IF CELL.PalletReady[CELL.I] AND CELL.InfeedReady[CELL.K] THEN CELL.WorkAvail := 1; END_IF;
    END_FOR;
END_FOR;
CELL.tStarve.PRE := 5000;
CELL.tStarve.TimerEnable := PML.State = 6 AND NOT CELL.WorkAvail AND NOT ROB.Busy;
TONR(CELL.tStarve);

// Fallas -> Held
IF ROB.Error OR (RobI_FaultActive AND PML.State = 6) OR NOT IO_SafetyOK THEN CELL.HoldLatch := 1; END_IF;
IF HMI.Cmd_AckAlarms AND NOT RobI_FaultActive AND IO_SafetyOK THEN
    CELL.HoldLatch := 0;
    HMI.Cmd_AckAlarms := 0;
END_IF;

PML.AbortCond := NOT IO_EStopOK OR (NOT ROB.CommOK AND PML.State <> 2 AND PML.State <> 9);
PML.HoldCond := CELL.HoldLatch;
PML.SuspendCond := CELL.tStarve.DN OR (PML.State = 5 AND NOT CELL.WorkAvail);

// State Complete
CELL.tAct.PRE := 1000;
CELL.tAct.TimerEnable := NOT PML.StateChanged;
TONR(CELL.tAct);
CASE PML.State OF
1:  PML.SC := IO_EStopOK AND IO_SafetyOK AND CELL.tAct.DN;
3:  PML.SC := CELL.tAct.DN AND RobI_ReadyForCmd;
6:  PML.SC := HMI.Rcp_TargetPallets > 0 AND CELL.TotalPallets >= HMI.Rcp_TargetPallets AND NOT ROB.Busy;
7, 13, 16: PML.SC := NOT ROB.Busy;
8:  PML.SC := CELL.tAct.DN;
10: PML.SC := NOT ROB.Busy OR RobI_HeldState;
12: PML.SC := NOT RobI_HeldState AND CELL.tAct.DN;
14: PML.SC := CELL.tAct.DN;
15: PML.SC := ROB.CommOK AND RobI_MotorsOnState AND RobI_ProgRunning AND RobI_AutoMode AND NOT RobI_FaultActive AND CELL.tAct.DN;
ELSE
    PML.SC := 0;
END_CASE;

// Comandos (HMI, pulsadores, PackTags)
PML.CmdReset := HMI.Cmd_Reset OR IO_PB_Reset OR HMI.PT_CntrlCmd = 1;
PML.CmdStart := HMI.Cmd_Start OR IO_PB_Start OR HMI.PT_CntrlCmd = 2;
PML.CmdStop := HMI.Cmd_Stop OR NOT IO_PB_Stop OR HMI.PT_CntrlCmd = 3;
PML.CmdHold := HMI.Cmd_Hold OR HMI.PT_CntrlCmd = 4;
PML.CmdUnhold := HMI.Cmd_Unhold OR HMI.PT_CntrlCmd = 5;
PML.CmdSuspend := HMI.Cmd_Suspend OR HMI.PT_CntrlCmd = 6;
PML.CmdUnsuspend := HMI.Cmd_Unsuspend OR HMI.PT_CntrlCmd = 7;
PML.CmdAbort := HMI.Cmd_Abort OR HMI.PT_CntrlCmd = 8;
PML.CmdClear := HMI.Cmd_Clear OR HMI.PT_CntrlCmd = 9;
PML.ModeReq := HMI.Cmd_ModeReq;
HMI.Cmd_Reset := 0; HMI.Cmd_Start := 0; HMI.Cmd_Stop := 0; HMI.Cmd_Hold := 0; HMI.Cmd_Unhold := 0;
HMI.Cmd_Suspend := 0; HMI.Cmd_Unsuspend := 0; HMI.Cmd_Abort := 0; HMI.Cmd_Clear := 0; HMI.PT_CntrlCmd := 0;
`;

    out["R35_Sequencer.st"] = pre("Secuenciador: el PLC decide la toma, la estación y la posición") + `
CASE CELL.Seq OF
0:
    ROB.Execute := 0;
    CELL.ManualReq := 0;
    IF HMI.Cmd_RobotHome THEN CELL.ManualReq := 2; END_IF;
    IF HMI.Cmd_RobotMaintPos THEN CELL.ManualReq := 4; END_IF;
    IF HMI.Cmd_RobotGripTest THEN CELL.ManualReq := 5; END_IF;
    HMI.Cmd_RobotHome := 0; HMI.Cmd_RobotMaintPos := 0; HMI.Cmd_RobotGripTest := 0;
    IF CELL.ManualReq > 0 AND PML.Mode <> 1 AND NOT ROB.Busy AND RobI_ReadyForCmd THEN
        CELL.CmdCode := CELL.ManualReq;
        CELL.Seq := 10;
    ELSIF PML.State = 6 AND PML.Mode = 1 AND NOT ROB.Busy AND RobI_ReadyForCmd THEN
        CELL.PlaceSel := 0;
        IF CELL.ActiveP >= 1 AND CELL.ActiveP <= ${nP} THEN
            IF CELL.PalletReady[CELL.ActiveP] THEN CELL.PlaceSel := CELL.ActiveP; END_IF;
        END_IF;
        IF CELL.PlaceSel = 0 THEN
            FOR CELL.I := 1 TO ${nP} DO
                IF CELL.PlaceSel = 0 AND CELL.PalletReady[CELL.I] THEN CELL.PlaceSel := CELL.I; END_IF;
            END_FOR;
        END_IF;
        CELL.PickSel := 0;
        FOR CELL.I := 1 TO ${nI} DO
            CELL.K := ((CELL.LastInfeed + CELL.I - 1) MOD ${nI}) + 1;
            IF CELL.PickSel = 0 AND CELL.InfeedReady[CELL.K] THEN CELL.PickSel := CELL.K; END_IF;
        END_FOR;
        IF CELL.PlaceSel > 0 AND CELL.PickSel > 0 THEN
            CELL.ActiveP := CELL.PlaceSel;
            CELL.LastInfeed := CELL.PickSel;
            CELL.K := CELL.Box[CELL.PlaceSel];
            IF (CELL.Layer[CELL.PlaceSel] MOD 2) = 1 THEN
                ROB.PosX := PatA[CELL.K].X; ROB.PosY := PatA[CELL.K].Y; ROB.PosRz := PatA[CELL.K].Rz;
            ELSE
                ROB.PosX := PatB[CELL.K].X; ROB.PosY := PatB[CELL.K].Y; ROB.PosRz := PatB[CELL.K].Rz;
            END_IF;
            ROB.PosZ := CELL.Layer[CELL.PlaceSel] * HMI.Rcp_BoxH * 10;
            CELL.CmdCode := 1;
            CELL.Seq := 10;
        END_IF;
    END_IF;
10:
    ROB.CmdCode := CELL.CmdCode;
    ROB.PickStation := CELL.PickSel;
    ROB.PlaceStation := CELL.PlaceSel;
    ROB.Layer := CELL.Layer[CELL.ActiveP];
    ROB.BoxIndex := CELL.Box[CELL.ActiveP];
    ROB.ApproachZ := HMI.Rcp_ApproachZ;
    ROB.ApproachXY := HMI.Rcp_ApproachXY;
    ROB.Execute := 1;
    IF ROB.Busy THEN
        ROB.Execute := 0;
        CELL.Seq := 20;
    ELSIF ROB.Error THEN
        ROB.Execute := 0;
        CELL.Seq := 0;
    END_IF;
20:
    IF ROB.Done THEN
        IF CELL.CmdCode = 1 THEN
            HMI.PT_ProdProcessedCount := HMI.PT_ProdProcessedCount + 1;
            CELL.Box[CELL.PlaceSel] := CELL.Box[CELL.PlaceSel] + 1;
            IF CELL.Box[CELL.PlaceSel] > HMI.Rcp_PerLayer THEN
                CELL.Box[CELL.PlaceSel] := 1;
                CELL.Layer[CELL.PlaceSel] := CELL.Layer[CELL.PlaceSel] + 1;
                IF CELL.Layer[CELL.PlaceSel] > HMI.Rcp_Layers THEN
                    CELL.Layer[CELL.PlaceSel] := 1;
                    CELL.Complete[CELL.PlaceSel] := 1;
                    CELL.TotalPallets := CELL.TotalPallets + 1;
                    HMI.PT_PalletCount := HMI.PT_PalletCount + 1;
                END_IF;
            END_IF;
        END_IF;
        CELL.Seq := 0;
    ELSIF ROB.Error THEN
        HMI.PT_ProdDefectiveCount := HMI.PT_ProdDefectiveCount + 1;
        CELL.Seq := 0;
    ELSIF NOT ROB.Busy THEN
        CELL.Seq := 0;
    END_IF;
END_CASE;
IF PML.State = 8 OR PML.State = 9 THEN
    CELL.Seq := 0;
    ROB.Execute := 0;
END_IF;
IF HMI.Cmd_ResetCounters THEN
    CELL.TotalPallets := 0;
    HMI.PT_ProdProcessedCount := 0; HMI.PT_ProdDefectiveCount := 0; HMI.PT_PalletCount := 0;
    HMI.Cmd_ResetCounters := 0;
END_IF;
`;

    out["R40_Stations.st"] = pre("Estaciones de palet e infeeds") + `
${lay.pallets.map((p) => `// ---- Estación de palet ${p.id}
IF CELL.WasPresent[${p.id}] AND NOT IO_PalletPresent${p.id} THEN
    CELL.Complete[${p.id}] := 0; CELL.Layer[${p.id}] := 1; CELL.Box[${p.id}] := 1;
END_IF;
CELL.WasPresent[${p.id}] := IO_PalletPresent${p.id};
IF HMI.Cmd_ForcePalletDone[${p.id}] THEN CELL.Complete[${p.id}] := 1; HMI.Cmd_ForcePalletDone[${p.id}] := 0; END_IF;
CELL.PalletReady[${p.id}] := IO_PalletPresent${p.id} AND NOT CELL.Complete[${p.id}] AND IO_ZoneSafe${p.id};
IO_LampPalletDone${p.id} := CELL.Complete[${p.id}] AND IO_PalletPresent${p.id};
IO_OutfeedRun${p.id} := ${cfg.palletExit === "conveyor" ? `CELL.Complete[${p.id}] AND RobI_OutPallet${p.id} AND IO_OutfeedFree${p.id} AND PML.State <> 8 AND PML.State <> 9` : "0; // retiro manual"};
`).join("\n")}
${lay.infeeds.map((f) => `// ---- Infeed ${f.id}
CELL.InfeedReady[${f.id}] := IO_InfeedAtPick${f.id};
IO_InfeedRun${f.id} := NOT IO_InfeedAtPick${f.id} AND RobI_OutInfeed${f.id} AND (PML.State = 6 OR PML.State = 3 OR PML.State = 13 OR PML.State = 5 OR PML.State = 14);
`).join("\n")}`;

    out["R60_HMI.st"] = pre("Estados al HMI, PackTags, torre de luz y alarmas") + `
CELL.tBlink.PRE := 500;
CELL.tBlink.TimerEnable := NOT CELL.tBlink.DN;
TONR(CELL.tBlink);
IF CELL.tBlink.DN THEN CELL.Blink := NOT CELL.Blink; END_IF;
IO_LightGreen := PML.State = 6 OR ((PML.State = 5 OR PML.State = 3) AND CELL.Blink);
IO_LightAmber := PML.State = 4 OR PML.State = 11 OR PML.State = 2 OR PML.State = 17 OR (PML.State = 5 AND NOT CELL.Blink);
IO_LightRed := PML.State = 9 OR PML.State = 8 OR CELL.HoldLatch;
IO_Buzzer := PML.State = 8 OR (CELL.HoldLatch AND PML.State = 10);
IO_LampReset := (PML.State = 2 OR PML.State = 17 OR PML.State = 9) AND CELL.Blink;

HMI.Sts_State := PML.State;
HMI.Sts_Mode := PML.Mode;
HMI.PT_StateCurrent := PML.State;
HMI.PT_UnitModeCurrent := PML.Mode;
HMI.PT_StateCurrentTime := PML.TimeInState;
HMI.Sts_ActivePallet := CELL.ActiveP;
FOR CELL.I := 1 TO 4 DO
    HMI.Sts_Layer[CELL.I] := CELL.Layer[CELL.I];
    HMI.Sts_BoxInLayer[CELL.I] := CELL.Box[CELL.I];
    HMI.Sts_PalletComplete[CELL.I] := CELL.Complete[CELL.I];
    HMI.Sts_PalletReady[CELL.I] := CELL.PalletReady[CELL.I];
    HMI.Sts_InfeedReady[CELL.I] := CELL.InfeedReady[CELL.I];
END_FOR;
HMI.Sts_RobotCommOK := ROB.CommOK;
HMI.Sts_RobotBusy := ROB.Busy;
HMI.Sts_RobotAtHome := RobI_AtHome;
HMI.Sts_RobotStep := RobI_Step;
HMI.Sts_RobotError := ROB.ErrorCode;
HMI.Sts_CycleTime := RobI_CycleTime;

HMI.Sts_AlarmWord[0].0 := NOT IO_EStopOK;
HMI.Sts_AlarmWord[0].1 := NOT IO_SafetyOK;
HMI.Sts_AlarmWord[0].2 := NOT ROB.CommOK;
HMI.Sts_AlarmWord[0].3 := RobI_FaultActive;
HMI.Sts_AlarmWord[0].4 := ROB.Error AND ROB.ErrorCode = 100;
HMI.Sts_AlarmWord[0].5 := ROB.Error AND ROB.ErrorCode = 101;
HMI.Sts_AlarmWord[0].6 := ROB.Error AND (ROB.ErrorCode = 4 OR ROB.ErrorCode = 5);
HMI.Sts_AlarmWord[0].7 := ROB.Error AND ROB.ErrorCode = 6;
HMI.Sts_AlarmWord[0].8 := NOT RobI_AutoMode;
HMI.Sts_AlarmWord[0].9 := PML.State = 5;
HMI.Sts_AlarmWord[0].10 := ROB.Error AND ROB.ErrorCode > 0 AND ROB.ErrorCode < 100 AND ROB.ErrorCode <> 4 AND ROB.ErrorCode <> 5 AND ROB.ErrorCode <> 6;
${lay.pallets.map((p) => `HMI.Sts_AlarmWord[1].${p.id - 1} := CELL.Complete[${p.id}] AND IO_PalletPresent${p.id};`).join("\n")}
`;
    return out;
  }

  function files(ctx) {
    if (ctx.cfg.plcBrand === "Siemens")
      return {
        "plc/Siemens/01_Types.udt": s7Types(ctx),
        "plc/Siemens/02_Blocks.scl": s7Functions(ctx),
        "plc/Siemens/03_DataBlocks.db": s7DataBlocks(ctx),
        "plc/Siemens/04_Main.scl": s7Main(ctx)
      };
    const out = { "plc/AllenBradley/Tags_y_Alias.CSV": abAliasCSV(ctx), "plc/AllenBradley/UDTs_y_modulo_robot.txt": abUDTs(ctx) };
    const r = abRoutines(ctx);
    Object.keys(r).forEach((k) => (out["plc/AllenBradley/" + k] = r[k]));
    return out;
  }

  return { files, ioList };
})();
