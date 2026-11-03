import SwiftUI

// Fleet writes: add a model or units (FleetFormPage.tsx), edit units/plates/listing
// (FleetModelDetail.tsx + VehicleRatesPage.tsx › saveListing) and maintenance blocks (useVehicleBlocks.ts).

/// "Προσθήκη οχήματος": more units of an existing model, or a new model.
struct VehicleFormView: View {
    enum Mode: Hashable { case existing, new }

    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var router: Router
    @Environment(\.dismiss) private var dismiss

    @State private var mode: Mode
    // Existing model
    @State private var existingID = ""
    @State private var addCount = 1
    @State private var addPlates: [String] = [""]
    // New model
    @State private var name = ""
    @State private var type: VehicleType = .car
    @State private var cc: Int?
    @State private var rateLow: Double?
    @State private var rateHigh: Double?
    @State private var imageURL = ""
    @State private var quantity = 1
    @State private var plates: [String] = [""]
    @State private var notes = ""

    @State private var saving = false
    @State private var error: String?

    init(mode: Mode = .existing, existingID: String = "") {
        _mode = State(initialValue: mode)
        _existingID = State(initialValue: existingID)
    }

    private var effectiveMode: Mode { store.vehicles.isEmpty ? .new : mode }
    private var existing: Vehicle? { store.vehicle(existingID) }
    private var newPlates: [String] { (effectiveMode == .existing ? addPlates : plates).map(\.trimmed).filter { !$0.isEmpty } }

    var body: some View {
        NavigationStack {
            Form {
                if !store.vehicles.isEmpty {
                    Section {
                        Picker("Τρόπος", selection: $mode.animation()) {
                            Text("Από υπάρχοντα στόλο").tag(Mode.existing)
                            Text("Νέος τύπος").tag(Mode.new)
                        }
                        .pickerStyle(.segmented)
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets())
                    } footer: {
                        Text(effectiveMode == .existing ? "Νέες μονάδες σε μοντέλο που ήδη έχετε. Παίρνουν τις τιμές και τη σελίδα του μοντέλου." : "Νέο μοντέλο με δικές του τιμές.")
                    }
                }
                Section { preview.listRowInsets(EdgeInsets()).listRowBackground(Color.clear) }
                if effectiveMode == .existing { existingSections } else { newSections }
                if let error {
                    Section { Label(error, systemImage: "exclamationmark.triangle.fill").foregroundStyle(Color.danger).font(.subheadline) }
                }
            }
            .navigationTitle(effectiveMode == .existing ? "Νέες μονάδες" : "Νέο όχημα")
            .navigationBarTitleDisplayMode(.inline)
            .scrollDismissesKeyboard(.interactively)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Άκυρο") { dismiss() }.disabled(saving) }
                ToolbarItem(placement: .confirmationAction) {
                    if saving { ProgressView() } else {
                        Button(effectiveMode == .existing ? "Προσθήκη" : "Αποθήκευση", action: submit)
                            .fontWeight(.semibold)
                            .disabled(effectiveMode == .existing && existing == nil)
                    }
                }
            }
        }
        .interactiveDismissDisabled(saving)
        .onAppear(perform: demoPrefill)
    }

    /// DEBUG screenshots: sample input for -DemoRoute fleet/new and fleet/units.
    private func demoPrefill() {
        #if DEBUG
        if AppConfig.demoRoute == "fleet/units", existingID.isEmpty, let v = store.vehicles.first {
            existingID = v.id; resizeAdd(2); addPlates = ["ΕΜΜ 4821", "ΕΜΜ 4822"]
        }
        if AppConfig.demoRoute == "fleet/new", name.isEmpty {
            name = "Toyota Aygo X"; cc = 1000; rateLow = 40; rateHigh = 70
            resizeNew(3); plates = ["ΕΜΒ 2210", "ΕΜΒ 2211", ""]
        }
        #endif
    }

    // MARK: Preview card (the web's live preview aside)

    private var preview: some View {
        let v = existing
        let url = effectiveMode == .existing ? v?.imageURL : imageURL.nilIfBlank
        let t = effectiveMode == .existing ? (v?.type ?? .car) : type
        return VStack(alignment: .leading, spacing: 10) {
            VehicleImage(url: url, type: t, cornerRadius: 14, inset: 8).frame(height: 150)
            VStack(alignment: .leading, spacing: 4) {
                if effectiveMode == .existing {
                    Text(v?.name ?? "Επιλέξτε μοντέλο").font(.headline).foregroundStyle(v == nil ? .secondary : .primary)
                    if let v {
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text("x\(v.quantity)").foregroundStyle(.secondary)
                            Image(systemName: "arrow.right").font(.caption).foregroundStyle(.tertiary)
                            Text("x\(v.quantity + addCount)").font(.title3.weight(.bold)).monospacedDigit()
                            Text("συνολικά μετά την προσθήκη").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                } else {
                    Text(name.trimmed.isEmpty ? "Όνομα μοντέλου" : name.trimmed).font(.headline).foregroundStyle(name.trimmed.isEmpty ? .secondary : .primary)
                    Text("\(Labels.vehicleType(type)) · \(cc.map(String.init) ?? "–") cc · \(quantity) \(quantity == 1 ? "μονάδα" : "μονάδες")")
                        .font(.caption).foregroundStyle(.secondary)
                    if rateLow != nil || rateHigh != nil {
                        Text("€\(rateLow.map(Contact.cleanNumber) ?? "–")–\(rateHigh.map(Contact.cleanNumber) ?? "–") / ημέρα")
                            .font(.subheadline.weight(.semibold))
                    }
                }
            }
            FlowPlates(existing: effectiveMode == .existing ? (v?.unitPlates ?? []) : [], added: newPlates)
        }
        .card(padding: 12)
    }

    // MARK: Existing model

    @ViewBuilder private var existingSections: some View {
        Section {
            NavigationLink {
                ModelChooser(selection: $existingID)
            } label: {
                if let v = existing {
                    HStack(spacing: 12) {
                        VehicleImage(url: v.imageURL, type: v.type, cornerRadius: 8).frame(width: 56, height: 40)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(v.name).font(.body.weight(.medium))
                            Text("\(v.cc) cc · x\(v.quantity)").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                } else {
                    Label("Επιλογή μοντέλου", systemImage: "car.side").foregroundStyle(Color.accentColor)
                }
            }
        } header: { Text("1 · Μοντέλο") }

        if let v = existing {
            Section {
                Stepper(value: Binding(get: { addCount }, set: resizeAdd), in: 1...50) {
                    HStack {
                        Text("Νέες μονάδες")
                        Spacer()
                        Text("\(addCount)").fontWeight(.bold).monospacedDigit()
                    }
                }
                PlateFields(plates: $addPlates, offset: v.quantity)
            } header: { Text("2 · Νέες μονάδες") } footer: { Text("Τρέχων στόλος: x\(v.quantity)") }
        }
    }

    // MARK: New model

    @ViewBuilder private var newSections: some View {
        Section {
            TextField("Όνομα * (π.χ. Toyota Aygo)", text: $name)
            HStack(spacing: 10) {
                ForEach([VehicleType.car, .scooter]) { t in
                    let active = type == t
                    Button {
                        Haptics.select()
                        type = t
                    } label: {
                        VStack(spacing: 6) {
                            Image(systemName: t == .car ? "car.side.fill" : "scooter").font(.title2)
                            Text(Labels.vehicleType(t)).font(.footnote.weight(.semibold))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .foregroundStyle(active ? Color.navy : .secondary)
                        .background(active ? Color.navy.opacity(0.08) : .clear, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(active ? Color.navy : Color.hairline, lineWidth: active ? 2 : 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(active ? .isSelected : [])
                }
            }
            .listRowInsets(EdgeInsets(top: 10, leading: 12, bottom: 10, trailing: 12))
            numberRow("Κυβικά (cc) *", value: $cc, placeholder: "1000", unit: "cc")
            decimalRow("Τιμή low *", value: $rateLow, placeholder: "25")
            decimalRow("Τιμή high *", value: $rateHigh, placeholder: "45")
            TextField("Φωτογραφία (URL, προαιρετικό)", text: $imageURL)
                .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
        } header: { Text("1 · Στοιχεία οχήματος") }

        Section {
            Stepper(value: Binding(get: { quantity }, set: resizeNew), in: 1...50) {
                HStack {
                    Text("Ποσότητα")
                    Spacer()
                    Text("\(quantity)").fontWeight(.bold).monospacedDigit()
                }
            }
            PlateFields(plates: $plates, offset: 0)
            TextField("Σημειώσεις για το όχημα...", text: $notes, axis: .vertical).lineLimit(2...5)
        } header: { Text("2 · Στόλος & πινακίδες") } footer: {
            Text("Μετά την αποθήκευση ορίστε τις τιμές ανά περίοδο και το slug του site από την καρτέλα του μοντέλου.")
        }
    }

    private func numberRow(_ title: String, value: Binding<Int?>, placeholder: String, unit: String) -> some View {
        HStack {
            Text(title)
            Spacer()
            TextField(placeholder, value: value, format: .number.grouping(.never))
                .keyboardType(.numberPad).multilineTextAlignment(.trailing).frame(maxWidth: 110)
            Text(unit).foregroundStyle(.secondary)
        }
    }

    private func decimalRow(_ title: String, value: Binding<Double?>, placeholder: String) -> some View {
        HStack {
            Text(title)
            Spacer()
            TextField(placeholder, value: value, format: .number.precision(.fractionLength(0...2)))
                .keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(maxWidth: 110)
            Text("€/ημ.").foregroundStyle(.secondary)
        }
    }

    private func resizeAdd(_ n: Int) {
        addCount = n
        addPlates = (0..<n).map { $0 < addPlates.count ? addPlates[$0] : "" }
    }

    private func resizeNew(_ n: Int) {
        quantity = n
        plates = (0..<n).map { $0 < plates.count ? plates[$0] : "" }
    }

    private func submit() {
        error = nil
        if effectiveMode == .existing {
            guard let v = existing else { error = "Επιλέξτε όχημα από τον στόλο"; return }
            saving = true
            Task {
                do {
                    try await store.addUnits(to: v, count: addCount, plates: addPlates)
                    Haptics.notify(.success)
                    store.show("Προστέθηκαν \(addCount) μονάδες στο \(v.name)")
                    dismiss()
                    router.fleetPath = [.vehicle(v.id)]
                } catch {
                    Haptics.notify(.error)
                    self.error = "Σφάλμα προσθήκης μονάδων"
                }
                saving = false
            }
        } else {
            guard !name.trimmed.isEmpty, let cc, cc > 0, let rateLow, let rateHigh else {
                error = "Συμπληρώστε όνομα, cc και τιμές"; return
            }
            saving = true
            let input = VehicleInput(name: name, type: type, cc: cc, dailyRateLow: rateLow, dailyRateHigh: rateHigh, quantity: quantity,
                                     plates: plates, notes: notes, imageURL: imageURL)
            Task {
                do {
                    let v = try await store.createVehicle(input)
                    Haptics.notify(.success)
                    store.show("Το όχημα προστέθηκε στον στόλο")
                    dismiss()
                    router.fleetPath = [.vehicle(v.id)]
                } catch {
                    Haptics.notify(.error)
                    self.error = "Σφάλμα προσθήκης οχήματος"
                }
                saving = false
            }
        }
    }
}

extension VehicleFormView.Mode: Identifiable { var id: Self { self } }

/// "Μονάδα N" + plate text field per unit, with an optional status dot.
struct PlateFields: View {
    @Binding var plates: [String]
    var offset = 0
    var status: ((Int) -> Color?)? = nil

    var body: some View {
        ForEach(plates.indices, id: \.self) { i in
            HStack(spacing: 10) {
                Circle().fill(status?(i) ?? Color.secondary.opacity(0.3)).frame(width: 8, height: 8)
                Text("Μονάδα \(offset + i + 1)").font(.subheadline).foregroundStyle(.secondary).frame(width: 84, alignment: .leading)
                TextField("π.χ. ΑΜΗ1234", text: Binding(get: { i < plates.count ? plates[i] : "" }, set: { if i < plates.count { plates[i] = $0 } }))
                    .font(.body.monospaced())
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
            }
        }
    }
}

/// Existing plates (muted) and the ones being added (green "+").
struct FlowPlates: View {
    let existing: [String]
    let added: [String]
    var body: some View {
        if existing.isEmpty && added.isEmpty {
            Text("Χωρίς καταχωρημένες πινακίδες").font(.caption).foregroundStyle(.secondary)
        } else {
            WrapLayout(spacing: 5) {
                ForEach(Array(existing.enumerated()), id: \.offset) { _, p in PlateBadge(plate: p) }
                ForEach(Array(added.enumerated()), id: \.offset) { _, p in
                    Text("+ \(p.uppercased())")
                        .font(.caption.weight(.semibold).monospaced())
                        .padding(.horizontal, 6).padding(.vertical, 2.5)
                        .foregroundStyle(Color.success)
                        .background(Color.success.opacity(0.12), in: RoundedRectangle(cornerRadius: 5, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 5, style: .continuous).strokeBorder(Color.success.opacity(0.4), lineWidth: 1))
                }
            }
        }
    }
}

/// Simple flow layout for chips.
struct WrapLayout: Layout {
    var spacing: CGFloat = 6
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, row: CGFloat = 0, maxX: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x > 0 && x + s.width > width { x = 0; y += row + spacing; row = 0 }
            x += s.width + spacing; row = max(row, s.height); maxX = max(maxX, x - spacing)
        }
        return CGSize(width: min(maxX, width), height: y + row)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, row: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x > bounds.minX && x + s.width > bounds.maxX { x = bounds.minX; y += row + spacing; row = 0 }
            v.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(s))
            x += s.width + spacing; row = max(row, s.height)
        }
    }
}

struct ModelChooser: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @Binding var selection: String

    var body: some View {
        List(store.vehicles) { v in
            Button {
                Haptics.select()
                selection = v.id
                dismiss()
            } label: {
                HStack(spacing: 12) {
                    VehicleImage(url: v.imageURL, type: v.type, cornerRadius: 8).frame(width: 64, height: 44)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(v.name).font(.body.weight(.medium)).foregroundStyle(.primary)
                        Text("\(v.cc) cc · x\(v.quantity)").font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    if selection == v.id { Image(systemName: "checkmark").foregroundStyle(Color.accentColor).fontWeight(.semibold) }
                }
            }
        }
        .navigationTitle("Μοντέλο")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Edit a model

/// Units & plates, notes, active, photo URL, and the site listing (slug + show_on_site).
struct VehicleEditView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    let vehicle: Vehicle

    @State private var quantity: Int
    @State private var plates: [String]
    @State private var notes: String
    @State private var active: Bool
    @State private var imageURL: String
    @State private var slug: String
    @State private var showOnSite: Bool
    @State private var saving = false
    @State private var error: String?

    init(vehicle v: Vehicle) {
        vehicle = v
        let q = v.quantity
        let p = v.unitPlates
        _quantity = State(initialValue: q)
        _plates = State(initialValue: (0..<q).map { $0 < p.count ? p[$0] : "" })
        _notes = State(initialValue: v.notes ?? "")
        _active = State(initialValue: v.active)
        _imageURL = State(initialValue: v.imageURL ?? "")
        _slug = State(initialValue: v.slug ?? "")
        _showOnSite = State(initialValue: v.showOnSite ?? true)
    }

    private var cleanPlates: [String] { plates.map(\.trimmed).filter { !$0.isEmpty } }
    private var dirty: Bool {
        quantity != vehicle.quantity || notes != (vehicle.notes ?? "") || cleanPlates != vehicle.unitPlates
            || active != vehicle.active || imageURL.trimmed != (vehicle.imageURL ?? "")
            || VehicleUpdate.cleanSlug(slug) != (vehicle.slug ?? "") || showOnSite != (vehicle.showOnSite ?? true)
    }

    var body: some View {
        let statuses = store.unitStatuses(vehicle)
        NavigationStack {
            Form {
                Section {
                    Stepper(value: Binding(get: { quantity }, set: setQty), in: 1...50) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Ποσότητα στον στόλο")
                                Text("Ίδια οχήματα αυτού του μοντέλου").font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text("\(quantity)").font(.title3.weight(.bold)).monospacedDigit()
                        }
                    }
                    PlateFields(plates: $plates) { i in
                        guard i < statuses.count else { return nil }
                        switch statuses[i].status {
                        case .available: return .success
                        case .onRent: return .navy
                        case .blocked: return .danger
                        }
                    }
                    TextField("Σημειώσεις (π.χ. ζάντα πίσω δεξιά γδαρμένη)", text: $notes, axis: .vertical).lineLimit(2...5)
                } header: { Text("Μονάδες & πινακίδες") } footer: {
                    HStack(spacing: 12) {
                        legend(.success, "Διαθέσιμο"); legend(.navy, "Σε ενοικίαση"); legend(.danger, "Συντήρηση")
                    }
                }

                Section {
                    Toggle(isOn: $active) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Ενεργό")
                            Text(active ? "Εμφανίζεται για νέες κρατήσεις." : "Δεν εμφανίζεται για νέες κρατήσεις.").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    VStack(alignment: .leading, spacing: 10) {
                        TextField("Φωτογραφία (URL)", text: $imageURL)
                            .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                        VehicleImage(url: imageURL.nilIfBlank, type: vehicle.type, cornerRadius: 10, inset: 6).frame(height: 110)
                    }
                    .padding(.vertical, 4)
                } header: { Text("Κατάσταση & φωτογραφία") }

                Section {
                    HStack(spacing: 2) {
                        Text("/").foregroundStyle(.secondary)
                        TextField("π.χ. fiat-panda", text: $slug)
                            .textInputAutocapitalization(.never).autocorrectionDisabled().font(.body.monospaced())
                    }
                    Toggle(isOn: $showOnSite) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Εμφάνιση στο site")
                            Text(showOnSite ? "Ορατό και κρατήσιμο online" : "Κρυφό από τους επισκέπτες").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                } header: { Text("Εμφάνιση στο rentacarsifnos.com") } footer: {
                    Text("Οι τιμές και η διαθεσιμότητα εμφανίζονται στη σελίδα του οχήματος με αυτό το slug. Αλλαγές φαίνονται στο site μέσα σε λίγα λεπτά.")
                }

                if let error {
                    Section { Label(error, systemImage: "exclamationmark.triangle.fill").foregroundStyle(Color.danger).font(.subheadline) }
                }
            }
            .navigationTitle(vehicle.name)
            .navigationBarTitleDisplayMode(.inline)
            .scrollDismissesKeyboard(.interactively)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Άκυρο") { dismiss() }.disabled(saving) }
                ToolbarItem(placement: .confirmationAction) {
                    if saving { ProgressView() } else { Button("Αποθήκευση", action: save).fontWeight(.semibold).disabled(!dirty) }
                }
            }
        }
        .interactiveDismissDisabled(saving)
    }

    private func legend(_ c: Color, _ t: String) -> some View {
        HStack(spacing: 4) { Circle().fill(c).frame(width: 7, height: 7); Text(t) }
    }

    /// setQty(): 1…50, plate slots follow.
    private func setQty(_ n: Int) {
        let q = max(1, min(50, n))
        quantity = q
        plates = (0..<q).map { $0 < plates.count ? plates[$0] : "" }
    }

    private func save() {
        error = nil
        saving = true
        let clean = VehicleUpdate.cleanSlug(slug)
        let update = VehicleUpdate(quantity: quantity, plates: plates, notes: .some(notes), active: active,
                                   imageURL: .some(imageURL), slug: .some(clean), showOnSite: showOnSite)
        Task {
            do {
                try await store.updateVehicle(vehicle, update)
                slug = clean
                Haptics.notify(.success)
                store.show("Το όχημα ενημερώθηκε")
                dismiss()
            } catch {
                Haptics.notify(.error)
                self.error = (error as? BackendError)?.errorDescription ?? "Σφάλμα ενημέρωσης"
            }
            saving = false
        }
    }
}

// MARK: - Maintenance blocks

struct BlockFormView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    let vehicle: Vehicle

    @State private var start = Date()
    @State private var end = Date()
    @State private var reason = ""
    @State private var saving = false
    @State private var error: String?

    private var from: String { Day.string(from: start) }
    private var to: String { Day.string(from: max(start, end)) }
    private var days: Int { Day.nights(from: from, to: to) + 1 }

    var body: some View {
        let free = store.freeUnits(vehicle, from: from, to: to)
        let conflicts = Availability.conflicts(vehicle: vehicle, from: from, to: to, bookings: store.bookings)
        NavigationStack {
            Form {
                Section {
                    DatePicker("Από", selection: $start, displayedComponents: .date)
                    DatePicker("Έως (συμπεριλαμβάνεται)", selection: $end, in: start..., displayedComponents: .date)
                    HStack {
                        TextField("Λόγος (Σέρβις, ζημιά…)", text: $reason)
                        Menu {
                            ForEach(["Σέρβις", "Ζημιά", "ΚΤΕΟ", "Αλλαγή ελαστικών", "Καθαρισμός"], id: \.self) { r in Button(r) { reason = r } }
                        } label: { Image(systemName: "text.badge.plus").font(.title3) }
                        .accessibilityLabel("Προτεινόμενοι λόγοι")
                    }
                } header: { Text("\(vehicle.name) · \(days) \(days == 1 ? "ημέρα" : "ημέρες")") }

                Section {
                    HStack(spacing: 10) {
                        Image(systemName: free > 0 ? "wrench.and.screwdriver.fill" : "exclamationmark.triangle.fill")
                            .foregroundStyle(free > 0 ? Color.warning : Color.danger)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(free > 0 ? "Δεσμεύει 1 μονάδα · ελεύθερες μετά: \(free - 1) από \(vehicle.units)" : "Καμία ελεύθερη μονάδα για αυτές τις ημερομηνίες")
                                .font(.subheadline.weight(.semibold))
                            if !conflicts.isEmpty {
                                Text("Κρατήσεις στο διάστημα: " + conflicts.prefix(3).map(\.customerName).joined(separator: ", ") + (conflicts.count > 3 ? "…" : ""))
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                } footer: {
                    Text("Μετράει στη διαθεσιμότητα όπως μια κράτηση (και στο site), μέχρι και την τελευταία ημέρα.")
                }

                if let error { Section { Text(error).foregroundStyle(Color.danger) } }
            }
            .navigationTitle("Μπλοκ συντήρησης")
            .navigationBarTitleDisplayMode(.inline)
            .onChange(of: start) { _, s in if end < s { end = s } }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Άκυρο") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if saving { ProgressView() } else { Button("Αποθήκευση", action: save).fontWeight(.semibold) }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func save() {
        saving = true
        error = nil
        Task {
            do {
                try await store.createBlock(BlockInput(vehicleID: vehicle.id, startDate: from, endDate: to, reason: reason))
                Haptics.notify(.success)
                store.show("Προστέθηκε μπλοκ συντήρησης")
                dismiss()
            } catch {
                Haptics.notify(.error)
                self.error = "Σφάλμα μπλοκαρίσματος"
            }
            saving = false
        }
    }
}

struct BlockRow: View {
    let block: VehicleBlock
    var body: some View {
        let today = Day.today
        let active = block.startDate <= today && block.endDate >= today
        let past = block.endDate < today
        let days = Day.nights(from: block.startDate, to: block.endDate) + 1
        HStack(spacing: 12) {
            Image(systemName: "wrench.and.screwdriver.fill")
                .font(.subheadline)
                .foregroundStyle(active ? Color.danger : .secondary)
                .frame(width: 38, height: 38)
                .background((active ? Color.danger : Color.secondary).opacity(0.12), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text("\(Day.dayMonth(block.startDate)) – \(Day.dayMonth(block.endDate))").font(.subheadline.weight(.semibold))
                    Text("\(days) \(days == 1 ? "ημέρα" : "ημέρες")").font(.caption).foregroundStyle(.secondary)
                }
                Text((block.reason?.nilIfBlank ?? "Συντήρηση") + (active ? " · ενεργό τώρα" : past ? " · ολοκληρώθηκε" : " · προγραμματισμένο"))
                    .font(.caption).foregroundStyle(active ? Color.danger : .secondary).lineLimit(1)
            }
            Spacer()
        }
        .opacity(past ? 0.6 : 1)
        .accessibilityElement(children: .combine)
    }
}
