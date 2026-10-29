import SwiftUI

struct EntrenarView: View {
    @EnvironmentObject private var progreso: ProgresoStore
    @State private var rutinaActiva: Rutina?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    SemanaResumen()

                    if progreso.sugerirSubirNivel {
                        bannerSubirNivel
                    }

                    tarjetaHoy

                    ForEach(Catalogo.niveles) { nivel in
                        seccionNivel(nivel)
                    }

                    consejos
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Calistenia")
        }
        .fullScreenCover(item: $rutinaActiva) { rutina in
            EntrenamientoView(rutina: rutina)
        }
    }

    private var tarjetaHoy: some View {
        let rutina = progreso.siguienteRutina
        let nivel = Catalogo.nivel(rutina.nivel)
        return VStack(alignment: .leading, spacing: 12) {
            Text("TOCA HOY")
                .font(.caption.weight(.bold))
                .foregroundStyle(.white.opacity(0.8))
            Text(rutina.nombre)
                .font(.title.bold())
                .foregroundStyle(.white)
            Text("Nivel \(nivel.id) · \(nivel.nombre) · \(rutina.enfoque)")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.9))
            HStack(spacing: 16) {
                Label("\(rutina.minutosEstimados) min", systemImage: "clock")
                Label("\(rutina.bloques.count) ejercicios", systemImage: "list.bullet")
            }
            .font(.footnote.weight(.medium))
            .foregroundStyle(.white)

            HStack {
                Button {
                    rutinaActiva = rutina
                } label: {
                    Label("Empezar", systemImage: "play.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(.white, in: RoundedRectangle(cornerRadius: 12))
                        .foregroundStyle(.orange)
                }
                NavigationLink {
                    RutinaDetalleView(rutina: rutina)
                } label: {
                    Image(systemName: "info.circle")
                        .font(.title2)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8)
                }
            }
            .padding(.top, 4)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(colors: [.orange, .red.opacity(0.85)], startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 20)
        )
    }

    private var bannerSubirNivel: some View {
        HStack(spacing: 12) {
            Image(systemName: "arrow.up.circle.fill")
                .font(.largeTitle)
                .foregroundStyle(.green)
            VStack(alignment: .leading, spacing: 4) {
                Text("¡Estás listo para subir de nivel!")
                    .font(.headline)
                Text("Llevas \(progreso.sesionesEnNivelActual) sesiones y ya no te cuestan tanto.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Button("Pasar al nivel \(progreso.nivel + 1)") {
                    withAnimation { progreso.nivel += 1 }
                }
                .font(.subheadline.bold())
                .padding(.top, 2)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }

    private func seccionNivel(_ nivel: Nivel) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Nivel \(nivel.id): \(nivel.nombre)")
                    .font(.title3.bold())
                if nivel.id == progreso.nivel {
                    Text("ACTUAL")
                        .font(.caption2.bold())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(.orange, in: Capsule())
                        .foregroundStyle(.white)
                }
                Spacer()
                Text(nivel.semanas)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Text(nivel.descripcion)
                .font(.subheadline)
                .foregroundStyle(.secondary)

            VStack(spacing: 0) {
                ForEach(nivel.rutinas) { rutina in
                    NavigationLink {
                        RutinaDetalleView(rutina: rutina)
                    } label: {
                        FilaRutina(rutina: rutina)
                    }
                    .buttonStyle(.plain)
                    if rutina.id != nivel.rutinas.last?.id {
                        Divider().padding(.leading, 60)
                    }
                }
            }
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
        }
    }

    private var consejos: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Consejos para empezar")
                .font(.title3.bold())
            ForEach(Catalogo.consejos, id: \.self) { consejo in
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.orange)
                    Text(consejo)
                        .font(.subheadline)
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }
}

struct FilaRutina: View {
    let rutina: Rutina

    var body: some View {
        HStack(spacing: 12) {
            Text(rutina.id.hasSuffix("a") ? "A" : "B")
                .font(.headline)
                .frame(width: 36, height: 36)
                .background(Color.orange.opacity(0.15), in: Circle())
                .foregroundStyle(.orange)
            VStack(alignment: .leading, spacing: 2) {
                Text(rutina.nombre).font(.body.weight(.semibold))
                Text("\(rutina.enfoque) · \(rutina.minutosEstimados) min")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .padding(12)
        .contentShape(Rectangle())
    }
}

/// Puntos de lunes a domingo con los días entrenados.
struct SemanaResumen: View {
    @EnvironmentObject private var progreso: ProgresoStore

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Esta semana")
                    .font(.headline)
                Spacer()
                Text("\(progreso.sesionesEstaSemana) de \(progreso.metaSemanal)")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(progreso.sesionesEstaSemana >= progreso.metaSemanal ? Color.green : Color.secondary)
            }
            HStack {
                ForEach(progreso.diasEstaSemana) { dia in
                    VStack(spacing: 6) {
                        Text(dia.letra)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(dia.esHoy ? Color.orange : Color.secondary)
                        ZStack {
                            Circle()
                                .fill(dia.entrenado ? Color.orange : Color(.tertiarySystemFill))
                            if dia.entrenado {
                                Image(systemName: "checkmark")
                                    .font(.caption.bold())
                                    .foregroundStyle(.white)
                            }
                        }
                        .frame(width: 30, height: 30)
                        .overlay(
                            Circle().stroke(Color.orange, lineWidth: dia.esHoy && !dia.entrenado ? 2 : 0)
                        )
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }
}
