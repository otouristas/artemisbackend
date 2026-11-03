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

    /// Unit plates: the plates array wins, else the comma string the web CRM writes.
    var unitPlates: [String] {
        if let plates, !plates.isEmpty { return plates.map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty } }
        return (plate ?? "").split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
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

    enum CodingKeys: String, CodingKey {
        case plate, status, comments
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
    }
}

struct ClientInput: Encodable {
    var name: String
    var phone: String?
    var email: String?
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
