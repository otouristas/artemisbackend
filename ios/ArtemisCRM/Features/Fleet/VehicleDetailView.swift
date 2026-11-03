import SwiftUI

struct VehicleDetailView: View {
    @EnvironmentObject private var store: AppStore
    let vehicleID: String
    @State private var editingRate: RateSheet?

    struct RateSheet: Identifiable { let id = UUID(); let rate: VehicleRate? }

    var body: some View {
        if let v = store.vehicle(vehicleID) { content(v) } else {
            ContentUnavailableView("Το όχημα δεν βρέθηκε", systemImage: "car.side")
        }
    }

    private func content(_ v: Vehicle) -> some View {
        let today = Day.today
        let upcoming = store.bookings.filter { $0.vehicleID == v.id && $0.isActive && $0.checkOut >= today }.sorted { $0.checkIn < $1.checkIn }
        let rates = store.rates(for: v.id).filter { $0.endDate >= today }
        return List {
            Section {
                hero(v)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            Section {
                stats(v)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            Section("Επόμενες 14 ημέρες") {
                AvailabilityStrip(vehicle: v)
                    .padding(.vertical, 6)
            }
            Section("Μονάδες σήμερα") {
                let busy = Availability.conflicts(vehicle: v, from: today, to: today, bookings: store.bookings)
                if v.unitPlates.isEmpty {
                    Text("Δεν έχουν καταχωρηθεί πινακίδες").foregroundStyle(.secondary)
                }
                ForEach(v.unitPlates, id: \.self) { plate in
                    let b = busy.first { $0.plate == plate }
                    HStack {
                        PlateBadge(plate: plate)
                        Spacer()
                        if let b {
                            NavigationLink(value: Route.booking(b.id)) {
                                HStack {
                                    Spacer()
                                    Text(b.customerName).font(.subheadline).lineLimit(1)
                                    StatusPill(text: "έως \(Day.dayMonth(b.checkOut))", color: .navy)
                                }
                            }
                        } else {
                            StatusPill(text: "Ελεύθερο", color: .success, icon: "checkmark")
                        }
                    }
                }
                ForEach(store.blocks.filter { $0.vehicleID == v.id && $0.endDate >= today }) { block in
                    Label("\(block.reason ?? "Μπλοκάρισμα") · \(Day.shortRange(block.startDate, block.endDate))", systemImage: "wrench.and.screwdriver")
                        .font(.subheadline).foregroundStyle(Color.warning)
                }
            }
            Section {
                if upcoming.isEmpty {
                    Text("Καμία επερχόμενη κράτηση").foregroundStyle(.secondary)
                }
                ForEach(upcoming.prefix(12)) { b in
                    NavigationLink(value: Route.booking(b.id)) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(b.customerName).font(.subheadline.weight(.medium))
                                Text(Day.shortRange(b.checkIn, b.checkOut) + " · \(b.nights) ημ.").font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            if let p = b.plate { PlateBadge(plate: p) }
                            StatusPill(text: Labels.booking(b.status), color: b.status.color)
                        }
                    }
                }
            } header: { Text("Επερχόμενες κρατήσεις (\(upcoming.count))") }
            Section {
                if rates.isEmpty {
                    Text("Δεν υπάρχουν περίοδοι τιμών. Η αυτόματη τιμή δεν θα υπολογίζεται.").font(.subheadline).foregroundStyle(.secondary)
                }
                ForEach(rates) { r in
                    Button { editingRate = RateSheet(rate: r) } label: { RateRow(rate: r, isCurrent: r.startDate <= today && today <= r.endDate) }
                        .buttonStyle(.plain)
                        .swipeActions {
                            Button(role: .destructive) { Task { await store.deleteRate(r) } } label: { Label("Διαγραφή", systemImage: "trash") }
                        }
                }
                Button { editingRate = RateSheet(rate: nil) } label: { Label("Νέα περίοδος τιμής", systemImage: "plus.circle.fill") }
            } header: { Text("Τιμές ανά περίοδο") } footer: {
                Text("Η τιμή υπολογίζεται ανά νύχτα από αυτές τις περιόδους (ίδιος κανόνας με το web και το site).")
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color.screen)
        .navigationTitle(v.name)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $editingRate) { s in RateEditView(vehicle: v, rate: s.rate) }
    }

    private func hero(_ v: Vehicle) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            VehicleImage(url: v.imageURL, type: v.type, cornerRadius: 20)
                .frame(height: 200)
            VStack(alignment: .leading, spacing: 4) {
                Text(v.name).font(.title2.weight(.bold))
                Text("\(Labels.vehicleType(v.type)) · \(v.cc) cc · \(v.units) μονάδες").font(.subheadline).foregroundStyle(.secondary)
            }
            HStack(spacing: 10) {
                Circle().fill(v.active ? Color.success : Color.secondary).frame(width: 8, height: 8)
                VStack(alignment: .leading, spacing: 1) {
                    Text(v.active ? "ΕΝΕΡΓΟ" : "ΑΝΕΝΕΡΓΟ").font(.caption.weight(.heavy)).tracking(0.5)
                    Text(v.active ? ((v.showOnSite ?? true) ? "Εμφανίζεται στο site και δέχεται κρατήσεις." : "Ενεργό στο CRM, κρυφό στο site.") : "Δεν εμφανίζεται για νέες κρατήσεις.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
            }
            .padding(12)
            .background((v.active ? Color.success : Color.secondary).opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.hairline))
        }
    }

    private func stats(_ v: Vehicle) -> some View {
        let free = store.freeToday(v)
        return HStack(spacing: 10) {
            stat("Μονάδες", "\(v.units)", .navy)
            stat("Ελεύθερα", "\(free)", free > 0 ? .success : .danger)
            stat("Σήμερα", store.todayRate(v).map(Money.format) ?? "—", .sun)
        }
    }

    private func stat(_ title: String, _ value: String, _ tint: Color) -> some View {
        VStack(spacing: 4) {
            Text(value).font(.title3.weight(.bold)).foregroundStyle(tint).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .card(padding: 12)
    }
}

struct RateRow: View {
    let rate: VehicleRate
    var isCurrent = false

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(rate.label?.nilIfBlank ?? "Περίοδος").font(.subheadline.weight(.medium))
                    if isCurrent { StatusPill(text: "Τώρα", color: .success) }
                }
                Text("\(Day.format(rate.startDate, "d MMM yyyy")) – \(Day.format(rate.endDate, "d MMM yyyy"))" + ((rate.minDays ?? 1) > 1 ? " · min \(rate.minDays ?? 1) ημ." : ""))
                    .font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Text(Money.precise(rate.dailyRate)).font(.headline).monospacedDigit()
            Text("/ημ.").font(.caption).foregroundStyle(.secondary)
        }
        .contentShape(Rectangle())
    }
}

/// 14 small bars: free units per day.
struct AvailabilityStrip: View {
    @EnvironmentObject private var store: AppStore
    let vehicle: Vehicle

    var body: some View {
        let days = (0..<14).map { Day.add($0, to: Day.today) }
        HStack(alignment: .bottom, spacing: 4) {
            ForEach(days, id: \.self) { d in
                let free = Availability.freeUnits(vehicle: vehicle, on: d, bookings: store.bookings, blocks: store.blocks)
                let frac = CGFloat(vehicle.units - free) / CGFloat(max(vehicle.units, 1))
                VStack(spacing: 4) {
                    Text("\(free)").font(.system(size: 10, weight: .semibold)).foregroundStyle(free == 0 ? Color.danger : .secondary)
                    ZStack(alignment: .bottom) {
                        RoundedRectangle(cornerRadius: 3).fill(Color.secondary.opacity(0.14))
                        RoundedRectangle(cornerRadius: 3).fill(free == 0 ? Color.danger : Color.navy).frame(height: max(3, 44 * frac))
                    }
                    .frame(height: 44)
                    Text(Day.format(d, "d")).font(.system(size: 10)).foregroundStyle(d == Day.today ? Color.navy : .secondary)
                        .fontWeight(d == Day.today ? .bold : .regular)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Διαθεσιμότητα 14 ημερών")
    }
}

struct RateEditView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    let vehicle: Vehicle
    let rate: VehicleRate?

    @State private var label = ""
    @State private var start = Date()
    @State private var end = Day.add(30, to: Date())
    @State private var daily: Double = 0
    @State private var minDays = 1
    @State private var saving = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Ετικέτα (π.χ. Υψηλή περίοδος 2027)", text: $label)
                    DatePicker("Από", selection: $start, displayedComponents: .date)
                    DatePicker("Έως (συμπεριλαμβάνεται)", selection: $end, in: start..., displayedComponents: .date)
                }
                Section {
                    HStack {
                        Text("Τιμή ανά ημέρα")
                        Spacer()
                        TextField("0", value: $daily, format: .number.precision(.fractionLength(0...2)))
                            .keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(maxWidth: 100)
                        Text("€").foregroundStyle(.secondary)
                    }
                    Stepper("Ελάχιστες ημέρες: \(minDays)", value: $minDays, in: 1...30)
                } footer: {
                    Text("Οι περίοδοι του ίδιου μοντέλου δεν μπορούν να επικαλύπτονται.")
                }
                if let error { Section { Text(error).foregroundStyle(Color.danger) } }
            }
            .navigationTitle(rate == nil ? "Νέα περίοδος" : "Επεξεργασία τιμής")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Άκυρο") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if saving { ProgressView() } else { Button("Αποθήκευση", action: save).fontWeight(.semibold).disabled(daily <= 0) }
                }
            }
            .onAppear {
                guard let rate else { return }
                label = rate.label ?? ""
                start = Day.date(rate.startDate); end = Day.date(rate.endDate)
                daily = rate.dailyRate; minDays = rate.minDays ?? 1
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func save() {
        saving = true
        error = nil
        let input = RateInput(vehicleID: vehicle.id, label: label, startDate: Day.string(from: start), endDate: Day.string(from: end), dailyRate: daily, minDays: minDays)
        Task {
            do {
                try await store.saveRate(input, editing: rate)
                Haptics.notify(.success)
                store.show("Η τιμή αποθηκεύτηκε")
                dismiss()
            } catch {
                Haptics.notify(.error)
                self.error = error.localizedDescription
            }
            saving = false
        }
    }
}
