import SwiftUI

struct RutinaDetalleView: View {
    let rutina: Rutina
    @State private var rutinaActiva: Rutina?

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Nivel \(rutina.nivel) · \(Catalogo.nivel(rutina.nivel).nombre)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text(rutina.enfoque)
                        .font(.headline)
                    HStack(spacing: 16) {
                        Label("\(rutina.minutosEstimados) min aprox.", systemImage: "clock")
                        Label("\(rutina.bloques.count) ejercicios", systemImage: "list.bullet")
                    }
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
            }

            Section("Ejercicios") {
                ForEach(rutina.bloques) { bloque in
                    NavigationLink {
                        EjercicioDetalleView(ejercicio: bloque.ejercicio)
                    } label: {
                        HStack(spacing: 12) {
                            IconoEjercicio(categoria: bloque.ejercicio.categoria, tamano: 40)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(bloque.ejercicio.nombre)
                                    .font(.body.weight(.semibold))
                                Text(bloque.texto)
                                    .font(.subheadline)
                                    .foregroundStyle(.orange)
                                Text("Descanso \(bloque.descanso) s")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }

            Section {
                Text("Los dos primeros ejercicios son de calentamiento. Toca cualquier ejercicio para ver cómo se hace y sus versiones más fáciles o difíciles.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle(rutina.nombre)
        .safeAreaInset(edge: .bottom) {
            Button {
                rutinaActiva = rutina
            } label: {
                Label("Empezar entrenamiento", systemImage: "play.fill")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .padding()
            .background(.bar)
        }
        .fullScreenCover(item: $rutinaActiva) { rutina in
            EntrenamientoView(rutina: rutina)
        }
    }
}

struct IconoEjercicio: View {
    let categoria: Categoria
    var tamano: CGFloat = 44

    var body: some View {
        Image(systemName: categoria.icono)
            .font(.system(size: tamano * 0.5))
            .foregroundStyle(.orange)
            .frame(width: tamano, height: tamano)
            .background(Color.orange.opacity(0.15), in: RoundedRectangle(cornerRadius: tamano * 0.25))
    }
}
