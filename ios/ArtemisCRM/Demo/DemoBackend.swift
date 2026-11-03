#if DEBUG
import Foundation

/// In-memory backend for `-DemoMode` (DEBUG builds only). Every write works on the sample data
/// so all flows (accept a request, edit a booking, edit prices) can be tried without the owner's
/// password. `-DemoSimulateRequest` drops a new website request in 4 seconds after launch.
final class DemoBackend: Backend {
    let isDemo = true
    private var data = DemoData.make()
    private var continuation: AsyncStream<ChangeEvent>.Continuation?

    private func latency() async { try? await Task.sleep(nanoseconds: 450_000_000) }

    func currentSessionEmail() async -> String? { AppConfig.allowedAdminEmail }
    func signIn(email: String, password: String) async throws -> String { AppConfig.allowedAdminEmail }
    func signOut() async {}

    func loadSnapshot() async throws -> Snapshot {
        await latency()
        return data
    }

    func fetchRequests(createdAfter: String) async throws -> [BookingRequest] {
        data.requests.filter { $0.createdAt > createdAfter }
    }

    func fetchRequest(id: String) async throws -> BookingRequest? { data.requests.first { $0.id == id } }
    func countNewRequests() async throws -> Int { data.requests.filter { $0.status == .new }.count }

    func createBooking(_ input: BookingInput) async throws -> Booking {
        await latency()
        var b = Booking(id: UUID().uuidString.lowercased(), vehicleID: input.vehicleID, customerName: input.customerName,
                        checkIn: input.checkIn, checkOut: input.checkOut, status: input.status, createdAt: ISO.string(Date()))
        input.apply(to: &b)
        data.bookings.append(b)
        return b
    }

    func updateBooking(id: String, _ input: BookingInput) async throws -> Booking {
        await latency()
        guard let i = data.bookings.firstIndex(where: { $0.id == id }) else { throw BackendError.message("Δεν βρέθηκε η κράτηση") }
        input.apply(to: &data.bookings[i])
        return data.bookings[i]
    }

    func setBookingStatus(id: String, _ status: BookingStatus) async throws {
        await latency()
        if let i = data.bookings.firstIndex(where: { $0.id == id }) { data.bookings[i].status = status }
    }

    func updateRequest(id: String, _ update: RequestStatusUpdate) async throws {
        await latency()
        guard let i = data.requests.firstIndex(where: { $0.id == id }) else { return }
        data.requests[i].status = update.status
        if update.includeBookingID { data.requests[i].bookingID = update.bookingID }
    }

    func createClient(_ input: ClientInput) async throws -> Client {
        let c = Client(id: UUID().uuidString.lowercased(), name: input.name, phone: input.phone, email: input.email, createdAt: ISO.string(Date()))
        data.clients.append(c)
        return c
    }

    func createRate(_ input: RateInput) async throws -> VehicleRate {
        await latency()
        try checkOverlap(input, excluding: nil)
        let r = VehicleRate(id: UUID().uuidString.lowercased(), vehicleID: input.vehicleID, label: input.label, startDate: input.startDate,
                            endDate: input.endDate, dailyRate: input.dailyRate, minDays: input.minDays)
        data.rates.append(r)
        data.rates.sort { $0.startDate < $1.startDate }
        return r
    }

    func updateRate(id: String, _ input: RateInput) async throws {
        await latency()
        try checkOverlap(input, excluding: id)
        guard let i = data.rates.firstIndex(where: { $0.id == id }) else { return }
        data.rates[i].label = input.label; data.rates[i].startDate = input.startDate; data.rates[i].endDate = input.endDate
        data.rates[i].dailyRate = input.dailyRate; data.rates[i].minDays = input.minDays
        data.rates.sort { $0.startDate < $1.startDate }
    }

    func deleteRate(id: String) async throws { data.rates.removeAll { $0.id == id } }

    private func checkOverlap(_ input: RateInput, excluding: String?) throws {
        let clash = data.rates.contains { $0.vehicleID == input.vehicleID && $0.id != excluding && $0.startDate <= input.endDate && $0.endDate >= input.startDate }
        if clash { throw BackendError.message("Η περίοδος επικαλύπτει άλλη περίοδο του ίδιου μοντέλου.") }
    }

    func changes() -> AsyncStream<ChangeEvent> {
        AsyncStream { continuation in
            self.continuation = continuation
            guard ProcessInfo.processInfo.arguments.contains("-DemoSimulateRequest") else { return }
            Task { [weak self] in
                try? await Task.sleep(nanoseconds: 4_000_000_000)
                guard let self else { return }
                let r = DemoData.liveRequest()
                self.data.requests.insert(r, at: 0)
                continuation.yield(.requestInserted(r))
            }
        }
    }

    func stopChanges() async { continuation?.finish(); continuation = nil }
    func saveDeviceToken(_ token: String) async {}
}
#endif
