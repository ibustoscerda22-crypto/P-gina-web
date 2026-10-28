import Foundation

enum Categoria: String, CaseIterable, Identifiable {
    case empuje = "Empuje"
    case traccion = "Tracción"
    case piernas = "Piernas"
    case core = "Core"
    case movilidad = "Movilidad"

    var id: String { rawValue }

    var icono: String {
        switch self {
        case .empuje: return "figure.strengthtraining.functional"
        case .traccion: return "figure.climbing"
        case .piernas: return "figure.step.training"
        case .core: return "figure.core.training"
        case .movilidad: return "figure.flexibility"
        }
    }
}

struct Ejercicio: Identifiable, Hashable {
    let id: String
    let nombre: String
    let categoria: Categoria
    let resumen: String
    let musculos: [String]
    let pasos: [String]
    let errores: [String]
    var masFacil: String? = nil
    var masDificil: String? = nil
}

enum Medida: Hashable {
    case reps(Int)
    case segundos(Int)

    var texto: String {
        switch self {
        case .reps(let n): return "\(n) reps"
        case .segundos(let s): return "\(s) s"
        }
    }
}

/// Un ejercicio dentro de una rutina: cuántas series, de cuánto y cuánto descanso.
struct Bloque: Identifiable, Hashable {
    let id = UUID()
    let ejercicioID: String
    let series: Int
    let medida: Medida
    let descanso: Int
    var porLado: Bool = false

    var ejercicio: Ejercicio { Catalogo.ejercicio(ejercicioID) }

    var texto: String {
        let base = series > 1 ? "\(series) × \(medida.texto)" : medida.texto
        return porLado ? base + " por lado" : base
    }
}

struct Rutina: Identifiable, Hashable {
    let id: String
    let nombre: String
    let nivel: Int
    let enfoque: String
    let bloques: [Bloque]

    var minutosEstimados: Int {
        let segundos = bloques.reduce(0) { total, bloque in
            let trabajo: Int
            switch bloque.medida {
            case .reps(let n): trabajo = n * 3
            case .segundos(let s): trabajo = s
            }
            let lados = bloque.porLado ? 2 : 1
            return total + bloque.series * (trabajo * lados + bloque.descanso)
        }
        return max(5, Int((Double(segundos) / 60).rounded()))
    }
}

struct Nivel: Identifiable {
    let id: Int
    let nombre: String
    let semanas: String
    let descripcion: String
    let rutinas: [Rutina]
}

enum Sensacion: String, Codable, CaseIterable, Identifiable {
    case facil = "Fácil"
    case bien = "Bien"
    case dificil = "Difícil"

    var id: String { rawValue }

    var emoji: String {
        switch self {
        case .facil: return "😎"
        case .bien: return "💪"
        case .dificil: return "🥵"
        }
    }
}

struct Sesion: Codable, Identifiable {
    var id = UUID()
    let rutinaID: String
    let rutinaNombre: String
    let nivel: Int
    let fecha: Date
    let duracion: Int
    let sensacion: Sensacion
}
