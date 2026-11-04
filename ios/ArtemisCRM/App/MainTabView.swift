import SwiftUI

struct MainTabView: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var router: Router

    var body: some View {
        TabView(selection: $router.tab) {
            NavigationStack(path: $router.todayPath) {
                TodayView().routes()
            }
            .tabItem { Label("Σήμερα", systemImage: "sun.max") }
            .tag(Tab.today)

            NavigationStack(path: $router.bookingsPath) {
                BookingsView().routes()
            }
            .tabItem { Label("Κρατήσεις", systemImage: "calendar") }
            .tag(Tab.bookings)

            NavigationStack(path: $router.requestsPath) {
                RequestsView().routes()
            }
            .tabItem { Label("Αιτήματα", systemImage: "tray") }
            .badge(store.newRequestCount)
            .tag(Tab.requests)

            NavigationStack(path: $router.fleetPath) {
                FleetView().routes()
            }
            .tabItem { Label("Στόλος", systemImage: "car.2") }
            .tag(Tab.fleet)

            NavigationStack(path: $router.morePath) {
                MoreView().routes()
            }
            .tabItem { Label("Περισσότερα", systemImage: "ellipsis.circle") }
            .tag(Tab.more)
        }
        .onChange(of: router.tab) { _, _ in Haptics.select() }
        .overlay(alignment: .top) { bannerOverlay }
        .overlay(alignment: .bottom) { toastOverlay }
        .onAppear(perform: applyDemoRoute)
    }

    @ViewBuilder private var bannerOverlay: some View {
        if let r = store.banner {
            NewRequestBanner(request: r) {
                withAnimation(.spring) { store.banner = nil }
                router.openRequest(r.id)
            } onDismiss: {
                withAnimation(.spring) { store.banner = nil }
            }
            .padding(.top, 4)
            .transition(.move(edge: .top).combined(with: .opacity))
            .task(id: r.id) {
                try? await Task.sleep(nanoseconds: 7_000_000_000)
                withAnimation(.spring) { if store.banner?.id == r.id { store.banner = nil } }
            }
        }
    }

    @ViewBuilder private var toastOverlay: some View {
        if let t = store.toast {
            ToastView(toast: t)
                .padding(.bottom, 64)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .task(id: t.id) {
                    try? await Task.sleep(nanoseconds: 2_400_000_000)
                    withAnimation(.spring) { if store.toast?.id == t.id { store.toast = nil } }
                }
                .onTapGesture { withAnimation { store.toast = nil } }
        }
    }

    /// DEBUG screenshots: `-DemoRoute bookings/detail` etc.
    private func applyDemoRoute() {
        guard let route = AppConfig.demoRoute else { return }
        Task { @MainActor in
            for _ in 0..<40 where !store.hasLoaded { try? await Task.sleep(nanoseconds: 100_000_000) }
            let today = Day.today
            let parts = route.split(separator: "/").map(String.init)
            switch parts.first {
            case "bookings": router.tab = .bookings
                #if DEBUG
                // checklist(/new): a rental with a recorded check-in; edit/delete: the booking with extra fees.
                let pinned: String? = parts.count > 1 ? (parts[1] == "checklist" ? DemoData.checklistBookingID : ["edit", "delete"].contains(parts[1]) ? DemoData.feesBookingID : nil) : nil
                #else
                let pinned: String? = nil
                #endif
                if parts.count > 1, let b = store.booking(pinned) ?? store.bookings.first(where: { $0.checkIn == today && $0.balance > 0 }) ?? store.bookings.first { router.bookingsPath = [.booking(b.id)] }
            case "requests": router.tab = .requests
                if parts.count > 1, let r = store.requests.first(where: { $0.status == .new }) { router.requestsPath = [.request(r.id)] }
            case "today": router.tab = .today
            case "fleet": router.tab = .fleet
                // fleet/detail, fleet/maintenance, fleet/block, fleet/edit open the first model; fleet/new and fleet/units the form.
                if parts.count > 1, !["new", "units"].contains(parts[1]), let v = store.vehicles.first {
                    router.fleetPath = parts[1] == "prices" ? [.vehicle(v.id), .prices(v.id)] : [.vehicle(v.id)]
                }
            case "more": router.tab = .more
                if parts.count > 1 {
                    switch parts[1] {
                    case "clients": router.morePath = [.clients]
                    case "client": if let c = store.clients.first { router.morePath = [.clients, .client(c.id)] }
                    case "money": router.morePath = [.money]
                    case "settings": router.morePath = [.settings]
                    default: break
                    }
                }
            default: router.tab = .today
            }
        }
    }
}

extension View {
    func routes() -> some View {
        navigationDestination(for: Route.self) { route in
            switch route {
            case .booking(let id): BookingDetailView(bookingID: id)
            case .request(let id): RequestDetailView(requestID: id)
            case .vehicle(let id): VehicleDetailView(vehicleID: id)
            case .prices(let id): PriceCalendarView(vehicleID: id)
            case .client(let id): ClientDetailView(clientID: id)
            case .clients: ClientsView()
            case .money: MoneyView()
            case .settings: SettingsView()
            }
        }
    }
}

/// In-app banner for a request that arrived over Realtime.
struct NewRequestBanner: View {
    @EnvironmentObject private var store: AppStore
    let request: BookingRequest
    let onOpen: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        Button(action: onOpen) {
            HStack(spacing: 12) {
                Image(systemName: "bell.badge.fill")
                    .symbolRenderingMode(.palette)
                    .foregroundStyle(Color.white, Color.sun)
                    .font(.title3)
                    .frame(width: 40, height: 40)
                    .background(Color.navyFill, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Νέο αίτημα κράτησης").font(.subheadline.weight(.bold))
                    Text(NotificationManager.shared.body(for: request, vehicleName: store.requestVehicleName(request)))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
            }
            .padding(12)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Color.sun.opacity(0.35), lineWidth: 1))
            .shadow(color: .black.opacity(0.18), radius: 16, y: 6)
            .padding(.horizontal, 12)
        }
        .buttonStyle(.plain)
        .gesture(DragGesture(minimumDistance: 10).onEnded { if $0.translation.height < -10 { onDismiss() } })
        .accessibilityHint("Άνοιγμα αιτήματος")
    }
}
