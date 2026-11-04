import SwiftUI

struct MoreView: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var auth: AuthManager

    private var seasonTotal: Double {
        let year = String(Day.today.prefix(4))
        return store.bookings.filter { $0.isActive && $0.checkIn.hasPrefix(year) }.reduce(0) { $0 + $1.total }
    }

    var body: some View {
        List {
            Section {
                HStack(spacing: 14) {
                    Image("BrandSymbol")
                        .resizable().scaledToFit()
                        .foregroundStyle(.white)
                        .padding(12)
                        .frame(width: 64, height: 64)
                        .background(Color.navyFill, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 8) {
                            BrandLogo(height: 30)
                            if store.isDemo { DemoBadge() }
                        }
                        Text(email).font(.subheadline).foregroundStyle(.secondary)
                        Text("Απολλωνία · Σίφνος").font(.caption).foregroundStyle(.tertiary)
                    }
                }
                .padding(.vertical, 4)
            }

            Section {
                NavigationLink(value: Route.clients) {
                    row("Πελάτες", "person.2.fill", .navy, detail: "\(store.clients.count)")
                }
                NavigationLink(value: Route.money) {
                    row("Οικονομικά", "chart.bar.xaxis", .success, detail: Money.compact(seasonTotal))
                }
                NavigationLink(value: Route.settings) {
                    row("Ρυθμίσεις", "gearshape.fill", .secondary, detail: nil)
                }
            }

            Section {
                Link(destination: URL(string: "https://rentacarsifnos.com")!) {
                    row("Ιστότοπος", "globe", .sun, detail: "rentacarsifnos.com")
                }
                Link(destination: URL(string: "tel:+302284033333")!) {
                    row("Γραφείο", "phone.fill", .olive, detail: "22840 33333")
                }
            }
        }
        .navigationTitle("Περισσότερα")
    }

    private var email: String {
        if case .signedIn(let e) = auth.state { return e }
        return AppConfig.allowedAdminEmail
    }

    private func row(_ title: String, _ icon: String, _ tint: Color, detail: String?) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white)
                .frame(width: 30, height: 30)
                .background(tint, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            Text(title).foregroundStyle(.primary)
            Spacer()
            if let detail { Text(detail).foregroundStyle(.secondary) }
        }
    }
}

// MARK: - Clients

struct ClientsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var query = ""

    private var clients: [Client] {
        let q = query.trimmed.lowercased()
        return store.clients.filter { c in
            q.isEmpty || [c.name, c.phone, c.email].compactMap { $0?.lowercased() }.contains { $0.contains(q) }
        }
    }

    var body: some View {
        List {
            if clients.isEmpty {
                if query.isEmpty {
                    ContentUnavailableView("Χωρίς πελάτες", systemImage: "person.2", description: Text("Οι πελάτες δημιουργούνται αυτόματα με κάθε κράτηση."))
                } else {
                    ContentUnavailableView.search(text: query)
                }
            }
            ForEach(clients) { c in
                let history = store.bookings(for: c)
                NavigationLink(value: Route.client(c.id)) {
                    HStack(spacing: 12) {
                        Avatar(name: c.name, size: 42)
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 6) {
                                Text(c.name).font(.body.weight(.medium))
                                ForEach(c.tags ?? [], id: \.self) { StatusPill(text: $0, color: .sun) }
                                if !store.duplicates(of: c).isEmpty { StatusPill(text: "Διπλότυπο", color: .warning, icon: "arrow.triangle.merge") }
                            }
                            Text(c.phone ?? c.email ?? "—").font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(Money.format(history.filter(\.isActive).reduce(0) { $0 + $1.total })).font(.subheadline.weight(.semibold)).monospacedDigit()
                            Text(history.count == 1 ? "1 κράτηση" : "\(history.count) κρατήσεις").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
                .swipeActions(edge: .leading) {
                    if let url = Contact.whatsApp(phone: c.phone) {
                        Button { UIApplication.shared.open(url) } label: { Label("WhatsApp", systemImage: "message.fill") }.tint(.success)
                    }
                    if let url = Contact.telURL(c.phone) {
                        Button { UIApplication.shared.open(url) } label: { Label("Κλήση", systemImage: "phone.fill") }.tint(.navy)
                    }
                }
            }
        }
        .navigationTitle("Πελάτες")
        .searchable(text: $query, prompt: "Όνομα, τηλέφωνο, email")
        .refreshable { await store.refresh() }
    }
}

struct ClientDetailView: View {
    @EnvironmentObject private var store: AppStore
    let clientID: String
    @State private var newBooking = false
    @State private var editing = false
    @State private var mergeID: String?
    @State private var confirmMerge = false
    @State private var merging = false

    var body: some View {
        if let c = store.client(clientID) {
            let history = store.bookings(for: c)
            let active = history.filter(\.isActive)
            List {
                Section {
                    VStack(spacing: 12) {
                        Avatar(name: c.name, size: 72)
                        Text(c.name).font(.title2.weight(.bold))
                        if let tags = c.tags, !tags.isEmpty {
                            HStack { ForEach(tags, id: \.self) { StatusPill(text: $0, color: .sun) } }
                        }
                        ContactRow(phone: c.phone, email: c.email, whatsApp: Contact.whatsApp(phone: c.phone, text: "Γεια σας \(c.name)!"))
                    }
                    .frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
                }
                Section {
                    HStack(spacing: 10) {
                        stat("Κρατήσεις", "\(active.count)")
                        stat("Σύνολο", Money.format(active.reduce(0) { $0 + $1.total }))
                        stat("Υπόλοιπο", Money.format(active.reduce(0) { $0 + $1.balance }))
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                }
                let duplicates = store.duplicates(of: c)
                if !duplicates.isEmpty { mergeSection(c, duplicates) }
                Section {
                    if let p = c.phone.nilIfBlank { InfoRow(icon: "phone", title: "Τηλέφωνο", value: p) }
                    if let e = c.email.nilIfBlank { InfoRow(icon: "envelope", title: "Email", value: e) }
                    if let d = c.idDocument.nilIfBlank { InfoRow(icon: "person.text.rectangle", title: "Ταυτότητα", value: d) }
                    if let l = ClientEditView.languageLabel(c.preferredLanguage) { InfoRow(icon: "globe", title: "Γλώσσα", value: l) }
                    if let v = store.vehicle(c.preferredVehicleID) { InfoRow(icon: "car.side", title: "Προτιμώμενο όχημα", value: v.name) }
                    if let n = c.notes?.nilIfBlank { Text(n).font(.subheadline) }
                    Button { editing = true } label: { Label("Επεξεργασία στοιχείων", systemImage: "pencil") }
                } header: { Text("Στοιχεία") }
                Section("Ιστορικό") {
                    if history.isEmpty { Text("Καμία κράτηση").foregroundStyle(.secondary) }
                    ForEach(history) { b in
                        NavigationLink(value: Route.booking(b.id)) {
                            HStack(spacing: 12) {
                                VehicleImage(url: store.vehicle(b.vehicleID)?.imageURL, type: store.vehicle(b.vehicleID)?.type ?? .car, cornerRadius: 6)
                                    .frame(width: 48, height: 34)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(store.vehicleName(b.vehicleID)).font(.subheadline.weight(.medium))
                                    Text(Day.format(b.checkIn, "d MMM yyyy") + " · \(b.nights) ημ.").font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                VStack(alignment: .trailing, spacing: 2) {
                                    Text(Money.format(b.total)).font(.subheadline).monospacedDigit()
                                    if b.status != .confirmed { Text(Labels.booking(b.status)).font(.caption2).foregroundStyle(b.status.color) }
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle(c.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                Button { editing = true } label: { Text("Επεξεργασία") }
                Button { newBooking = true } label: { Image(systemName: "calendar.badge.plus") }
                    .accessibilityLabel("Νέα κράτηση για τον πελάτη")
            }
            .sheet(isPresented: $editing) { ClientEditView(client: c) }
            .task {
                #if DEBUG
                if AppConfig.demoRoute == "more/client/edit" {
                    try? await Task.sleep(nanoseconds: 1_200_000_000)
                    editing = true
                }
                if AppConfig.demoRoute == "more/client/merge", let d = store.duplicates(of: c).first {
                    try? await Task.sleep(nanoseconds: 1_600_000_000)
                    mergeID = d.id
                    try? await Task.sleep(nanoseconds: 400_000_000)
                    confirmMerge = true
                }
                #endif
            }
            .alert("Συγχώνευση πελατών;", isPresented: $confirmMerge) {
                Button("Συγχώνευση", role: .destructive) { merge(keep: c) }
                Button("Ακύρωση", role: .cancel) {}
            } message: {
                Text("Οι κρατήσεις του «\(store.client(mergeID)?.name ?? "")» θα μεταφερθούν στον «\(c.name)» και το διπλότυπο προφίλ θα διαγραφεί. Η ενέργεια δεν αναιρείται.")
            }
            .sheet(isPresented: $newBooking) {
                BookingFormView(mode: .create(prefill: {
                    var i = BookingInput()
                    i.clientID = c.id; i.customerName = c.name; i.customerPhone = c.phone; i.customerEmail = c.email
                    i.vehicleID = c.preferredVehicleID ?? ""
                    return i
                }()))
            }
        } else {
            ContentUnavailableView("Ο πελάτης δεν βρέθηκε", systemImage: "person.crop.circle.badge.questionmark")
        }
    }

    /// MergeDuplicatesCard.tsx: same phone (last 10 digits) on another profile.
    private func mergeSection(_ c: Client, _ duplicates: [Client]) -> some View {
        Section {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "arrow.triangle.merge")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.sun)
                    .frame(width: 32, height: 32)
                    .background(Color.sun.opacity(0.15), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Πιθανά διπλότυπα").font(.subheadline.weight(.semibold))
                    Text("Βρέθηκαν πελάτες με το ίδιο τηλέφωνο. Συγχωνεύστε σε αυτό το προφίλ.").font(.caption).foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 2)
            ForEach(duplicates) { d in
                let count = store.bookings.filter { $0.clientID == d.id }.count
                Button {
                    Haptics.select()
                    mergeID = mergeID == d.id ? nil : d.id
                } label: {
                    HStack(spacing: 12) {
                        Avatar(name: d.name, size: 36, tint: .sun)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(d.name).font(.subheadline.weight(.medium)).foregroundStyle(.primary)
                            Text([d.phone, d.email, d.createdAt.map { "από \(Day.format($0, "d MMM yyyy"))" }].compactMap { $0?.nilIfBlank }.joined(separator: " · "))
                                .font(.caption).foregroundStyle(.secondary).lineLimit(2)
                            Text(count == 1 ? "1 κράτηση" : "\(count) κρατήσεις").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: mergeID == d.id ? "largecircle.fill.circle" : "circle")
                            .font(.title3)
                            .foregroundStyle(mergeID == d.id ? Color.sun : Color.secondary.opacity(0.5))
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(mergeID == d.id ? .isSelected : [])
            }
            Button { confirmMerge = true } label: {
                HStack {
                    if merging { ProgressView().tint(.white) }
                    Label("Συγχώνευση", systemImage: "arrow.triangle.merge")
                }
            }
            .buttonStyle(PrimaryButtonStyle(tint: .sun))
            .disabled(mergeID == nil || merging)
            .opacity(mergeID == nil ? 0.5 : 1)
            .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
        }
        .listRowBackground(Color.sun.opacity(0.07))
    }

    private func merge(keep: Client) {
        guard let id = mergeID, let dup = store.client(id) else { return }
        merging = true
        Task {
            do {
                try await store.mergeClients(keep: keep, merge: dup)
                mergeID = nil
            } catch {
                Haptics.notify(.error)
                store.show("Σφάλμα συγχώνευσης", error: true)
            }
            merging = false
        }
    }

    private func stat(_ title: String, _ value: String) -> some View {
        VStack(spacing: 4) {
            Text(value).font(.headline).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .card(padding: 12)
    }
}
