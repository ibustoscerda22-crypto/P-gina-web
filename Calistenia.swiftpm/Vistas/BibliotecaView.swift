import SwiftUI

struct BibliotecaView: View {
    @State private var busqueda = ""

    private func ejercicios(de categoria: Categoria) -> [Ejercicio] {
        Catalogo.ejercicios.filter { ejercicio in
            ejercicio.categoria == categoria &&
            (busqueda.isEmpty || ejercicio.nombre.localizedCaseInsensitiveContains(busqueda))
        }
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(Categoria.allCases) { categoria in
                    let lista = ejercicios(de: categoria)
                    if !lista.isEmpty {
                        Section(categoria.rawValue) {
                            ForEach(lista) { ejercicio in
                                NavigationLink {
                                    EjercicioDetalleView(ejercicio: ejercicio)
                                } label: {
                                    HStack(spacing: 12) {
                                        IconoEjercicio(categoria: ejercicio.categoria, tamano: 36)
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(ejercicio.nombre).font(.body.weight(.semibold))
                                            Text(ejercicio.musculos.joined(separator: ", "))
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .searchable(text: $busqueda, prompt: "Buscar ejercicio")
            .navigationTitle("Ejercicios")
        }
    }
}

struct EjercicioDetalleView: View {
    let ejercicio: Ejercicio

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack(spacing: 16) {
                    IconoEjercicio(categoria: ejercicio.categoria, tamano: 72)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(ejercicio.categoria.rawValue.uppercased())
                            .font(.caption.bold())
                            .foregroundStyle(.orange)
                        Text(ejercicio.musculos.joined(separator: " · "))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }

                Text(ejercicio.resumen)
                    .font(.body)

                VStack(alignment: .leading, spacing: 12) {
                    Text("Cómo se hace").font(.title3.bold())
                    ForEach(Array(ejercicio.pasos.enumerated()), id: \.offset) { indice, paso in
                        HStack(alignment: .top, spacing: 12) {
                            Text("\(indice + 1)")
                                .font(.subheadline.bold())
                                .foregroundStyle(.white)
                                .frame(width: 26, height: 26)
                                .background(.orange, in: Circle())
                            Text(paso)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }

                if !ejercicio.errores.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Errores comunes").font(.title3.bold())
                        ForEach(ejercicio.errores, id: \.self) { error in
                            HStack(alignment: .top, spacing: 10) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundStyle(.yellow)
                                Text(error)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                }

                let facil = Catalogo.ejercicioOpcional(ejercicio.masFacil)
                let dificil = Catalogo.ejercicioOpcional(ejercicio.masDificil)
                if facil != nil || dificil != nil {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Progresión").font(.title3.bold())
                        if let facil {
                            enlaceProgresion(facil, titulo: "Más fácil", icono: "arrow.down.circle.fill", color: .green)
                        }
                        if let dificil {
                            enlaceProgresion(dificil, titulo: "Siguiente paso", icono: "arrow.up.circle.fill", color: .orange)
                        }
                    }
                }
            }
            .padding()
        }
        .navigationTitle(ejercicio.nombre)
        .navigationBarTitleDisplayMode(.large)
    }

    private func enlaceProgresion(_ otro: Ejercicio, titulo: String, icono: String, color: Color) -> some View {
        NavigationLink {
            EjercicioDetalleView(ejercicio: otro)
        } label: {
            HStack(spacing: 12) {
                Image(systemName: icono)
                    .font(.title2)
                    .foregroundStyle(color)
                VStack(alignment: .leading, spacing: 2) {
                    Text(titulo).font(.caption).foregroundStyle(.secondary)
                    Text(otro.nombre).font(.body.weight(.semibold)).foregroundStyle(.primary)
                }
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(.tertiary)
            }
            .padding()
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
        }
    }
}
