import SwiftUI
import UIKit

/// Cada pantalla del entrenamiento guiado.
enum Paso {
    case preparacion(segundos: Int, primero: Ejercicio)
    case ejercicio(Ejercicio, medida: Medida, porLado: Bool, serie: Int, total: Int, lado: String?)
    case descanso(segundos: Int, siguiente: Ejercicio)

    /// Segundos de cuenta regresiva, o nil si el paso termina cuando el usuario toca "Hecho".
    var duracion: Int? {
        switch self {
        case .preparacion(let segundos, _):
            return segundos
        case .descanso(let segundos, _):
            return segundos
        case .ejercicio(_, let medida, _, _, _, _):
            if case .segundos(let segundos) = medida { return segundos }
            return nil
        }
    }

    var esEjercicio: Bool {
        if case .ejercicio = self { return true }
        return false
    }

    static func construir(_ rutina: Rutina) -> [Paso] {
        let bloques = rutina.bloques
        guard let primero = bloques.first else { return [] }
        var pasos: [Paso] = [.preparacion(segundos: 10, primero: primero.ejercicio)]

        for (i, bloque) in bloques.enumerated() {
            let ejercicio = bloque.ejercicio
            var porTiempo = false
            if case .segundos = bloque.medida { porTiempo = true }
            // Los ejercicios por tiempo y por lado se separan en dos pantallas.
            let lados: [String?] = (bloque.porLado && porTiempo) ? ["Lado derecho", "Lado izquierdo"] : [nil]

            for serie in 1...bloque.series {
                for (j, lado) in lados.enumerated() {
                    if j > 0 {
                        pasos.append(.descanso(segundos: 5, siguiente: ejercicio))
                    }
                    pasos.append(.ejercicio(
                        ejercicio,
                        medida: bloque.medida,
                        porLado: bloque.porLado && !porTiempo,
                        serie: serie,
                        total: bloque.series,
                        lado: lado
                    ))
                }
                let ultimaSerie = serie == bloque.series
                if ultimaSerie && i == bloques.count - 1 { continue }
                guard bloque.descanso > 0 else { continue }
                let siguiente = ultimaSerie ? bloques[i + 1].ejercicio : ejercicio
                pasos.append(.descanso(segundos: bloque.descanso, siguiente: siguiente))
            }
        }
        return pasos
    }
}

struct EntrenamientoView: View {
    let rutina: Rutina

    @EnvironmentObject private var progreso: ProgresoStore
    @Environment(\.dismiss) private var dismiss

    @State private var pasos: [Paso]
    @State private var indice = 0
    @State private var restante: Int
    @State private var totalPaso: Int
    @State private var pausado = false
    @State private var inicio = Date()
    @State private var duracion = 0
    @State private var terminado = false
    @State private var confirmarSalida = false
    @State private var tecnica: Ejercicio?
    @State private var sensacion: Sensacion = .bien

    private let reloj = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    init(rutina: Rutina) {
        self.rutina = rutina
        let pasos = Paso.construir(rutina)
        let primera = pasos.first?.duracion ?? 0
        _pasos = State(initialValue: pasos)
        _restante = State(initialValue: primera)
        _totalPaso = State(initialValue: primera)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if terminado {
                    resumen
                } else if indice < pasos.count {
                    ProgressView(value: Double(indice), total: Double(pasos.count))
                        .padding(.horizontal)
                        .padding(.top, 8)
                    contenido(pasos[indice])
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .padding()
                }
            }
            .navigationTitle(terminado ? "" : rutina.nombre)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        if terminado {
                            dismiss()
                        } else {
                            pausado = true
                            confirmarSalida = true
                        }
                    } label: {
                        Image(systemName: "xmark")
                    }
                }
            }
            .confirmationDialog("¿Salir del entrenamiento?", isPresented: $confirmarSalida, titleVisibility: .visible) {
                Button("Salir sin guardar", role: .destructive) { dismiss() }
                Button("Seguir entrenando", role: .cancel) { pausado = false }
            }
            .sheet(item: $tecnica) { ejercicio in
                NavigationStack {
                    EjercicioDetalleView(ejercicio: ejercicio)
                        .toolbar {
                            ToolbarItem(placement: .confirmationAction) {
                                Button("Listo") { tecnica = nil }
                            }
                        }
                }
            }
        }
        .onReceive(reloj) { _ in tick() }
        .onAppear { UIApplication.shared.isIdleTimerDisabled = true }
        .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
    }

    // MARK: - Pantallas

    @ViewBuilder
    private func contenido(_ paso: Paso) -> some View {
        switch paso {
        case .preparacion(_, let primero):
            VStack(spacing: 24) {
                Spacer()
                Text("Prepárate")
                    .font(.largeTitle.bold())
                AnilloTiempo(restante: restante, total: totalPaso, color: .blue)
                Text("Primero: \(primero.nombre)")
                    .font(.title3)
                    .foregroundStyle(.secondary)
                Spacer()
                Button {
                    avanzar()
                } label: {
                    Text("Empezar ya").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            }

        case .ejercicio(let ejercicio, let medida, let porLado, let serie, let total, let lado):
            VStack(spacing: 16) {
                Text("SERIE \(serie) DE \(total)")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.orange)
                IconoEjercicio(categoria: ejercicio.categoria, tamano: 80)
                Text(ejercicio.nombre)
                    .font(.largeTitle.bold())
                    .multilineTextAlignment(.center)
                if let lado {
                    Text(lado)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.orange)
                }
                Spacer()
                switch medida {
                case .reps(let n):
                    VStack(spacing: 0) {
                        Text("\(n)")
                            .font(.system(size: 110, weight: .bold, design: .rounded))
                        Text(porLado ? "repeticiones por lado" : "repeticiones")
                            .font(.title3)
                            .foregroundStyle(.secondary)
                    }
                case .segundos:
                    AnilloTiempo(restante: restante, total: totalPaso, color: .orange)
                }
                Spacer()
                Button {
                    pausado = true
                    tecnica = ejercicio
                } label: {
                    Label("Ver técnica", systemImage: "info.circle")
                }
                if case .reps = medida {
                    Button {
                        avanzar()
                    } label: {
                        Label("¡Hecho!", systemImage: "checkmark")
                            .font(.title3.bold())
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                } else {
                    controlesTiempo(textoTerminar: "Terminar serie")
                }
            }

        case .descanso(_, let siguiente):
            VStack(spacing: 24) {
                Spacer()
                Text("Descansa")
                    .font(.largeTitle.bold())
                AnilloTiempo(restante: restante, total: totalPaso, color: .green)
                VStack(spacing: 4) {
                    Text("Siguiente")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text(siguiente.nombre)
                        .font(.title2.weight(.semibold))
                }
                Spacer()
                Button {
                    restante += 15
                    totalPaso += 15
                } label: {
                    Label("+15 s", systemImage: "plus")
                }
                .buttonStyle(.bordered)
                controlesTiempo(textoTerminar: "Saltar descanso")
            }
        }
    }

    private func controlesTiempo(textoTerminar: String) -> some View {
        HStack(spacing: 12) {
            Button {
                pausado.toggle()
            } label: {
                Image(systemName: pausado ? "play.fill" : "pause.fill")
                    .font(.title3)
                    .frame(width: 56)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)

            Button {
                avanzar()
            } label: {
                Text(textoTerminar)
                    .font(.headline)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
    }

    private var seriesTotales: Int {
        pasos.filter { $0.esEjercicio }.count
    }

    private var resumen: some View {
        ScrollView {
            VStack(spacing: 20) {
                Image(systemName: "trophy.fill")
                    .font(.system(size: 72))
                    .foregroundStyle(.yellow)
                    .padding(.top, 32)
                Text("¡Entrenamiento completado!")
                    .font(.title.bold())
                    .multilineTextAlignment(.center)
                Text(rutina.nombre)
                    .font(.title3)
                    .foregroundStyle(.secondary)

                HStack(spacing: 12) {
                    TarjetaDato(titulo: "Tiempo", valor: "\(max(1, duracion / 60)) min", icono: "clock.fill", color: .green)
                    TarjetaDato(titulo: "Series", valor: "\(seriesTotales)", icono: "repeat", color: .orange)
                }

                Text("¿Cómo te sentiste?")
                    .font(.headline)
                    .padding(.top, 8)
                HStack(spacing: 12) {
                    ForEach(Sensacion.allCases) { opcion in
                        Button {
                            sensacion = opcion
                        } label: {
                            VStack(spacing: 4) {
                                Text(opcion.emoji).font(.largeTitle)
                                Text(opcion.rawValue).font(.subheadline.weight(.semibold))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(
                                sensacion == opcion ? Color.orange.opacity(0.2) : Color(.secondarySystemBackground),
                                in: RoundedRectangle(cornerRadius: 12)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(sensacion == opcion ? Color.orange : Color.clear, lineWidth: 2)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                Text(mensajeSensacion)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)

                Button {
                    progreso.registrar(rutina, duracion: duracion, sensacion: sensacion)
                    dismiss()
                } label: {
                    Text("Guardar entrenamiento")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .padding(.top, 8)
            }
            .padding()
        }
    }

    private var mensajeSensacion: String {
        switch sensacion {
        case .facil: return "Genial. Si se repite, la app te sugerirá subir de nivel."
        case .bien: return "Ese es el punto justo: exigente pero con buena técnica."
        case .dificil: return "Normal al comienzo. Usa las versiones más fáciles y repite el nivel."
        }
    }

    // MARK: - Lógica del reloj

    private func tick() {
        guard !terminado, !pausado, indice < pasos.count, pasos[indice].duracion != nil else { return }
        if restante > 1 {
            restante -= 1
            if restante <= 3 { Haptica.toque() }
        } else {
            avanzar()
        }
    }

    private func avanzar() {
        Haptica.exito()
        pausado = false
        if indice + 1 < pasos.count {
            indice += 1
            restante = pasos[indice].duracion ?? 0
            totalPaso = restante
        } else {
            duracion = Int(Date().timeIntervalSince(inicio))
            terminado = true
        }
    }
}

struct AnilloTiempo: View {
    let restante: Int
    let total: Int
    let color: Color

    private var fraccion: CGFloat {
        guard total > 0 else { return 0 }
        return CGFloat(restante) / CGFloat(total)
    }

    private var texto: String {
        restante >= 60 ? String(format: "%d:%02d", restante / 60, restante % 60) : "\(restante)"
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(color.opacity(0.2), lineWidth: 16)
            Circle()
                .trim(from: 0, to: fraccion)
                .stroke(color, style: StrokeStyle(lineWidth: 16, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.linear(duration: 1), value: restante)
            Text(texto)
                .font(.system(size: 64, weight: .bold, design: .rounded))
                .monospacedDigit()
        }
        .frame(width: 220, height: 220)
    }
}

enum Haptica {
    static func exito() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    static func toque() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
}
