import Foundation
import Supabase
import UIKit

/// Live backend. Auth sessions persist in the keychain (the SDK default on iOS), so the owner
/// signs in once with the same account as the web CRM.
final class SupabaseBackend: Backend {
    let isDemo = false
    let client: SupabaseClient
    private var channel: RealtimeChannelV2?
    private var listenTasks: [Task<Void, Never>] = []

    init() {
        client = SupabaseClient(
            supabaseURL: AppConfig.supabaseURL,
            supabaseKey: AppConfig.supabaseKey,
            options: SupabaseClientOptions(auth: .init(emitLocalSessionAsInitialSession: true))
        )
    }

    // MARK: Auth (mirrors src/hooks/useAuth.tsx)

    func currentSessionEmail() async -> String? {
        do {
            let session = try await client.auth.session
            if AppConfig.isAllowedAdmin(session.user.email) { return session.user.email }
            try? await client.auth.signOut()
            return nil
        } catch {
            return nil
        }
    }

    func signIn(email: String, password: String) async throws -> String {
        guard AppConfig.isAllowedAdmin(email) else { throw BackendError.unauthorized }
        do {
            let session = try await client.auth.signIn(email: email.trimmed.lowercased(), password: password)
            guard AppConfig.isAllowedAdmin(session.user.email) else {
                try? await client.auth.signOut()
                throw BackendError.unauthorized
            }
            return session.user.email ?? email
        } catch let e as BackendError {
            throw e
        } catch {
            let text = "\(error)".lowercased()
            if text.contains("invalid login") || text.contains("invalid_credentials") {
                throw BackendError.message("Λάθος email ή κωδικός.")
            }
            if text.contains("offline") || text.contains("network") || text.contains("-1009") {
                throw BackendError.message("Δεν υπάρχει σύνδεση στο διαδίκτυο.")
            }
            throw BackendError.message("Η σύνδεση απέτυχε. Δοκιμάστε ξανά.")
        }
    }

    func signOut() async {
        await stopChanges()
        try? await client.auth.signOut()
    }

    // MARK: Reads (query shapes from src/hooks/*)

    func loadSnapshot() async throws -> Snapshot {
        async let vehicles: [Vehicle] = client.from("vehicles").select().order("name").execute().value
        async let bookings: [Booking] = client.from("bookings").select().order("check_in").execute().value
        async let requests: [BookingRequest] = client.from("booking_requests").select().order("created_at", ascending: false).execute().value
        async let clients: [Client] = client.from("clients").select().order("name").execute().value
        async let rates: [VehicleRate] = client.from("vehicle_rates").select().order("start_date").execute().value
        async let blocks: [VehicleBlock] = client.from("vehicle_blocks").select().order("start_date").execute().value
        return try await Snapshot(vehicles: vehicles, bookings: bookings, requests: requests, clients: clients, rates: rates, blocks: blocks)
    }

    func fetchRequests(createdAfter: String) async throws -> [BookingRequest] {
        try await client.from("booking_requests").select().gt("created_at", value: createdAfter)
            .order("created_at", ascending: false).execute().value
    }

    func fetchRequest(id: String) async throws -> BookingRequest? {
        let rows: [BookingRequest] = try await client.from("booking_requests").select().eq("id", value: id).limit(1).execute().value
        return rows.first
    }

    func countNewRequests() async throws -> Int {
        let res = try await client.from("booking_requests").select("id", head: true, count: .exact).eq("status", value: "new").execute()
        return res.count ?? 0
    }

    // MARK: Writes

    func createBooking(_ input: BookingInput) async throws -> Booking {
        try await client.from("bookings").insert(input).select().single().execute().value
    }

    func updateBooking(id: String, _ input: BookingInput) async throws -> Booking {
        try await client.from("bookings").update(input).eq("id", value: id).select().single().execute().value
    }

    func setBookingStatus(id: String, _ status: BookingStatus) async throws {
        try await client.from("bookings").update(BookingStatusUpdate(status: status)).eq("id", value: id).execute()
    }

    func updateRequest(id: String, _ update: RequestStatusUpdate) async throws {
        try await client.from("booking_requests").update(update).eq("id", value: id).execute()
    }

    func createClient(_ input: ClientInput) async throws -> Client {
        try await client.from("clients").insert(input).select().single().execute().value
    }

    func updateClient(id: String, _ update: ClientUpdate) async throws -> Client {
        try await client.from("clients").update(update).eq("id", value: id).select().single().execute().value
    }

    func deleteBooking(id: String) async throws {
        try await client.from("bookings").delete().eq("id", value: id).execute()
    }

    func mergeClients(keepID: String, mergeID: String) async throws {
        try await client.from("bookings").update(ClientIDUpdate(clientID: keepID)).eq("client_id", value: mergeID).execute()
        try await client.from("clients").delete().eq("id", value: mergeID).execute()
    }

    func fetchChecklists(bookingID: String) async throws -> [VehicleChecklist] {
        try await client.from("vehicle_checklists").select().eq("booking_id", value: bookingID).order("created_at").execute().value
    }

    func createChecklist(_ input: ChecklistInput) async throws -> VehicleChecklist {
        try await client.from("vehicle_checklists").insert(input).select().single().execute().value
    }

    func uploadVehiclePhoto(_ jpeg: Data) async throws -> String {
        // Same naming as the web: `${Date.now()}_${random}.${ext}` at the bucket root.
        let rand = String(UUID().uuidString.lowercased().filter(\.isLetter).prefix(8))
        let name = "\(Int(Date().timeIntervalSince1970 * 1000))_\(rand).jpg"
        let bucket = client.storage.from("vehicle-photos")
        try await bucket.upload(name, data: jpeg, options: FileOptions(contentType: "image/jpeg"))
        return try bucket.getPublicURL(path: name).absoluteString
    }

    func createVehicle(_ input: VehicleInput) async throws -> Vehicle {
        do {
            return try await client.from("vehicles").insert(input).select().single().execute().value
        } catch { throw Self.vehicleError(error) }
    }

    func updateVehicle(id: String, _ update: VehicleUpdate) async throws -> Vehicle {
        do {
            return try await client.from("vehicles").update(update).eq("id", value: id).select().single().execute().value
        } catch { throw Self.vehicleError(error) }
    }

    /// 23505 = unique_violation on vehicles_slug_key.
    private static func vehicleError(_ error: Error) -> Error {
        if "\(error)".contains("23505") || "\(error)".contains("vehicles_slug_key") { return BackendError.slugTaken }
        return error
    }

    func createBlock(_ input: BlockInput) async throws -> VehicleBlock {
        try await client.from("vehicle_blocks").insert(input).select().single().execute().value
    }

    func deleteBlock(id: String) async throws {
        try await client.from("vehicle_blocks").delete().eq("id", value: id).execute()
    }

    func createRate(_ input: RateInput) async throws -> VehicleRate {
        do {
            return try await client.from("vehicle_rates").insert(input).select().single().execute().value
        } catch { throw Self.rateError(error) }
    }

    func createRates(_ inputs: [RateInput]) async throws -> [VehicleRate] {
        guard !inputs.isEmpty else { return [] }
        do {
            return try await client.from("vehicle_rates").insert(inputs).select().execute().value
        } catch { throw Self.rateError(error) }
    }

    func updateRate(id: String, _ input: RateInput) async throws {
        do {
            try await client.from("vehicle_rates").update(input).eq("id", value: id).execute()
        } catch { throw Self.rateError(error) }
    }

    func deleteRate(id: String) async throws {
        try await client.from("vehicle_rates").delete().eq("id", value: id).execute()
    }

    /// 23P01 = exclusion_violation: the range overlaps another period of the same model.
    private static func rateError(_ error: Error) -> Error {
        if "\(error)".contains("23P01") { return BackendError.message("Η περίοδος επικαλύπτει άλλη περίοδο του ίδιου μοντέλου.") }
        return error
    }

    // MARK: Realtime

    func changes() -> AsyncStream<ChangeEvent> {
        AsyncStream { continuation in
            let setup = Task { [weak self] in
                guard let self else { return }
                await self.stopChanges()
                let channel = self.client.channel("artemis-ios-\(UUID().uuidString.prefix(8))")
                let inserts = channel.postgresChange(InsertAction.self, schema: "public", table: "booking_requests")
                let tables = ["booking_requests", "bookings", "vehicles", "vehicle_rates", "clients", "vehicle_blocks"]
                let streams = tables.map { ($0, channel.postgresChange(AnyAction.self, schema: "public", table: $0)) }
                do {
                    try await channel.subscribeWithError()
                } catch {
                    continuation.finish()
                    return
                }
                self.channel = channel
                self.listenTasks.append(Task { [weak self] in
                    for await insert in inserts {
                        // Re-read through PostgREST so numbers/dates decode exactly like list reads.
                        guard let id = insert.record["id"]?.stringValue else { continue }
                        if let row = try? await self?.fetchRequest(id: id) {
                            continuation.yield(.requestInserted(row))
                        }
                    }
                })
                for (table, stream) in streams {
                    self.listenTasks.append(Task {
                        for await _ in stream { continuation.yield(.tableChanged(table)) }
                    })
                }
            }
            continuation.onTermination = { _ in setup.cancel() }
        }
    }

    func stopChanges() async {
        listenTasks.forEach { $0.cancel() }
        listenTasks.removeAll()
        if let channel {
            await client.removeChannel(channel)
            self.channel = nil
        }
    }

    // MARK: Remote push

    /// Upserts into public.device_tokens (migration 20261104010000). Debug builds register as
    /// `development` (APNs sandbox), TestFlight/App Store (Release) builds as `production`.
    func saveDeviceToken(_ token: String) async throws {
        struct Row: Encodable {
            let token: String
            let platform = "ios"
            let bundle_id = "gr.artemisrental.crm"
            let environment: String
            let device_name: String
            let updated_at: String
        }
        #if DEBUG
        let env = "development"
        #else
        let env = "production"
        #endif
        let name = await MainActor.run { UIDevice.current.name }
        try await client.from("device_tokens")
            .upsert(Row(token: token, environment: env, device_name: name, updated_at: ISO.string(Date())), onConflict: "token")
            .execute()
    }
}
