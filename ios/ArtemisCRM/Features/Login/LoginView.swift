import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var auth: AuthManager
    /// Prefilled like LoginPage.tsx (useState(ALLOWED_ADMIN_EMAIL)).
    @State private var email: String = {
        #if DEBUG
        // Screenshots: `-DemoLoginEmail info@artemisrentals.gr` shows the near-miss hint.
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-DemoLoginEmail"), i + 1 < args.count { return args[i + 1] }
        #endif
        return AppConfig.allowedAdminEmail
    }()
    @State private var password = ""
    @State private var showPassword = false
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focus: Field?

    enum Field { case email, password }

    var body: some View {
        ZStack(alignment: .top) {
            Color.screen.ignoresSafeArea()
            hero
            ScrollView {
                VStack(spacing: 0) {
                    Spacer().frame(height: 250)
                    form
                        .padding(.horizontal, 20)
                    footer.padding(.top, 24)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .scrollBounceBehavior(.basedOnSize)
        }
    }

    private var hero: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(colors: [Color(red: 0.07, green: 0.24, blue: 0.33), Color(red: 0.03, green: 0.11, blue: 0.16)],
                           startPoint: .top, endPoint: .bottom)
            Circle()
                .fill(Color.sun)
                .frame(width: 58, height: 58)
                .shadow(color: Color.sun.opacity(0.6), radius: 24)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                .padding(.top, 92)
                .padding(.trailing, 40)
            WaveShape()
                .fill(Color.white.opacity(0.06))
                .frame(height: 90)
                .offset(y: 10)
            VStack(alignment: .leading, spacing: 10) {
                Image("Logo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 150)
                    .foregroundStyle(.white)
                    .accessibilityLabel("Artemis Rental")
                Text("Back office · Σίφνος")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.white.opacity(0.75))
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 64)
        }
        .frame(height: 320)
        .clipped()
        .ignoresSafeArea(edges: .top)
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Σύνδεση").font(.title2.weight(.bold))
                Text("Με τον ίδιο λογαριασμό που χρησιμοποιείτε στο web CRM.")
                    .font(.subheadline).foregroundStyle(.secondary)
            }

            VStack(spacing: 12) {
                field(icon: "envelope") {
                    TextField("Email", text: $email, prompt: Text("info@artemisrental.gr"))
                        .textContentType(.username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focus, equals: .email)
                        .submitLabel(.next)
                        .onSubmit { focus = .password }
                }
                field(icon: "lock") {
                    Group {
                        if showPassword {
                            TextField("Κωδικός", text: $password)
                        } else {
                            SecureField("Κωδικός", text: $password)
                        }
                    }
                    .textContentType(.password)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($focus, equals: .password)
                    .submitLabel(.go)
                    .onSubmit(submit)
                    Button { showPassword.toggle() } label: {
                        Image(systemName: showPassword ? "eye.slash" : "eye").foregroundStyle(.secondary)
                    }
                    .accessibilityLabel(showPassword ? "Απόκρυψη κωδικού" : "Εμφάνιση κωδικού")
                }
            }

            if AppConfig.isNearMissAdmin(email) {
                HStack(spacing: 10) {
                    Image(systemName: "lightbulb.fill").foregroundStyle(Color.sun)
                    Text("Το σωστό email είναι \(AppConfig.allowedAdminEmail)")
                        .font(.footnote.weight(.medium))
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 4)
                    Button("Διόρθωση") {
                        Haptics.tap()
                        email = AppConfig.allowedAdminEmail
                        error = nil
                        focus = .password
                    }
                    .font(.footnote.weight(.bold))
                    .buttonStyle(.borderedProminent)
                    .tint(Color.sun)
                    .controlSize(.small)
                }
                .padding(10)
                .background(Color.sun.opacity(0.12), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .transition(.opacity.combined(with: .move(edge: .top)))
            }

            if let error {
                Label(error, systemImage: "exclamationmark.circle.fill")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Color.danger)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }

            Button(action: submit) {
                HStack(spacing: 8) {
                    if busy { ProgressView().tint(.white) }
                    Text(busy ? "Σύνδεση…" : "Σύνδεση")
                }
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(busy || email.isEmpty || password.isEmpty)
            .opacity(email.isEmpty || password.isEmpty ? 0.6 : 1)
        }
        .card(padding: 22)
        .animation(.easeInOut(duration: 0.2), value: error)
        .animation(.easeInOut(duration: 0.2), value: AppConfig.isNearMissAdmin(email))
    }

    private var footer: some View {
        VStack(spacing: 6) {
            Label("Η σύνδεση παραμένει ενεργή με ασφάλεια στο Keychain.", systemImage: "lock.shield")
                .font(.footnote)
                .foregroundStyle(.secondary)
            Text("Artemis CRM \(AppConfig.version)")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 24)
    }

    private func field<Content: View>(icon: String, @ViewBuilder content: () -> Content) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon).foregroundStyle(.secondary).frame(width: 20)
            content()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 14)
        .background(Color.screen, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.hairline, lineWidth: 1))
    }

    private func submit() {
        guard !busy, !email.isEmpty, !password.isEmpty else { return }
        // Trim + lowercase like isAllowedAdminEmail(); a near miss gets the fix hint, not a sign-in attempt.
        email = AppConfig.normalizedEmail(email)
        if AppConfig.isNearMissAdmin(email) {
            error = "Το σωστό email είναι \(AppConfig.allowedAdminEmail)"
            Haptics.notify(.warning)
            return
        }
        focus = nil
        busy = true
        error = nil
        Task {
            do {
                try await auth.signIn(email: email, password: password)
                Haptics.notify(.success)
            } catch {
                self.error = error.localizedDescription
                Haptics.notify(.error)
            }
            busy = false
        }
    }
}

struct WaveShape: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: 0, y: rect.height * 0.5))
        p.addCurve(to: CGPoint(x: rect.width, y: rect.height * 0.45),
                   control1: CGPoint(x: rect.width * 0.35, y: rect.height * 0.05),
                   control2: CGPoint(x: rect.width * 0.65, y: rect.height * 0.95))
        p.addLine(to: CGPoint(x: rect.width, y: rect.height))
        p.addLine(to: CGPoint(x: 0, y: rect.height))
        p.closeSubpath()
        return p
    }
}
