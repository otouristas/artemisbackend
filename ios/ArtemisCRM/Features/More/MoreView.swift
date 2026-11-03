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
                    Image("Logo")
                        .resizable().scaledToFit()
                        .foregroundStyle(.white)
                        .padding(10)
                        .frame(width: 64, height: 64)
                        .background(Color.navyFill, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 6) {
                            Text("Artemis Rental").font(.headline)
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
                Section("Στοιχεία") {
                    if let p = c.phone { InfoRow(icon: "phone", title: "Τηλέφωνο", value: p) }
                    if let e = c.email { InfoRow(icon: "envelope", title: "Email", value: e) }
                    if let l = c.preferredLanguage { InfoRow(icon: "globe", title: "Γλώσσα", value: Locale(identifier: "el").localizedString(forLanguageCode: l) ?? l) }
                    if let n = c.notes?.nilIfBlank { Text(n).font(.subheadline) }
                }
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
                Button { newBooking = true } label: { Image(systemName: "calendar.badge.plus") }
                    .accessibilityLabel("Νέα κράτηση για τον πελάτη")
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

    private func stat(_ title: String, _ value: String) -> some View {
        VStack(spacing: 4) {
            Text(value).font(.headline).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .card(padding: 12)
    }
}
