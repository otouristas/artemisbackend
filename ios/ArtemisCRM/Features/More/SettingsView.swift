import SwiftUI
import UIKit

struct SettingsView: View {
    @EnvironmentObject private var auth: AuthManager
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var notifications: NotificationManager
    @State private var confirmSignOut = false
    @State private var notifyEnabled = NotificationManager.shared.enabled

    var body: some View {
        List {
            Section {
                HStack {
                    Label("Άδεια ειδοποιήσεων", systemImage: "bell.badge")
                    Spacer()
                    StatusPill(text: statusText, color: statusColor)
                }
                Toggle(isOn: $notifyEnabled) {
                    Label("Νέα αιτήματα από το site", systemImage: "tray.and.arrow.down")
                }
                .onChange(of: notifyEnabled) { _, v in notifications.enabled = v }
                if notifications.authorization == .denied {
                    Button { UIApplication.shared.open(URL(string: UIApplication.openSettingsURLString)!) } label: {
                        Label("Άνοιγμα Ρυθμίσεων iOS", systemImage: "arrow.up.forward.app")
                    }
                } else if notifications.authorization == .notDetermined {
                    Button { Task { await notifications.requestAuthorization() } } label: { Label("Ενεργοποίηση ειδοποιήσεων", systemImage: "bell") }
                }
                Button { notifications.sendTest() } label: { Label("Δοκιμαστική ειδοποίηση", systemImage: "paperplane") }
                    .disabled(notifications.authorization != .authorized)
            } header: { Text("Ειδοποιήσεις") } footer: {
                Text("Όσο η εφαρμογή είναι ανοιχτή, τα νέα αιτήματα έρχονται άμεσα (Realtime). Στο παρασκήνιο το iOS ελέγχει περιοδικά. Για ειδοποιήσεις όταν η εφαρμογή είναι εντελώς κλειστή χρειάζεται remote push (βλ. README).")
            }

            Section("Παρασκήνιο & push") {
                InfoRow(icon: "arrow.clockwise", title: "Έλεγχος παρασκηνίου", value: backgroundStatus)
                InfoRow(icon: "clock", title: "Τελευταίος έλεγχος", value: notifications.lastBackgroundRun.map { $0.formatted(.relative(presentation: .named).locale(greek)) } ?? "—")
                InfoRow(icon: "antenna.radiowaves.left.and.right", title: "Remote push", value: AppConfig.remotePushEnabled ? (notifications.deviceToken == nil ? "Αναμονή token" : "Ενεργό") : "Ανενεργό")
                if let token = notifications.deviceToken {
                    Button { UIPasteboard.general.string = token; store.show("Το token αντιγράφηκε") } label: {
                        Label("Αντιγραφή device token", systemImage: "doc.on.doc")
                    }
                }
            }

            Section("Λογαριασμός") {
                InfoRow(icon: "person.crop.circle", title: "Email", value: email)
                if store.isDemo {
                    InfoRow(icon: "testtube.2", title: "Λειτουργία", value: "Demo (δείγμα δεδομένων)", valueColor: .sun)
                }
                Button(role: .destructive) { confirmSignOut = true } label: {
                    Label("Αποσύνδεση", systemImage: "rectangle.portrait.and.arrow.right")
                }
            }

            Section {
                InfoRow(icon: "app.badge", title: "Έκδοση", value: AppConfig.version)
                InfoRow(icon: "server.rack", title: "Βάση", value: store.isDemo ? "Demo" : "Supabase")
            } footer: {
                Text("Artemis Rental · Σίφνος").frame(maxWidth: .infinity).padding(.top, 12)
            }
        }
        .navigationTitle("Ρυθμίσεις")
        .navigationBarTitleDisplayMode(.inline)
        .task { await notifications.refreshAuthorization() }
        .confirmationDialog("Αποσύνδεση από το Artemis CRM;", isPresented: $confirmSignOut, titleVisibility: .visible) {
            Button("Αποσύνδεση", role: .destructive) {
                Task {
                    store.stopLive()
                    NotificationManager.shared.clearOnSignOut()
                    await auth.signOut()
                    store.reset()
                    Router.shared.tab = .today
                }
            }
            Button("Άκυρο", role: .cancel) {}
        }
    }

    private var email: String {
        if case .signedIn(let e) = auth.state { return e }
        return "—"
    }

    private var statusText: String {
        switch notifications.authorization {
        case .authorized, .provisional, .ephemeral: return "Ενεργές"
        case .denied: return "Απενεργοποιημένες"
        default: return "Δεν ζητήθηκε"
        }
    }

    private var statusColor: Color {
        switch notifications.authorization {
        case .authorized, .provisional, .ephemeral: return .success
        case .denied: return .danger
        default: return .warning
        }
    }

    private var backgroundStatus: String {
        switch UIApplication.shared.backgroundRefreshStatus {
        case .available: return "Διαθέσιμος"
        case .denied: return "Απενεργοποιημένος"
        case .restricted: return "Περιορισμένος"
        @unknown default: return "—"
        }
    }
}
