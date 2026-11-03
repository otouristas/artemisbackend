import SwiftUI

struct BookingsView: View {
    enum Segment: Hashable { case upcoming, inRental, history }

    @EnvironmentObject private var store: AppStore
    @State private var segment: Segment = .upcoming
    @State private var query = ""
    @State private var showNew = false
    @State private var cancelTarget: Booking?

    private var today: String { Day.today }

    private var filtered: [Booking] {
        let q = query.trimmed.lowercased()
        let base: [Booking]
        switch segment {
        case .upcoming: base = store.bookings.filter { $0.isActive && $0.checkIn >= today }.sorted { $0.checkIn < $1.checkIn }
        case .inRental: base = store.bookings.filter { $0.isActive && $0.checkIn < today && $0.checkOut >= today }.sorted { $0.checkOut < $1.checkOut }
        case .history: base = store.bookings.filter { $0.checkOut < today || ($0.status == .cancelled && $0.checkOut >= today) }.sorted { $0.checkIn > $1.checkIn }
        }
        guard !q.isEmpty else { return base }
        return base.filter { b in
            [b.customerName, b.customerPhone, b.customerEmail, b.plate, store.vehicleName(b.vehicleID), b.deliveryLocation]
                .compactMap { $0?.lowercased() }.contains { $0.contains(q) }
        }
    }

    /// Group by the day that matters for the segment: pickup day, return day, or month for history.
    private var groups: [(key: String, title: String, items: [Booking])] {
        var order: [String] = []
        var dict: [String: [Booking]] = [:]
        for b in filtered {
            let key: String
            switch segment {
            case .upcoming: key = b.checkIn
            case .inRental: key = b.checkOut
            case .history: key = String(b.checkIn.prefix(7))
            }
            if dict[key] == nil { order.append(key) }
            dict[key, default: []].append(b)
        }
        return order.map { key in
            let title: String
            switch segment {
            case .upcoming: title = Day.relativeLabel(key)
            case .inRental: title = "Επιστροφή · " + Day.relativeLabel(key)
            case .history: title = Day.format(key + "-01", "LLLL yyyy").capitalizedFirst
            }
            return (key, title, dict[key] ?? [])
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            UnderlineTabs(selection: $segment, items: [
                (.upcoming, "Επερχόμενες", nil),
                (.inRental, "Σε ενοικίαση", nil),
                (.history, "Ιστορικό", nil),
            ])
            .background(Color.card)

            List {
                if !store.hasLoaded {
                    ForEach(Placeholder.bookings) { b in TripCard(booking: b).skeleton(true).plainRow() }
                } else if groups.isEmpty {
                    emptyState.plainRow()
                } else {
                    ForEach(groups, id: \.key) { group in
                        Section {
                            ForEach(group.items) { b in
                                ZStack {
                                    NavigationLink(value: Route.booking(b.id)) { EmptyView() }.opacity(0)
                                    TripCard(booking: b)
                                }
                                .plainRow()
                                .contextMenu { BookingContextMenu(booking: b) }
                                .swipeActions(edge: .leading, allowsFullSwipe: true) {
                                    if b.status == .pending {
                                        Button { Task { await store.setStatus(b, .confirmed) } } label: { Label("Επιβεβαίωση", systemImage: "checkmark") }
                                            .tint(.success)
                                    }
                                    if let url = Contact.whatsApp(booking: b, vehicleName: store.vehicleName(b.vehicleID)) {
                                        Button { UIApplication.shared.open(url) } label: { Label("WhatsApp", systemImage: "message.fill") }
                                            .tint(Color(red: 0.15, green: 0.68, blue: 0.38))
                                    }
                                }
                                .swipeActions(edge: .trailing) {
                                    if b.status != .cancelled {
                                        Button(role: .destructive) { cancelTarget = b } label: { Label("Ακύρωση", systemImage: "xmark") }
                                    }
                                    if let tel = Contact.telURL(b.customerPhone) {
                                        Button { UIApplication.shared.open(tel) } label: { Label("Κλήση", systemImage: "phone.fill") }.tint(.navy)
                                    }
                                }
                            }
                        } header: {
                            SectionHeader(group.title, count: group.items.count)
                                .padding(.top, 6)
                                .textCase(nil)
                        }
                    }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Color.screen)
            .refreshable { await store.refresh() }
        }
        .background(Color.screen)
        .navigationTitle("Κρατήσεις")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .automatic), prompt: "Πελάτης, πινακίδα, όχημα")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showNew = true } label: { Image(systemName: "plus.circle.fill").font(.title3) }
                    .accessibilityLabel("Νέα κράτηση")
            }
        }
        .sheet(isPresented: $showNew) { BookingFormView(mode: .create(prefill: nil)) }
        .confirmationDialog("Ακύρωση κράτησης;", isPresented: Binding(get: { cancelTarget != nil }, set: { if !$0 { cancelTarget = nil } }), titleVisibility: .visible, presenting: cancelTarget) { b in
            Button("Ακύρωση κράτησης", role: .destructive) { Task { await store.setStatus(b, .cancelled) } }
            Button("Πίσω", role: .cancel) {}
        } message: { b in
            Text("\(b.customerName) · \(Day.shortRange(b.checkIn, b.checkOut))")
        }
    }

    @ViewBuilder private var emptyState: some View {
        if !query.isEmpty {
            ContentUnavailableView.search(text: query)
        } else {
            switch segment {
            case .upcoming:
                ContentUnavailableView("Καμία επερχόμενη κράτηση", systemImage: "calendar.badge.plus", description: Text("Οι νέες κρατήσεις θα εμφανιστούν εδώ."))
            case .inRental:
                ContentUnavailableView("Κανένα όχημα σε ενοικίαση", systemImage: "car.side", description: Text("Δεν υπάρχει ενεργή ενοικίαση αυτή τη στιγμή."))
            case .history:
                ContentUnavailableView("Χωρίς ιστορικό", systemImage: "clock.arrow.circlepath", description: Text("Οι ολοκληρωμένες κρατήσεις θα εμφανιστούν εδώ."))
            }
        }
    }
}

extension View {
    func plainRow() -> some View {
        listRowSeparator(.hidden)
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
    }
}
