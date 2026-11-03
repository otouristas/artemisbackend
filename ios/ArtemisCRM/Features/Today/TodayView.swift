import SwiftUI

struct TodayView: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var router: Router
    @State private var showNewBooking = false

    private var today: String { Day.today }
    private var active: [Booking] { store.bookings.filter(\.isActive) }
    private var pickups: [Booking] { active.filter { $0.checkIn == today } }
    private var returns: [Booking] { active.filter { $0.checkOut == today } }
    private var pending: [Booking] { store.bookings.filter { $0.status == .pending && $0.checkOut >= today } }
    private var overdue: [Booking] { active.filter { $0.balance > 0 && $0.checkOut <= today } }
    private var onRoad: Int { active.filter { $0.checkIn <= today && $0.checkOut > today }.count }
    private var loading: Bool { !store.hasLoaded }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 22) {
                header
                if store.newRequestCount > 0 { requestsCallout }
                kpis
                section("Παραλαβές σήμερα", items: pickups, emphasis: .pickup, empty: "Καμία παραλαβή σήμερα", icon: "arrow.up.right.circle")
                section("Επιστροφές σήμερα", items: returns, emphasis: .dropoff, empty: "Καμία επιστροφή σήμερα", icon: "arrow.down.left.circle")
                agenda
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
            .skeleton(loading)
        }
        .background(Color.screen)
        .navigationTitle("Σήμερα")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showNewBooking = true } label: { Image(systemName: "plus.circle.fill").font(.title3) }
                    .accessibilityLabel("Νέα κράτηση")
            }
        }
        .refreshable { await store.refresh() }
        .sheet(isPresented: $showNewBooking) { BookingFormView(mode: .create(prefill: nil)) }
        .onChange(of: store.hasLoaded) { _, loaded in
            if loaded && AppConfig.demoRoute == "today/new" { showNewBooking = true }
        }
        .overlay {
            if case .failed(let msg) = store.phase {
                ContentUnavailableView {
                    Label("Δεν ήταν δυνατή η φόρτωση", systemImage: "wifi.exclamationmark")
                } description: { Text(msg) } actions: {
                    Button("Δοκιμή ξανά") { Task { await store.refresh() } }.buttonStyle(.borderedProminent)
                }
                .background(Color.screen)
            }
        }
    }

    private var header: some View {
        HStack {
            Text(Day.long(today))
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.secondary)
            if store.isDemo { DemoBadge() }
            Spacer()
            Label("\(onRoad) σε ενοικίαση", systemImage: "car.side.fill")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.navy)
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(Color.navy.opacity(0.1), in: Capsule())
        }
        .padding(.top, 2)
    }

    private var requestsCallout: some View {
        Button {
            router.tab = .requests
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "tray.full.fill")
                    .foregroundStyle(.white)
                    .frame(width: 38, height: 38)
                    .background(Color.sun, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(store.newRequestCount == 1 ? "1 νέο αίτημα από το site" : "\(store.newRequestCount) νέα αιτήματα από το site")
                        .font(.subheadline.weight(.semibold))
                    Text("Απαντήστε γρήγορα για να μη χαθεί η κράτηση").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(.tertiary)
            }
            .card(padding: 12)
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Color.sun.opacity(0.4), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var kpis: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
            KPITile(title: "Αφίξεις", value: "\(pickups.count)", icon: "arrow.up.right", tint: .success, caption: "παραλαβές σήμερα")
            KPITile(title: "Αναχωρήσεις", value: "\(returns.count)", icon: "arrow.down.left", tint: .danger, caption: "επιστροφές σήμερα")
            Button { router.tab = .bookings } label: {
                KPITile(title: "Εκκρεμείς", value: "\(pending.count)", icon: "clock", tint: .warning, caption: "προς επιβεβαίωση")
            }.buttonStyle(.plain)
            NavigationLink(value: Route.money) {
                KPITile(title: "Ανοιχτά υπόλοιπα", value: Money.format(overdue.reduce(0) { $0 + $1.balance }), icon: "eurosign", tint: .sun,
                        caption: overdue.count == 1 ? "1 κράτηση" : "\(overdue.count) κρατήσεις")
            }.buttonStyle(.plain)
        }
    }

    @ViewBuilder
    private func section(_ title: String, items: [Booking], emphasis: TripCardEmphasis, empty: String, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title, count: items.count)
            if items.isEmpty && !loading {
                HStack(spacing: 10) {
                    Image(systemName: icon).foregroundStyle(.tertiary).font(.title3)
                    Text(empty).font(.subheadline).foregroundStyle(.secondary)
                }
                .card(padding: 14)
            } else {
                ForEach(loading ? Placeholder.bookings : items) { b in
                    NavigationLink(value: Route.booking(b.id)) {
                        TripCard(booking: b, emphasis: emphasis, showContact: true)
                    }
                    .buttonStyle(.plain)
                    .contextMenu { BookingContextMenu(booking: b) }
                }
            }
        }
    }

    private var agenda: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader("Επόμενες 7 ημέρες")
            VStack(spacing: 0) {
                ForEach(1...7, id: \.self) { offset in
                    let day = Day.add(offset, to: today)
                    let ins = active.filter { $0.checkIn == day }
                    let outs = active.filter { $0.checkOut == day }
                    AgendaDayRow(day: day, pickups: ins, returns: outs)
                    if offset < 7 { Divider().padding(.leading, 64) }
                }
            }
            .card(padding: 0)
        }
    }
}

struct AgendaDayRow: View {
    @EnvironmentObject private var store: AppStore
    let day: String
    let pickups: [Booking]
    let returns: [Booking]
    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                guard !(pickups.isEmpty && returns.isEmpty) else { return }
                Haptics.select()
                withAnimation(.snappy) { expanded.toggle() }
            } label: {
                HStack(spacing: 14) {
                    VStack(spacing: 0) {
                        Text(Day.format(day, "EEE").uppercased(with: greek)).font(.caption2.weight(.bold)).foregroundStyle(.secondary)
                        Text(Day.format(day, "d")).font(.title3.weight(.bold)).monospacedDigit()
                    }
                    .frame(width: 36)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(Day.relativeLabel(day)).font(.subheadline.weight(.semibold))
                        if pickups.isEmpty && returns.isEmpty {
                            Text("Χωρίς κινήσεις").font(.caption).foregroundStyle(.secondary)
                        } else {
                            Text(pickups.prefix(2).map(\.customerName).joined(separator: ", ") + (pickups.count > 2 ? "…" : ""))
                                .font(.caption).foregroundStyle(.secondary).lineLimit(1)
                        }
                    }
                    Spacer()
                    HStack(spacing: 6) {
                        if !pickups.isEmpty { StatusPill(text: "\(pickups.count)", color: .success, icon: "arrow.up.right") }
                        if !returns.isEmpty { StatusPill(text: "\(returns.count)", color: .danger, icon: "arrow.down.left") }
                    }
                    if !(pickups.isEmpty && returns.isEmpty) {
                        Image(systemName: "chevron.down")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.tertiary)
                            .rotationEffect(.degrees(expanded ? 180 : 0))
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if expanded {
                VStack(spacing: 8) {
                    ForEach(pickups) { row($0, pickup: true) }
                    ForEach(returns) { row($0, pickup: false) }
                }
                .padding(.horizontal, 14)
                .padding(.bottom, 12)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }

    private func row(_ b: Booking, pickup: Bool) -> some View {
        NavigationLink(value: Route.booking(b.id)) {
            HStack(spacing: 10) {
                Image(systemName: pickup ? "arrow.up.right" : "arrow.down.left")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(pickup ? Color.success : Color.danger)
                    .frame(width: 22)
                VehicleImage(url: store.vehicle(b.vehicleID)?.imageURL, type: store.vehicle(b.vehicleID)?.type ?? .car, cornerRadius: 6)
                    .frame(width: 40, height: 28)
                VStack(alignment: .leading, spacing: 1) {
                    Text(b.customerName).font(.subheadline.weight(.medium)).lineLimit(1)
                    Text(store.vehicleName(b.vehicleID) + (b.deliveryLocation.map { " · \($0)" } ?? "")).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
            }
            .padding(.leading, 50)
        }
        .buttonStyle(.plain)
    }
}

/// Shapes used while the first load is in flight (rendered redacted).
enum Placeholder {
    static let bookings: [Booking] = (1...2).map {
        Booking(id: "placeholder-\($0)", vehicleID: "", plate: "ΕΜΜ 0000", customerName: "Όνομα Πελάτη", checkIn: Day.today,
                checkOut: Day.add(3, to: Day.today), status: .confirmed, totalPrice: 120, depositAmount: 40, deliveryLocation: "Λιμάνι Καμάρες")
    }
}
