import SwiftUI

struct BookingDetailView: View {
    @EnvironmentObject private var store: AppStore
    let bookingID: String
    @State private var editing = false
    @State private var confirmCancel = false
    @State private var busy = false

    var body: some View {
        if let b = store.booking(bookingID) {
            content(b)
        } else {
            ContentUnavailableView("Η κράτηση δεν βρέθηκε", systemImage: "calendar.badge.exclamationmark")
        }
    }

    private func content(_ b: Booking) -> some View {
        let vehicle = store.vehicle(b.vehicleID)
        return ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                hero(b, vehicle)
                tripCard(b, vehicle)
                customerCard(b, vehicle)
                paymentCard(b)
                if let notes = b.comments?.nilIfBlank {
                    VStack(alignment: .leading, spacing: 8) {
                        SectionHeader("Σημειώσεις")
                        Text(notes).font(.subheadline).frame(maxWidth: .infinity, alignment: .leading).card()
                    }
                }
                if let r = store.requestForBooking(b) {
                    NavigationLink(value: Route.request(r.id)) {
                        HStack {
                            Label("Από αίτημα του site", systemImage: "globe")
                            Spacer()
                            Text(ISO.relative(r.createdAt)).foregroundStyle(.secondary)
                            Image(systemName: "chevron.right").foregroundStyle(.tertiary)
                        }
                        .font(.subheadline)
                        .card(padding: 14)
                    }
                    .buttonStyle(.plain)
                }
                actions(b)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 28)
        }
        .background(Color.screen)
        .navigationTitle(b.customerName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Επεξεργασία") { editing = true }
            }
        }
        .sheet(isPresented: $editing) { BookingFormView(mode: .edit(b)) }
        .confirmationDialog("Ακύρωση κράτησης;", isPresented: $confirmCancel, titleVisibility: .visible) {
            Button("Ακύρωση κράτησης", role: .destructive) { run { await store.setStatus(b, .cancelled) } }
            Button("Πίσω", role: .cancel) {}
        } message: {
            Text("Η μονάδα θα ελευθερωθεί για τις ημερομηνίες \(Day.shortRange(b.checkIn, b.checkOut)).")
        }
    }

    private func hero(_ b: Booking, _ v: Vehicle?) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            VehicleImage(url: v?.imageURL, type: v?.type ?? .car, cornerRadius: 14, inset: 10)
                .frame(height: 170)
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    StatusPill(text: Labels.booking(b.status), color: b.status.color, icon: b.status.icon, filled: true)
                    phasePill(b)
                }
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(v?.name ?? "Όχημα").font(.title2.weight(.bold))
                    if let plate = b.plate?.nilIfBlank { PlateBadge(plate: plate) }
                }
                Text(b.customerName + " · " + Day.shortRange(b.checkIn, b.checkOut))
                    .font(.subheadline).foregroundStyle(.secondary)
            }
        }
        .card(padding: 12)
        .padding(.top, 8)
    }

    @ViewBuilder private func phasePill(_ b: Booking) -> some View {
        switch TripPhase(b) {
        case .pickupToday: StatusPill(text: "Παραλαβή σήμερα", color: .success, icon: "arrow.up.right")
        case .returnToday: StatusPill(text: "Επιστροφή σήμερα", color: .danger, icon: "arrow.down.left")
        case .inRental: StatusPill(text: "Σε ενοικίαση", color: .navy, icon: "car.side")
        default: EmptyView()
        }
    }

    private func tripCard(_ b: Booking, _ v: Vehicle?) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader("Ταξίδι")
            VStack(spacing: 14) {
                HStack(alignment: .top) {
                    dateColumn(title: "Παραλαβή", day: b.checkIn, align: .leading)
                    Spacer()
                    VStack(spacing: 2) {
                        Image(systemName: "arrow.right").foregroundStyle(.tertiary)
                        Text(b.nights == 1 ? "1 ημέρα" : "\(b.nights) ημέρες").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    }
                    .padding(.top, 10)
                    Spacer()
                    dateColumn(title: "Επιστροφή", day: b.checkOut, align: .trailing)
                }
                Divider()
                InfoRow(icon: "mappin.and.ellipse", title: "Παράδοση", value: b.deliveryLocation?.nilIfBlank ?? "—")
                InfoRow(icon: v?.type == .scooter ? "scooter" : "car.side", title: "Όχημα", value: v?.name ?? "—")
                InfoRow(icon: "number", title: "Πινακίδα", value: b.plate?.nilIfBlank ?? "Δεν έχει οριστεί")
                InfoRow(icon: "arrow.triangle.branch", title: "Πηγή", value: Labels.source(b.bookingSource))
            }
            .card()
        }
    }

    private func dateColumn(title: String, day: String, align: HorizontalAlignment) -> some View {
        VStack(alignment: align, spacing: 2) {
            Text(title.uppercased(with: greek)).font(.caption2.weight(.bold)).tracking(0.5).foregroundStyle(.secondary)
            Text(Day.format(day, "EEE d MMM")).font(.headline)
            Text(Day.relativeLabel(day) == Day.long(day) ? Day.format(day, "yyyy") : Day.relativeLabel(day))
                .font(.caption).foregroundStyle(.secondary)
        }
    }

    private func customerCard(_ b: Booking, _ v: Vehicle?) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader("Πελάτης")
            VStack(alignment: .leading, spacing: 14) {
                let client = store.client(b.clientID)
                Group {
                    if let client {
                        NavigationLink(value: Route.client(client.id)) { customerHeader(b, chevron: true) }.buttonStyle(.plain)
                    } else {
                        customerHeader(b, chevron: false)
                    }
                }
                ContactRow(phone: b.customerPhone, email: b.customerEmail, whatsApp: Contact.whatsApp(booking: b, vehicleName: v?.name ?? "Όχημα"))
            }
            .card()
        }
    }

    private func customerHeader(_ b: Booking, chevron: Bool) -> some View {
        HStack(spacing: 12) {
            Avatar(name: b.customerName, size: 46)
            VStack(alignment: .leading, spacing: 2) {
                Text(b.customerName).font(.headline)
                Text([b.customerPhone, b.customerEmail].compactMap { $0?.nilIfBlank }.joined(separator: " · "))
                    .font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer()
            if chevron { Image(systemName: "chevron.right").foregroundStyle(.tertiary) }
        }
        .contentShape(Rectangle())
    }

    private func paymentCard(_ b: Booking) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader("Πληρωμή")
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Υπόλοιπο").font(.subheadline).foregroundStyle(.secondary)
                        Text(Money.precise(b.balance)).font(.system(.title, design: .rounded).weight(.bold))
                            .foregroundStyle(b.balance > 0 ? Color.sun : Color.success)
                            .monospacedDigit()
                    }
                    Spacer()
                    if b.balance <= 0 && b.total > 0 {
                        StatusPill(text: "Εξοφλημένη", color: .success, icon: "checkmark.seal.fill")
                    }
                }
                ProgressView(value: b.total > 0 ? min(b.paid / b.total, 1) : 0)
                    .tint(Color.success)
                VStack(spacing: 10) {
                    InfoRow(icon: "eurosign.circle", title: "Σύνολο", value: Money.precise(b.total))
                    InfoRow(icon: "banknote", title: "Προκαταβολή", value: Money.precise(b.paid))
                    InfoRow(icon: "creditcard", title: "Τρόπος πληρωμής", value: Labels.payment(b.paymentMethod))
                }
            }
            .card()
        }
    }

    @ViewBuilder private func actions(_ b: Booking) -> some View {
        VStack(spacing: 10) {
            if b.status == .pending {
                Button { run { await store.setStatus(b, .confirmed) } } label: {
                    Label("Επιβεβαίωση κράτησης", systemImage: "checkmark.circle.fill")
                }
                .buttonStyle(PrimaryButtonStyle(tint: .success))
            }
            if b.status == .cancelled {
                Button { run { await store.setStatus(b, .pending) } } label: {
                    Label("Επαναφορά σε εκκρεμή", systemImage: "arrow.uturn.backward")
                }
                .buttonStyle(SecondaryButtonStyle())
            } else {
                Button { confirmCancel = true } label: { Label("Ακύρωση κράτησης", systemImage: "xmark.circle") }
                    .buttonStyle(SecondaryButtonStyle(tint: .danger))
            }
        }
        .disabled(busy)
        .padding(.top, 4)
    }

    private func run(_ work: @escaping () async -> Void) {
        busy = true
        Task { await work(); busy = false }
    }
}
