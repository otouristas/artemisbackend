import Foundation

enum AppConfig {
    /// Same project and public publishable key as src/integrations/supabase/client.ts.
    static let supabaseURL = URL(string: "https://ogbjgmxmlmgpcsdmrkcq.supabase.co")!
    static let supabaseKey = "sb_publishable_OmpiQViFXannlvrDez11OA_EorHdEYH"
    /// src/lib/auth.ts — RLS (is_artemis_admin()) only lets this account read or write.
    static let allowedAdminEmail = "info@artemisrental.gr"
    static let backgroundRefreshID = "gr.artemisrental.crm.refresh"

    /// Info.plist `ArtemisRemotePushEnabled`. Off until the owner sets up APNs (see README).
    static var remotePushEnabled: Bool {
        Bundle.main.object(forInfoDictionaryKey: "ArtemisRemotePushEnabled") as? Bool ?? false
    }

    static var isDemo: Bool {
        #if DEBUG
        return ProcessInfo.processInfo.arguments.contains("-DemoMode")
        #else
        return false
        #endif
    }

    /// DEBUG: `-ResetOnboarding` clears the "seen" flag and shows the onboarding even in demo mode.
    static var forceOnboarding: Bool {
        #if DEBUG
        return ProcessInfo.processInfo.arguments.contains("-ResetOnboarding")
        #else
        return false
        #endif
    }

    /// DEBUG: `-OnboardingPage 2` opens the onboarding on that page (0-based), for screenshots.
    static var onboardingStartPage: Int {
        #if DEBUG
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-OnboardingPage"), i + 1 < args.count { return Int(args[i + 1]) ?? 0 }
        #endif
        return 0
    }

    /// DEBUG helper for screenshots: `-DemoRoute requests/detail` etc.
    static var demoRoute: String? {
        #if DEBUG
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-DemoRoute"), i + 1 < args.count { return args[i + 1] }
        #endif
        return nil
    }

    static var version: String {
        let v = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
        let b = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
        return "\(v) (\(b))"
    }

    static func normalizedEmail(_ email: String?) -> String { (email ?? "").trimmed.lowercased() }

    static func isAllowedAdmin(_ email: String?) -> Bool {
        normalizedEmail(email) == allowedAdminEmail
    }

    /// A typo of the admin address (e.g. "info@artemisrentals.gr"): up to 2 edits away.
    static func isNearMissAdmin(_ email: String?) -> Bool {
        let e = normalizedEmail(email)
        guard e.count >= 8, e != allowedAdminEmail else { return false }
        return editDistance(e, allowedAdminEmail) <= 2
    }

    /// Levenshtein distance.
    private static func editDistance(_ a: String, _ b: String) -> Int {
        let a = Array(a), b = Array(b)
        guard !a.isEmpty else { return b.count }
        guard !b.isEmpty else { return a.count }
        var prev = Array(0...b.count)
        for i in 1...a.count {
            var cur = [i] + Array(repeating: 0, count: b.count)
            for j in 1...b.count {
                cur[j] = Swift.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1))
            }
            prev = cur
        }
        return prev[b.count]
    }
}

enum ChangeEvent {
    case requestInserted(BookingRequest)
    case tableChanged(String)
}

enum BackendError: LocalizedError {
    static let slugTaken = BackendError.message("Το slug χρησιμοποιείται ήδη από άλλο όχημα")

    case unauthorized
    case message(String)
    var errorDescription: String? {
        switch self {
        case .unauthorized: return "Μη εξουσιοδοτημένος λογαριασμός."
        case .message(let m): return m
        }
    }
}

/// Everything the app does against the database. `SupabaseBackend` talks to the live project;
/// `DemoBackend` (DEBUG, -DemoMode) keeps sample data in memory.
protocol Backend: AnyObject {
    var isDemo: Bool { get }

    func currentSessionEmail() async -> String?
    func signIn(email: String, password: String) async throws -> String
    func signOut() async

    func loadSnapshot() async throws -> Snapshot
    func fetchRequests(createdAfter: String) async throws -> [BookingRequest]
    func fetchRequest(id: String) async throws -> BookingRequest?
    func countNewRequests() async throws -> Int

    func createBooking(_ input: BookingInput) async throws -> Booking
    func updateBooking(id: String, _ input: BookingInput) async throws -> Booking
    func setBookingStatus(id: String, _ status: BookingStatus) async throws
    func updateRequest(id: String, _ update: RequestStatusUpdate) async throws
    func createClient(_ input: ClientInput) async throws -> Client

    func deleteBooking(id: String) async throws
    /// useMergeClients(): move the duplicate's bookings to `keepID`, then delete the duplicate.
    func mergeClients(keepID: String, mergeID: String) async throws

    func fetchChecklists(bookingID: String) async throws -> [VehicleChecklist]
    func createChecklist(_ input: ChecklistInput) async throws -> VehicleChecklist
    /// uploadVehiclePhoto(): stores a JPEG in the public `vehicle-photos` bucket, returns its public URL.
    func uploadVehiclePhoto(_ jpeg: Data) async throws -> String

    func createVehicle(_ input: VehicleInput) async throws -> Vehicle
    func updateVehicle(id: String, _ update: VehicleUpdate) async throws -> Vehicle
    func createBlock(_ input: BlockInput) async throws -> VehicleBlock
    func deleteBlock(id: String) async throws

    func createRate(_ input: RateInput) async throws -> VehicleRate
    func updateRate(id: String, _ input: RateInput) async throws
    func deleteRate(id: String) async throws

    /// Live changes (Realtime). The stream ends when `stopChanges()` is called.
    func changes() -> AsyncStream<ChangeEvent>
    func stopChanges() async

    /// Upserts the APNs token into public.device_tokens. Throws when the server did not save it.
    func saveDeviceToken(_ token: String) async throws
}
