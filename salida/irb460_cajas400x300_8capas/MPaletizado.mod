MODULE MPaletizado
    !***********************************************************
    ! Celda: irb460_cajas400x300_8capas
    ! Robot IRB 460, conveyor 2000x600 a 800 mm, cajas 400x300x250, pallet europeo 1200x800, 8 capas, mosaico alternado
    ! Robot: IRB 460-110/2.4
    ! Generado por el generador de paletizado - no editar a mano,
    ! cambia la celda y vuelve a generar.
    !
    ! Cajas por capa: 8, 7, 8, 7, 8, 7, 8, 7  (total 60)
    ! Senales necesarias (EIO_paletizado.cfg):
    !   doNewBox  -> crea una caja nueva en el conveyor (Smart Component Source)
    !   doVacuum  -> 1 = coge la caja (Attacher), 0 = la suelta (Detacher)
    !***********************************************************

    ! Garra de vacio: TCP en la cara de las ventosas, Z hacia abajo
    PERS tooldata tGarra := [TRUE,[[0,0,250],[1,0,0,0]],[40,[0,0,125],[1,0,0,0],0,0,0]];
    ! Carga de una caja, centro de gravedad en el centro de la caja (bajo el TCP)
    PERS loaddata lCaja := [15,[0,0,125],[1,0,0,0],0,0,0];

    ! Pallet: origen en la esquina del pallet a nivel de suelo
    TASK PERS wobjdata wPallet := [FALSE,TRUE,"",[[1750,-600,0],[0.707107,0,0,0.707107]],[[0,0,0],[1,0,0,0]]];
    ! Conveyor: origen en el punto de pick sobre la cinta, X en el sentido de avance
    TASK PERS wobjdata wConveyor := [FALSE,TRUE,"",[[800,1200,800],[1,0,0,0]],[[0,0,0],[1,0,0,0]]];

    CONST jointtarget jHome := [[0,0,0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
    ! Pick: TCP en la cara superior de la caja
    CONST robtarget pPick := [[0,0,250],[0,1,0,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
    ! Plantilla de place; la posicion y el giro se rellenan desde nPlace
    CONST robtarget pPlaceBase := [[0,0,0],[0,1,0,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];

    CONST num nAprox := 300;
    CONST num nTotal := 60;
    ! Posiciones de place en wPallet: [x, y, z TCP, giro garra en grados]
    CONST num nPlace{60,4} := [
    ! capa 1 (mosaico A)
    [150,200,394,-90],
    [1050,200,394,-90],
    [450,200,394,-90],
    [750,200,394,-90],
    [150,600,394,-90],
    [1050,600,394,-90],
    [450,600,394,-90],
    [750,600,394,-90],
    ! capa 2 (mosaico B)
    [200,200,644,0],
    [1000,200,644,0],
    [600,200,644,0],
    [150,550,644,-90],
    [1050,550,644,-90],
    [450,550,644,-90],
    [750,550,644,-90],
    ! capa 3 (mosaico A)
    [150,200,894,-90],
    [1050,200,894,-90],
    [450,200,894,-90],
    [750,200,894,-90],
    [150,600,894,-90],
    [1050,600,894,-90],
    [450,600,894,-90],
    [750,600,894,-90],
    ! capa 4 (mosaico B')
    [1050,250,1144,-90],
    [150,250,1144,-90],
    [750,250,1144,-90],
    [450,250,1144,-90],
    [1000,600,1144,0],
    [200,600,1144,0],
    [600,600,1144,0],
    ! capa 5 (mosaico A)
    [150,200,1394,-90],
    [1050,200,1394,-90],
    [450,200,1394,-90],
    [750,200,1394,-90],
    [150,600,1394,-90],
    [1050,600,1394,-90],
    [450,600,1394,-90],
    [750,600,1394,-90],
    ! capa 6 (mosaico B)
    [200,200,1644,0],
    [1000,200,1644,0],
    [600,200,1644,0],
    [150,550,1644,-90],
    [1050,550,1644,-90],
    [450,550,1644,-90],
    [750,550,1644,-90],
    ! capa 7 (mosaico A)
    [150,200,1894,-90],
    [1050,200,1894,-90],
    [450,200,1894,-90],
    [750,200,1894,-90],
    [150,600,1894,-90],
    [1050,600,1894,-90],
    [450,600,1894,-90],
    [750,600,1894,-90],
    ! capa 8 (mosaico B')
    [1050,250,2144,-90],
    [150,250,2144,-90],
    [750,250,2144,-90],
    [450,250,2144,-90],
    [1000,600,2144,0],
    [200,600,2144,0],
    [600,600,2144,0]
    ];

    PROC main()
        ConfJ\Off;
        ConfL\Off;
        Reset doVacuum;
        GripLoad load0;
        MoveAbsJ jHome\NoEOffs, v2000, z50, tGarra;
        FOR i FROM 1 TO nTotal DO
            CogerCaja;
            DejarCaja i;
        ENDFOR
        MoveAbsJ jHome\NoEOffs, v2000, z50, tGarra;
        TPWrite "Pallet completo: " \Num:=nTotal;
    ENDPROC

    PROC CogerCaja()
        PulseDO\PLength:=0.2, doNewBox;
        MoveJ Offs(pPick,0,0,nAprox), v2000, z50, tGarra\WObj:=wConveyor;
        MoveL pPick, v300, fine, tGarra\WObj:=wConveyor;
        Set doVacuum;
        GripLoad lCaja;
        WaitTime 0.2;
        MoveL Offs(pPick,0,0,nAprox), v1000, z50, tGarra\WObj:=wConveyor;
    ENDPROC

    PROC DejarCaja(num idx)
        VAR robtarget pT;
        pT := pPlaceBase;
        pT.trans := [nPlace{idx,1}, nPlace{idx,2}, nPlace{idx,3}];
        pT.rot := OrientZYX(nPlace{idx,4}, 0, 180);
        MoveJ Offs(pT,0,0,nAprox), v2000, z50, tGarra\WObj:=wPallet;
        MoveL pT, v300, fine, tGarra\WObj:=wPallet;
        Reset doVacuum;
        GripLoad load0;
        WaitTime 0.2;
        MoveL Offs(pT,0,0,nAprox), v1000, z50, tGarra\WObj:=wPallet;
    ENDPROC
ENDMODULE
