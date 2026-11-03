import Foundation
import SwiftUI

enum Tab: Hashable { case today, bookings, requests, fleet, more }

enum Route: Hashable {
    case booking(String)
    case request(String)
    case vehicle(String)
    case client(String)
    case clients
    case money
    case settings
}

/// Navigation state, shared so notifications and deep links can open a screen.
@MainActor
final class Router: ObservableObject {
    static let shared = Router()
    @Published var tab: Tab = .today
    @Published var todayPath: [Route] = []
    @Published var bookingsPath: [Route] = []
    @Published var requestsPath: [Route] = []
    @Published var fleetPath: [Route] = []
    @Published var morePath: [Route] = []

    func openRequest(_ id: String) {
        tab = .requests
        requestsPath = [.request(id)]
    }

    func open(url: URL) {
        // artemiscrm://request/<id>, artemiscrm://booking/<id>
        guard url.scheme == "artemiscrm", let host = url.host else { return }
        let id = url.pathComponents.dropFirst().first ?? ""
        switch host {
        case "request" where !id.isEmpty: openRequest(id)
        case "booking" where !id.isEmpty: tab = .bookings; bookingsPath = [.booking(id)]
        case "requests": tab = .requests; requestsPath = []
        default: break
        }
    }
}

@MainActor
final class AuthManager: ObservableObject {
    enum State: Equatable { case checking, signedOut, signedIn(String) }
    @Published var state: State = .checking
    let backend: Backend

    init(backend: Backend) { self.backend = backend }

    func restore() async {
        if let email = await backend.currentSessionEmail() { state = .signedIn(email) } else { state = .signedOut }
    }

    func signIn(email: String, password: String) async throws {
        let e = try await backend.signIn(email: email, password: password)
        state = .signedIn(e)
    }

    func signOut() async {
        await backend.signOut()
        state = .signedOut
    }
}

/// The app's data, loaded together and kept fresh by Realtime (like react-query + channels on the web).
@MainActor
final class AppStore: ObservableObject {
    enum Phase: Equatable { case idle, loading, loaded, failed(String) }

    @Published private(set) var vehicles: [Vehicle] = []
    @Published private(set) var bookings: [Booking] = []
    @Published private(set) var requests: [BookingRequest] = []
    @Published private(set) var clients: [Client] = []
    @Published private(set) var rates: [VehicleRate] = []
    @Published private(set) var blocks: [VehicleBlock] = []
    @Published private(set) var phase: Phase = .idle
    @Published var banner: BookingRequest?
    @Published var toast: Toast?

    struct Toast: Identifiable, Equatable {
        let id = UUID()
        let text: String
        var isError = false
    }

    let backend: Backend
    private var changesTask: Task<Void, Never>?
    private var reloadTask: Task<Void, Never>?

    init(backend: Backend) { self.backend = backend }

    var isDemo: Bool { backend.isDemo }
    var hasLoaded: Bool { phase == .loaded || !vehicles.isEmpty }

    // MARK: Loading

    func refresh() async {
        if !hasLoaded { phase = .loading }
        do {
            let s = try await backend.loadSnapshot()
            apply(s)
            phase = .loaded
            NotificationManager.shared.didLoad(requests: requests)
        } catch {
            if (error as? CancellationError) != nil || "\(error)".contains("cancelled") { return }
            phase = hasLoaded ? .loaded : .failed(error.localizedDescription)
            if hasLoaded { show("Αποτυχία ανανέωσης", error: true) }
        }
    }

    private func apply(_ s: Snapshot) {
        vehicles = s.vehicles
        bookings = s.bookings
        requests = s.requests
        clients = s.clients
        rates = s.rates
        blocks = s.blocks
    }

    func startLive() {
        changesTask?.cancel()
        changesTask = Task { [weak self] in
            guard let self else { return }
            for await event in self.backend.changes() {
                switch event {
                case .requestInserted(let r):
                    if !self.requests.contains(where: { $0.id == r.id }) {
                        self.requests.insert(r, at: 0)
                        NotificationManager.shared.announce(r, vehicleName: self.requestVehicleName(r))
                        withAnimation(.spring(response: 0.45, dampingFraction: 0.8)) { self.banner = r }
                        Haptics.notify(.success)
                        NotificationManager.shared.didLoad(requests: self.requests)
                    }
                case .tableChanged:
                    self.scheduleReload()
                }
            }
        }
    }

    func stopLive() {
        changesTask?.cancel()
        changesTask = nil
        Task { await backend.stopChanges() }
    }

    private func scheduleReload() {
        reloadTask?.cancel()
        reloadTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 600_000_000)
            guard !Task.isCancelled else { return }
            await self?.refresh()
        }
    }

    func reset() {
        apply(Snapshot())
        phase = .idle
        banner = nil
    }

    func show(_ text: String, error: Bool = false) {
        withAnimation(.spring) { toast = Toast(text: text, isError: error) }
    }

    // MARK: Lookups

    var activeVehicles: [Vehicle] { vehicles.filter(\.active) }
    var newRequestCount: Int { requests.filter { $0.status == .new }.count }

    func vehicle(_ id: String?) -> Vehicle? { vehicles.first { $0.id == id } }
    func vehicleName(_ id: String?) -> String { vehicle(id)?.name ?? "Όχημα" }
    func booking(_ id: String?) -> Booking? { bookings.first { $0.id == id } }
    func request(_ id: String?) -> BookingRequest? { requests.first { $0.id == id } }
    func client(_ id: String?) -> Client? { clients.first { $0.id == id } }
    func rates(for vehicleID: String) -> [VehicleRate] { rates.filter { $0.vehicleID == vehicleID }.sorted { $0.startDate < $1.startDate } }

    func matchedVehicle(for r: BookingRequest) -> Vehicle? { Availability.matchVehicle(r.requestedVehicle, in: activeVehicles) }
    func requestVehicleName(_ r: BookingRequest) -> String { matchedVehicle(for: r)?.name ?? r.requestedVehicle ?? "Όχημα" }

    func freeUnits(_ v: Vehicle, from: String, to: String, excluding: String? = nil) -> Int {
        Availability.freeUnits(vehicle: v, from: from, to: to, bookings: bookings, blocks: blocks, excluding: excluding)
    }
    func freeToday(_ v: Vehicle) -> Int { Availability.freeUnits(vehicle: v, on: Day.today, bookings: bookings, blocks: blocks) }
    func todayRate(_ v: Vehicle) -> Double? { Pricing.rate(for: Day.today, in: rates(for: v.id))?.dailyRate }
    func price(_ vehicleID: String, from: String, to: String) -> RateBreakdown? {
        Pricing.calculate(rates: rates(for: vehicleID), checkIn: from, checkOut: to)
    }

    /// History for a client: linked by client_id, or same name + phone for older rows.
    func bookings(for c: Client) -> [Booking] {
        bookings.filter { b in
            if b.clientID == c.id { return true }
            guard b.clientID == nil else { return false }
            return b.customerName.lowercased() == c.name.lowercased() && (b.customerPhone ?? "") == (c.phone ?? "")
        }.sorted { $0.checkIn > $1.checkIn }
    }

    func requestForBooking(_ b: Booking) -> BookingRequest? { requests.first { $0.bookingID == b.id } }

    // MARK: Writes

    /// resolveClientId() from BookingFormPage: reuse a client with the same name and phone or create one.
    private func resolveClientID(_ input: BookingInput) async -> String? {
        if let id = input.clientID { return id }
        let name = input.customerName.trimmed.lowercased()
        let phone = input.customerPhone?.trimmed ?? ""
        if let existing = clients.first(where: { $0.name.trimmed.lowercased() == name && ($0.phone ?? "") == phone }) { return existing.id }
        guard let created = try? await backend.createClient(ClientInput(name: input.customerName.trimmed, phone: phone.nilIfBlank, email: input.customerEmail.nilIfBlank)) else { return nil }
        clients.append(created)
        clients.sort { $0.name < $1.name }
        return created.id
    }

    @discardableResult
    func saveBooking(_ input: BookingInput, editing: Booking?, fromRequest: BookingRequest?) async throws -> Booking {
        var payload = input
        payload.clientID = await resolveClientID(input)
        let saved: Booking
        if let editing {
            saved = try await backend.updateBooking(id: editing.id, payload)
            if let i = bookings.firstIndex(where: { $0.id == editing.id }) { bookings[i] = saved }
        } else {
            saved = try await backend.createBooking(payload)
            bookings.append(saved)
            bookings.sort { $0.checkIn < $1.checkIn }
            if let r = fromRequest {
                try? await backend.updateRequest(id: r.id, RequestStatusUpdate(status: .accepted, bookingID: saved.id, includeBookingID: true))
                if let i = requests.firstIndex(where: { $0.id == r.id }) {
                    requests[i].status = .accepted
                    requests[i].bookingID = saved.id
                }
                NotificationManager.shared.didLoad(requests: requests)
            }
        }
        return saved
    }

    func setStatus(_ b: Booking, _ status: BookingStatus) async {
        do {
            try await backend.setBookingStatus(id: b.id, status)
            if let i = bookings.firstIndex(where: { $0.id == b.id }) { bookings[i].status = status }
            Haptics.notify(.success)
            show(status == .confirmed ? "Η κράτηση επιβεβαιώθηκε" : status == .cancelled ? "Η κράτηση ακυρώθηκε" : "Η κράτηση ενημερώθηκε")
        } catch {
            Haptics.notify(.error)
            show("Σφάλμα ενημέρωσης", error: true)
        }
    }

    func setRequestStatus(_ r: BookingRequest, _ status: RequestStatus) async {
        do {
            try await backend.updateRequest(id: r.id, RequestStatusUpdate(status: status))
            if let i = requests.firstIndex(where: { $0.id == r.id }) { requests[i].status = status }
            NotificationManager.shared.didLoad(requests: requests)
            Haptics.notify(.success)
            show(status == .rejected ? "Το αίτημα απορρίφθηκε" : status == .reviewed ? "Σημειώθηκε ως ελεγμένο" : "Το αίτημα ενημερώθηκε")
        } catch {
            Haptics.notify(.error)
            show("Σφάλμα ενημέρωσης αιτήματος", error: true)
        }
    }

    func saveRate(_ input: RateInput, editing: VehicleRate?) async throws {
        if let editing {
            try await backend.updateRate(id: editing.id, input)
            if let i = rates.firstIndex(where: { $0.id == editing.id }) {
                rates[i].label = input.label; rates[i].startDate = input.startDate; rates[i].endDate = input.endDate
                rates[i].dailyRate = input.dailyRate; rates[i].minDays = input.minDays
            }
        } else {
            let r = try await backend.createRate(input)
            rates.append(r)
        }
        rates.sort { $0.startDate < $1.startDate }
    }

    func deleteRate(_ r: VehicleRate) async {
        do {
            try await backend.deleteRate(id: r.id)
            rates.removeAll { $0.id == r.id }
            show("Η περίοδος διαγράφηκε")
        } catch {
            show("Σφάλμα διαγραφής", error: true)
        }
    }
}
