import Foundation

// Mirrors src/integrations/supabase/types.ts. DATE columns stay "yyyy-MM-dd" strings
// (no timezone surprises; they compare lexicographically). Timestamps stay ISO strings.

enum VehicleType: String, Codable, CaseIterable, Identifiable, Hashable {
    case car, scooter
    var id: String { rawValue }
}

enum BookingStatus: String, Codable, CaseIterable, Identifiable, Hashable {
    case pending, confirmed, cancelled
    var id: String { rawValue }
}

enum RequestStatus: String, Codable, CaseIterable, Identifiable, Hashable {
    case new, reviewed, accepted, rejected
    var id: String { rawValue }
}

struct Vehicle: Codable, Identifiable, Hashable {
    var id: String
    var name: String
    var type: VehicleType
    var cc: Int
    var quantity: Int
    var plate: String?
    var plates: [String]?
    var imageURL: String?
    var active: Bool
    var slug: String?
    var notes: String?
    var showOnSite: Bool?
    var dailyRateLow: Double?
    var dailyRateHigh: Double?

    enum CodingKeys: String, CodingKey {
        case id, name, type, cc, quantity, plate, plates, active, slug, notes
        case imageURL = "image_url"
        case showOnSite = "show_on_site"
        case dailyRateLow = "daily_rate_low"
        case dailyRateHigh = "daily_rate_high"
    }

    /// Unit plates, parsePlates() in fleetData.ts: the comma string `plate` the web CRM writes is the
    /// source of truth, the `plates` array the fallback.
    var unitPlates: [String] {
        let fromString = (plate ?? "").split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        if !fromString.isEmpty { return fromString }
        return (plates ?? []).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }

    var units: Int { max(quantity, 1) }
}

struct Booking: Codable, Identifiable, Hashable {
    var id: String
    var vehicleID: String
    var plate: String?
    var clientID: String?
    var customerName: String
    var customerPhone: String?
    var customerEmail: String?
    var checkIn: String
    var checkOut: String
    var status: BookingStatus
    var totalPrice: Double?
    var depositAmount: Double?
    var deliveryLocation: String?
    var paymentMethod: String?
    var paymentNotes: String?
    var bookingSource: String?
    var comments: String?
    var idDocument: String?
    var extraFeesJSON: String?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, plate, status, comments
        case vehicleID = "vehicle_id"
        case clientID = "client_id"
        case customerName = "customer_name"
        case customerPhone = "customer_phone"
        case customerEmail = "customer_email"
        case checkIn = "check_in"
        case checkOut = "check_out"
        case totalPrice = "total_price"
        case depositAmount = "deposit_amount"
        case deliveryLocation = "delivery_location"
        case paymentMethod = "payment_method"
        case paymentNotes = "payment_notes"
        case bookingSource = "booking_source"
        case idDocument = "id_document"
        case extraFeesJSON = "extra_fees_json"
        case createdAt = "created_at"
    }

    var total: Double { totalPrice ?? 0 }
    var paid: Double { depositAmount ?? 0 }
    /// Same as bookingBalance() on the web: never negative.
    var balance: Double { max(total - paid, 0) }
    var nights: Int { Day.nights(from: checkIn, to: checkOut) }
    var isActive: Bool { status != .cancelled }
    /// Lines of extra_fees_json (fees and the returning-customer discount).
    var extraFees: [ExtraFee] { ExtraFee.parse(extraFeesJSON) }
}

struct BookingRequest: Codable, Identifiable, Hashable {
    var id: String
    var customerName: String
    var customerEmail: String?
    var customerPhone: String?
    var requestedVehicle: String?
    var checkIn: String
    var checkOut: String
    var pickupLocation: String?
    var returnLocation: String?
    var partySize: Int?
    var childSeat: Bool
    var arrivalInfo: String?
    var message: String?
    var estimatedTotal: Double?
    var locale: String?
    var status: RequestStatus
    var bookingID: String?
    var adminNotes: String?
    var source: String?
    var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, message, locale, status, source
        case customerName = "customer_name"
        case customerEmail = "customer_email"
        case customerPhone = "customer_phone"
        case requestedVehicle = "requested_vehicle"
        case checkIn = "check_in"
        case checkOut = "check_out"
        case pickupLocation = "pickup_location"
        case returnLocation = "return_location"
        case partySize = "party_size"
        case childSeat = "child_seat"
        case arrivalInfo = "arrival_info"
        case estimatedTotal = "estimated_total"
        case bookingID = "booking_id"
        case adminNotes = "admin_notes"
        case createdAt = "created_at"
    }

    var nights: Int { Day.nights(from: checkIn, to: checkOut) }
    var createdDate: Date? { ISO.parse(createdAt) }
}

struct Client: Codable, Identifiable, Hashable {
    var id: String
    var name: String
    var phone: String?
    var email: String?
    var notes: String?
    var tags: [String]?
    var preferredLanguage: String?
    var preferredVehicleID: String?
    var idDocument: String?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, phone, email, notes, tags
        case preferredLanguage = "preferred_language"
        case preferredVehicleID = "preferred_vehicle_id"
        case idDocument = "id_document"
        case createdAt = "created_at"
    }
}

struct VehicleBlock: Codable, Identifiable, Hashable {
    var id: String
    var vehicleID: String
    var startDate: String
    var endDate: String
    var reason: String?

    enum CodingKeys: String, CodingKey {
        case id, reason
        case vehicleID = "vehicle_id"
        case startDate = "start_date"
        case endDate = "end_date"
    }
}

struct VehicleRate: Codable, Identifiable, Hashable {
    var id: String
    var vehicleID: String
    var label: String?
    var startDate: String
    var endDate: String
    var dailyRate: Double
    var minDays: Int?

    enum CodingKeys: String, CodingKey {
        case id, label
        case vehicleID = "vehicle_id"
        case startDate = "start_date"
        case endDate = "end_date"
        case dailyRate = "daily_rate"
        case minDays = "min_days"
    }
}

// MARK: - Write payloads (explicit nulls so edits can clear a field)

struct BookingInput: Encodable, Equatable {
    var vehicleID: String = ""
    var plate: String?
    var clientID: String?
    var customerName: String = ""
    var customerPhone: String?
    var customerEmail: String?
    var checkIn: String = Day.string(from: Date())
    var checkOut: String = Day.string(from: Day.add(1, to: Date()))
    var status: BookingStatus = .pending
    var totalPrice: Double = 0
    var depositAmount: Double = 0
    var deliveryLocation: String?
    var paymentMethod: String = "cash"
    var bookingSource: String = "phone"
    var comments: String?
    /// Extra fee lines (without the discount), as on BookingFormPage.
    var extraFees: [ExtraFee] = []
    var isReturningCustomer = false
    var discountAmount: Double = 0

    enum CodingKeys: String, CodingKey {
        case plate, status, comments
        case extraFeesJSON = "extra_fees_json"
        case vehicleID = "vehicle_id"
        case clientID = "client_id"
        case customerName = "customer_name"
        case customerPhone = "customer_phone"
        case customerEmail = "customer_email"
        case checkIn = "check_in"
        case checkOut = "check_out"
        case totalPrice = "total_price"
        case depositAmount = "deposit_amount"
        case deliveryLocation = "delivery_location"
        case paymentMethod = "payment_method"
        case bookingSource = "booking_source"
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(vehicleID, forKey: .vehicleID)
        try c.encode(plate.nilIfBlank, forKey: .plate)
        try c.encode(clientID, forKey: .clientID)
        try c.encode(customerName.trimmingCharacters(in: .whitespaces), forKey: .customerName)
        try c.encode(customerPhone.nilIfBlank, forKey: .customerPhone)
        try c.encode(customerEmail.nilIfBlank, forKey: .customerEmail)
        try c.encode(checkIn, forKey: .checkIn)
        try c.encode(checkOut, forKey: .checkOut)
        try c.encode(status, forKey: .status)
        try c.encode(totalPrice, forKey: .totalPrice)
        try c.encode(depositAmount, forKey: .depositAmount)
        try c.encode(deliveryLocation.nilIfBlank, forKey: .deliveryLocation)
        try c.encode(paymentMethod, forKey: .paymentMethod)
        try c.encode(bookingSource, forKey: .bookingSource)
        try c.encode(comments.nilIfBlank, forKey: .comments)
        try c.encode(extraFeesJSON, forKey: .extraFeesJSON)
    }

    /// −|discount| when the returning-customer switch is on (returningDiscount on the web).
    var returningDiscount: Double { isReturningCustomer ? -abs(discountAmount) : 0 }
    var feesTotal: Double { extraFees.reduce(0) { $0 + $1.amount } }

    /// buildSubmitData() › extra_fees_json: the fees plus a "returning-discount" line, or null.
    var extraFeesJSON: String? {
        var payload = extraFees
        let d = returningDiscount
        if d != 0 {
            payload.append(ExtraFee(id: ExtraFee.discountID, label: "Έκπτωση παλιού πελάτη (\(Contact.cleanNumber(abs(d)))€)", amount: d))
        }
        return ExtraFee.serialize(payload)
    }

    init() {}

    init(booking b: Booking) {
        vehicleID = b.vehicleID
        plate = b.plate
        clientID = b.clientID
        customerName = b.customerName
        customerPhone = b.customerPhone
        customerEmail = b.customerEmail
        checkIn = b.checkIn
        checkOut = b.checkOut
        status = b.status
        totalPrice = b.total
        depositAmount = b.paid
        deliveryLocation = b.deliveryLocation
        paymentMethod = b.paymentMethod ?? "cash"
        bookingSource = b.bookingSource ?? "phone"
        comments = b.comments
        let lines = b.extraFees
        if let discount = lines.first(where: { $0.id == ExtraFee.discountID }) {
            isReturningCustomer = true
            discountAmount = abs(discount.amount)
        }
        extraFees = lines.filter { $0.id != ExtraFee.discountID }
    }

    /// Same pre-fill as BookingFormPage when opened with ?requestId=.
    init(request r: BookingRequest, vehicleID: String) {
        self.vehicleID = vehicleID
        customerName = r.customerName
        customerPhone = r.customerPhone
        customerEmail = r.customerEmail
        checkIn = r.checkIn
        checkOut = r.checkOut
        status = .pending
        totalPrice = r.estimatedTotal ?? 0
        depositAmount = 0
        deliveryLocation = r.pickupLocation
        paymentMethod = "cash"
        bookingSource = "online"
        let parts: [String?] = [
            r.message?.trimmed.nilIfBlank,
            r.arrivalInfo?.trimmed.nilIfBlank.map { "Άφιξη: \($0)" },
            r.childSeat ? "Παιδικό κάθισμα" : nil,
            r.partySize.map { "Άτομα: \($0)" },
            r.requestedVehicle?.nilIfBlank.map { "Αίτημα οχήματος: \($0)" },
            r.adminNotes?.trimmed.nilIfBlank.map { "Σημειώσεις: \($0)" },
        ]
        comments = parts.compactMap { $0 }.joined(separator: "\n").nilIfBlank
    }

    func apply(to b: inout Booking) {
        b.vehicleID = vehicleID; b.plate = plate.nilIfBlank; b.clientID = clientID
        b.customerName = customerName; b.customerPhone = customerPhone.nilIfBlank; b.customerEmail = customerEmail.nilIfBlank
        b.checkIn = checkIn; b.checkOut = checkOut; b.status = status
        b.totalPrice = totalPrice; b.depositAmount = depositAmount
        b.deliveryLocation = deliveryLocation.nilIfBlank; b.paymentMethod = paymentMethod
        b.bookingSource = bookingSource; b.comments = comments.nilIfBlank
        b.extraFeesJSON = extraFeesJSON
    }
}

/// One line of bookings.extra_fees_json: `[{"id","label","amount"}]` (ExtraFee in booking-form/utils.ts).
struct ExtraFee: Codable, Identifiable, Hashable {
    static let discountID = "returning-discount"
    var id: String
    var label: String
    var amount: Double

    init(id: String = ExtraFee.newID(), label: String, amount: Double) {
        self.id = id; self.label = label; self.amount = amount
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(String.self, forKey: .id)) ?? ExtraFee.newID()
        label = (try? c.decode(String.self, forKey: .label)) ?? ""
        if let n = try? c.decode(Double.self, forKey: .amount) { amount = n }
        else { amount = Double((try? c.decode(String.self, forKey: .amount)) ?? "") ?? 0 }
    }

    /// Math.random().toString(36).substring(2, 9)
    static func newID() -> String {
        let chars = Array("abcdefghijklmnopqrstuvwxyz0123456789")
        return String((0..<7).map { _ in chars.randomElement()! })
    }

    static func parse(_ json: String?) -> [ExtraFee] {
        guard let data = json?.data(using: .utf8), !data.isEmpty else { return [] }
        return (try? JSONDecoder().decode([ExtraFee].self, from: data)) ?? []
    }

    static func serialize(_ fees: [ExtraFee]) -> String? {
        guard !fees.isEmpty else { return nil }
        let e = JSONEncoder()
        e.outputFormatting = [.withoutEscapingSlashes]
        return (try? e.encode(fees)).flatMap { String(data: $0, encoding: .utf8) }
    }
}

struct ClientInput: Encodable {
    var name: String
    var phone: String?
    var email: String?
}

/// save() in ClientProfilePage.tsx: every field is sent, blanks as null.
struct ClientUpdate: Encodable, Equatable {
    var name: String
    var phone: String?
    var email: String?
    var idDocument: String?
    var notes: String?
    var tags: [String] = []
    var preferredLanguage: String?
    var preferredVehicleID: String?

    init(_ c: Client) {
        name = c.name; phone = c.phone; email = c.email; idDocument = c.idDocument; notes = c.notes
        tags = c.tags ?? []; preferredLanguage = c.preferredLanguage; preferredVehicleID = c.preferredVehicleID
    }

    enum CodingKeys: String, CodingKey {
        case name, phone, email, notes, tags
        case idDocument = "id_document"
        case preferredLanguage = "preferred_language"
        case preferredVehicleID = "preferred_vehicle_id"
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(name.trimmed, forKey: .name)
        try c.encode(phone.nilIfBlank, forKey: .phone)
        try c.encode(email.nilIfBlank, forKey: .email)
        try c.encode(idDocument.nilIfBlank, forKey: .idDocument)
        try c.encode(notes.nilIfBlank, forKey: .notes)
        try c.encode(tags.map(\.trimmed).filter { !$0.isEmpty }, forKey: .tags)
        try c.encode(preferredLanguage.nilIfBlank, forKey: .preferredLanguage)
        try c.encode(preferredVehicleID.nilIfBlank, forKey: .preferredVehicleID)
    }
}

struct RateInput: Encodable, Equatable {
    var vehicleID: String
    var label: String?
    var startDate: String
    var endDate: String
    var dailyRate: Double
    var minDays: Int = 1

    enum CodingKeys: String, CodingKey {
        case label
        case vehicleID = "vehicle_id"
        case startDate = "start_date"
        case endDate = "end_date"
        case dailyRate = "daily_rate"
        case minDays = "min_days"
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(vehicleID, forKey: .vehicleID)
        try c.encode(label.nilIfBlank, forKey: .label)
        try c.encode(startDate, forKey: .startDate)
        try c.encode(endDate, forKey: .endDate)
        try c.encode(dailyRate, forKey: .dailyRate)
        try c.encode(minDays, forKey: .minDays)
    }
}

struct RequestStatusUpdate: Encodable {
    var status: RequestStatus
    var bookingID: String?
    var includeBookingID = false

    enum CodingKeys: String, CodingKey { case status; case bookingID = "booking_id" }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(status, forKey: .status)
        if includeBookingID { try c.encode(bookingID, forKey: .bookingID) }
    }
}

struct BookingStatusUpdate: Encodable {
    var status: BookingStatus
}

// MARK: - Vehicle checklists (useVehicleChecklists.ts)

enum ChecklistType: String, Codable, CaseIterable, Identifiable, Hashable {
    case checkIn = "check_in", checkOut = "check_out"
    var id: String { rawValue }
}

struct VehicleChecklist: Codable, Identifiable, Hashable {
    var id: String
    var bookingID: String
    var type: ChecklistType
    var fuelLevel: Int?
    var mileage: Int?
    var damageNotes: String?
    var photoURLs: [String]?
    var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, type, mileage
        case bookingID = "booking_id"
        case fuelLevel = "fuel_level"
        case damageNotes = "damage_notes"
        case photoURLs = "photo_urls"
        case createdAt = "created_at"
    }

    var fuel: Int { fuelLevel ?? 100 }
    var km: Int { mileage ?? 0 }
    var photos: [String] { photoURLs ?? [] }
}

struct ChecklistInput: Encodable {
    var bookingID: String
    var type: ChecklistType
    var fuelLevel: Int
    var mileage: Int
    var damageNotes: String?
    var photoURLs: [String]

    enum CodingKeys: String, CodingKey {
        case type, mileage
        case bookingID = "booking_id"
        case fuelLevel = "fuel_level"
        case damageNotes = "damage_notes"
        case photoURLs = "photo_urls"
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(bookingID, forKey: .bookingID)
        try c.encode(type, forKey: .type)
        try c.encode(fuelLevel, forKey: .fuelLevel)
        try c.encode(mileage, forKey: .mileage)
        try c.encode(damageNotes.nilIfBlank, forKey: .damageNotes)
        try c.encode(photoURLs, forKey: .photoURLs)
    }
}

// MARK: - Fleet writes (FleetFormPage, FleetModelDetail, VehicleRatesPage)

/// New model (submitNew() in FleetFormPage.tsx).
struct VehicleInput: Encodable {
    var name: String
    var type: VehicleType
    var cc: Int
    var dailyRateLow: Double
    var dailyRateHigh: Double
    var quantity: Int
    var plates: [String]
    var notes: String?
    var imageURL: String?

    enum CodingKeys: String, CodingKey {
        case name, type, cc, quantity, plate, plates, notes
        case dailyRateLow = "daily_rate_low"
        case dailyRateHigh = "daily_rate_high"
        case imageURL = "image_url"
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        let clean = plates.map(\.trimmed).filter { !$0.isEmpty }
        try c.encode(name.trimmed, forKey: .name)
        try c.encode(type, forKey: .type)
        try c.encode(cc, forKey: .cc)
        try c.encode(dailyRateLow, forKey: .dailyRateLow)
        try c.encode(dailyRateHigh, forKey: .dailyRateHigh)
        try c.encode(quantity, forKey: .quantity)
        try c.encode(VehicleUpdate.plateString(clean), forKey: .plate)
        try c.encode(clean.isEmpty ? nil : clean, forKey: .plates)
        try c.encode(notes.nilIfBlank, forKey: .notes)
        try c.encode(imageURL.nilIfBlank, forKey: .imageURL)
    }
}

/// Partial update of a vehicles row: only the fields that are set are sent. Plates are written as
/// the comma string the web reads (and mirrored to `plates`).
struct VehicleUpdate: Encodable {
    var quantity: Int?
    var plates: [String]?
    var notes: String??
    var active: Bool?
    var imageURL: String??
    var slug: String??
    var showOnSite: Bool?

    enum CodingKeys: String, CodingKey {
        case quantity, plate, plates, notes, active, slug
        case imageURL = "image_url"
        case showOnSite = "show_on_site"
    }

    static func plateString(_ plates: [String]) -> String? {
        let clean = plates.map(\.trimmed).filter { !$0.isEmpty }
        return clean.isEmpty ? nil : clean.joined(separator: ", ")
    }

    /// saveListing() in VehicleRatesPage.tsx.
    static func cleanSlug(_ raw: String) -> String {
        // .toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "")
        var out = ""
        var inRun = false
        for ch in raw.trimmed.lowercased() {
            if ("a"..."z").contains(ch) || ("0"..."9").contains(ch) || ch == "-" {
                out.append(ch); inRun = false
            } else if !inRun {
                out.append("-"); inRun = true
            }
        }
        return out.trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        if let quantity { try c.encode(quantity, forKey: .quantity) }
        if let plates {
            let clean = plates.map(\.trimmed).filter { !$0.isEmpty }
            try c.encode(Self.plateString(clean), forKey: .plate)
            try c.encode(clean.isEmpty ? nil : clean, forKey: .plates)
        }
        if let notes { try c.encode(notes.nilIfBlank, forKey: .notes) }
        if let active { try c.encode(active, forKey: .active) }
        if let imageURL { try c.encode(imageURL.nilIfBlank, forKey: .imageURL) }
        if let slug { try c.encode(slug.nilIfBlank, forKey: .slug) }
        if let showOnSite { try c.encode(showOnSite, forKey: .showOnSite) }
    }

    func apply(to v: inout Vehicle) {
        if let quantity { v.quantity = quantity }
        if let plates {
            let clean = plates.map(\.trimmed).filter { !$0.isEmpty }
            v.plate = Self.plateString(clean); v.plates = clean.isEmpty ? nil : clean
        }
        if let notes { v.notes = notes.nilIfBlank }
        if let active { v.active = active }
        if let imageURL { v.imageURL = imageURL.nilIfBlank }
        if let slug { v.slug = slug.nilIfBlank }
        if let showOnSite { v.showOnSite = showOnSite }
    }
}

/// Maintenance block (useCreateVehicleBlock).
struct BlockInput: Encodable {
    var vehicleID: String
    var startDate: String
    var endDate: String
    var reason: String?

    enum CodingKeys: String, CodingKey {
        case reason
        case vehicleID = "vehicle_id"
        case startDate = "start_date"
        case endDate = "end_date"
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(vehicleID, forKey: .vehicleID)
        try c.encode(startDate, forKey: .startDate)
        try c.encode(endDate, forKey: .endDate)
        try c.encode(reason.nilIfBlank, forKey: .reason)
    }
}

struct ClientIDUpdate: Encodable {
    let clientID: String
    enum CodingKeys: String, CodingKey { case clientID = "client_id" }
}

/// Everything the CRM reads, loaded together like the web's react-query cache.
struct Snapshot {
    var vehicles: [Vehicle] = []
    var bookings: [Booking] = []
    var requests: [BookingRequest] = []
    var clients: [Client] = []
    var rates: [VehicleRate] = []
    var blocks: [VehicleBlock] = []
}

// MARK: - Small helpers

extension Optional where Wrapped == String {
    var nilIfBlank: String? {
        guard let s = self?.trimmingCharacters(in: .whitespacesAndNewlines), !s.isEmpty else { return nil }
        return s
    }
}

extension String {
    var nilIfBlank: String? { Optional(self).nilIfBlank }
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
