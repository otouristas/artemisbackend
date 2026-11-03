import Foundation
import UIKit
import UserNotifications
import BackgroundTasks

/// Local notifications for new website requests, background refresh, app badge, and
/// (behind `ArtemisRemotePushEnabled`) APNs registration.
@MainActor
final class NotificationManager: NSObject, ObservableObject {
    static let shared = NotificationManager()

    @Published private(set) var authorization: UNAuthorizationStatus = .notDetermined
    @Published private(set) var deviceToken: String? = UserDefaults.standard.string(forKey: Keys.deviceToken)
    @Published private(set) var lastBackgroundRun: Date? = UserDefaults.standard.object(forKey: Keys.lastBackgroundRun) as? Date

    /// Set by the app once a backend exists (used by the background task).
    var backend: Backend?

    enum Keys {
        static let enabled = "notifyNewRequests"
        static let lastSeen = "lastSeenRequestCreatedAt"
        static let deviceToken = "apnsDeviceToken"
        static let lastBackgroundRun = "lastBackgroundRun"
        /// The token value and time of the last upsert that succeeded on the server.
        static let uploadedToken = "apnsTokenUploaded"
        static let uploadedAt = "apnsTokenUploadedAt"
    }

    enum TokenStatus: Equatable { case none, saving, saved(Date), failed }
    @Published private(set) var tokenStatus: TokenStatus = NotificationManager.storedTokenStatus()

    private static func storedTokenStatus() -> TokenStatus {
        let d = UserDefaults.standard
        guard let token = d.string(forKey: Keys.deviceToken), token == d.string(forKey: Keys.uploadedToken),
              let at = d.object(forKey: Keys.uploadedAt) as? Date else { return .none }
        return .saved(at)
    }

    var enabled: Bool {
        get { UserDefaults.standard.object(forKey: Keys.enabled) as? Bool ?? true }
        set { UserDefaults.standard.set(newValue, forKey: Keys.enabled); objectWillChange.send() }
    }

    private var lastSeen: String? {
        get { UserDefaults.standard.string(forKey: Keys.lastSeen) }
        set { UserDefaults.standard.set(newValue, forKey: Keys.lastSeen) }
    }

    // MARK: Permission

    func refreshAuthorization() async {
        authorization = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }

    /// Asked right after login.
    func requestAuthorization() async {
        let center = UNUserNotificationCenter.current()
        _ = try? await center.requestAuthorization(options: [.alert, .badge, .sound])
        await refreshAuthorization()
        if AppConfig.remotePushEnabled && authorization == .authorized {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    // MARK: Posting

    func body(for r: BookingRequest, vehicleName: String) -> String {
        "\(r.customerName), \(vehicleName), \(Day.shortRange(r.checkIn, r.checkOut))"
    }

    /// Realtime insert while the app runs: local notification (+ the in-app banner the store shows).
    func announce(_ r: BookingRequest, vehicleName: String) {
        guard enabled else { return }
        post(r, vehicleName: vehicleName)
        markSeen(r.createdAt)
    }

    private func post(_ r: BookingRequest, vehicleName: String) {
        let content = UNMutableNotificationContent()
        content.title = "Νέο αίτημα κράτησης"
        content.body = "Νέο αίτημα κράτησης: \(body(for: r, vehicleName: vehicleName))"
        content.sound = .default
        content.threadIdentifier = "booking-requests"
        content.userInfo = ["request_id": r.id]
        let req = UNNotificationRequest(identifier: "request-\(r.id)", content: content, trigger: nil)
        UNUserNotificationCenter.current().add(req)
    }

    func sendTest() {
        let content = UNMutableNotificationContent()
        content.title = "Artemis CRM"
        content.body = "Οι ειδοποιήσεις λειτουργούν. Θα ειδοποιηθείτε για κάθε νέο αίτημα από το site."
        content.sound = .default
        let req = UNNotificationRequest(identifier: "test-\(UUID())", content: content,
                                        trigger: UNTimeIntervalNotificationTrigger(timeInterval: 2, repeats: false))
        UNUserNotificationCenter.current().add(req)
    }

    /// After any load: badge = number of `new` requests; remember the newest request seen.
    func didLoad(requests: [BookingRequest]) {
        let count = requests.filter { $0.status == .new }.count
        UNUserNotificationCenter.current().setBadgeCount(count)
        if let newest = requests.map(\.createdAt).max() { markSeen(newest) }
    }

    private func markSeen(_ createdAt: String) {
        if lastSeen == nil || createdAt > (lastSeen ?? "") { lastSeen = createdAt }
    }

    func clearOnSignOut() {
        UNUserNotificationCenter.current().setBadgeCount(0)
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
    }

    // MARK: Background refresh (BGAppRefreshTask)

    nonisolated static func registerBackgroundTask() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: AppConfig.backgroundRefreshID, using: nil) { task in
            guard let task = task as? BGAppRefreshTask else { return }
            Task { @MainActor in
                NotificationManager.shared.scheduleBackgroundRefresh()
                let work = Task { await NotificationManager.shared.runBackgroundCheck() }
                task.expirationHandler = { work.cancel() }
                let ok = await work.value
                task.setTaskCompleted(success: ok)
            }
        }
    }

    func scheduleBackgroundRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: AppConfig.backgroundRefreshID)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }

    /// Fetch requests created since the last one seen, notify for each, update the badge.
    @discardableResult
    func runBackgroundCheck() async -> Bool {
        guard let backend, await backend.currentSessionEmail() != nil else { return false }
        do {
            let since = lastSeen ?? ISO.string(Date().addingTimeInterval(-24 * 3600))
            let fresh = try await backend.fetchRequests(createdAfter: since)
            if enabled {
                for r in fresh.reversed() where r.status == .new {
                    post(r, vehicleName: r.requestedVehicle ?? "Όχημα")
                }
            }
            if let newest = fresh.map(\.createdAt).max() { markSeen(newest) }
            let count = try await backend.countNewRequests()
            try? await UNUserNotificationCenter.current().setBadgeCount(count)
            lastBackgroundRun = Date()
            UserDefaults.standard.set(lastBackgroundRun, forKey: Keys.lastBackgroundRun)
            return true
        } catch {
            return false
        }
    }

    // MARK: Remote push

    /// Called on every launch and every return to the foreground while signed in: iOS hands back the
    /// (same or new) token in didRegister, which upserts it again, so a failed upload is retried.
    func registerForRemotePushIfPossible() async {
        await refreshAuthorization()
        guard AppConfig.remotePushEnabled, authorization == .authorized else { return }
        UIApplication.shared.registerForRemoteNotifications()
    }

    /// Settings › Remote push › Επανεγγραφή.
    func reregister() async {
        if let token = deviceToken { await upload(token) }
        await registerForRemotePushIfPossible()
    }

    /// Always upsert (even an unchanged token); it counts as uploaded only after the server saved it.
    func didRegister(token: Data) {
        let hex = token.map { String(format: "%02x", $0) }.joined()
        deviceToken = hex
        UserDefaults.standard.set(hex, forKey: Keys.deviceToken)
        Task { await upload(hex) }
    }

    private var uploading = false

    private func upload(_ token: String) async {
        guard let backend, !uploading else { return }
        uploading = true
        defer { uploading = false }
        tokenStatus = .saving
        do {
            try await backend.saveDeviceToken(token)
            let now = Date()
            UserDefaults.standard.set(token, forKey: Keys.uploadedToken)
            UserDefaults.standard.set(now, forKey: Keys.uploadedAt)
            tokenStatus = .saved(now)
        } catch {
            UserDefaults.standard.removeObject(forKey: Keys.uploadedToken)
            tokenStatus = .failed
        }
    }
}

extension NotificationManager: UNUserNotificationCenterDelegate {
    /// In the foreground the store already shows the in-app banner, so the system one is skipped.
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        if notification.request.content.userInfo["request_id"] != nil { return [.list, .sound, .badge] }
        return [.banner, .list, .sound]
    }

    /// Tapping a notification (local or remote) opens that request.
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let info = response.notification.request.content.userInfo
        if let id = info["request_id"] as? String {
            await MainActor.run { Router.shared.openRequest(id) }
        }
    }
}
