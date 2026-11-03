import SwiftUI
import PhotosUI
import UIKit

// Vehicle check-in / check-out checklists (src/components/VehicleChecklist.tsx).

extension ChecklistType {
    /// TYPE_META on the web: check_in is the handover to the customer, check_out the return.
    var label: String { self == .checkIn ? "Παράδοση" : "Παραλαβή" }
    var longLabel: String { self == .checkIn ? "Παράδοση (Check-in)" : "Παραλαβή (Check-out)" }
    var icon: String { self == .checkIn ? "arrow.up.forward.circle.fill" : "arrow.down.backward.circle.fill" }
    var tint: Color { self == .checkIn ? .navy : .success }
}

enum PhotoCompressor {
    /// Longest side 1600 px, JPEG 0.8: keeps uploads small on island mobile data.
    static func jpeg(_ image: UIImage, maxSide: CGFloat = 1600) -> Data? {
        let s = image.size
        let scale = min(1, maxSide / max(s.width, s.height, 1))
        let target = CGSize(width: (s.width * scale).rounded(), height: (s.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let resized = UIGraphicsImageRenderer(size: target, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: target)) }
        return resized.jpegData(compressionQuality: 0.8)
    }
}

/// A checklist photo: bucket URL (AsyncImage) or a local file (demo mode).
struct PhotoThumb: View {
    let url: String
    var body: some View {
        Color.secondary.opacity(0.12)
            .overlay {
                if let u = URL(string: url), u.isFileURL {
                    if let img = UIImage(contentsOfFile: u.path) { Image(uiImage: img).resizable().scaledToFill() }
                } else if let u = URL(string: url) {
                    AsyncImage(url: u) { phase in
                        if let image = phase.image { image.resizable().scaledToFill() }
                        else if phase.error != nil { Image(systemName: "photo").foregroundStyle(.secondary) }
                        else { ProgressView().controlSize(.small) }
                    }
                }
            }
            .clipped()
    }
}

struct FuelBar: View {
    let level: Int
    var width: CGFloat = 80
    private var tone: Color { level <= 25 ? .danger : level <= 50 ? .warning : .success }
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "fuelpump.fill").font(.caption).foregroundStyle(.secondary)
            ZStack(alignment: .leading) {
                Capsule().fill(Color.secondary.opacity(0.18))
                Capsule().fill(tone).frame(width: width * CGFloat(level) / 100)
            }
            .frame(width: width, height: 6)
            Text("\(level)%").font(.caption.weight(.semibold)).monospacedDigit()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Καύσιμο \(level)%")
    }
}

/// Card on the booking detail: the recorded checklists as a timeline plus the "new" button.
struct ChecklistSection: View {
    @EnvironmentObject private var store: AppStore
    let booking: Booking
    @State private var showForm = false
    @State private var viewer: PhotoViewerItem?
    @State private var loaded = false

    private var items: [VehicleChecklist] { store.checklists[booking.id] ?? [] }
    private var checkIn: VehicleChecklist? { items.first { $0.type == .checkIn } }
    private var checkOut: VehicleChecklist? { items.first { $0.type == .checkOut } }
    /// Default to the step that is still missing.
    private var nextType: ChecklistType { checkIn != nil && checkOut == nil ? .checkOut : .checkIn }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader("Κατάσταση οχήματος", count: items.isEmpty ? nil : items.count)
            VStack(alignment: .leading, spacing: 14) {
                if !loaded && items.isEmpty {
                    HStack { ProgressView(); Text("Φόρτωση…").font(.subheadline).foregroundStyle(.secondary) }
                } else if items.isEmpty {
                    HStack(spacing: 12) {
                        Image(systemName: "checklist").font(.title3).foregroundStyle(.secondary)
                        Text("Δεν έχει καταγραφεί κατάσταση οχήματος για αυτή την κράτηση.")
                            .font(.subheadline).foregroundStyle(.secondary)
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.secondary.opacity(0.35), style: StrokeStyle(lineWidth: 1, dash: [5, 4])))
                } else {
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(items.enumerated()), id: \.element.id) { i, c in
                            entry(c, last: i == items.count - 1)
                        }
                    }
                    summary
                }
                Button { showForm = true } label: {
                    Label("Νέο checklist παράδοσης/παραλαβής", systemImage: "camera.fill").font(.subheadline.weight(.semibold))
                }
                .buttonStyle(SecondaryButtonStyle())
            }
            .card()
        }
        .id("checklist")
        .task(id: booking.id) {
            await store.loadChecklists(for: booking.id)
            loaded = true
            #if DEBUG
            if AppConfig.demoRoute == "bookings/checklist/new" {
                try? await Task.sleep(nanoseconds: 1_600_000_000)
                showForm = true
            }
            #endif
        }
        .sheet(isPresented: $showForm) { ChecklistFormView(booking: booking, defaultType: nextType) }
        .fullScreenCover(item: $viewer) { PhotoViewer(item: $0) }
    }

    @ViewBuilder private var summary: some View {
        if let a = checkIn, let b = checkOut, b.km > a.km {
            HStack(spacing: 6) {
                Image(systemName: "key.fill").font(.caption)
                Text("Διανύθηκαν ") + Text("\(Self.km(b.km - a.km)) km").fontWeight(.semibold).foregroundColor(.primary)
                    + Text(b.fuel < a.fuel ? " · καύσιμο −\(a.fuel - b.fuel)%" : "")
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
    }

    private func entry(_ c: VehicleChecklist, last: Bool) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(spacing: 0) {
                Image(systemName: c.type.icon).font(.title3).foregroundStyle(c.type.tint).background(Circle().fill(Color.card))
                if !last { Rectangle().fill(Color.hairline).frame(width: 1.5).frame(maxHeight: .infinity) }
            }
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    StatusPill(text: c.type.label, color: c.type.tint)
                    Text(Self.stamp(c.createdAt)).font(.caption).foregroundStyle(.secondary)
                }
                HStack(spacing: 16) {
                    FuelBar(level: c.fuel)
                    HStack(spacing: 4) {
                        Image(systemName: "gauge.with.dots.needle.67percent").font(.caption).foregroundStyle(.secondary)
                        Text(Self.km(c.km)).font(.caption.weight(.semibold)).monospacedDigit()
                        Text("km").font(.caption).foregroundStyle(.secondary)
                    }
                }
                if let notes = c.damageNotes?.nilIfBlank {
                    Label { Text(notes).font(.subheadline) } icon: {
                        Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Color.warning).font(.caption)
                    }
                    .padding(.horizontal, 10).padding(.vertical, 8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.warning.opacity(0.12), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                if !c.photos.isEmpty {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 4), spacing: 6) {
                        ForEach(Array(c.photos.enumerated()), id: \.offset) { i, url in
                            Button { viewer = PhotoViewerItem(urls: c.photos, index: i) } label: {
                                PhotoThumb(url: url)
                                    .aspectRatio(1, contentMode: .fit)
                                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                                    .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Color.hairline))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Φωτό \(i + 1)")
                        }
                    }
                }
            }
            .padding(.bottom, last ? 0 : 16)
        }
    }

    static func km(_ n: Int) -> String {
        let f = NumberFormatter(); f.locale = greek; f.numberStyle = .decimal
        return f.string(from: NSNumber(value: n)) ?? "\(n)"
    }

    /// "3 Νοε, 10:25"
    static func stamp(_ iso: String) -> String {
        guard let d = ISO.parse(iso) else { return "" }
        let f = DateFormatter(); f.locale = greek; f.setLocalizedDateFormatFromTemplate("d MMM HH:mm")
        return f.string(from: d)
    }
}

struct PhotoViewerItem: Identifiable {
    let id = UUID()
    let urls: [String]
    let index: Int
}

struct PhotoViewer: View {
    @Environment(\.dismiss) private var dismiss
    let item: PhotoViewerItem
    @State private var page = 0

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()
            TabView(selection: $page) {
                ForEach(Array(item.urls.enumerated()), id: \.offset) { i, url in
                    fullImage(url).tag(i)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: item.urls.count > 1 ? .always : .never))
            Button { dismiss() } label: {
                Image(systemName: "xmark").font(.headline).foregroundStyle(.white)
                    .frame(width: 40, height: 40).background(.ultraThinMaterial, in: Circle())
            }
            .padding()
            .accessibilityLabel("Κλείσιμο")
        }
        .onAppear { page = item.index }
    }

    @ViewBuilder private func fullImage(_ url: String) -> some View {
        if let u = URL(string: url), u.isFileURL, let img = UIImage(contentsOfFile: u.path) {
            Image(uiImage: img).resizable().scaledToFit()
        } else if let u = URL(string: url) {
            AsyncImage(url: u) { phase in
                if let image = phase.image { image.resizable().scaledToFit() } else { ProgressView().tint(.white) }
            }
        }
    }
}

/// The "new checklist" form: type, fuel, mileage, damage notes, photos.
struct ChecklistFormView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    let booking: Booking

    @State private var type: ChecklistType
    @State private var fuel: Double = 100
    @State private var mileage = ""
    @State private var notes = ""
    @State private var photos: [UIImage] = []
    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var showCamera = false
    @State private var saving = false
    @State private var error: String?

    init(booking: Booking, defaultType: ChecklistType) {
        self.booking = booking
        _type = State(initialValue: defaultType)
        #if DEBUG
        if AppConfig.demoRoute == "bookings/checklist/new" {
            _photos = State(initialValue: [DemoData.sampleImage(1), DemoData.sampleImage(2)])
            _mileage = State(initialValue: "48655")
            _fuel = State(initialValue: 75)
            _notes = State(initialValue: "Καμία νέα ζημιά.")
        }
        #endif
    }

    private var fuelInt: Int { Int(fuel.rounded()) }
    private var fuelTone: Color { fuelInt <= 25 ? .danger : fuelInt <= 50 ? .warning : .success }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 10) {
                        ForEach(ChecklistType.allCases) { t in typeButton(t) }
                    }
                    .listRowInsets(EdgeInsets(top: 10, leading: 12, bottom: 10, trailing: 12))
                } header: { Text("Τύπος") } footer: {
                    Text("\(store.vehicleName(booking.vehicleID))\(booking.plate.map { " · \($0)" } ?? "") · \(booking.customerName)")
                }

                Section {
                    VStack(spacing: 10) {
                        HStack {
                            Label("Επίπεδο καυσίμων", systemImage: "fuelpump.fill")
                            Spacer()
                            Text("\(fuelInt)%").font(.title3.weight(.bold)).monospacedDigit().foregroundStyle(fuelTone)
                        }
                        Slider(value: $fuel, in: 0...100, step: 5)
                            .tint(fuelTone)
                            .accessibilityValue("\(fuelInt)%")
                        HStack {
                            ForEach(["Ε", "¼", "½", "¾", "Γ"], id: \.self) { t in
                                Text(t).font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                                if t != "Γ" { Spacer() }
                            }
                        }
                    }
                    .padding(.vertical, 4)
                    HStack {
                        Label("Χιλιόμετρα", systemImage: "gauge.with.dots.needle.67percent")
                        Spacer()
                        TextField("π.χ. 12500", text: $mileage)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                            .monospacedDigit()
                            .frame(maxWidth: 140)
                            .onChange(of: mileage) { _, v in
                                let digits = v.filter(\.isNumber)
                                if digits != v { mileage = digits }
                            }
                    }
                } header: { Text("Καύσιμο & χιλιόμετρα") }

                Section {
                    TextField("Περιγράψτε τυχόν ζημιές...", text: $notes, axis: .vertical)
                        .lineLimit(2...6)
                } header: { Label("Σημειώσεις ζημιών", systemImage: "exclamationmark.triangle") }

                Section {
                    photoGrid
                        .listRowInsets(EdgeInsets(top: 12, leading: 12, bottom: 12, trailing: 12))
                } header: { Text("Φωτογραφίες") } footer: {
                    if !photos.isEmpty { Text("\(photos.count) αρχείο(α) επιλεγμένα · ανεβαίνουν στο vehicle-photos με την αποθήκευση") }
                }

                if let error {
                    Section { Label(error, systemImage: "exclamationmark.triangle.fill").foregroundStyle(Color.danger).font(.subheadline) }
                }
            }
            .navigationTitle("Νέο checklist")
            .navigationBarTitleDisplayMode(.inline)
            .scrollDismissesKeyboard(.interactively)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Άκυρο") { dismiss() }.disabled(saving) }
                ToolbarItem(placement: .confirmationAction) {
                    if saving { ProgressView() } else { Button("Αποθήκευση", action: save).fontWeight(.semibold) }
                }
            }
            .onChange(of: pickerItems) { _, items in loadPicked(items) }
            .fullScreenCover(isPresented: $showCamera) {
                CameraPicker { img in photos.append(img) }.ignoresSafeArea()
            }
        }
        .interactiveDismissDisabled(saving)
    }

    private func typeButton(_ t: ChecklistType) -> some View {
        let active = type == t
        return Button {
            Haptics.select()
            withAnimation(.spring(response: 0.3)) { type = t }
        } label: {
            VStack(spacing: 6) {
                Image(systemName: t.icon).font(.title2)
                Text(t.longLabel).font(.footnote.weight(.semibold)).multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.85)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .foregroundStyle(active ? t.tint : .secondary)
            .background(active ? t.tint.opacity(0.1) : Color.clear, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(active ? t.tint : Color.hairline, lineWidth: active ? 2 : 1))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(active ? .isSelected : [])
    }

    private var photoGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 4), spacing: 8) {
            ForEach(Array(photos.enumerated()), id: \.offset) { i, img in
                Color.clear
                    .aspectRatio(1, contentMode: .fit)
                    .overlay { Image(uiImage: img).resizable().scaledToFill() }
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay(alignment: .topTrailing) {
                        Button {
                            withAnimation { _ = photos.remove(at: i) }
                        } label: {
                            Image(systemName: "xmark").font(.caption2.weight(.bold)).foregroundStyle(.primary)
                                .frame(width: 22, height: 22).background(.regularMaterial, in: Circle())
                        }
                        .buttonStyle(.plain)
                        .padding(4)
                        .accessibilityLabel("Αφαίρεση φωτογραφίας")
                    }
            }
            PhotosPicker(selection: $pickerItems, maxSelectionCount: 12, matching: .images) {
                addTile(icon: "photo.badge.plus", title: "Προσθήκη")
            }
            .buttonStyle(.plain)
            .frame(maxWidth: .infinity)
            if UIImagePickerController.isSourceTypeAvailable(.camera) {
                Button { showCamera = true } label: { addTile(icon: "camera", title: "Κάμερα") }
                    .buttonStyle(.plain)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private func addTile(icon: String, title: String) -> some View {
        Color.clear
            .aspectRatio(1, contentMode: .fit)
            .frame(maxWidth: .infinity)
            .overlay {
                VStack(spacing: 4) {
                    Image(systemName: icon).font(.title3)
                    Text(title).font(.caption2.weight(.medium)).lineLimit(1).minimumScaleFactor(0.8)
                }
                .foregroundStyle(.secondary)
            }
            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Color.secondary.opacity(0.4), style: StrokeStyle(lineWidth: 1.5, dash: [5, 4])))
            .contentShape(Rectangle())
    }

    private func loadPicked(_ items: [PhotosPickerItem]) {
        guard !items.isEmpty else { return }
        Task {
            for item in items {
                if let data = try? await item.loadTransferable(type: Data.self), let img = UIImage(data: data) { photos.append(img) }
            }
            pickerItems = []
        }
    }

    private func save() {
        error = nil
        saving = true
        Task {
            do {
                try await store.saveChecklist(bookingID: booking.id, type: type, fuel: fuelInt, mileage: Int(mileage) ?? 0, notes: notes, photos: photos)
                Haptics.notify(.success)
                store.show("Το checklist αποθηκεύτηκε!")
                dismiss()
            } catch {
                Haptics.notify(.error)
                self.error = "Σφάλμα κατά την αποθήκευση"
            }
            saving = false
        }
    }
}

/// UIImagePickerController camera, for photos at the handover.
struct CameraPicker: UIViewControllerRepresentable {
    let onPick: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let c = UIImagePickerController()
        c.sourceType = .camera
        c.delegate = context.coordinator
        return c
    }
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ p: CameraPicker) { parent = p }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let img = info[.originalImage] as? UIImage { parent.onPick(img) }
            parent.dismiss()
        }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { parent.dismiss() }
    }
}
