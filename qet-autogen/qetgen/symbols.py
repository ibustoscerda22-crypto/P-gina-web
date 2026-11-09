"""Alias en español de los símbolos de la biblioteca oficial de QElectroTech.

Para usar otro símbolo basta con cambiar la ruta (relativa a la carpeta `elements`
de QElectroTech o a `qetgen/elementos`). Si tus planos de referencia usan símbolos
propios, cópialos a `qetgen/elementos/` y agrega aquí un alias.
"""

_A = "10_electric/10_allpole/"
_RC = _A + "310_relays_contactors_contacts/"
_XR = _RC + "02_contacts_cross_referencing/"
_PROT = _A + "200_fuses_protective_gears/"
_SIG = _A + "380_signaling_operating/"

SYMBOLS = {
    # Alimentación
    "fuente_3f_n_pe": _A + "110_network_supplies/src_3p_pe_n.elmt",
    # Referencias entre folios
    "flecha_entrada": _A + "100_folio_referencing/01coming_arrow.elmt",
    "flecha_salida": _A + "100_folio_referencing/02going_arrow.elmt",
    # Protecciones
    "interruptor_4p": _PROT + "11_circuit_breakers/disjonct-m_4fn.elmt",
    "interruptor_3p": _PROT + "11_circuit_breakers/disjonct-m_3f.elmt",
    "interruptor_1p_n": _PROT + "11_circuit_breakers/disjonct-m_1fn.elmt",
    "interruptor_1p": _PROT + "11_circuit_breakers/disjonct-m_1f.elmt",
    "guardamotor": _PROT + "12_magneto_thermal_circuit_breakers/gv2p.elmt",
    "rele_termico": _PROT + "30_thermal_relays/relais_therm4_wide.elmt",
    # Contactores y relés
    "contactor_3p": _XR + "02_power_contacts/com_puiss4.elmt",
    "bobina": _RC + "01_coils/bobine3.elmt",
    "bobina_temporizada": _RC + "01_coils/bobine_tempo_travail.elmt",
    "contacto_na": _XR + "01_auxiliary_contacts/con_simple.elmt",
    "contacto_nc": _XR + "01_auxiliary_contacts/con_simple_nf.elmt",
    "contacto_na_temporizado": _XR + "11_delayed_contacts/con_simple_tmp_t.elmt",
    "contacto_nc_temporizado": _XR + "11_delayed_contacts/con_simple_nf_tmp_t.elmt",
    "contacto_termico_nc": _XR + "15_protection_contacts/act_thermique_nf_esclave.elmt",
    "contacto_guardamotor_nc": _XR + "15_protection_contacts/contact_gv_nf.elmt",
    "contacto_guardamotor_na": _XR + "15_protection_contacts/contact_gv_no.elmt",
    "contacto_termico_na": _XR + "15_protection_contacts/act_termique_no_esclave.elmt",
    # Mando y señalización
    "pulsador_na": _SIG + "20_push_buttons/poussoir.elmt",
    "pulsador_nc": _SIG + "20_push_buttons/poussoir_nf.elmt",
    "parada_emergencia": _SIG + "20_push_buttons/au.elmt",
    "selector": _SIG + "21_selector_switches/commut_2_position_fixe.elmt",
    "lampara": _SIG + "11_optical_signaling/lampe2.elmt",
    "baliza": _SIG + "11_optical_signaling/voyant_flash.elmt",
    # Cargas
    "motor_3f": _A + "391_consumers_actuators/10_engines/moteur_tri_1.elmt",
    "motor_3f_6bornes": _A + "391_consumers_actuators/10_engines/moteur_tri_de.elmt",
    "electrovalvula": _A + "391_consumers_actuators/20_valves/electrovanne.elmt",
    # Símbolos propios (qetgen/elementos/99_qetgen, ver herramientas/crear_simbolos.py)
    "variador": "99_qetgen/variador.elmt",
    "partidor_suave": "99_qetgen/partidor_suave.elmt",
    "borne_equipo_salida": "99_qetgen/borne_equipo_salida.elmt",
    "borne_equipo_entrada": "99_qetgen/borne_equipo_entrada.elmt",
}


def sym(name: str) -> str:
    """Devuelve la ruta del símbolo; acepta un alias o directamente una ruta .elmt."""
    if name.endswith(".elmt"):
        return name
    try:
        return SYMBOLS[name]
    except KeyError as exc:
        raise KeyError(f"Símbolo desconocido '{name}'. Disponibles: {', '.join(sorted(SYMBOLS))}") from exc
