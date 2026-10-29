import SwiftUI

struct ProgresoView: View {
    @EnvironmentObject private var progreso: ProgresoStore
    @State private var confirmarReinicio = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                        TarjetaDato(titulo: "Entrenamientos", valor: "\(progreso.sesiones.count)", icono: "checkmark.seal.fill", color: .orange)
                        TarjetaDato(titulo: "Esta semana", valor: "\(progreso.sesionesEstaSemana)/\(progreso.metaSemanal)", icono: "calendar", color: .blue)
                        TarjetaDato(titulo: "Racha (semanas)", valor: "\(progreso.rachaSemanas)", icono: "flame.fill", color: .red)
                        TarjetaDato(titulo: "Minutos", valor: "\(progreso.minutosTotales)", icono: "clock.fill", color: .green)
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                }

                Section {
                    SemanaResumen()
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }

                Section {
                    Picker("Nivel actual", selection: $progreso.nivel) {
                        ForEach(Catalogo.niveles) { nivel in
                            Text("\(nivel.id) · \(nivel.nombre)").tag(nivel.id)
                        }
                    }
                } header: {
                    Text("Tu nivel")
                } footer: {
                    Text("La meta es \(progreso.metaSemanal) entrenamientos por semana. La racha cuenta las semanas seguidas en que la cumples.")
                }

                Section("Historial") {
                    if progreso.sesiones.isEmpty {
                        Text("Aún no hay entrenamientos. ¡El primero es el más importante!")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(progreso.sesiones) { sesion in
                            FilaSesion(sesion: sesion)
                        }
                        .onDelete { posiciones in
                            let aBorrar = posiciones.map { progreso.sesiones[$0] }
                            aBorrar.forEach { progreso.borrar($0) }
                        }
                    }
                }

                if !progreso.sesiones.isEmpty {
                    Section {
                        Button("Borrar todo el progreso", role: .destructive) {
                            confirmarReinicio = true
                        }
                    }
                }
            }
            .navigationTitle("Progreso")
            .confirmationDialog("¿Borrar todo el progreso?", isPresented: $confirmarReinicio, titleVisibility: .visible) {
                Button("Borrar todo", role: .destructive) { progreso.reiniciar() }
                Button("Cancelar", role: .cancel) {}
            } message: {
                Text("Se eliminará el historial y volverás al nivel 1.")
            }
        }
    }
}

struct FilaSesion: View {
    let sesion: Sesion

    var body: some View {
        HStack(spacing: 12) {
            Text(sesion.sensacion.emoji)
                .font(.title2)
            VStack(alignment: .leading, spacing: 2) {
                Text(sesion.rutinaNombre)
                    .font(.body.weight(.semibold))
                Text("Nivel \(sesion.nivel) · \(max(1, sesion.duracion / 60)) min · \(sesion.sensacion.rawValue)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(sesion.fecha.formatted(.dateTime.day().month(.abbreviated)))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}

struct TarjetaDato: View {
    let titulo: String
    let valor: String
    let icono: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icono)
                .foregroundStyle(color)
            Text(valor)
                .font(.title.bold())
                .monospacedDigit()
            Text(titulo)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }
}
