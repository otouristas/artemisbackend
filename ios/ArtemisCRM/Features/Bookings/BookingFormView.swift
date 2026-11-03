import SwiftUI

/// Create / edit a booking, or accept a website request (BookingFormPage.tsx).
struct BookingFormView: View {
    enum Mode {
        case create(prefill: BookingInput?)
        case edit(Booking)
        case accept(BookingRequest, vehicleID: String?)
    }

    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    let mode: Mode

    @State private var input = BookingInput()
    @State private var manualPrice = false
    @State private var saving = false
    @State private var error: String?
    @State private var confirmConflict = false
    @State private var initialized = false

    private var editingBooking: Booking? { if case .edit(let b) = mode { return b }; return nil }
    private var sourceRequest: BookingRequest? { if case .accept(let r, _) = mode { return r }; return nil }
    private var vehicle: Vehicle? { store.vehicle(input.vehicleID) }
    private var nights: Int { Day.nights(from: input.checkIn, to: input.checkOut) }
    private var freeUnits: Int? {
        guard let vehicle, nights > 0 else { return nil }
        return store.freeUnits(vehicle, from: input.checkIn, to: input.checkOut, excluding: editingBooking?.id)
    }
    private var conflicts: [Booking] {
        guard let vehicle else { return [] }
        return Availability.conflicts(vehicle: vehicle, from: input.checkIn, to: input.checkOut, bookings: store.bookings, excluding: editingBooking?.id)
    }
    private var breakdown: RateBreakdown? {
        guard !input.vehicleID.isEmpty else { return nil }
        return store.price(input.vehicleID, from: input.checkIn, to: input.checkOut)
    }
    private var title: String {
        switch mode {
        case .create: return "Νέα κράτηση"
        case .edit: return "Επεξεργασία"
        case .accept: return "Αποδοχή αιτήματος"
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                if let r = sourceRequest {
                    Section {
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Από αίτημα του site").font(.subheadline.weight(.semibold))
                                Text("Με την αποθήκευση το αίτημα του/της \(r.customerName) σημειώνεται ως αποδεκτό.")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        } icon: { Image(systemName: "globe").foregroundStyle(Color.sun) }
                    }
                }
                vehicleSection
                datesSection
                customerSection
                priceSection
                detailsSection
                if let error {
                    Section { Label(error, systemImage: "exclamationmark.triangle.fill").foregroundStyle(Color.danger).font(.subheadline) }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .scrollDismissesKeyboard(.interactively)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Άκυρο") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if saving { ProgressView() } else {
                        Button(sourceRequest != nil ? "Αποδοχή" : "Αποθήκευση") { attemptSave() }.fontWeight(.semibold)
                    }
                }
            }
            .alert("Δεν υπάρχει ελεύθερη μονάδα", isPresented: $confirmConflict) {
                Button("Αποθήκευση παρ' όλα αυτά", role: .destructive) { save() }
                Button("Άκυρο", role: .cancel) {}
            } message: {
                Text("Για αυτές τις ημερομηνίες όλες οι μονάδες του \(vehicle?.name ?? "μοντέλου") είναι δεσμευμένες (\(conflicts.count) κρατήσεις).")
            }
            .onAppear(perform: setup)
            .onChange(of: input.vehicleID) { _, _ in autoPrice(); validatePlate() }
            .onChange(of: input.checkIn) { _, new in
                if input.checkOut <= new { input.checkOut = Day.add(1, to: new) }
                autoPrice(); validatePlate()
            }
            .onChange(of: input.checkOut) { _, _ in autoPrice(); validatePlate() }
            .onChange(of: manualPrice) { _, manual in if !manual { autoPrice() } }
        }
        .interactiveDismissDisabled(saving)
    }

    // MARK: Sections

    private var vehicleSection: some View {
        Section {
            NavigationLink {
                VehiclePickerView(selection: $input.vehicleID, from: input.checkIn, to: input.checkOut, excluding: editingBooking?.id)
            } label: {
                if let vehicle {
                    HStack(spacing: 12) {
                        VehicleImage(url: vehicle.imageURL, type: vehicle.type, cornerRadius: 8).frame(width: 56, height: 40)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(vehicle.name).font(.body.weight(.medium))
                            Text("\(Labels.vehicleType(vehicle.type)) · \(vehicle.cc) cc").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                } else {
                    Label("Επιλογή μοντέλου", systemImage: "car.side").foregroundStyle(Color.accentColor)
                }
            }
            if let vehicle {
                availabilityRow(vehicle)
                Picker("Πινακίδα", selection: Binding(get: { input.plate ?? "" }, set: { input.plate = $0.nilIfBlank })) {
                    Text("Χωρίς ανάθεση").tag("")
                    let taken = Availability.takenPlates(vehicle: vehicle, from: input.checkIn, to: input.checkOut, bookings: store.bookings, excluding: editingBooking?.id)
                    ForEach(vehicle.unitPlates, id: \.self) { p in
                        Text(taken.contains(p) ? "\(p) · κατειλημμένη" : p).tag(p)
                    }
                }
            }
        } header: { Text("Όχημα") }
    }

    @ViewBuilder private func availabilityRow(_ v: Vehicle) -> some View {
        if let free = freeUnits {
            HStack(spacing: 10) {
                Image(systemName: free > 0 ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                    .foregroundStyle(free > 0 ? Color.success : Color.danger)
                VStack(alignment: .leading, spacing: 2) {
                    Text(free > 0 ? "Διαθέσιμο: \(free) από \(v.units)" : "Καμία ελεύθερη μονάδα")
                        .font(.subheadline.weight(.semibold))
                    if !conflicts.isEmpty {
                        Text((free > 0 ? "Ήδη κρατημένα από: " : "Σύγκρουση με: ") + conflicts.prefix(3).map(\.customerName).joined(separator: ", ") + (conflicts.count > 3 ? "…" : ""))
                            .font(.caption).foregroundStyle(.secondary).lineLimit(2)
                    }
                }
            }
        }
    }

    private var datesSection: some View {
        Section {
            DatePicker("Παραλαβή", selection: dateBinding(\.checkIn), displayedComponents: .date)
            DatePicker("Επιστροφή", selection: dateBinding(\.checkOut), in: Day.add(1, to: Day.date(input.checkIn))..., displayedComponents: .date)
            HStack {
                Text("Διάρκεια").foregroundStyle(.secondary)
                Spacer()
                Text(nights == 1 ? "1 ημέρα" : "\(nights) ημέρες").fontWeight(.medium)
            }
        } header: { Text("Ημερομηνίες") }
    }

    private var customerSection: some View {
        Section {
            NavigationLink {
                ClientPickerView { c in
                    input.clientID = c.id
                    input.customerName = c.name
                    input.customerPhone = c.phone
                    input.customerEmail = c.email
                }
            } label: {
                Label(input.clientID == nil ? "Επιλογή υπάρχοντος πελάτη" : "Αλλαγή πελάτη", systemImage: "person.crop.circle.badge.checkmark")
                    .foregroundStyle(Color.accentColor)
            }
            TextField("Ονοματεπώνυμο", text: $input.customerName)
                .textContentType(.name)
                .onChange(of: input.customerName) { _, _ in if let c = store.client(input.clientID), c.name != input.customerName { input.clientID = nil } }
            TextField("Τηλέφωνο", text: optional(\.customerPhone))
                .textContentType(.telephoneNumber).keyboardType(.phonePad)
            TextField("Email", text: optional(\.customerEmail))
                .textContentType(.emailAddress).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
        } header: { Text("Πελάτης") } footer: {
            if input.clientID == nil && !input.customerName.isEmpty {
                Text("Αν δεν υπάρχει πελάτης με το ίδιο όνομα και τηλέφωνο, θα δημιουργηθεί νέος.")
            }
        }
    }

    private var priceSection: some View {
        Section {
            if let breakdown {
                if breakdown.available {
                    ForEach(breakdown.segments, id: \.self) { s in
                        HStack {
                            VStack(alignment: .leading, spacing: 1) {
                                Text(s.label).font(.subheadline)
                                Text("\(s.days) × \(Money.precise(s.rate))").font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(Money.precise(s.subtotal)).monospacedDigit()
                        }
                    }
                    HStack {
                        Text("Αυτόματη τιμή").fontWeight(.semibold)
                        Spacer()
                        Text(Money.precise(breakdown.baseTotal)).fontWeight(.semibold).monospacedDigit()
                    }
                } else {
                    Label("Δεν υπάρχει τιμή για όλες τις ημέρες. Ορίστε τιμή χειροκίνητα.", systemImage: "info.circle")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            Toggle("Χειροκίνητη τιμή", isOn: $manualPrice)
            HStack {
                Text("Σύνολο")
                Spacer()
                TextField("0", value: $input.totalPrice, format: .number.precision(.fractionLength(0...2)))
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .disabled(!manualPrice)
                    .foregroundStyle(manualPrice ? .primary : .secondary)
                    .frame(maxWidth: 120)
                Text("€").foregroundStyle(.secondary)
            }
            HStack {
                Text("Προκαταβολή")
                Spacer()
                TextField("0", value: $input.depositAmount, format: .number.precision(.fractionLength(0...2)))
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 120)
                Text("€").foregroundStyle(.secondary)
            }
            Picker("Τρόπος πληρωμής", selection: $input.paymentMethod) {
                ForEach(Labels.paymentMethods, id: \.key) { Text($0.label).tag($0.key) }
            }
        } header: { Text("Τιμή & πληρωμή") } footer: {
            if input.depositAmount > input.totalPrice {
                Text("Η προκαταβολή δεν μπορεί να υπερβαίνει το συνολικό ποσό").foregroundStyle(Color.danger)
            } else {
                Text("Υπόλοιπο προς είσπραξη: \(Money.precise(max(input.totalPrice - input.depositAmount, 0)))")
            }
        }
    }

    private var detailsSection: some View {
        Section {
            Picker("Κατάσταση", selection: $input.status) {
                ForEach(BookingStatus.allCases) { Text(Labels.booking($0)).tag($0) }
            }
            .pickerStyle(.segmented)
            .listRowInsets(EdgeInsets(top: 10, leading: 16, bottom: 10, trailing: 16))
            HStack {
                TextField("Τοποθεσία παράδοσης", text: optional(\.deliveryLocation))
                Menu {
                    ForEach(Labels.locations, id: \.self) { loc in Button(loc) { input.deliveryLocation = loc } }
                } label: { Image(systemName: "mappin.circle").font(.title3) }
                .accessibilityLabel("Προτεινόμενες τοποθεσίες")
            }
            Picker("Πηγή", selection: $input.bookingSource) {
                ForEach(Labels.sources, id: \.key) { Text($0.label).tag($0.key) }
            }
            TextField("Σημειώσεις", text: optional(\.comments), axis: .vertical)
                .lineLimit(3...8)
        } header: { Text("Λεπτομέρειες") }
    }

    // MARK: Logic

    private func setup() {
        guard !initialized else { return }
        initialized = true
        switch mode {
        case .create(let prefill):
            input = prefill ?? BookingInput()
            if input.vehicleID.isEmpty, let first = store.activeVehicles.first { input.vehicleID = first.id }
            manualPrice = false
            autoPrice()
        case .edit(let b):
            input = BookingInput(booking: b)
            manualPrice = true
        case .accept(let r, let vid):
            input = BookingInput(request: r, vehicleID: vid ?? store.matchedVehicle(for: r)?.id ?? "")
            manualPrice = r.estimatedTotal != nil
            if !manualPrice { autoPrice() }
        }
    }

    private func autoPrice() {
        guard !manualPrice, let b = breakdown, b.available, b.baseTotal > 0 else { return }
        input.totalPrice = b.baseTotal
    }

    private func validatePlate() {
        guard let v = vehicle else { input.plate = nil; return }
        if let p = input.plate, !v.unitPlates.contains(p) { input.plate = nil }
    }

    private func attemptSave() {
        error = nil
        guard !input.customerName.trimmed.isEmpty else { error = "Συμπληρώστε το όνομα του πελάτη"; return }
        guard vehicle != nil else { error = "Επιλέξτε όχημα"; return }
        guard nights > 0 else { error = "Η επιστροφή πρέπει να είναι μετά την παραλαβή"; return }
        guard input.depositAmount <= input.totalPrice else { error = "Η προκαταβολή δεν μπορεί να υπερβαίνει το συνολικό ποσό"; return }
        if input.status != .cancelled, freeUnits == 0 { confirmConflict = true; return }
        save()
    }

    private func save() {
        saving = true
        Task {
            do {
                try await store.saveBooking(input, editing: editingBooking, fromRequest: sourceRequest)
                Haptics.notify(.success)
                store.show(sourceRequest != nil ? "Η κράτηση δημιουργήθηκε από το αίτημα!" : editingBooking != nil ? "Η κράτηση ενημερώθηκε!" : "Η κράτηση δημιουργήθηκε!")
                dismiss()
            } catch {
                Haptics.notify(.error)
                self.error = editingBooking != nil ? "Σφάλμα κατά την ενημέρωση" : "Σφάλμα κατά τη δημιουργία"
            }
            saving = false
        }
    }

    private func dateBinding(_ key: WritableKeyPath<BookingInput, String>) -> Binding<Date> {
        Binding(get: { Day.date(input[keyPath: key]) }, set: { input[keyPath: key] = Day.string(from: $0) })
    }

    private func optional(_ key: WritableKeyPath<BookingInput, String?>) -> Binding<String> {
        Binding(get: { input[keyPath: key] ?? "" }, set: { input[keyPath: key] = $0 })
    }
}

/// Model list with live free-unit counts for the chosen dates.
struct VehiclePickerView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @Binding var selection: String
    let from: String
    let to: String
    var excluding: String?
    @State private var type: VehicleType?

    var body: some View {
        List {
            Section {
                Picker("Τύπος", selection: $type) {
                    Text("Όλα").tag(VehicleType?.none)
                    Text("Αυτοκίνητα").tag(VehicleType?.some(.car))
                    Text("Scooter").tag(VehicleType?.some(.scooter))
                }
                .pickerStyle(.segmented)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
            }
            Section {
                ForEach(store.activeVehicles.filter { type == nil || $0.type == type }) { v in
                    let free = store.freeUnits(v, from: from, to: to, excluding: excluding)
                    Button {
                        Haptics.select()
                        selection = v.id
                        dismiss()
                    } label: {
                        HStack(spacing: 12) {
                            VehicleImage(url: v.imageURL, type: v.type, cornerRadius: 8).frame(width: 64, height: 44)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(v.name).font(.body.weight(.medium)).foregroundStyle(.primary)
                                HStack(spacing: 6) {
                                    Text("\(free)/\(v.units) ελεύθερα")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(free > 0 ? Color.success : Color.danger)
                                    if let p = store.price(v.id, from: from, to: to), p.available {
                                        Text("· \(Money.format(p.baseTotal))").font(.caption).foregroundStyle(.secondary)
                                    }
                                }
                            }
                            Spacer()
                            if selection == v.id { Image(systemName: "checkmark").foregroundStyle(Color.accentColor).fontWeight(.semibold) }
                        }
                    }
                    .opacity(free > 0 ? 1 : 0.6)
                }
            } footer: {
                Text("Διαθεσιμότητα για \(Day.shortRange(from, to)).")
            }
        }
        .navigationTitle("Μοντέλο")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { type = store.vehicle(selection)?.type }
    }
}

struct ClientPickerView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    let onPick: (Client) -> Void
    @State private var query = ""

    var body: some View {
        List {
            ForEach(store.clients.filter { query.isEmpty || $0.name.localizedCaseInsensitiveContains(query) || ($0.phone ?? "").contains(query) }) { c in
                Button {
                    onPick(c)
                    dismiss()
                } label: {
                    HStack(spacing: 12) {
                        Avatar(name: c.name, size: 34)
                        VStack(alignment: .leading) {
                            Text(c.name).foregroundStyle(.primary)
                            if let p = c.phone { Text(p).font(.caption).foregroundStyle(.secondary) }
                        }
                    }
                }
            }
        }
        .searchable(text: $query, prompt: "Αναζήτηση πελάτη")
        .navigationTitle("Πελάτες")
        .navigationBarTitleDisplayMode(.inline)
    }
}
