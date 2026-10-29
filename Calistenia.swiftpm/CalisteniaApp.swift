import SwiftUI

@main
struct CalisteniaApp: App {
    @StateObject private var progreso = ProgresoStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(progreso)
                .tint(.orange)
        }
    }
}

struct ContentView: View {
    var body: some View {
        TabView {
            EntrenarView()
                .tabItem { Label("Entrenar", systemImage: "flame.fill") }
            BibliotecaView()
                .tabItem { Label("Ejercicios", systemImage: "figure.strengthtraining.functional") }
            ProgresoView()
                .tabItem { Label("Progreso", systemImage: "chart.bar.fill") }
        }
    }
}
