import SwiftUI

struct RequestDetailView: View {
    @EnvironmentObject private var store: AppStore
    let requestID: String
    @State private var accepting: AcceptChoice?
    @State private var confirmReject = false
    @State private var loadingMissing = false

    struct AcceptChoice: Identifiable { let id = UUID(); let vehicleID: String? }

    var body: some View {
        if let r = store.request(requestID) {
            content(r)
        } else if !store.hasLoaded {
            ProgressView()
        } else {
            ContentUnavailableView("Το αίτημα δεν βρέθηκε", systemImage: "tray")
                .task { await store.refresh() }
        }
    }

    private func content(_ r: BookingRequest) -> some View {
        let v = store.matchedVehicle(for: r)
        let open = r.status == .new || r.status == .reviewed
        return ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header(r)
                tripCard(r, v)
                if let m = r.message?.nilIfBlank { messageCard(m, r) }
                guestCard(r)
                availabilityCard(r, v)
                if r.status == .accepted, let bid = r.bookingID, store.booking(bid) != nil {
                    NavigationLink(value: Route.booking(bid)) {
                        HStack {
                            Label("Προβολή κράτησης", systemImage: "calendar.badge.checkmark").foregroundStyle(Color.success)
                            Spacer()
                            Image(systemName: "chevron.right").foregroundStyle(.tertiary)
                        }
                        .font(.subheadline.weight(.semibold))
                        .card(padding: 14)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, open ? 120 : 28)
        }
        .background(Color.screen)
        .navigationTitle("Αίτημα")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    if r.status == .new {
                        Button { Task { await store.setRequestStatus(r, .reviewed) } } label: { Label("Σημείωση ως ελεγμένο", systemImage: "eye") }
                    }
                    if r.status == .rejected {
                        Button { Task { await store.setRequestStatus(r, .reviewed) } } label: { Label("Επαναφορά", systemImage: "arrow.uturn.backward") }
                    }
                    if let email = r.customerEmail?.nilIfBlank {
                        Button { UIPasteboard.general.string = email; store.show("Το email αντιγράφηκε") } label: { Label("Αντιγραφή email", systemImage: "doc.on.doc") }
                    }
                } label: { Image(systemName: "ellipsis.circle") }
            }
        }
        .safeAreaInset(edge: .bottom) {
            if open { actionBar(r, v) }
        }
        .onAppear {
            if AppConfig.demoRoute == "requests/accept" && accepting == nil {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { accepting = AcceptChoice(vehicleID: v?.id) }
            }
        }
        .sheet(item: $accepting) { choice in
            BookingFormView(mode: .accept(r, vehicleID: choice.vehicleID))
        }
        .confirmationDialog("Απόρριψη αιτήματος;", isPresented: $confirmReject, titleVisibility: .visible) {
            Button("Απόρριψη", role: .destructive) { Task { await store.setRequestStatus(r, .rejected) } }
            Button("Πίσω", role: .cancel) {}
        } message: { Text("Θυμηθείτε να ενημερώσετε τον/την \(r.customerName).") }
    }

    private func header(_ r: BookingRequest) -> some View {
        HStack(alignment: .center, spacing: 14) {
            Avatar(name: r.customerName, size: 56, tint: r.status == .new ? .sun : .navy)
            VStack(alignment: .leading, spacing: 4) {
                Text(r.customerName).font(.title3.weight(.bold))
                HStack(spacing: 6) {
                    StatusPill(text: Labels.request(r.status), color: r.status.color, filled: r.status == .new)
                    Text("· \(ISO.relative(r.createdAt))").font(.caption).foregroundStyle(.secondary)
                }
                if let loc = r.locale?.nilIfBlank {
                    Text("Γλώσσα: \(Locale(identifier: "el").localizedString(forLanguageCode: loc) ?? loc) · \(Labels.source(r.source))")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
        }
        .padding(.top, 10)
    }

    private func tripCard(_ r: BookingRequest, _ v: Vehicle?) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader("Ταξίδι")
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 12) {
                    VehicleImage(url: v?.imageURL, type: v?.type ?? .car, cornerRadius: 10).frame(width: 88, height: 60)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(v?.name ?? r.requestedVehicle ?? "Χωρίς προτίμηση").font(.headline)
                        if let v { Text("\(Labels.vehicleType(v.type)) · \(v.cc) cc").font(.caption).foregroundStyle(.secondary) }
                        if v == nil, let raw = r.requestedVehicle { Text("Ζητήθηκε: \(raw)").font(.caption).foregroundStyle(.secondary) }
                    }
                }
                Divider()
                HStack(alignment: .top) {
                    dateBlock("Παραλαβή", r.checkIn, r.pickupLocation)
                    Spacer()
                    VStack(spacing: 2) {
                        Image(systemName: "arrow.right").foregroundStyle(.tertiary)
                        Text("\(r.nights) ημ.").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    }.padding(.top, 10)
                    Spacer()
                    dateBlock("Επιστροφή", r.checkOut, r.returnLocation, trailing: true)
                }
                Divider()
                VStack(spacing: 10) {
                    if let p = r.partySize { InfoRow(icon: "person.2", title: "Άτομα", value: "\(p)") }
                    InfoRow(icon: "figure.and.child.holdinghands", title: "Παιδικό κάθισμα", value: r.childSeat ? "Ναι" : "Όχι", valueColor: r.childSeat ? .sun : .primary)
                    if let a = r.arrivalInfo?.nilIfBlank { InfoRow(icon: "ferry", title: "Άφιξη", value: a) }
                    if let est = r.estimatedTotal { InfoRow(icon: "eurosign.circle", title: "Εκτίμηση site", value: Money.precise(est)) }
                    if let v, let p = store.price(v.id, from: r.checkIn, to: r.checkOut), p.available {
                        InfoRow(icon: "tag", title: "Τιμή τιμοκαταλόγου", value: Money.precise(p.baseTotal), valueColor: .navy)
                    }
                }
            }
            .card()
        }
    }

    private func dateBlock(_ title: String, _ day: String, _ place: String?, trailing: Bool = false) -> some View {
        VStack(alignment: trailing ? .trailing : .leading, spacing: 2) {
            Text(title.uppercased(with: greek)).font(.caption2.weight(.bold)).tracking(0.5).foregroundStyle(.secondary)
            Text(Day.format(day, "EEE d MMM")).font(.headline)
            if let place = place?.nilIfBlank { Text(place).font(.caption).foregroundStyle(.secondary).multilineTextAlignment(trailing ? .trailing : .leading) }
        }
    }

    private func messageCard(_ m: String, _ r: BookingRequest) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader("Μήνυμα")
            HStack(alignment: .top, spacing: 10) {
                Avatar(name: r.customerName, size: 30)
                Text(m)
                    .font(.subheadline)
                    .padding(12)
                    .background(Color.navy.opacity(0.07), in: UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 16, bottomTrailingRadius: 16, topTrailingRadius: 16, style: .continuous))
                Spacer(minLength: 20)
            }
        }
    }

    private func guestCard(_ r: BookingRequest) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader("Επικοινωνία")
            VStack(alignment: .leading, spacing: 12) {
                if let p = r.customerPhone?.nilIfBlank { InfoRow(icon: "phone", title: "Τηλέφωνο", value: p) }
                if let e = r.customerEmail?.nilIfBlank { InfoRow(icon: "envelope", title: "Email", value: e) }
                ContactRow(phone: r.customerPhone, email: r.customerEmail, whatsApp: Contact.whatsApp(request: r))
            }
            .card()
        }
    }

    private func availabilityCard(_ r: BookingRequest, _ v: Vehicle?) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader("Διαθεσιμότητα")
            VStack(alignment: .leading, spacing: 14) {
                if let v {
                    let free = store.freeUnits(v, from: r.checkIn, to: r.checkOut)
                    let conflicts = Availability.conflicts(vehicle: v, from: r.checkIn, to: r.checkOut, bookings: store.bookings)
                    HStack(spacing: 14) {
                        Gauge(value: Double(free), in: 0...Double(max(v.units, 1))) {
                            EmptyView()
                        } currentValueLabel: {
                            Text("\(free)").font(.headline.weight(.bold))
                        }
                        .gaugeStyle(.accessoryCircularCapacity)
                        .tint(free > 0 ? Color.success : Color.danger)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(free > 0 ? "\(free) από \(v.units) ελεύθερα" : "Δεν υπάρχει ελεύθερη μονάδα")
                                .font(.headline)
                                .foregroundStyle(free > 0 ? Color.primary : Color.danger)
                            Text("\(v.name) · \(Day.shortRange(r.checkIn, r.checkOut))").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    if !conflicts.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Κρατήσεις στις ίδιες ημερομηνίες").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                            ForEach(conflicts.prefix(5)) { b in
                                NavigationLink(value: Route.booking(b.id)) {
                                    HStack {
                                        Text(b.customerName).font(.subheadline)
                                        Spacer()
                                        Text(Day.shortRange(b.checkIn, b.checkOut)).font(.caption).foregroundStyle(.secondary)
                                        if let p = b.plate { PlateBadge(plate: p) }
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    if free == 0 || r.status == .new || r.status == .reviewed {
                        alternatives(r, v)
                    }
                } else {
                    Label("Δεν βρέθηκε μοντέλο για «\(r.requestedVehicle ?? "—")». Επιλέξτε όχημα κατά την αποδοχή.", systemImage: "questionmark.circle")
                        .font(.subheadline).foregroundStyle(.secondary)
                    alternatives(r, nil)
                }
            }
            .card()
        }
    }

    @ViewBuilder private func alternatives(_ r: BookingRequest, _ v: Vehicle?) -> some View {
        let pool = store.activeVehicles.filter { $0.id != v?.id && (v == nil || $0.type == v!.type) }
        let alts = pool.map { ($0, store.freeUnits($0, from: r.checkIn, to: r.checkOut)) }.filter { $0.1 > 0 }.sorted { $0.1 > $1.1 }.prefix(3)
        if !alts.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("Εναλλακτικές").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(Array(alts), id: \.0.id) { alt in
                            Button {
                                accepting = AcceptChoice(vehicleID: alt.0.id)
                            } label: {
                                VStack(alignment: .leading, spacing: 6) {
                                    VehicleImage(url: alt.0.imageURL, type: alt.0.type, cornerRadius: 8).frame(width: 120, height: 70)
                                    Text(alt.0.name).font(.caption.weight(.semibold)).lineLimit(1)
                                    Text("\(alt.1) ελεύθερα").font(.caption2).foregroundStyle(Color.success)
                                }
                                .frame(width: 120)
                            }
                            .buttonStyle(.plain)
                            .disabled(!(r.status == .new || r.status == .reviewed))
                        }
                    }
                }
            }
        }
    }

    private func actionBar(_ r: BookingRequest, _ v: Vehicle?) -> some View {
        HStack(spacing: 12) {
            Button { confirmReject = true } label: { Text("Απόρριψη") }
                .buttonStyle(SecondaryButtonStyle(tint: .danger))
            Button {
                Haptics.tap()
                accepting = AcceptChoice(vehicleID: v?.id)
            } label: { Label("Αποδοχή", systemImage: "checkmark") }
                .buttonStyle(PrimaryButtonStyle())
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 8)
        .background(.bar)
    }
}
