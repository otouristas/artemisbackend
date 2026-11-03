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
    @AppStorage(AppAppearance.key) private var appearance = AppAppearance.defaultValue

    init() {
        #if DEBUG
        if AppConfig.forceOnboarding { UserDefaults.standard.removeObject(forKey: OnboardingView.doneKey) }
        // Screenshots: `-DemoAppearance system|light|dark` sets the stored appearance before launch.
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-DemoAppearance"), i + 1 < args.count, AppAppearance(rawValue: args[i + 1]) != nil {
            UserDefaults.standard.set(args[i + 1], forKey: AppAppearance.key)
        }
        #endif
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
                .preferredColorScheme(appearance.colorScheme)
                .onOpenURL { router.open(url: $0) }
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .background:
                NotificationManager.shared.scheduleBackgroundRefresh()
            case .active:
                if case .signedIn = auth.state, store.phase == .loaded { Task { await store.refresh() } }
                if case .signedIn = auth.state {
                    Task { await notifications.registerForRemotePushIfPossible() }
                } else {
                    Task { await notifications.refreshAuthorization() }
                }
            default: break
            }
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var auth: AuthManager
    @EnvironmentObject private var store: AppStore
    @AppStorage(OnboardingView.doneKey) private var onboardingDone = false
    @State private var splashDone = false

    /// First launch only, before login. DEBUG `-ResetOnboarding` shows it again (also in demo mode).
    private var showOnboarding: Bool {
        guard !onboardingDone else { return false }
        if case .signedOut = auth.state { return true }
        return AppConfig.forceOnboarding
    }

    private enum Screen: Equatable { case splash, onboarding, login, main }
    private var screen: Screen {
        if !splashDone || auth.state == .checking { return .splash }
        if showOnboarding { return .onboarding }
        if case .signedIn = auth.state { return .main }
        return .login
    }

    var body: some View {
        Group {
            switch screen {
            case .splash:
                SplashView { splashDone = true }
            case .onboarding:
                OnboardingView { onboardingDone = true }
                    .transition(.opacity)
            case .login:
                LoginView()
                    .transition(.opacity)
            case .main:
                MainTabView()
                    .transition(.opacity.combined(with: .scale(scale: 0.98)))
                    .task {
                        await store.refresh()
                        store.startLive()
                        await NotificationManager.shared.requestAuthorization()
                        // Every launch while signed in: re-register so the token upsert is retried.
                        await NotificationManager.shared.registerForRemotePushIfPossible()
                    }
            }
        }
        .animation(.easeInOut(duration: 0.3), value: screen)
        .task { await auth.restore() }
    }
}

func debugLog(_ s: String) {
    #if DEBUG
    FileHandle.standardError.write("[Artemis \(String(format: "%.3f", ProcessInfo.processInfo.systemUptime))] \(s)\n".data(using: .utf8)!)
    #endif
}
