import SwiftUI
import UserNotifications

/// First-launch onboarding, before login (Turo/Airbnb host style: big illustration, title, one line).
/// Completion is stored in UserDefaults (`doneKey`).
struct OnboardingView: View {
    static let doneKey = "onboarding.completed.v1"

    @EnvironmentObject private var notifications: NotificationManager
    let onFinish: () -> Void

    @State private var page = AppConfig.onboardingStartPage
    @State private var asking = false
    @State private var askedHere = false

    private struct Page: Identifiable {
        let id: Int
        let title: String
        let body: String
    }

    private let pages: [Page] = [
        Page(id: 0, title: "Η μέρα σας,\nμε μια ματιά", body: "Παραλαβές, επιστροφές και υπόλοιπα του σήμερα σε μία οθόνη."),
        Page(id: 1, title: "Αιτήματα\nαπό το site", body: "Τα αιτήματα του rentacarsifnos.com έρχονται εδώ. Αποδοχή με ένα άγγιγμα."),
        Page(id: 2, title: "Στόλος\n& τιμές", body: "Ελεύθερες μονάδες, πινακίδες, συντήρηση και τιμές ανά περίοδο."),
        Page(id: 3, title: "Μην χάσετε\nκαμία κράτηση", body: "Ειδοποίηση μόλις φτάσει νέο αίτημα, ακόμη και με την εφαρμογή στο παρασκήνιο."),
    ]

    private var isLast: Bool { page == pages.count - 1 }
    private var notificationsAsked: Bool {
        #if DEBUG
        // -DemoNotificationsUnasked: show the "enable" step even if this simulator already allowed them.
        if ProcessInfo.processInfo.arguments.contains("-DemoNotificationsUnasked") { return askedHere }
        #endif
        return askedHere || notifications.authorization != .notDetermined
    }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            TabView(selection: $page) {
                ForEach(pages) { p in
                    pageView(p).tag(p.id)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .animation(.spring(response: 0.4, dampingFraction: 0.85), value: page)
            bottomBar
        }
        .background(Color.screen.ignoresSafeArea())
        .onChange(of: page) { _, _ in Haptics.select() }
        .task { await notifications.refreshAuthorization() }
    }

    // MARK: Chrome

    private var topBar: some View {
        HStack {
            BrandLogo(height: 30)
            Spacer()
            if !isLast {
                Button("Παράλειψη") {
                    withAnimation { page = pages.count - 1 }
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 24)
        .padding(.top, 8)
        .frame(height: 52)
    }

    private var bottomBar: some View {
        VStack(spacing: 18) {
            HStack(spacing: 6) {
                ForEach(pages) { p in
                    Capsule()
                        .fill(p.id == page ? Color.navy : Color.secondary.opacity(0.25))
                        .frame(width: p.id == page ? 22 : 7, height: 7)
                }
            }
            .animation(.spring(response: 0.35), value: page)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Σελίδα \(page + 1) από \(pages.count)")

            if isLast {
                if notificationsAsked {
                    Button(action: finish) { Label("Σύνδεση", systemImage: "arrow.right") }
                        .buttonStyle(PrimaryButtonStyle())
                    Label(notifications.authorization == .authorized ? "Οι ειδοποιήσεις είναι ενεργές" : "Μπορείτε να τις ενεργοποιήσετε από τις Ρυθμίσεις",
                          systemImage: notifications.authorization == .authorized ? "checkmark.circle.fill" : "info.circle")
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(notifications.authorization == .authorized ? Color.success : .secondary)
                        .frame(height: 22)
                } else {
                    Button(action: enableNotifications) {
                        HStack(spacing: 8) {
                            if asking { ProgressView().tint(.white) } else { Image(systemName: "bell.badge.fill") }
                            Text("Ενεργοποίηση ειδοποιήσεων")
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle(tint: .sun))
                    .disabled(asking)
                    Button("Σύνδεση", action: finish)
                        .font(.headline)
                        .foregroundStyle(Color.navy)
                        .frame(height: 22)
                }
            } else {
                Button {
                    withAnimation { page += 1 }
                } label: { Text("Συνέχεια") }
                .buttonStyle(PrimaryButtonStyle())
                Color.clear.frame(height: 22)
            }
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 12)
        .padding(.top, 8)
    }

    private func pageView(_ p: Page) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            OnboardingArt(page: p.id)
                .frame(maxWidth: .infinity)
                .frame(height: 360)
                .padding(.horizontal, 20)
                .padding(.top, 8)
            VStack(alignment: .leading, spacing: 12) {
                Text(p.title)
                    .font(.system(size: 34, weight: .bold))
                    .tracking(-0.5)
                    .lineSpacing(-2)
                    .fixedSize(horizontal: false, vertical: true)
                Text(p.body)
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                if p.id == pages.count - 1 {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("ΕΜΦΑΝΙΣΗ").font(.caption.weight(.bold)).tracking(0.6).foregroundStyle(.secondary)
                        AppearancePicker()
                    }
                    .padding(.top, 10)
                }
            }
            .padding(.horizontal, 28)
            .padding(.top, 28)
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .contain)
    }

    // MARK: Actions

    private func enableNotifications() {
        asking = true
        Task {
            await notifications.requestAuthorization()
            asking = false
            withAnimation { askedHere = true }
            Haptics.notify(notifications.authorization == .authorized ? .success : .warning)
        }
    }

    private func finish() {
        Haptics.tap()
        withAnimation { onFinish() }
    }
}

// MARK: - Illustrations (SF Symbol compositions on a brand panel)

private struct OnboardingArt: View {
    let page: Int
    @State private var appear = false

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 32, style: .continuous)
                .fill(LinearGradient(colors: [Color(red: 0.07, green: 0.24, blue: 0.33), Color(red: 0.03, green: 0.11, blue: 0.16)],
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
            // Sun + sea, like the login hero.
            Circle()
                .fill(Color.sun)
                .frame(width: 86, height: 86)
                .shadow(color: Color.sun.opacity(0.55), radius: 30)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                .padding(.top, 34).padding(.trailing, 34)
                .opacity(page == 3 ? 0 : 1)
            WaveShape()
                .fill(Color.white.opacity(0.07))
                .frame(height: 110)
                .frame(maxHeight: .infinity, alignment: .bottom)
            content
                .padding(24)
                .scaleEffect(appear ? 1 : 0.94)
                .opacity(appear ? 1 : 0)
        }
        .clipShape(RoundedRectangle(cornerRadius: 32, style: .continuous))
        .environment(\.colorScheme, .light)
        .onAppear { withAnimation(.spring(response: 0.55, dampingFraction: 0.8).delay(0.05)) { appear = true } }
        .onDisappear { appear = false }
        .accessibilityHidden(true)
    }

    @ViewBuilder private var content: some View {
        switch page {
        case 0: today
        case 1: requests
        case 2: fleet
        default: notifications
        }
    }

    private var today: some View {
        VStack(spacing: 12) {
            HStack(spacing: 10) {
                miniKPI("2", "Αφίξεις", "arrow.up.right", .success)
                miniKPI("3", "Αναχωρήσεις", "arrow.down.left", .danger)
            }
            miniTrip(pill: "Παραλαβή 10:30", pillIcon: "arrow.up.right", tint: .success, name: "Giulia Rossi", car: "Fiat Panda", plate: "ΕΜΖ 2735", symbol: "car.side.fill")
            miniTrip(pill: "Επιστροφή 18:00", pillIcon: "arrow.down.left", tint: .danger, name: "Thomas Laurent", car: "SYM Symphony 125", plate: "ΜΗΛ 3734", symbol: "scooter")
                .rotationEffect(.degrees(-2))
                .offset(x: 10)
        }
        .frame(maxHeight: .infinity, alignment: .bottom)
    }

    private var requests: some View {
        VStack(spacing: 14) {
            banner("Νέο αίτημα κράτησης", "Chloé Martin · Fiat Panda · 7 – 12 Νοε")
                .rotationEffect(.degrees(-1.5))
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Image(systemName: "globe").foregroundStyle(Color.sun)
                    Text("rentacarsifnos.com").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    Spacer()
                    StatusPill(text: "Νέο", color: .sun, filled: true)
                }
                Text("5 ημέρες · 3 άτομα · παιδικό κάθισμα").font(.subheadline.weight(.medium))
                HStack(spacing: 8) {
                    Label("Αποδοχή", systemImage: "checkmark")
                        .font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 10)
                        .background(Color.success, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                    Label("WhatsApp", systemImage: "message.fill")
                        .font(.subheadline.weight(.semibold)).foregroundStyle(Color.success)
                        .frame(maxWidth: .infinity).padding(.vertical, 10)
                        .background(Color.success.opacity(0.12), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                }
            }
            .padding(14)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .shadow(color: .black.opacity(0.25), radius: 14, y: 6)
        }
        .frame(maxHeight: .infinity, alignment: .bottom)
    }

    private var fleet: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color(white: 0.96))
                    Image(systemName: "scooter").font(.system(size: 24)).foregroundStyle(Color(red: 0.04, green: 0.16, blue: 0.24))
                }
                .frame(width: 64, height: 46)
                VStack(alignment: .leading, spacing: 3) {
                    Text("SYM Symphony 125").font(.subheadline.weight(.semibold))
                    Text("7/7 ελεύθερα · 25 €/ημέρα").font(.caption).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
            .padding(10)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .shadow(color: .black.opacity(0.2), radius: 10, y: 4)
            .scaleEffect(0.92)
            .rotationEffect(.degrees(2.5))
            .offset(x: -8, y: 6)
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.white)
                    Image(systemName: "car.side.fill").font(.system(size: 34)).foregroundStyle(Color(red: 0.04, green: 0.16, blue: 0.24))
                }
                .frame(width: 92, height: 66)
                VStack(alignment: .leading, spacing: 6) {
                    Text("Chevrolet Spark").font(.headline)
                    HStack(spacing: 6) {
                        Capsule().fill(Color.secondary.opacity(0.18)).frame(width: 60, height: 6)
                            .overlay(alignment: .leading) { Capsule().fill(Color.success).frame(width: 38, height: 6) }
                        Text("5/8 ελεύθερα").font(.caption.weight(.semibold))
                    }
                    Text("40 €/ημέρα σήμερα").font(.caption.weight(.medium)).foregroundStyle(Color.navy)
                }
                Spacer(minLength: 0)
            }
            .padding(12)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .shadow(color: .black.opacity(0.25), radius: 14, y: 6)
            HStack(spacing: 8) {
                chip("ΕΜΜ 2217", "number", .navy)
                chip("Συντήρηση", "wrench.and.screwdriver", .danger)
                chip("Υψηλή 64 €", "eurosign", .sun)
            }
        }
        .frame(maxHeight: .infinity, alignment: .bottom)
    }

    private var notifications: some View {
        VStack(spacing: 20) {
            ZStack {
                ForEach(0..<3) { i in
                    Circle().stroke(Color.white.opacity(0.12 - Double(i) * 0.03), lineWidth: 1.5)
                        .frame(width: 120 + CGFloat(i) * 56, height: 120 + CGFloat(i) * 56)
                }
                Circle().fill(Color.sun).frame(width: 104, height: 104)
                    .shadow(color: Color.sun.opacity(0.6), radius: 26)
                Image(systemName: "bell.badge.fill")
                    .symbolRenderingMode(.palette)
                    .foregroundStyle(Color.white, Color(red: 0.04, green: 0.16, blue: 0.24))
                    .font(.system(size: 46, weight: .semibold))
            }
            .frame(maxHeight: .infinity)
            banner("Νέο αίτημα κράτησης", "Isabella García · Suzuki Ignis · 8 – 13 Νοε")
        }
    }

    // MARK: Pieces

    private func miniKPI(_ value: String, _ title: String, _ icon: String, _ tint: Color) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon).font(.footnote.weight(.bold)).foregroundStyle(tint)
                .frame(width: 28, height: 28).background(tint.opacity(0.13), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            VStack(alignment: .leading, spacing: 0) {
                Text(value).font(.title3.weight(.bold))
                Text(title).font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .shadow(color: .black.opacity(0.2), radius: 10, y: 4)
    }

    private func miniTrip(pill: String, pillIcon: String, tint: Color, name: String, car: String, plate: String, symbol: String) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 5) {
                StatusPill(text: pill, color: tint, icon: pillIcon)
                Text(name).font(.headline)
                HStack(spacing: 6) {
                    Text(car).font(.caption).foregroundStyle(.secondary)
                    PlateBadge(plate: plate)
                }
            }
            Spacer(minLength: 0)
            ZStack {
                RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color(white: 0.96))
                Image(systemName: symbol).font(.system(size: 26)).foregroundStyle(Color(red: 0.04, green: 0.16, blue: 0.24))
            }
            .frame(width: 70, height: 52)
        }
        .padding(12)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: .black.opacity(0.25), radius: 14, y: 6)
    }

    private func banner(_ title: String, _ text: String) -> some View {
        HStack(spacing: 12) {
            Image("BrandSymbol").resizable().scaledToFit().foregroundStyle(.white).padding(7)
                .frame(width: 40, height: 40)
                .background(Color(red: 0.04, green: 0.16, blue: 0.24), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(title).font(.subheadline.weight(.bold))
                    Spacer()
                    Text("τώρα").font(.caption).foregroundStyle(.secondary)
                }
                Text(text).font(.footnote).foregroundStyle(.secondary).lineLimit(1)
            }
        }
        .padding(12)
        .background(.white.opacity(0.94), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: .black.opacity(0.25), radius: 14, y: 6)
    }

    private func chip(_ text: String, _ icon: String, _ tint: Color) -> some View {
        Label(text, systemImage: icon)
            .font(.caption.weight(.semibold))
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .padding(.horizontal, 10).padding(.vertical, 8)
            .foregroundStyle(tint)
            .background(Color.white, in: Capsule())
            .shadow(color: .black.opacity(0.2), radius: 8, y: 3)
    }
}
