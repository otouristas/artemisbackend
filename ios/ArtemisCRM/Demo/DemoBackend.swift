#if DEBUG
import Foundation

/// In-memory backend for `-DemoMode` (DEBUG builds only). Every write works on the sample data
/// so all flows (accept a request, edit a booking, edit prices) can be tried without the owner's
/// password. `-DemoSimulateRequest` drops a new website request in 4 seconds after launch.
final class DemoBackend: Backend {
    let isDemo = true
    private var data = DemoData.make()
    private lazy var checklists = DemoData.checklists(for: data)
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

    func deleteBooking(id: String) async throws {
        await latency()
        data.bookings.removeAll { $0.id == id }
        checklists.removeAll { $0.bookingID == id }   // ON DELETE CASCADE
        for i in data.requests.indices where data.requests[i].bookingID == id { data.requests[i].bookingID = nil } // SET NULL
    }

    func mergeClients(keepID: String, mergeID: String) async throws {
        await latency()
        for i in data.bookings.indices where data.bookings[i].clientID == mergeID { data.bookings[i].clientID = keepID }
        data.clients.removeAll { $0.id == mergeID }
    }

    func fetchChecklists(bookingID: String) async throws -> [VehicleChecklist] {
        await latency()
        return checklists.filter { $0.bookingID == bookingID }.sorted { $0.createdAt < $1.createdAt }
    }

    func createChecklist(_ input: ChecklistInput) async throws -> VehicleChecklist {
        await latency()
        let c = VehicleChecklist(id: UUID().uuidString.lowercased(), bookingID: input.bookingID, type: input.type, fuelLevel: input.fuelLevel,
                                 mileage: input.mileage, damageNotes: input.damageNotes.nilIfBlank, photoURLs: input.photoURLs, createdAt: ISO.string(Date()))
        checklists.append(c)
        return c
    }

    /// Writes the photo to Caches so the app shows it like a bucket URL.
    func uploadVehiclePhoto(_ jpeg: Data) async throws -> String {
        try? await Task.sleep(nanoseconds: 250_000_000)
        return try DemoData.storePhoto(jpeg, name: "\(Int(Date().timeIntervalSince1970 * 1000))_\(UUID().uuidString.prefix(6).lowercased()).jpg")
    }

    func createVehicle(_ input: VehicleInput) async throws -> Vehicle {
        await latency()
        let clean = input.plates.map(\.trimmed).filter { !$0.isEmpty }
        let v = Vehicle(id: UUID().uuidString.lowercased(), name: input.name.trimmed, type: input.type, cc: input.cc, quantity: input.quantity,
                        plate: VehicleUpdate.plateString(clean), plates: clean.isEmpty ? nil : clean, imageURL: input.imageURL.nilIfBlank,
                        active: true, slug: nil, notes: input.notes.nilIfBlank, showOnSite: true,
                        dailyRateLow: input.dailyRateLow, dailyRateHigh: input.dailyRateHigh)
        data.vehicles.append(v)
        data.vehicles.sort { $0.name < $1.name }
        return v
    }

    func updateVehicle(id: String, _ update: VehicleUpdate) async throws -> Vehicle {
        await latency()
        guard let i = data.vehicles.firstIndex(where: { $0.id == id }) else { throw BackendError.message("Δεν βρέθηκε το όχημα") }
        if let slug = update.slug, let s = slug.nilIfBlank, data.vehicles.contains(where: { $0.id != id && $0.slug == s }) {
            throw BackendError.slugTaken
        }
        update.apply(to: &data.vehicles[i])
        return data.vehicles[i]
    }

    func createBlock(_ input: BlockInput) async throws -> VehicleBlock {
        await latency()
        let b = VehicleBlock(id: UUID().uuidString.lowercased(), vehicleID: input.vehicleID, startDate: input.startDate, endDate: input.endDate, reason: input.reason.nilIfBlank)
        data.blocks.append(b)
        data.blocks.sort { $0.startDate < $1.startDate }
        return b
    }

    func deleteBlock(id: String) async throws {
        await latency()
        data.blocks.removeAll { $0.id == id }
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
    func saveDeviceToken(_ token: String) async throws {}
}
#endif
