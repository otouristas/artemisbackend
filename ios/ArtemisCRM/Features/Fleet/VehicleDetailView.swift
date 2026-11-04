import SwiftUI

struct VehicleDetailView: View {
    @EnvironmentObject private var store: AppStore
    let vehicleID: String
    @State private var editingRate: RateSheet?
    @State private var editingVehicle = false
    @State private var addingBlock = false
    @State private var addingUnits = false
    @State private var deletingBlock: VehicleBlock?

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
        return ScrollViewReader { proxy in List {
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
            Section {
                if v.unitPlates.isEmpty {
                    Text("Δεν έχουν καταχωρηθεί πινακίδες").font(.subheadline).foregroundStyle(.secondary)
                }
                ForEach(Array(store.unitStatuses(v).enumerated()), id: \.offset) { i, unit in
                    HStack {
                        if let plate = unit.plate { PlateBadge(plate: plate) } else { Text("Μονάδα \(i + 1)").font(.subheadline).foregroundStyle(.secondary) }
                        Spacer()
                        switch unit.status {
                        case .available:
                            StatusPill(text: "Ελεύθερο", color: .success, icon: "checkmark")
                        case .blocked(let block):
                            StatusPill(text: "Συντήρηση · \(block.reason?.nilIfBlank ?? "έως \(Day.dayMonth(block.endDate))")", color: .danger, icon: "wrench.and.screwdriver")
                        case .onRent(let b):
                            if let b {
                                NavigationLink(value: Route.booking(b.id)) {
                                    HStack {
                                        Spacer()
                                        Text(b.customerName).font(.subheadline).lineLimit(1)
                                        StatusPill(text: "έως \(Day.dayMonth(b.checkOut))", color: .navy)
                                    }
                                }
                            }
                        }
                    }
                }
                Button { addingUnits = true } label: { Label("Προσθήκη μονάδων", systemImage: "plus.square.on.square") }
            } header: { Text("Μονάδες σήμερα") }
            .id("units")
            Section {
                let modelBlocks = store.blocks(for: v)
                if modelBlocks.isEmpty {
                    Label("Κανένα μπλοκ συντήρησης.", systemImage: "wrench.and.screwdriver").font(.subheadline).foregroundStyle(.secondary)
                }
                ForEach(modelBlocks) { block in
                    HStack {
                        BlockRow(block: block)
                        Button { deletingBlock = block } label: { Image(systemName: "trash").foregroundStyle(Color.danger) }
                            .buttonStyle(.borderless)
                            .accessibilityLabel("Διαγραφή μπλοκ")
                    }
                    .swipeActions {
                        Button(role: .destructive) { deletingBlock = block } label: { Label("Διαγραφή", systemImage: "trash") }
                    }
                }
                Button { addingBlock = true } label: { Label("Νέο μπλοκ συντήρησης", systemImage: "plus.circle.fill") }
            } header: { Text("Συντήρηση (\(store.blocks(for: v).count))") } footer: {
                Text("Κάθε μπλοκ δεσμεύει μία μονάδα για τις ημερομηνίες, μέχρι και την τελευταία, όπως μια κράτηση. Μετράει στη διαθεσιμότητα του CRM και του site.")
            }
            .id("maintenance")
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
                NavigationLink(value: Route.prices(v.id)) {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Ημερολόγιο τιμών \(String(PriceYear.currentYear))", systemImage: "calendar")
                            .font(.subheadline.weight(.semibold))
                        YearPriceStrip(rates: store.rates(for: v.id), year: PriceYear.currentYear, compact: true)
                    }
                    .padding(.vertical, 4)
                }
                Button { editingRate = RateSheet(rate: nil) } label: { Label("Νέα περίοδος τιμής", systemImage: "plus.circle.fill") }
            } header: { Text("Τιμές ανά περίοδο") } footer: {
                Text("Η τιμή υπολογίζεται ανά νύχτα από αυτές τις περιόδους (ίδιος κανόνας με το web και το site).")
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .task {
            #if DEBUG
            guard let r = AppConfig.demoRoute else { return }
            try? await Task.sleep(nanoseconds: 1_600_000_000)
            switch r {
            case "fleet/maintenance": withAnimation { proxy.scrollTo("units", anchor: .top) }
            case "fleet/block": addingBlock = true
            case "fleet/edit": editingVehicle = true
            case "fleet/block-delete":
                withAnimation { proxy.scrollTo("maintenance", anchor: .top) }
                try? await Task.sleep(nanoseconds: 500_000_000)
                deletingBlock = store.blocks(for: v).first
            default: break
            }
            #endif
        }
        }
        .background(Color.screen)
        .navigationTitle(v.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button { editingVehicle = true } label: { Label("Επεξεργασία μοντέλου", systemImage: "pencil") }
                    Button { addingUnits = true } label: { Label("Προσθήκη μονάδων", systemImage: "plus.square.on.square") }
                    Button { addingBlock = true } label: { Label("Μπλοκ συντήρησης", systemImage: "wrench.and.screwdriver") }
                    Button { editingRate = RateSheet(rate: nil) } label: { Label("Νέα περίοδος τιμής", systemImage: "eurosign.circle") }
                    NavigationLink(value: Route.prices(v.id)) { Label("Ημερολόγιο τιμών", systemImage: "calendar") }
                } label: { Text("Επεξεργασία") }
            }
        }
        .sheet(item: $editingRate) { s in RateEditView(vehicle: v, rate: s.rate) }
        .sheet(isPresented: $editingVehicle) { VehicleEditView(vehicle: v) }
        .sheet(isPresented: $addingBlock) { BlockFormView(vehicle: v) }
        .sheet(isPresented: $addingUnits) { VehicleFormView(mode: .existing, existingID: v.id) }
        .alert("Διαγραφή μπλοκ συντήρησης;", isPresented: Binding(get: { deletingBlock != nil }, set: { if !$0 { deletingBlock = nil } }), presenting: deletingBlock) { block in
            Button("Διαγραφή", role: .destructive) { Task { await store.deleteBlock(block) } }
            Button("Άκυρο", role: .cancel) {}
        } message: { _ in
            Text("Το όχημα θα εμφανίζεται ξανά διαθέσιμο για αυτές τις ημερομηνίες.")
        }
    }

    private func hero(_ v: Vehicle) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            VehicleImage(url: v.imageURL, type: v.type, cornerRadius: 20)
                .frame(height: 200)
            VStack(alignment: .leading, spacing: 4) {
                Text(v.name).font(.title2.weight(.bold))
                Text("\(Labels.vehicleType(v.type)) · \(v.cc) cc · \(v.units) \(v.units == 1 ? "μονάδα" : "μονάδες")" + (v.slug.map { " · /\($0)" } ?? ""))
                    .font(.subheadline).foregroundStyle(.secondary)
            }
            HStack(spacing: 10) {
                Circle().fill(v.active ? Color.success : Color.secondary).frame(width: 8, height: 8)
                VStack(alignment: .leading, spacing: 1) {
                    Text(v.active ? "ΕΝΕΡΓΟ" : "ΑΝΕΝΕΡΓΟ").font(.caption.weight(.heavy)).tracking(0.5)
                    Text(v.active ? (v.slug?.nilIfBlank == nil ? "Ενεργό στο CRM · χωρίς slug, δεν εμφανίζεται στο site." : (v.showOnSite ?? true) ? "Εμφανίζεται στο site και δέχεται κρατήσεις." : "Ενεργό στο CRM, κρυφό στο site.") : "Δεν εμφανίζεται για νέες κρατήσεις.")
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
    /// A range picked on the price calendar.
    var initialStart: String? = nil
    var initialEnd: String? = nil

    @State private var label = ""
    @State private var start = Date()
    @State private var end = Day.add(30, to: Date())
    @State private var daily: Double = 0
    @State private var minDays = 1
    @State private var saving = false
    @State private var error: String?
    @State private var confirmDelete = false

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
                if rate != nil {
                    Section {
                        Button("Διαγραφή περιόδου", role: .destructive) { confirmDelete = true }
                    }
                }
            }
            .navigationTitle(rate == nil ? "Νέα περίοδος" : "Επεξεργασία τιμής")
            .alert("Διαγραφή περιόδου;", isPresented: $confirmDelete) {
                Button("Διαγραφή", role: .destructive) {
                    guard let rate else { return }
                    Task { await store.deleteRate(rate); dismiss() }
                }
                Button("Άκυρο", role: .cancel) {}
            } message: {
                Text("Οι ημέρες της θα μείνουν χωρίς τιμή μέχρι να προσθέσετε νέα περίοδο.")
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Άκυρο") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if saving { ProgressView() } else { Button("Αποθήκευση", action: save).fontWeight(.semibold).disabled(daily <= 0) }
                }
            }
            .onAppear {
                guard let rate else {
                    if let initialStart { start = Day.date(initialStart) }
                    if let initialEnd { end = Day.date(initialEnd) }
                    return
                }
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
