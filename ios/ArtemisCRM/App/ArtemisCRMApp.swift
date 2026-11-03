import SwiftUI
import UserNotifications

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = NotificationManager.shared
        NotificationManager.registerBackgroundTask()
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { @MainActor in NotificationManager.shared.didRegister(token: deviceToken) }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("APNs registration failed: \(error.localizedDescription)")
    }
}

@main
struct ArtemisCRMApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @StateObject private var auth: AuthManager
    @StateObject private var store: AppStore
    @StateObject private var router = Router.shared
    @StateObject private var notifications = NotificationManager.shared
    @Environment(\.scenePhase) private var scenePhase

    init() {
        let backend: Backend
        #if DEBUG
        backend = AppConfig.isDemo ? DemoBackend() : SupabaseBackend()
        #else
        backend = SupabaseBackend()
        #endif
        _auth = StateObject(wrappedValue: AuthManager(backend: backend))
        _store = StateObject(wrappedValue: AppStore(backend: backend))
        NotificationManager.shared.backend = backend
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .environmentObject(store)
                .environmentObject(router)
                .environmentObject(notifications)
                .environment(\.locale, greek)
                .tint(Color.accentColor)
                .onOpenURL { router.open(url: $0) }
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .background:
                NotificationManager.shared.scheduleBackgroundRefresh()
            case .active:
                if case .signedIn = auth.state, store.phase == .loaded { Task { await store.refresh() } }
                Task { await notifications.refreshAuthorization() }
            default: break
            }
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var auth: AuthManager
    @EnvironmentObject private var store: AppStore

    var body: some View {
        Group {
            switch auth.state {
            case .checking:
                SplashView()
            case .signedOut:
                LoginView()
                    .transition(.opacity)
            case .signedIn:
                MainTabView()
                    .transition(.opacity.combined(with: .scale(scale: 0.98)))
                    .task {
                        await store.refresh()
                        store.startLive()
                        await NotificationManager.shared.requestAuthorization()
                    }
            }
        }
        .animation(.easeInOut(duration: 0.3), value: auth.state)
        .task { await auth.restore() }
    }
}

struct SplashView: View {
    var body: some View {
        ZStack {
            Color("LaunchBackground").ignoresSafeArea()
            Image("Logo").resizable().scaledToFit().frame(width: 180).foregroundStyle(.white)
        }
    }
}

func debugLog(_ s: String) {
    #if DEBUG
    FileHandle.standardError.write("[Artemis \(String(format: "%.3f", ProcessInfo.processInfo.systemUptime))] \(s)\n".data(using: .utf8)!)
    #endif
}
