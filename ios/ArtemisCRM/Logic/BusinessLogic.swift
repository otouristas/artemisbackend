import Foundation

// Ports of src/lib/status.ts, src/lib/whatsapp.ts, src/lib/ratePricing.ts and
// src/components/requests/requestUtils.ts.

let greek = Locale(identifier: "el_GR")

// MARK: - Dates

/// DATE columns as "yyyy-MM-dd" in the device calendar (the business runs on Greek time).
enum Day {
    static let calendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.locale = greek
        c.timeZone = .current
        return c
    }()

    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func string(from date: Date) -> String { formatter.string(from: date) }
    static func date(_ s: String) -> Date { formatter.date(from: String(s.prefix(10))) ?? Date() }
    static var today: String { string(from: Date()) }
    static func add(_ days: Int, to date: Date) -> Date { calendar.date(byAdding: .day, value: days, to: date) ?? date }
    static func add(_ days: Int, to s: String) -> String { string(from: add(days, to: date(s))) }

    /// Nights like differenceInCalendarDays(check_out, check_in).
    static func nights(from a: String, to b: String) -> Int {
        let d = calendar.dateComponents([.day], from: calendar.startOfDay(for: date(a)), to: calendar.startOfDay(for: date(b))).day ?? 0
        return max(0, d)
    }

    /// Inclusive list of days.
    static func range(_ from: String, _ to: String) -> [String] {
        guard from <= to else { return [] }
        var out: [String] = []
        var d = from
        while d <= to && out.count < 800 { out.append(d); d = add(1, to: d) }
        return out
    }

    private static var templateCache: [String: DateFormatter] = [:]
    private static let cacheLock = NSLock()

    static func format(_ s: String, _ pattern: String) -> String {
        cacheLock.lock(); defer { cacheLock.unlock() }
        let f: DateFormatter
        if let cached = templateCache[pattern] { f = cached } else {
            f = DateFormatter()
            f.locale = greek
            f.setLocalizedDateFormatFromTemplate(pattern)
            templateCache[pattern] = f
        }
        return f.string(from: date(s))
    }

    /// "Τρ 3 Νοε"
    static func short(_ s: String) -> String { format(s, "EEE d MMM") }
    /// "3 Νοε"
    static func dayMonth(_ s: String) -> String { format(s, "d MMM") }
    /// "Τρίτη 3 Νοεμβρίου"
    static func long(_ s: String) -> String {
        let f = DateFormatter(); f.locale = greek; f.dateFormat = "EEEE d MMMM"
        return f.string(from: date(s)).capitalizedFirst
    }

    static func relativeLabel(_ s: String) -> String {
        let t = today
        if s == t { return "Σήμερα" }
        if s == add(1, to: t) { return "Αύριο" }
        if s == add(-1, to: t) { return "Χθες" }
        return long(s)
    }

    /// "4 – 9 Ιουλ" / "28 Ιουν – 3 Ιουλ" (shortRange in requestUtils.ts)
    static func shortRange(_ a: String, _ b: String) -> String {
        let da = date(a), db = date(b)
        if calendar.component(.month, from: da) == calendar.component(.month, from: db) {
            return "\(calendar.component(.day, from: da)) – \(dayMonth(b))"
        }
        return "\(dayMonth(a)) – \(dayMonth(b))"
    }
}

enum ISO {
    private static let withFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f
    }()
    private static let plain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime]; return f
    }()
    static func parse(_ s: String) -> Date? {
        // Postgres sends "2026-11-03 10:12:44.123+00" or "2026-11-03T10:12:44.123456+00:00".
        var t = s.replacingOccurrences(of: " ", with: "T")
        if let r = t.range(of: #"\.\d{4,}"#, options: .regularExpression) {
            t.replaceSubrange(r, with: String(t[r].prefix(4)))
        }
        if t.hasSuffix("+00") { t += ":00" }
        return withFraction.date(from: t) ?? plain.date(from: t)
    }
    static func string(_ d: Date) -> String { withFraction.string(from: d) }

    static func relative(_ s: String) -> String {
        guard let d = parse(s) else { return "" }
        let f = RelativeDateTimeFormatter()
        f.locale = greek
        f.unitsStyle = .full
        return f.localizedString(for: d, relativeTo: Date())
    }
}

extension String {
    var capitalizedFirst: String { prefix(1).uppercased() + dropFirst() }
}

// MARK: - Money

enum Money {
    private static let euro: NumberFormatter = {
        let f = NumberFormatter()
        f.locale = greek
        f.numberStyle = .currency
        f.currencyCode = "EUR"
        f.maximumFractionDigits = 0
        return f
    }()
    private static let euroCents: NumberFormatter = {
        let f = NumberFormatter()
        f.locale = greek
        f.numberStyle = .currency
        f.currencyCode = "EUR"
        f.maximumFractionDigits = 2
        f.minimumFractionDigits = 0
        return f
    }()
    static func format(_ v: Double) -> String { euro.string(from: NSNumber(value: v.rounded())) ?? "\(Int(v)) €" }
    static func precise(_ v: Double) -> String { euroCents.string(from: NSNumber(value: v)) ?? "\(v) €" }
    static func compact(_ v: Double) -> String {
        if abs(v) >= 1000 {
            let k = v / 1000
            let s = k >= 10 ? String(format: "%.0f", k) : String(format: "%.1f", k).replacingOccurrences(of: ".", with: ",")
            return "\(s)k €"
        }
        return "\(Int(v.rounded())) €"
    }
}

// MARK: - Labels (src/lib/status.ts)

enum Labels {
    static func booking(_ s: BookingStatus) -> String {
        switch s {
        case .pending: return "Εκκρεμεί"
        case .confirmed: return "Επιβεβαιωμένη"
        case .cancelled: return "Ακυρωμένη"
        }
    }
    static func request(_ s: RequestStatus) -> String {
        switch s {
        case .new: return "Νέο"
        case .reviewed: return "Ελεγμένο"
        case .accepted: return "Αποδεκτό"
        case .rejected: return "Απορρίφθηκε"
        }
    }
    static let sources: [(key: String, label: String)] = [
        ("phone", "Τηλέφωνο"), ("walkin", "Walk-in"), ("online", "Online"), ("email", "Email"),
        ("website", "Ιστότοπος"), ("touristas", "Touristas"), ("manual", "Χειροκίνητο"), ("api", "API"),
    ]
    static func source(_ key: String?) -> String {
        guard let key else { return "—" }
        return sources.first { $0.key == key }?.label ?? key
    }
    static let paymentMethods: [(key: String, label: String)] = [
        ("cash", "Μετρητά"), ("bank", "Τραπεζική κατάθεση"), ("iris", "IRIS"), ("card", "Κάρτα"),
    ]
    static func payment(_ key: String?) -> String {
        let k = key ?? "cash"
        return paymentMethods.first { $0.key == k }?.label ?? k
    }
    static func vehicleType(_ t: VehicleType) -> String { t == .car ? "Αυτοκίνητο" : "Scooter" }

    /// Common Sifnos handover points, offered as suggestions in forms.
    static let locations = ["Λιμάνι Καμάρες", "Γραφείο Απολλωνίας", "Πλατύς Γιαλός", "Φάρος", "Βαθύ", "Χερρόνησος", "Κάστρο", "Αρτεμώνας", "Ξενοδοχείο πελάτη"]

    static func initials(_ name: String) -> String {
        let s = name.split(whereSeparator: { $0.isWhitespace }).prefix(2).compactMap { $0.first.map { String($0).uppercased() } }.joined()
        return s.isEmpty ? "?" : s
    }
}

// MARK: - Pricing (src/lib/ratePricing.ts)

struct RateSegment: Hashable {
    var label: String
    var days: Int
    var rate: Double
    var subtotal: Double
}

struct RateBreakdown {
    var totalDays: Int
    var segments: [RateSegment]
    var baseTotal: Double
    /// False when at least one night has no rate period.
    var available: Bool
}

enum Pricing {
    static func rate(for day: String, in rates: [VehicleRate]) -> VehicleRate? {
        rates.first { $0.startDate <= day && day <= $0.endDate }
    }

    /// Charged per night: check-in 10 Jun, check-out 14 Jun is 4 days.
    static func calculate(rates: [VehicleRate], checkIn: String, checkOut: String) -> RateBreakdown? {
        let totalDays = Day.nights(from: checkIn, to: checkOut)
        guard totalDays > 0 else { return nil }
        var segments: [RateSegment] = []
        var currentID: String?
        var day = checkIn
        for _ in 0..<totalDays {
            guard let period = rate(for: day, in: rates) else {
                return RateBreakdown(totalDays: totalDays, segments: [], baseTotal: 0, available: false)
            }
            if currentID == period.id, var last = segments.popLast() {
                last.days += 1; last.subtotal += period.dailyRate
                segments.append(last)
            } else {
                segments.append(RateSegment(label: period.label?.nilIfBlank ?? "Περίοδος", days: 1, rate: period.dailyRate, subtotal: period.dailyRate))
                currentID = period.id
            }
            day = Day.add(1, to: day)
        }
        return RateBreakdown(totalDays: totalDays, segments: segments, baseTotal: segments.reduce(0) { $0 + $1.subtotal }, available: true)
    }
}

// MARK: - Availability

/// A booking (pending/confirmed) holds one unit from check-in through the return day inclusive and
/// each maintenance block holds one unit — the same rule as public.site_vehicle_availability().
enum Availability {
    static func overlaps(_ b: Booking, _ from: String, _ to: String) -> Bool {
        b.checkIn <= to && b.checkOut >= from
    }

    static func conflicts(vehicle: Vehicle, from: String, to: String, bookings: [Booking], excluding: String? = nil) -> [Booking] {
        bookings.filter { $0.vehicleID == vehicle.id && $0.isActive && $0.id != excluding && overlaps($0, from, to) }
            .sorted { $0.checkIn < $1.checkIn }
    }

    static func freeUnits(vehicle: Vehicle, on day: String, bookings: [Booking], blocks: [VehicleBlock], excluding: String? = nil) -> Int {
        let used = bookings.filter { $0.vehicleID == vehicle.id && $0.isActive && $0.id != excluding && $0.checkIn <= day && day <= $0.checkOut }.count
        let blocked = blocks.filter { $0.vehicleID == vehicle.id && $0.startDate <= day && day <= $0.endDate }.count
        return max(0, vehicle.units - used - blocked)
    }

    /// Units free on every day of the range (the minimum over the days).
    static func freeUnits(vehicle: Vehicle, from: String, to: String, bookings: [Booking], blocks: [VehicleBlock], excluding: String? = nil) -> Int {
        let days = Day.range(from, max(from, to))
        guard !days.isEmpty else { return vehicle.units }
        let relevant = bookings.filter { $0.vehicleID == vehicle.id && $0.isActive && $0.id != excluding && overlaps($0, from, to) }
        let relevantBlocks = blocks.filter { $0.vehicleID == vehicle.id && $0.startDate <= to && $0.endDate >= from }
        return days.map { freeUnits(vehicle: vehicle, on: $0, bookings: relevant, blocks: relevantBlocks) }.min() ?? vehicle.units
    }

    /// Plates held by overlapping bookings.
    static func takenPlates(vehicle: Vehicle, from: String, to: String, bookings: [Booking], excluding: String? = nil) -> Set<String> {
        Set(conflicts(vehicle: vehicle, from: from, to: to, bookings: bookings, excluding: excluding).compactMap { $0.plate })
    }

    /// matchVehicleId() from requestUtils.ts, plus slug matching for website requests.
    static func matchVehicle(_ requested: String?, in vehicles: [Vehicle]) -> Vehicle? {
        guard let raw = requested?.trimmed, !raw.isEmpty else { return nil }
        let q = raw.lowercased().replacingOccurrences(of: "-", with: " ").replacingOccurrences(of: "_", with: " ")
        if let v = vehicles.first(where: { $0.slug?.lowercased() == raw.lowercased() }) { return v }
        if let v = vehicles.first(where: { $0.name.lowercased() == q }) { return v }
        return vehicles.first { $0.name.lowercased().contains(q) || q.contains($0.name.lowercased()) }
    }
}

// MARK: - Contact links (src/lib/whatsapp.ts)

enum Contact {
    static func normalizePhone(_ raw: String) -> String {
        var phone = raw.filter(\.isNumber)
        if phone.hasPrefix("00") { phone.removeFirst(2) }
        if phone.hasPrefix("69") && phone.count == 10 { phone = "30" + phone }
        if !phone.hasPrefix("30") && phone.count == 10 { phone = "30" + phone }
        return phone
    }

    static func telURL(_ phone: String?) -> URL? {
        guard let p = phone?.nilIfBlank else { return nil }
        let cleaned = p.filter { $0.isNumber || $0 == "+" }
        return URL(string: "tel:\(cleaned)")
    }

    static func mailURL(_ email: String?) -> URL? {
        guard let e = email?.nilIfBlank else { return nil }
        return URL(string: "mailto:\(e)")
    }

    private static func waURL(phone: String, text: String) -> URL? {
        var c = URLComponents(string: "https://wa.me/\(phone)")
        c?.queryItems = [URLQueryItem(name: "text", value: text)]
        return c?.url
    }

    /// buildWhatsAppUrl(): booking confirmation message.
    static func whatsApp(booking b: Booking, vehicleName: String) -> URL? {
        guard let raw = b.customerPhone?.nilIfBlank else { return nil }
        let phone = normalizePhone(raw)
        var msg = "Γεια σας \(b.customerName)!\n\nΕπιβεβαίωση κράτησης - Artemis Rental Σίφνος:\n\nΌχημα: \(vehicleName)\nCheck-in: \(fixed(b.checkIn))\nCheck-out: \(fixed(b.checkOut))"
        if let loc = b.deliveryLocation?.nilIfBlank { msg += "\nΠαράδοση: \(loc)" }
        if b.total > 0 { msg += "\nΣύνολο: \(cleanNumber(b.total))€" }
        msg += "\n\nΤηλ: +30 22840 33333 / WhatsApp: +30 698 590 8478\nΣας ευχαριστούμε!"
        return waURL(phone: phone, text: msg)
    }

    /// requestWhatsAppUrl(): greeting about a website request, Greek or English by locale.
    static func whatsApp(request r: BookingRequest) -> URL? {
        guard let raw = r.customerPhone?.nilIfBlank else { return nil }
        let phone = normalizePhone(raw)
        guard !phone.isEmpty else { return nil }
        let isGreek = r.locale.map { $0.lowercased().hasPrefix("el") } ?? true
        let from = String(fixed(r.checkIn).prefix(5)), to = String(fixed(r.checkOut).prefix(5))
        let vehicle = r.requestedVehicle?.nilIfBlank.map { " (\($0))" } ?? ""
        let text = isGreek
            ? "Γεια σας \(r.customerName)! Σας ευχαριστούμε για το αίτημά σας στην Artemis Rental Σίφνος για \(from) – \(to)\(vehicle)."
            : "Hello \(r.customerName)! Thank you for your request with Artemis Rental Sifnos for \(from) – \(to)\(vehicle)."
        return waURL(phone: phone, text: text)
    }

    static func whatsApp(phone raw: String?, text: String = "") -> URL? {
        guard let raw = raw?.nilIfBlank else { return nil }
        return waURL(phone: normalizePhone(raw), text: text)
    }

    /// dd/MM/yyyy from yyyy-MM-dd
    static func fixed(_ s: String) -> String {
        let p = s.prefix(10).split(separator: "-")
        guard p.count == 3 else { return s }
        return "\(p[2])/\(p[1])/\(p[0])"
    }

    static func cleanNumber(_ v: Double) -> String {
        v == v.rounded() ? String(Int(v)) : String(format: "%.2f", v)
    }
}
