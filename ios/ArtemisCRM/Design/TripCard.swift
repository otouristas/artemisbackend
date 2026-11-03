import SwiftUI

/// Where a booking stands relative to today.
enum TripPhase {
    case cancelled, pickupToday, returnToday, inRental, upcoming, past

    init(_ b: Booking, today: String = Day.today) {
        if b.status == .cancelled { self = .cancelled }
        else if b.checkIn == today { self = .pickupToday }
        else if b.checkOut == today { self = .returnToday }
        else if b.checkIn < today && b.checkOut > today { self = .inRental }
        else if b.checkIn > today { self = .upcoming }
        else { self = .past }
    }
}

enum TripCardEmphasis { case auto, pickup, dropoff }

/// Turo-host-style trip card: status pill, guest, vehicle + plate, place, balance, photo on the right.
struct TripCard: View {
    @EnvironmentObject private var store: AppStore
    let booking: Booking
    var emphasis: TripCardEmphasis = .auto
    var showContact = false

    private var vehicle: Vehicle? { store.vehicle(booking.vehicleID) }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 7) {
                    pill
                    Text(booking.customerName)
                        .font(.headline)
                        .lineLimit(1)
                    HStack(spacing: 6) {
                        Text(vehicle?.name ?? "Όχημα")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                        if let plate = booking.plate?.nilIfBlank { PlateBadge(plate: plate) }
                    }
                    HStack(spacing: 10) {
                        Label(Day.shortRange(booking.checkIn, booking.checkOut), systemImage: "calendar")
                        if let loc = booking.deliveryLocation?.nilIfBlank {
                            Label(loc, systemImage: "mappin.and.ellipse").lineLimit(1)
                        }
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .labelStyle(CompactLabelStyle())
                }
                Spacer(minLength: 0)
                VStack(alignment: .trailing, spacing: 8) {
                    VehicleImage(url: vehicle?.imageURL, type: vehicle?.type ?? .car)
                        .frame(width: 96, height: 66)
                    if booking.balance > 0 && booking.status != .cancelled {
                        Text("Υπόλ. \(Money.format(booking.balance))")
                            .font(.caption.weight(.semibold))
                            .monospacedDigit()
                            .foregroundStyle(Color.sun)
                    } else if booking.total > 0 && booking.status != .cancelled {
                        Label("Εξοφλημένη", systemImage: "checkmark.seal.fill")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color.success)
                            .labelStyle(CompactLabelStyle())
                    }
                }
            }
            if showContact {
                ContactRow(phone: booking.customerPhone, email: booking.customerEmail,
                           whatsApp: Contact.whatsApp(booking: booking, vehicleName: vehicle?.name ?? "Όχημα"), showEmail: false)
            }
        }
        .card(padding: 14)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder private var pill: some View {
        let phase = TripPhase(booking)
        switch (emphasis, phase) {
        case (_, .cancelled):
            StatusPill(text: "Ακυρωμένη", color: .danger, icon: "xmark")
        case (.pickup, _), (.auto, .pickupToday):
            StatusPill(text: booking.status == .pending ? "Παραλαβή · εκκρεμεί" : "Παραλαβή σήμερα", color: booking.status == .pending ? .warning : .success, icon: "arrow.up.right")
        case (.dropoff, _), (.auto, .returnToday):
            StatusPill(text: "Επιστροφή σήμερα", color: .danger, icon: "arrow.down.left")
        case (.auto, .inRental):
            StatusPill(text: "Σε ενοικίαση · έως \(Day.dayMonth(booking.checkOut))", color: .navy, icon: "car.side")
        case (.auto, .upcoming):
            StatusPill(text: booking.status == .pending ? "Εκκρεμεί" : "Επιβεβαιωμένη", color: booking.status.color, icon: booking.status.icon)
        case (.auto, .past):
            StatusPill(text: "Ολοκληρώθηκε", color: .secondary, icon: "flag.checkered")
        }
    }
}

struct CompactLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 3) { configuration.icon; configuration.title }
    }
}

/// Context menu shared by booking rows.
struct BookingContextMenu: View {
    @EnvironmentObject private var store: AppStore
    let booking: Booking

    var body: some View {
        if let url = Contact.telURL(booking.customerPhone) {
            Button { UIApplication.shared.open(url) } label: { Label("Κλήση", systemImage: "phone") }
        }
        if let url = Contact.whatsApp(booking: booking, vehicleName: store.vehicleName(booking.vehicleID)) {
            Button { UIApplication.shared.open(url) } label: { Label("WhatsApp επιβεβαίωση", systemImage: "message") }
        }
        if let phone = booking.customerPhone?.nilIfBlank {
            Button { UIPasteboard.general.string = phone; store.show("Το τηλέφωνο αντιγράφηκε") } label: { Label("Αντιγραφή τηλεφώνου", systemImage: "doc.on.doc") }
        }
        Divider()
        if booking.status == .pending {
            Button { Task { await store.setStatus(booking, .confirmed) } } label: { Label("Επιβεβαίωση", systemImage: "checkmark.circle") }
        }
        if booking.status != .cancelled {
            Button(role: .destructive) { Task { await store.setStatus(booking, .cancelled) } } label: { Label("Ακύρωση", systemImage: "xmark.circle") }
        }
    }
}
