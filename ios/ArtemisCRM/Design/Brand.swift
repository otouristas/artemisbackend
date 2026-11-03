import SwiftUI

/// Ρυθμίσεις › Εμφάνιση. Stored with @AppStorage(AppAppearance.key); default light (the CRM's white design).
enum AppAppearance: String, CaseIterable, Identifiable {
    case system, light, dark
    static let key = "appearance"
    static let defaultValue = AppAppearance.light
    var id: String { rawValue }
    var label: String {
        switch self { case .system: return "Αυτόματο"; case .light: return "Φωτεινό"; case .dark: return "Σκούρο" }
    }
    var icon: String {
        switch self { case .system: return "circle.lefthalf.filled"; case .light: return "sun.max"; case .dark: return "moon" }
    }
    /// nil follows the phone's setting.
    var colorScheme: ColorScheme? {
        switch self { case .system: return nil; case .light: return .light; case .dark: return .dark }
    }
}

/// Segmented Αυτόματο / Φωτεινό / Σκούρο picker (Settings and the last onboarding page).
struct AppearancePicker: View {
    @AppStorage(AppAppearance.key) private var appearance = AppAppearance.defaultValue
    var body: some View {
        Picker("Εμφάνιση", selection: $appearance.animation(.easeInOut(duration: 0.25))) {
            ForEach(AppAppearance.allCases) { a in
                Label(a.label, systemImage: a.icon).tag(a)
            }
        }
        .pickerStyle(.segmented)
        .onChange(of: appearance) { _, _ in Haptics.select() }
    }
}

/// The Artemis Rental wordmark (src/assets/logo.svg): brand blue in light mode, white in dark mode.
struct BrandLogo: View {
    var height: CGFloat = 28
    var body: some View {
        Image("BrandLogo")
            .resizable()
            .scaledToFit()
            .frame(height: height)
            .accessibilityLabel("Artemis Rental")
    }
}

/// The wordmark at the top-left of a navigation bar, without the iOS 26 glass capsule.
struct BrandToolbarItem: ToolbarContent {
    var body: some ToolbarContent {
        if #available(iOS 26.0, *) {
            ToolbarItem(placement: .topBarLeading) { BrandLogo(height: 30).fixedSize() }
                .sharedBackgroundVisibility(.hidden)
        } else {
            ToolbarItem(placement: .topBarLeading) { BrandLogo(height: 30).fixedSize() }
        }
    }
}

/// In-app splash: starts exactly like the static launch screen (white logo on navy, 200 pt wide),
/// then a short scale/fade (≈0.9 s) while the session restores.
struct SplashView: View {
    var onFinish: () -> Void = {}
    @State private var phase = 0

    private var hold: Bool {
        #if DEBUG
        return ProcessInfo.processInfo.arguments.contains("-DemoHoldSplash")
        #else
        return false
        #endif
    }

    var body: some View {
        ZStack {
            Color("LaunchBackground").ignoresSafeArea()
            ZStack {
            // A soft sun glow rising behind the logo.
            Circle()
                .fill(RadialGradient(colors: [Color.sun.opacity(0.55), Color.sun.opacity(0)], center: .center, startRadius: 0, endRadius: 160))
                .frame(width: 320, height: 320)
                .scaleEffect(phase >= 1 ? 1 : 0.4)
                .opacity(phase >= 1 ? 0.9 : 0)
                .offset(y: -6)
            Image("Logo")
                .resizable()
                .scaledToFit()
                .foregroundStyle(.white)
                .frame(width: 200)
                .scaleEffect(phase >= 1 ? 1.06 : 1)
                .accessibilityLabel("Artemis Rental")
                .overlay(alignment: .bottom) {
                    Text("BACK OFFICE · ΣΙΦΝΟΣ")
                        .font(.caption.weight(.bold))
                        .tracking(2.5)
                        .foregroundStyle(.white.opacity(0.75))
                        .fixedSize()
                        .opacity(phase >= 1 ? 1 : 0)
                        .offset(y: phase >= 1 ? 40 : 46)
                }
            }
            .opacity(phase >= 2 ? 0 : 1)
            .scaleEffect(phase >= 2 ? 1.12 : 1)
        }
        .ignoresSafeArea()   // centred on the screen like the launch image
        .task {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.75)) { phase = 1 }
            try? await Task.sleep(nanoseconds: 620_000_000)
            guard !hold else { return }
            withAnimation(.easeIn(duration: 0.25)) { phase = 2 }
            try? await Task.sleep(nanoseconds: 250_000_000)
            onFinish()
        }
    }
}
