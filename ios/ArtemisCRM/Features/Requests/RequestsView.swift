import SwiftUI

struct RequestsView: View {
    enum Filter: Hashable { case new, reviewed, accepted, rejected, all }

    @EnvironmentObject private var store: AppStore
    @State private var filter: Filter = .new
    @State private var query = ""
    @State private var rejectTarget: BookingRequest?

    private func count(_ s: RequestStatus) -> Int { store.requests.filter { $0.status == s }.count }

    private var filtered: [BookingRequest] {
        let base: [BookingRequest]
        switch filter {
        case .new: base = store.requests.filter { $0.status == .new }
        case .reviewed: base = store.requests.filter { $0.status == .reviewed }
        case .accepted: base = store.requests.filter { $0.status == .accepted }
        case .rejected: base = store.requests.filter { $0.status == .rejected }
        case .all: base = store.requests
        }
        let q = query.trimmed.lowercased()
        guard !q.isEmpty else { return base }
        return base.filter { r in
            [r.customerName, r.customerEmail, r.customerPhone, r.requestedVehicle, r.pickupLocation].compactMap { $0?.lowercased() }.contains { $0.contains(q) }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            UnderlineTabs(selection: $filter, items: [
                (.new, "Νέα", count(.new)),
                (.reviewed, "Ελεγμένα", nil),
                (.accepted, "Αποδεκτά", nil),
                (.rejected, "Απορριφθέντα", nil),
                (.all, "Όλα", nil),
            ], scrollable: true)
            .background(Color.card)

            List {
                if !store.hasLoaded {
                    ForEach(0..<3, id: \.self) { _ in RequestRow(request: Self.placeholder).skeleton(true).plainRow() }
                } else if filtered.isEmpty {
                    emptyState.plainRow()
                } else {
                    if filter == .new {
                        Section {
                            ForEach(filtered) { row($0) }
                        } header: {
                            SectionHeader(filtered.count == 1 ? "1 αίτημα σε αναμονή" : "\(filtered.count) αιτήματα σε αναμονή").textCase(nil).padding(.top, 6)
                        }
                    } else {
                        ForEach(filtered) { row($0) }
                    }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Color.screen)
            .refreshable { await store.refresh() }
        }
        .background(Color.screen)
        .navigationTitle("Αιτήματα")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .automatic), prompt: "Όνομα, email, όχημα")
        .confirmationDialog("Απόρριψη αιτήματος;", isPresented: Binding(get: { rejectTarget != nil }, set: { if !$0 { rejectTarget = nil } }),
                            titleVisibility: .visible, presenting: rejectTarget) { r in
            Button("Απόρριψη", role: .destructive) { Task { await store.setRequestStatus(r, .rejected) } }
            Button("Πίσω", role: .cancel) {}
        } message: { r in Text("\(r.customerName) · \(Day.shortRange(r.checkIn, r.checkOut))") }
    }

    private func row(_ r: BookingRequest) -> some View {
        ZStack {
            NavigationLink(value: Route.request(r.id)) { EmptyView() }.opacity(0)
            RequestRow(request: r)
        }
        .plainRow()
        .swipeActions(edge: .leading, allowsFullSwipe: true) {
            if r.status == .new {
                Button { Task { await store.setRequestStatus(r, .reviewed) } } label: { Label("Ελέγχθηκε", systemImage: "eye") }.tint(.navy)
            }
        }
        .swipeActions(edge: .trailing) {
            if r.status == .new || r.status == .reviewed {
                Button(role: .destructive) { rejectTarget = r } label: { Label("Απόρριψη", systemImage: "xmark") }
            }
            if let url = Contact.whatsApp(request: r) {
                Button { UIApplication.shared.open(url) } label: { Label("WhatsApp", systemImage: "message.fill") }
                    .tint(Color(red: 0.15, green: 0.68, blue: 0.38))
            }
        }
        .contextMenu {
            if let url = Contact.telURL(r.customerPhone) { Button { UIApplication.shared.open(url) } label: { Label("Κλήση", systemImage: "phone") } }
            if let url = Contact.whatsApp(request: r) { Button { UIApplication.shared.open(url) } label: { Label("WhatsApp", systemImage: "message") } }
            if let url = Contact.mailURL(r.customerEmail) { Button { UIApplication.shared.open(url) } label: { Label("Email", systemImage: "envelope") } }
            if r.status == .new {
                Divider()
                Button { Task { await store.setRequestStatus(r, .reviewed) } } label: { Label("Σημείωση ως ελεγμένο", systemImage: "eye") }
            }
        }
    }

    @ViewBuilder private var emptyState: some View {
        if !query.isEmpty {
            ContentUnavailableView.search(text: query)
        } else if filter == .new {
            ContentUnavailableView("Όλα απαντήθηκαν", systemImage: "tray", description: Text("Τα νέα αιτήματα από το rentacarsifnos.com θα εμφανιστούν εδώ και θα λάβετε ειδοποίηση."))
        } else {
            ContentUnavailableView("Κανένα αίτημα", systemImage: "tray", description: Text("Δεν υπάρχουν αιτήματα σε αυτή την κατηγορία."))
        }
    }

    static let placeholder = BookingRequest(id: "p", customerName: "Όνομα Πελάτη", requestedVehicle: "Fiat Panda", checkIn: Day.today,
                                            checkOut: Day.add(4, to: Day.today), childSeat: false, status: .new, createdAt: ISO.string(Date()))
}

struct RequestRow: View {
    @EnvironmentObject private var store: AppStore
    let request: BookingRequest

    var body: some View {
        let v = store.matchedVehicle(for: request)
        let free = v.map { store.freeUnits($0, from: request.checkIn, to: request.checkOut) }
        HStack(alignment: .top, spacing: 12) {
            ZStack(alignment: .topTrailing) {
                Avatar(name: request.customerName, size: 44, tint: request.status == .new ? .sun : .navy)
                if request.status == .new {
                    Circle().fill(Color.sun).frame(width: 11, height: 11)
                        .overlay(Circle().strokeBorder(Color.card, lineWidth: 2))
                        .offset(x: 2, y: -2)
                }
            }
            VStack(alignment: .leading, spacing: 5) {
                HStack(alignment: .firstTextBaseline) {
                    Text(request.customerName).font(.headline).lineLimit(1)
                    Spacer(minLength: 6)
                    Text(ISO.relative(request.createdAt)).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }
                Text("\(v?.name ?? request.requestedVehicle ?? "Χωρίς όχημα") · \(Day.shortRange(request.checkIn, request.checkOut)) · \(request.nights) ημ.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                if let m = request.message?.nilIfBlank {
                    Text("“\(m)”").font(.footnote).foregroundStyle(.secondary).lineLimit(1).italic()
                }
                HStack(spacing: 6) {
                    if request.status != .new { StatusPill(text: Labels.request(request.status), color: request.status.color) }
                    if request.status == .new || request.status == .reviewed {
                        if let free {
                            StatusPill(text: free > 0 ? "Διαθέσιμο · \(free)" : "Μη διαθέσιμο", color: free > 0 ? .success : .danger,
                                       icon: free > 0 ? "checkmark" : "exclamationmark.triangle")
                        } else {
                            StatusPill(text: "Άγνωστο μοντέλο", color: .warning, icon: "questionmark")
                        }
                    }
                    if let est = request.estimatedTotal { Text(Money.format(est)).font(.caption.weight(.semibold)).foregroundStyle(.secondary) }
                    Spacer(minLength: 0)
                }
            }
            if let v {
                VehicleImage(url: v.imageURL, type: v.type, cornerRadius: 8).frame(width: 64, height: 46)
            }
        }
        .card(padding: 14)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}
