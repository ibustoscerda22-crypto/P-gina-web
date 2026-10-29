import Foundation

/// Guarda el historial de entrenamientos y el nivel actual en el teléfono (UserDefaults).
@MainActor
final class ProgresoStore: ObservableObject {
    @Published private(set) var sesiones: [Sesion] = []
    @Published var nivel: Int {
        didSet { UserDefaults.standard.set(nivel, forKey: Self.claveNivel) }
    }

    let metaSemanal = 3

    private static let claveSesiones = "sesiones"
    private static let claveNivel = "nivel"

    init() {
        let guardado = UserDefaults.standard.integer(forKey: Self.claveNivel)
        nivel = guardado == 0 ? 1 : guardado
        if let data = UserDefaults.standard.data(forKey: Self.claveSesiones),
           let decodificadas = try? JSONDecoder().decode([Sesion].self, from: data) {
            sesiones = decodificadas
        }
    }

    // MARK: - Acciones

    func registrar(_ rutina: Rutina, duracion: Int, sensacion: Sensacion) {
        let sesion = Sesion(
            rutinaID: rutina.id,
            rutinaNombre: rutina.nombre,
            nivel: rutina.nivel,
            fecha: Date(),
            duracion: duracion,
            sensacion: sensacion
        )
        sesiones.insert(sesion, at: 0)
        guardar()
    }

    func borrar(_ sesion: Sesion) {
        sesiones.removeAll { $0.id == sesion.id }
        guardar()
    }

    func reiniciar() {
        sesiones = []
        nivel = 1
        guardar()
    }

    private func guardar() {
        if let data = try? JSONEncoder().encode(sesiones) {
            UserDefaults.standard.set(data, forKey: Self.claveSesiones)
        }
    }

    // MARK: - Cálculos

    var calendario: Calendar {
        var calendario = Calendar.current
        calendario.firstWeekday = 2 // la semana parte el lunes
        return calendario
    }

    func sesiones(enSemanaDe fecha: Date) -> [Sesion] {
        guard let semana = calendario.dateInterval(of: .weekOfYear, for: fecha) else { return [] }
        return sesiones.filter { semana.contains($0.fecha) }
    }

    var sesionesEstaSemana: Int { sesiones(enSemanaDe: Date()).count }

    /// Los 7 días de la semana actual (lunes a domingo) y si se entrenó cada uno.
    var diasEstaSemana: [DiaSemana] {
        let letras = ["L", "M", "X", "J", "V", "S", "D"]
        guard let inicio = calendario.dateInterval(of: .weekOfYear, for: Date())?.start else { return [] }
        return (0..<7).map { i in
            let dia = calendario.date(byAdding: .day, value: i, to: inicio) ?? inicio
            let entrenado = sesiones.contains { calendario.isDate($0.fecha, inSameDayAs: dia) }
            return DiaSemana(id: i, letra: letras[i], entrenado: entrenado, esHoy: calendario.isDateInToday(dia))
        }
    }

    /// Semanas seguidas cumpliendo la meta. La semana en curso solo suma si ya se cumplió.
    var rachaSemanas: Int {
        var racha = 0
        var fecha = Date()
        if sesiones(enSemanaDe: fecha).count < metaSemanal {
            fecha = calendario.date(byAdding: .weekOfYear, value: -1, to: fecha) ?? fecha
        }
        while sesiones(enSemanaDe: fecha).count >= metaSemanal {
            racha += 1
            guard let anterior = calendario.date(byAdding: .weekOfYear, value: -1, to: fecha) else { break }
            fecha = anterior
        }
        return racha
    }

    var minutosTotales: Int {
        sesiones.reduce(0) { $0 + $1.duracion } / 60
    }

    /// Alterna A y B dentro del nivel actual.
    var siguienteRutina: Rutina {
        let rutinas = Catalogo.nivel(nivel).rutinas
        guard let ultima = sesiones.first(where: { $0.nivel == nivel }),
              let i = rutinas.firstIndex(where: { $0.id == ultima.rutinaID }) else {
            return rutinas[0]
        }
        return rutinas[(i + 1) % rutinas.count]
    }

    var sesionesEnNivelActual: Int {
        sesiones.filter { $0.nivel == nivel }.count
    }

    /// Sugiere subir de nivel tras 6 sesiones si las 3 últimas no fueron difíciles.
    var sugerirSubirNivel: Bool {
        guard nivel < Catalogo.niveles.count else { return false }
        let delNivel = sesiones.filter { $0.nivel == nivel }
        guard delNivel.count >= 6 else { return false }
        return !delNivel.prefix(3).contains { $0.sensacion == .dificil }
    }
}

struct DiaSemana: Identifiable {
    let id: Int
    let letra: String
    let entrenado: Bool
    let esHoy: Bool
}
