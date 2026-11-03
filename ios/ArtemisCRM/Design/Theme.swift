import SwiftUI
import UIKit

extension Color {
    static let navy = Color("Navy")
    static let navyFill = Color("NavyFill")
    static let sun = Color("Sun")
    static let olive = Color("Olive")
    static let success = Color("Success")
    static let danger = Color("Danger")
    static let warning = Color("Warning")
    static let card = Color("CardBackground")
    static let screen = Color("ScreenBackground")
    static let hairline = Color("Hairline")
}

enum Haptics {
    static func tap() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    static func select() { UISelectionFeedbackGenerator().selectionChanged() }
    static func notify(_ t: UINotificationFeedbackGenerator.FeedbackType) { UINotificationFeedbackGenerator().notificationOccurred(t) }
}

// MARK: - Card

struct CardStyle: ViewModifier {
    var padding: CGFloat = 16
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Color.hairline.opacity(0.7), lineWidth: 0.5))
            .shadow(color: .black.opacity(0.045), radius: 10, x: 0, y: 3)
    }
}

extension View {
    func card(padding: CGFloat = 16) -> some View { modifier(CardStyle(padding: padding)) }

    /// Skeleton loading: redacted placeholder with a soft shimmer.
    @ViewBuilder func skeleton(_ active: Bool) -> some View {
        if active { self.redacted(reason: .placeholder).modifier(Shimmer()).allowsHitTesting(false) } else { self }
    }
}

struct Shimmer: ViewModifier {
    @State private var phase: CGFloat = -1
    func body(content: Content) -> some View {
        content
            .overlay {
                GeometryReader { geo in
                    LinearGradient(colors: [.clear, .white.opacity(0.35), .clear], startPoint: .leading, endPoint: .trailing)
                        .frame(width: geo.size.width * 0.6)
                        .offset(x: phase * geo.size.width * 1.6)
                        .blendMode(.plusLighter)
                }
                .mask(content)
            }
            .onAppear {
                withAnimation(.linear(duration: 1.3).repeatForever(autoreverses: false)) { phase = 1 }
            }
    }
}

// MARK: - Status pill

struct StatusPill: View {
    let text: String
    let color: Color
    var icon: String?
    var filled = false

    var body: some View {
        HStack(spacing: 4) {
            if let icon { Image(systemName: icon).font(.caption2.weight(.bold)) }
            Text(text).font(.caption.weight(.semibold)).lineLimit(1)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .foregroundStyle(filled ? Color.white : color)
        .background(filled ? color : color.opacity(0.14), in: Capsule())
    }
}

extension BookingStatus {
    var color: Color {
        switch self { case .pending: return .warning; case .confirmed: return .success; case .cancelled: return .danger }
    }
    var icon: String {
        switch self { case .pending: return "clock"; case .confirmed: return "checkmark"; case .cancelled: return "xmark" }
    }
}

extension RequestStatus {
    var color: Color {
        switch self { case .new: return .sun; case .reviewed: return .navy; case .accepted: return .success; case .rejected: return .danger }
    }
}

// MARK: - Section header (Turo-style small caps)

struct SectionHeader: View {
    let title: String
    var count: Int?
    var trailing: AnyView?

    init(_ title: String, count: Int? = nil, trailing: AnyView? = nil) {
        self.title = title; self.count = count; self.trailing = trailing
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(title.uppercased(with: greek))
                .font(.footnote.weight(.semibold))
                .tracking(0.6)
                .foregroundStyle(.secondary)
            if let count {
                Text("\(count)")
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.secondary.opacity(0.14), in: Capsule())
                    .foregroundStyle(.secondary)
            }
            Spacer()
            trailing
        }
        .padding(.horizontal, 4)
        .accessibilityAddTraits(.isHeader)
    }
}

// MARK: - Vehicle photo

struct VehicleImage: View {
    let url: String?
    var type: VehicleType = .car
    var cornerRadius: CGFloat = 12
    var inset: CGFloat = 4

    var body: some View {
        Color.clear
            .overlay {
                if let url, let u = URL(string: url) {
                    AsyncImage(url: u, transaction: Transaction(animation: .easeOut(duration: 0.25))) { phase in
                        switch phase {
                        case .success(let image):
                            // Fleet photos are cut-outs on white: show the whole vehicle on a white tile.
                            ZStack { Color.white; image.resizable().scaledToFit().padding(inset) }
                        case .failure: placeholder
                        default: ZStack { placeholderBackground; ProgressView().controlSize(.small) }
                        }
                    }
                } else {
                    placeholder
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous).strokeBorder(Color.hairline.opacity(0.6), lineWidth: 0.5))
            .accessibilityHidden(true)
    }

    private var placeholderBackground: some View {
        LinearGradient(colors: [Color.navy.opacity(0.12), Color.navy.opacity(0.05)], startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    private var placeholder: some View {
        ZStack {
            placeholderBackground
            Image(systemName: type == .car ? "car.side.fill" : "scooter")
                .font(.title2)
                .foregroundStyle(Color.navy.opacity(0.35))
        }
    }
}

// MARK: - Avatar

struct Avatar: View {
    let name: String
    var size: CGFloat = 40
    var tint: Color = .navy

    var body: some View {
        Text(Labels.initials(name))
            .font(.system(size: size * 0.38, weight: .semibold, design: .rounded))
            .foregroundStyle(tint)
            .frame(width: size, height: size)
            .background(tint.opacity(0.12), in: Circle())
            .accessibilityHidden(true)
    }
}

// MARK: - KPI tile

struct KPITile: View {
    let title: String
    let value: String
    let icon: String
    let tint: Color
    var caption: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(tint)
                    .frame(width: 26, height: 26)
                    .background(tint.opacity(0.13), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                Text(title).font(.subheadline.weight(.medium)).foregroundStyle(.primary.opacity(0.85)).lineLimit(1).minimumScaleFactor(0.8)
                Spacer(minLength: 0)
            }
            Text(value)
                .font(.title2.weight(.bold))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            if let caption { Text(caption).font(.caption).foregroundStyle(.secondary).lineLimit(1) }
        }
        .card(padding: 14)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Underline tabs (Turo Booked / History / Calendar)

struct UnderlineTabs<T: Hashable>: View {
    @Binding var selection: T
    let items: [(T, String, Int?)]
    var scrollable = false
    @Namespace private var ns

    var body: some View {
        Group {
            if scrollable {
                ScrollView(.horizontal, showsIndicators: false) { row.padding(.horizontal, 12) }
            } else {
                row
            }
        }
        .background(alignment: .bottom) { Rectangle().fill(Color.hairline).frame(height: 1) }
    }

    private var row: some View {
        HStack(spacing: scrollable ? 22 : 0) {
            ForEach(items, id: \.0) { item in
                Button {
                    guard selection != item.0 else { return }
                    Haptics.select()
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) { selection = item.0 }
                } label: {
                    VStack(spacing: 10) {
                        HStack(spacing: 5) {
                            Text(item.1.uppercased(with: greek))
                                .font(.footnote.weight(.bold))
                                .tracking(0.5)
                            if let c = item.2, c > 0 {
                                Text("\(c)")
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 6).padding(.vertical, 1.5)
                                    .background(Color.sun, in: Capsule())
                            }
                        }
                        .foregroundStyle(selection == item.0 ? Color.navy : Color.secondary)
                        .padding(.top, 10)
                        ZStack {
                            Rectangle().fill(.clear).frame(height: 2.5)
                            if selection == item.0 {
                                Rectangle().fill(Color.navy).frame(height: 2.5)
                                    .matchedGeometryEffect(id: "underline", in: ns)
                            }
                        }
                    }
                    .frame(maxWidth: scrollable ? nil : .infinity)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selection == item.0 ? .isSelected : [])
            }
        }
    }
}

// MARK: - Contact buttons

struct ContactButton: View {
    let title: String
    let icon: String
    let tint: Color
    let url: URL?

    var body: some View {
        Button {
            guard let url else { return }
            Haptics.tap()
            UIApplication.shared.open(url)
        } label: {
            Label(title, systemImage: icon)
                .font(.subheadline.weight(.semibold))
                .labelStyle(.titleAndIcon)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .foregroundStyle(url == nil ? Color.secondary : tint)
                .background((url == nil ? Color.secondary : tint).opacity(0.12), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(url == nil)
    }
}

struct ContactRow: View {
    let phone: String?
    let email: String?
    let whatsApp: URL?
    var showEmail = true

    var body: some View {
        HStack(spacing: 8) {
            ContactButton(title: "Κλήση", icon: "phone.fill", tint: .navy, url: Contact.telURL(phone))
            ContactButton(title: "WhatsApp", icon: "message.fill", tint: .success, url: whatsApp)
            if showEmail { ContactButton(title: "Email", icon: "envelope.fill", tint: .sun, url: Contact.mailURL(email)) }
        }
    }
}

// MARK: - Misc

struct InfoRow: View {
    let icon: String
    let title: String
    let value: String
    var valueColor: Color = .primary

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Image(systemName: icon).foregroundStyle(.secondary).frame(width: 22)
            Text(title).foregroundStyle(.secondary)
            Spacer(minLength: 12)
            Text(value).foregroundStyle(valueColor).multilineTextAlignment(.trailing).fontWeight(.medium)
        }
        .font(.subheadline)
        .accessibilityElement(children: .combine)
    }
}

struct PlateBadge: View {
    let plate: String
    var body: some View {
        Text(plate)
            .font(.caption.weight(.semibold).monospaced())
            .padding(.horizontal, 6).padding(.vertical, 2.5)
            .overlay(RoundedRectangle(cornerRadius: 5, style: .continuous).strokeBorder(Color.secondary.opacity(0.45), lineWidth: 1))
            .foregroundStyle(.secondary)
            .accessibilityLabel("Πινακίδα \(plate)")
    }
}

struct ToastView: View {
    let toast: AppStore.Toast
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: toast.isError ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                .foregroundStyle(toast.isError ? Color.danger : Color.success)
            Text(toast.text).font(.subheadline.weight(.medium)).foregroundStyle(.white)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16).padding(.vertical, 14)
        .background(Color(white: 0.12), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: .black.opacity(0.2), radius: 12, y: 4)
        .padding(.horizontal, 16)
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    var tint: Color = .navyFill
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .foregroundStyle(.white)
            .background(tint.opacity(configuration.isPressed ? 0.85 : 1), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    var tint: Color = .navy
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .foregroundStyle(tint)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(tint.opacity(0.5), lineWidth: 1.2))
            .background(Color.card.opacity(configuration.isPressed ? 0.6 : 1), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

struct DemoBadge: View {
    var body: some View {
        Text("DEMO")
            .fixedSize()
            .font(.caption2.weight(.heavy))
            .tracking(1)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(Color.sun, in: Capsule())
            .foregroundStyle(.white)
    }
}
