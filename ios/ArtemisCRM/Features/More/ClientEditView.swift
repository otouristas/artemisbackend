import SwiftUI

/// The profile form of ClientProfilePage.tsx: contact details, ID, language, preferred model, tags, notes.
struct ClientEditView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    let client: Client

    @State private var draft: ClientUpdate
    @State private var newTag = ""
    @State private var saving = false
    @State private var error: String?
    @FocusState private var tagFocused: Bool

    /// LANGUAGE_LABELS in clientUtils.ts.
    static let languages: [(code: String, label: String)] = [
        ("el", "Ελληνικά"), ("en", "Αγγλικά"), ("de", "Γερμανικά"), ("fr", "Γαλλικά"), ("it", "Ιταλικά"),
        ("es", "Ισπανικά"), ("nl", "Ολλανδικά"), ("pt", "Πορτογαλικά"), ("ru", "Ρωσικά"), ("pl", "Πολωνικά"),
        ("sv", "Σουηδικά"), ("tr", "Τουρκικά"), ("he", "Εβραϊκά"), ("zh", "Κινεζικά"),
    ]

    /// SUGGESTED in TagEditor.tsx.
    static let suggestedTags = ["VIP", "Επαναλαμβανόμενος", "Οικογένεια", "Ζευγάρι", "Ντόπιος", "Μακροχρόνια"]

    static func languageLabel(_ code: String?) -> String? {
        guard let c = code.nilIfBlank?.lowercased() else { return nil }
        return languages.first { $0.code == c }?.label ?? c.uppercased()
    }

    init(client: Client) {
        self.client = client
        _draft = State(initialValue: ClientUpdate(client))
    }

    private var dirty: Bool { draft != ClientUpdate(client) }
    private var canSave: Bool { !draft.name.trimmed.isEmpty && dirty && !saving }

    var body: some View {
        NavigationStack {
            Form {
                Section("Στοιχεία") {
                    TextField("Ονοματεπώνυμο", text: $draft.name)
                        .textContentType(.name)
                    TextField("Τηλέφωνο", text: text(\.phone))
                        .keyboardType(.phonePad)
                        .textContentType(.telephoneNumber)
                    TextField("Email", text: text(\.email))
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    TextField("Ταυτότητα ή διαβατήριο", text: text(\.idDocument))
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                }
                Section("Προτιμήσεις") {
                    Picker("Γλώσσα", selection: text(\.preferredLanguage)) {
                        Text("Καμία").tag("")
                        ForEach(languageOptions, id: \.code) { Text($0.label).tag($0.code) }
                    }
                    Picker("Προτιμώμενο όχημα", selection: text(\.preferredVehicleID)) {
                        Text("Κανένα").tag("")
                        ForEach(store.vehicles) { Text($0.name).tag($0.id) }
                    }
                }
                Section {
                    tagEditor
                } header: { Text("Ετικέτες") } footer: {
                    Text("Πατήστε μια ετικέτα για να την αφαιρέσετε.")
                }
                Section("Σημειώσεις") {
                    TextField("Προτιμήσεις, ώρα άφιξης, πλοίο…", text: text(\.notes), axis: .vertical)
                        .lineLimit(3...8)
                }
                if let error { Section { Text(error).foregroundStyle(Color.danger) } }
            }
            .navigationTitle("Πελάτης")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Άκυρο") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if saving { ProgressView() } else {
                        Button("Αποθήκευση", action: save).fontWeight(.semibold).disabled(!canSave)
                    }
                }
            }
            .interactiveDismissDisabled(dirty)
        }
    }

    /// The saved code stays selectable even when it is not in the list.
    private var languageOptions: [(code: String, label: String)] {
        guard let c = draft.preferredLanguage.nilIfBlank, !Self.languages.contains(where: { $0.code == c }) else { return Self.languages }
        return Self.languages + [(c, c.uppercased())]
    }

    private var tagEditor: some View {
        VStack(alignment: .leading, spacing: 12) {
            if !draft.tags.isEmpty {
                WrapLayout(spacing: 6) {
                    ForEach(draft.tags, id: \.self) { t in
                        Button {
                            Haptics.select()
                            withAnimation(.snappy) { draft.tags.removeAll { $0 == t } }
                        } label: {
                            HStack(spacing: 4) {
                                Text(t)
                                Image(systemName: "xmark").font(.caption2.weight(.bold))
                            }
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 10).padding(.vertical, 6)
                            .foregroundStyle(Color.sun)
                            .background(Color.sun.opacity(0.14), in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Αφαίρεση \(t)")
                    }
                }
            }
            HStack {
                TextField("Νέα ετικέτα", text: $newTag)
                    .focused($tagFocused)
                    .submitLabel(.done)
                    .onSubmit { addTag(newTag) }
                if !newTag.trimmed.isEmpty {
                    Button("Προσθήκη") { addTag(newTag) }.font(.subheadline.weight(.semibold))
                }
            }
            let suggestions = Self.suggestedTags.filter { s in !draft.tags.contains { $0.lowercased() == s.lowercased() } }
            if !suggestions.isEmpty {
                WrapLayout(spacing: 6) {
                    ForEach(suggestions, id: \.self) { s in
                        Button { addTag(s) } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "plus").font(.caption2.weight(.bold))
                                Text(s)
                            }
                                .font(.caption.weight(.medium))
                                .padding(.horizontal, 10).padding(.vertical, 6)
                                .foregroundStyle(.secondary)
                                .overlay(Capsule().strokeBorder(Color.hairline, style: StrokeStyle(lineWidth: 1, dash: [3])))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }

    /// add() in TagEditor.tsx: comma-separated, case-insensitive duplicates dropped.
    private func addTag(_ raw: String) {
        let parts = raw.split(separator: ",").map { String($0).trimmed }.filter { !$0.isEmpty }
        guard !parts.isEmpty else { return }
        Haptics.select()
        withAnimation(.snappy) {
            for p in parts where !draft.tags.contains(where: { $0.lowercased() == p.lowercased() }) { draft.tags.append(p) }
        }
        newTag = ""
    }

    private func text(_ key: WritableKeyPath<ClientUpdate, String?>) -> Binding<String> {
        Binding(get: { draft[keyPath: key] ?? "" }, set: { draft[keyPath: key] = $0 })
    }

    private func save() {
        guard !draft.name.trimmed.isEmpty else { error = "Το όνομα είναι υποχρεωτικό"; return }
        if !newTag.trimmed.isEmpty { addTag(newTag) }
        saving = true
        error = nil
        Task {
            do {
                try await store.updateClient(client, draft)
                dismiss()
            } catch {
                Haptics.notify(.error)
                self.error = "Σφάλμα αποθήκευσης: \(error.localizedDescription)"
            }
            saving = false
        }
    }
}
