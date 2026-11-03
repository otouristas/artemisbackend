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

    static func isAllowedAdmin(_ email: String?) -> Bool {
        (email ?? "").trimmed.lowercased() == allowedAdminEmail
    }
}

enum ChangeEvent {
    case requestInserted(BookingRequest)
    case tableChanged(String)
}

enum BackendError: LocalizedError {
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

    func createRate(_ input: RateInput) async throws -> VehicleRate
    func updateRate(id: String, _ input: RateInput) async throws
    func deleteRate(id: String) async throws

    /// Live changes (Realtime). The stream ends when `stopChanges()` is called.
    func changes() -> AsyncStream<ChangeEvent>
    func stopChanges() async

    func saveDeviceToken(_ token: String) async
}
