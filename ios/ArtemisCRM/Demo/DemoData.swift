#if DEBUG
import Foundation
import UIKit

/// Realistic sample data relative to today: 16 models, ~30 bookings this week and next month,
/// a season of history for the charts, clients and website requests.
enum DemoData {
    private static let img = "https://rentacarsifnos.com/images/fleet/"

    private struct Model {
        let slug: String, name: String, type: VehicleType, cc: Int, qty: Int, image: String, base: Double, prefix: String
    }

    private static let models: [Model] = [
        .init(slug: "chevrolet-spark", name: "Chevrolet Spark", type: .car, cc: 1000, qty: 8, image: "chevrolet-spark.jpg", base: 40, prefix: "ΕΜΜ"),
        .init(slug: "hyundai-i10", name: "Hyundai i10", type: .car, cc: 1100, qty: 6, image: "hyundai-i10.jpg", base: 40, prefix: "ΕΜΗ"),
        .init(slug: "fiat-panda", name: "Fiat Panda", type: .car, cc: 1200, qty: 5, image: "fiat-panda.jpg", base: 45, prefix: "ΕΜΖ"),
        .init(slug: "nissan-micra", name: "Nissan Micra", type: .car, cc: 1200, qty: 4, image: "nissan-micra.jpg", base: 45, prefix: "ΕΜΚ"),
        .init(slug: "nissan-micra-auto", name: "Nissan Micra Automatic", type: .car, cc: 1200, qty: 2, image: "nissan-micra.jpg", base: 55, prefix: "ΕΜΚ"),
        .init(slug: "peugeot-208", name: "Peugeot 208", type: .car, cc: 1200, qty: 4, image: "peugeot-208.jpg", base: 50, prefix: "ΕΜΡ"),
        .init(slug: "peugeot-208-auto", name: "Peugeot 208 Automatic", type: .car, cc: 1200, qty: 2, image: "peugeot-208.jpg", base: 60, prefix: "ΕΜΡ"),
        .init(slug: "peugeot-301", name: "Peugeot 301", type: .car, cc: 1600, qty: 2, image: "peugeot-301.jpg", base: 55, prefix: "ΕΜΤ"),
        .init(slug: "citroen-c3", name: "Citroen C3", type: .car, cc: 1200, qty: 3, image: "citroen-c3.jpg", base: 50, prefix: "ΕΜΧ"),
        .init(slug: "skoda-fabia", name: "Skoda Fabia", type: .car, cc: 1000, qty: 2, image: "scoda-fabia.jpg", base: 50, prefix: "ΕΜΑ"),
        .init(slug: "suzuki-ignis", name: "Suzuki Ignis", type: .car, cc: 1200, qty: 3, image: "suzuki-ignis.jpg", base: 55, prefix: "ΕΜΙ"),
        .init(slug: "sym-symphony-125", name: "SYM Symphony 125", type: .scooter, cc: 125, qty: 7, image: "SYM-Symphony-125.jpg", base: 25, prefix: "ΜΗΛ"),
        .init(slug: "sym-symphony-150", name: "SYM Symphony 150", type: .scooter, cc: 150, qty: 4, image: "SYM-Symphony-150.jpg", base: 28, prefix: "ΜΗΛ"),
        .init(slug: "sym-symphony-200", name: "SYM Symphony 200", type: .scooter, cc: 200, qty: 3, image: "SYM-Symphony-200.jpg", base: 32, prefix: "ΜΗΛ"),
        .init(slug: "fiddle-125", name: "SYM Fiddle 125", type: .scooter, cc: 125, qty: 4, image: "fiddle-125.jpg", base: 25, prefix: "ΜΗΝ"),
        .init(slug: "jet4-125", name: "SYM Jet4 125", type: .scooter, cc: 125, qty: 3, image: "JET4-125.jpg", base: 25, prefix: "ΜΗΝ"),
    ]

    private static let people: [(String, String, String?, String)] = [
        ("Μαρία Παπαδοπούλου", "6944123456", "maria.pap@gmail.com", "el"),
        ("Giulia Rossi", "+39 347 812 3344", "giulia.rossi@libero.it", "it"),
        ("Thomas Laurent", "+33 6 12 34 56 78", "t.laurent@orange.fr", "fr"),
        ("Emma Wilson", "+44 7700 900123", "emma.w@outlook.com", "en"),
        ("Γιώργος Νικολάου", "6977001122", nil, "el"),
        ("Lukas Schneider", "+49 151 2345 6789", "lukas.schneider@web.de", "de"),
        ("Sofia Andersson", "+46 70 123 45 67", "sofia.andersson@gmail.com", "sv"),
        ("Ελένη Κωνσταντίνου", "6932456789", "eleni.k@yahoo.gr", "el"),
        ("Marco Bianchi", "+39 333 555 1212", "marco.bianchi@gmail.com", "it"),
        ("Claire Dubois", "+33 7 88 99 00 11", "claire.dubois@free.fr", "fr"),
        ("Νίκος Αντωνίου", "6987654321", "nikos.ant@gmail.com", "el"),
        ("Olivia Brown", "+44 7911 123456", "olivia.brown@gmail.com", "en"),
        ("Δημήτρης Βλάχος", "6945558899", nil, "el"),
        ("Anna Müller", "+49 160 9988 7766", "anna.mueller@gmx.de", "de"),
        ("James Taylor", "+1 415 555 0134", "jtaylor@icloud.com", "en"),
        ("Κατερίνα Σταύρου", "6974433221", "k.stavrou@hotmail.com", "el"),
    ]

    private static func id(_ prefix: String, _ n: Int) -> String {
        String(format: "%@-0000-4000-8000-%012ld", prefix, n)
    }

    static func make() -> Snapshot {
        var s = Snapshot()
        let today = Day.today

        // Vehicles + plates
        var plateCounter = 1180
        for (i, m) in models.enumerated() {
            var plates: [String] = []
            for _ in 0..<m.qty { plateCounter += 37; plates.append("\(m.prefix) \(plateCounter % 9000 + 1000)") }
            s.vehicles.append(Vehicle(id: id("0000000a", i + 1), name: m.name, type: m.type, cc: m.cc, quantity: m.qty,
                                      plate: plates.joined(separator: ", "), plates: plates, imageURL: img + m.image,
                                      active: true, slug: m.slug, notes: nil, showOnSite: true, dailyRateLow: m.base, dailyRateHigh: m.base * 1.6))
        }

        // Rates: published-style seasons for this year and next.
        let year = Day.calendar.component(.year, from: Date())
        var rateN = 0
        for (i, m) in models.enumerated() {
            let vid = s.vehicles[i].id
            for y in [year, year + 1] {
                let periods: [(String, String, String, Double)] = [
                    ("Χαμηλή περίοδος \(y)", "\(y)-01-01", "\(y)-05-10", 1.0),
                    ("Ενδιάμεση περίοδος \(y)", "\(y)-05-11", "\(y)-06-10", 1.15),
                    ("Μεσαία περίοδος \(y)", "\(y)-06-11", "\(y)-07-10", 1.3),
                    ("Υψηλή περίοδος \(y)", "\(y)-07-11", "\(y)-09-10", 1.6),
                    ("Ενδιάμεση περίοδος \(y)", "\(y)-09-11", "\(y)-09-30", 1.15),
                    ("Χαμηλή περίοδος \(y)", "\(y)-10-01", "\(y)-12-31", 1.0),
                ]
                for p in periods {
                    rateN += 1
                    s.rates.append(VehicleRate(id: id("0000000r", rateN), vehicleID: vid, label: p.0, startDate: p.1, endDate: p.2,
                                               dailyRate: (m.base * p.3 / 5).rounded() * 5, minDays: p.3 > 1.5 ? 3 : 1))
                }
            }
        }

        // Clients
        for (i, p) in people.enumerated() {
            s.clients.append(Client(id: id("0000000c", i + 1), name: p.0, phone: p.1, email: p.2, notes: i == 1 ? "Προτιμά παράδοση στο λιμάνι." : nil,
                                    tags: i % 4 == 0 ? ["VIP"] : (i % 5 == 0 ? ["Τακτικός"] : nil), preferredLanguage: p.3,
                                    createdAt: ISO.string(Day.add(-200 + i * 5, to: Date()))))
        }

        // Upcoming / current bookings: (model, client, checkIn offset, nights, status, deposit fraction, location)
        let plan: [(Int, Int, Int, Int, BookingStatus, Double, String)] = [
            (0, 0, 0, 4, .confirmed, 0.3, "Λιμάνι Καμάρες"),
            (11, 1, 0, 6, .confirmed, 1.0, "Γραφείο Απολλωνίας"),
            (5, 2, 0, 3, .pending, 0.0, "Πλατύς Γιαλός"),
            (2, 3, -4, 4, .confirmed, 0.5, "Λιμάνι Καμάρες"),
            (12, 4, -2, 2, .confirmed, 0.0, "Γραφείο Απολλωνίας"),
            (1, 5, -6, 6, .confirmed, 1.0, "Ξενοδοχείο Elies"),
            (0, 6, -2, 5, .confirmed, 0.4, "Λιμάνι Καμάρες"),
            (14, 7, -1, 4, .confirmed, 0.0, "Αρτεμώνας"),
            (3, 8, -3, 7, .confirmed, 0.5, "Λιμάνι Καμάρες"),
            (0, 9, 1, 5, .pending, 0.0, "Λιμάνι Καμάρες"),
            (6, 10, 1, 3, .confirmed, 0.3, "Βαθύ"),
            (11, 11, 2, 4, .confirmed, 0.0, "Λιμάνι Καμάρες"),
            (8, 12, 2, 7, .pending, 0.0, "Φάρος"),
            (0, 13, 3, 4, .confirmed, 0.25, "Λιμάνι Καμάρες"),
            (13, 14, 4, 3, .confirmed, 1.0, "Κάστρο"),
            (10, 15, 5, 5, .pending, 0.0, "Χερρόνησος"),
            (2, 0, 6, 4, .confirmed, 0.3, "Λιμάνι Καμάρες"),
            (11, 3, 6, 2, .confirmed, 0.0, "Γραφείο Απολλωνίας"),
            (4, 5, 9, 6, .confirmed, 0.5, "Λιμάνι Καμάρες"),
            (0, 7, 12, 4, .pending, 0.0, "Λιμάνι Καμάρες"),
            (9, 2, 14, 5, .confirmed, 0.3, "Πλατύς Γιαλός"),
            (12, 8, 17, 3, .confirmed, 0.0, "Λιμάνι Καμάρες"),
            (1, 9, 20, 7, .confirmed, 0.5, "Γραφείο Απολλωνίας"),
            (5, 11, 23, 4, .pending, 0.0, "Λιμάνι Καμάρες"),
            (15, 12, 26, 3, .confirmed, 0.0, "Αρτεμώνας"),
            (7, 13, 28, 6, .confirmed, 0.4, "Λιμάνι Καμάρες"),
            (0, 14, 31, 5, .confirmed, 0.0, "Λιμάνι Καμάρες"),
            (11, 15, 35, 4, .pending, 0.0, "Λιμάνι Καμάρες"),
            (3, 4, 2, 3, .cancelled, 0.0, "Λιμάνι Καμάρες"),
            (2, 6, -9, 5, .confirmed, 1.0, "Λιμάνι Καμάρες"),
            (10, 1, -12, 6, .confirmed, 0.8, "Βαθύ"),
        ]
        var bn = 0
        var plateUse: [String: Int] = [:]
        func addBooking(_ mi: Int, _ ci: Int, _ checkIn: String, _ nights: Int, _ status: BookingStatus, _ depositFrac: Double, _ loc: String, source: String, method: String) {
            bn += 1
            let v = s.vehicles[mi]
            let c = s.clients[ci]
            let checkOut = Day.add(nights, to: checkIn)
            let rates = s.rates.filter { $0.vehicleID == v.id }
            let total = Pricing.calculate(rates: rates, checkIn: checkIn, checkOut: checkOut)?.baseTotal ?? Double(nights) * models[mi].base
            let n = plateUse[v.id, default: 0]
            plateUse[v.id] = n + 1
            let plate = v.unitPlates[n % v.unitPlates.count]
            let deposit = (total * depositFrac / 10).rounded() * 10
            s.bookings.append(Booking(id: id("0000000b", bn), vehicleID: v.id, plate: plate, clientID: c.id, customerName: c.name,
                                      customerPhone: c.phone, customerEmail: c.email, checkIn: checkIn, checkOut: checkOut, status: status,
                                      totalPrice: total, depositAmount: min(deposit, total), deliveryLocation: loc, paymentMethod: method,
                                      bookingSource: source, comments: bn % 6 == 0 ? "Παιδικό κάθισμα · άφιξη με το πλοίο των 10:30" : nil,
                                      createdAt: ISO.string(Day.add(-30 + bn, to: Date()))))
        }
        let sources = ["phone", "website", "online", "walkin", "email", "touristas"]
        let methods = ["cash", "card", "bank", "iris"]
        for (k, p) in plan.enumerated() {
            addBooking(p.0, p.1, Day.add(p.2, to: today), p.3, p.4, p.5, p.6, source: sources[k % sources.count], method: methods[k % methods.count])
        }

        // Season history (May–Oct this year) for the money charts, deterministic.
        var rng = SeededRNG(seed: 7)
        let monthsWeight = [5: 6, 6: 10, 7: 16, 8: 18, 9: 11, 10: 5]
        for (month, count) in monthsWeight.sorted(by: { $0.key < $1.key }) {
            for _ in 0..<count {
                let day = Int.random(in: 1...26, using: &rng)
                let checkIn = String(format: "%04d-%02d-%02d", year, month, day)
                guard checkIn < Day.add(-14, to: today) else { continue }
                let mi = Int.random(in: 0..<models.count, using: &rng)
                let ci = Int.random(in: 0..<people.count, using: &rng)
                let nights = Int.random(in: 2...8, using: &rng)
                let paidAll = Int.random(in: 0..<10, using: &rng) < 8
                addBooking(mi, ci, checkIn, nights, Int.random(in: 0..<14, using: &rng) == 0 ? .cancelled : .confirmed,
                           paidAll ? 1.0 : 0.5, "Λιμάνι Καμάρες", source: sources[Int.random(in: 0..<sources.count, using: &rng)],
                           method: methods[Int.random(in: 0..<methods.count, using: &rng)])
            }
        }

        // A duplicate profile of client 0 (same phone in another format), with one older booking: client merge.
        s.clients.append(Client(id: id("0000000c", 17), name: "Maria Papadopoulou", phone: "+30 694 412 3456", email: "maria.pap@gmail.com",
                                preferredLanguage: "en", createdAt: ISO.string(Day.add(-30, to: Date()))))
        addBooking(5, 16, Day.add(-75, to: today), 3, .confirmed, 1.0, "Λιμάνι Καμάρες", source: "website", method: "card")

        // Extra fees + returning-customer discount on the first pickup of today (extra_fees_json).
        if let i = s.bookings.firstIndex(where: { $0.id == id("0000000b", 1) }) {
            let fees = [ExtraFee(id: "k3f9a2x", label: "Παιδικό κάθισμα", amount: 15),
                        ExtraFee(id: "p8w1m4z", label: "Παράδοση στο λιμάνι", amount: 10),
                        ExtraFee(id: ExtraFee.discountID, label: "Έκπτωση παλιού πελάτη (20€)", amount: -20)]
            s.bookings[i].extraFeesJSON = ExtraFee.serialize(fees)
            s.bookings[i].totalPrice = (s.bookings[i].totalPrice ?? 0) + 5
        }

        // Maintenance blocks: one now, one done, one planned (each holds one unit).
        s.blocks.append(VehicleBlock(id: id("0000000k", 1), vehicleID: s.vehicles[0].id, startDate: Day.add(-1, to: today), endDate: Day.add(2, to: today), reason: "Service"))
        s.blocks.append(VehicleBlock(id: id("0000000k", 2), vehicleID: s.vehicles[0].id, startDate: Day.add(-40, to: today), endDate: Day.add(-38, to: today), reason: "Αλλαγή ελαστικών"))
        s.blocks.append(VehicleBlock(id: id("0000000k", 3), vehicleID: s.vehicles[0].id, startDate: Day.add(20, to: today), endDate: Day.add(21, to: today), reason: "ΚΤΕΟ"))

        // Website requests
        func req(_ n: Int, _ name: String, _ phone: String?, _ email: String?, _ vehicle: String, _ inOff: Int, _ nights: Int,
                 _ status: RequestStatus, minutesAgo: Int, locale: String, pickup: String, party: Int, child: Bool, arrival: String?, message: String?, est: Double?) -> BookingRequest {
            let ci = Day.add(inOff, to: today)
            return BookingRequest(id: id("0000000q", n), customerName: name, customerEmail: email, customerPhone: phone, requestedVehicle: vehicle,
                                  checkIn: ci, checkOut: Day.add(nights, to: ci), pickupLocation: pickup, returnLocation: pickup, partySize: party,
                                  childSeat: child, arrivalInfo: arrival, message: message, estimatedTotal: est, locale: locale, status: status,
                                  bookingID: nil, adminNotes: nil, source: "website", createdAt: ISO.string(Date().addingTimeInterval(TimeInterval(-minutesAgo * 60))))
        }
        s.requests = [
            req(1, "Chloé Martin", "+33 6 45 22 18 90", "chloe.martin@gmail.com", "fiat-panda", 3, 5, .new, minutesAgo: 12, locale: "fr",
                pickup: "Λιμάνι Καμάρες", party: 3, child: true, arrival: "Seajets 10:40 από Πειραιά", message: "Bonjour! Is it possible to pick up the car at the port? We arrive with a 4-year-old.", est: 250),
            req(2, "Αλέξανδρος Γεωργίου", "6981122334", "alex.georgiou@gmail.com", "sym-symphony-125", 1, 3, .new, minutesAgo: 95, locale: "el",
                pickup: "Γραφείο Απολλωνίας", party: 2, child: false, arrival: nil, message: "Καλησπέρα, θα θέλαμε δύο κράνη.", est: 75),
            req(3, "Hannah Fischer", "+49 172 334 5566", "hannah.fischer@posteo.de", "peugeot-208-auto", 8, 6, .new, minutesAgo: 60 * 26, locale: "de",
                pickup: "Λιμάνι Καμάρες", party: 2, child: false, arrival: "Ferry Blue Star 13:15", message: "We need an automatic car please.", est: 360),
            req(4, "Paolo Conti", "+39 345 678 9012", "paolo.conti@gmail.com", "chevrolet-spark", 5, 4, .reviewed, minutesAgo: 60 * 30, locale: "it",
                pickup: "Πλατύς Γιαλός", party: 2, child: false, arrival: nil, message: nil, est: 160),
            req(5, "Rebecca Hughes", "+44 7800 112233", "becky.hughes@gmail.com", "suzuki-ignis", 12, 7, .reviewed, minutesAgo: 60 * 50, locale: "en",
                pickup: "Λιμάνι Καμάρες", party: 4, child: true, arrival: "Zante Ferries 09:00", message: "Can we have a child seat and a roof rack?", est: 385),
            req(6, "Σταύρος Μαυρίδης", "6955443322", nil, "hyundai-i10", -3, 4, .rejected, minutesAgo: 60 * 24 * 6, locale: "el",
                pickup: "Λιμάνι Καμάρες", party: 1, child: false, arrival: nil, message: nil, est: 160),
        ]
        var accepted = req(7, s.clients[2].name, s.clients[2].phone, s.clients[2].email, "peugeot-208", 0, 3, .accepted, minutesAgo: 60 * 24 * 4, locale: "fr",
                           pickup: "Πλατύς Γιαλός", party: 2, child: false, arrival: nil, message: "Merci!", est: 150)
        accepted.bookingID = s.bookings[2].id
        s.requests.append(accepted)
        s.bookings.sort { $0.checkIn < $1.checkIn }
        return s
    }

    /// The booking that `-DemoRoute bookings/checklist` opens: in rental, returns today, check-in recorded.
    static let checklistBookingID = id("0000000b", 4)
    /// The pickup of today with extra fees and a returning-customer discount.
    static let feesBookingID = id("0000000b", 1)

    /// Check-in/out checklists for two bookings (one open, one finished), with generated photos.
    static func checklists(for s: Snapshot) -> [VehicleChecklist] {
        var out: [VehicleChecklist] = []
        func at(_ day: String, _ hour: Int) -> String {
            let d = Day.calendar.date(bySettingHour: hour, minute: 25, second: 0, of: Day.date(day)) ?? Date()
            return ISO.string(d)
        }
        if let b = s.bookings.first(where: { $0.id == checklistBookingID }) {
            out.append(VehicleChecklist(id: id("0000000l", 1), bookingID: b.id, type: .checkIn, fuelLevel: 100, mileage: 48210,
                                        damageNotes: "Γρατζουνιά στον πίσω προφυλακτήρα, δεξιά. Ο πελάτης ενημερώθηκε.",
                                        photoURLs: [samplePhoto(0), samplePhoto(1), samplePhoto(2)].compactMap { $0 }, createdAt: at(b.checkIn, 10)))
        }
        if let b = s.bookings.first(where: { $0.id == id("0000000b", 30) }) {
            out.append(VehicleChecklist(id: id("0000000l", 2), bookingID: b.id, type: .checkIn, fuelLevel: 100, mileage: 47380,
                                        damageNotes: nil, photoURLs: [samplePhoto(3)].compactMap { $0 }, createdAt: at(b.checkIn, 9)))
            out.append(VehicleChecklist(id: id("0000000l", 3), bookingID: b.id, type: .checkOut, fuelLevel: 75, mileage: 47812,
                                        damageNotes: nil, photoURLs: [], createdAt: at(b.checkOut, 18)))
        }
        return out
    }

    static func storePhoto(_ jpeg: Data, name: String) throws -> String {
        let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("demo-vehicle-photos", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appendingPathComponent(name)
        try jpeg.write(to: url, options: .atomic)
        return url.absoluteString
    }

    /// A drawn "photo" of a car side with a marked spot, so demo checklists have pictures.
    static func samplePhoto(_ n: Int) -> String? {
        let img = sampleImage(n)
        guard let data = img.jpegData(compressionQuality: 0.8) else { return nil }
        return try? storePhoto(data, name: "sample-\(n).jpg")
    }

    static func sampleImage(_ n: Int) -> UIImage {
        let size = CGSize(width: 900, height: 675)
        let palettes: [(UIColor, UIColor)] = [
            (UIColor(red: 0.80, green: 0.88, blue: 0.95, alpha: 1), UIColor(red: 0.93, green: 0.89, blue: 0.80, alpha: 1)),
            (UIColor(red: 0.86, green: 0.84, blue: 0.80, alpha: 1), UIColor(red: 0.70, green: 0.68, blue: 0.64, alpha: 1)),
            (UIColor(red: 0.78, green: 0.86, blue: 0.92, alpha: 1), UIColor(red: 0.85, green: 0.80, blue: 0.70, alpha: 1)),
            (UIColor(red: 0.92, green: 0.86, blue: 0.76, alpha: 1), UIColor(red: 0.80, green: 0.74, blue: 0.64, alpha: 1)),
        ]
        let (top, bottom) = palettes[n % palettes.count]
        let symbols = ["car.side.fill", "car.rear.fill", "steeringwheel", "car.side.fill"]
        return UIGraphicsImageRenderer(size: size).image { ctx in
            let cg = ctx.cgContext
            let colors = [top.cgColor, bottom.cgColor] as CFArray
            if let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1]) {
                cg.drawLinearGradient(g, start: .zero, end: CGPoint(x: 0, y: size.height), options: [])
            }
            let config = UIImage.SymbolConfiguration(pointSize: 360, weight: .regular)
            if let sym = UIImage(systemName: symbols[n % symbols.count], withConfiguration: config)?
                .withTintColor(UIColor(red: 0.04, green: 0.16, blue: 0.24, alpha: 0.88), renderingMode: .alwaysOriginal) {
                let w = size.width * 0.78, h = w * sym.size.height / sym.size.width
                sym.draw(in: CGRect(x: (size.width - w) / 2, y: (size.height - h) / 2 + 20, width: w, height: h))
            }
            if n % 4 == 0 || n % 4 == 1 {
                let r = CGRect(x: n % 4 == 0 ? 600 : 250, y: 300, width: 150, height: 150)
                cg.setStrokeColor(UIColor(red: 0.85, green: 0.2, blue: 0.15, alpha: 1).cgColor)
                cg.setLineWidth(9)
                cg.setLineDash(phase: 0, lengths: [22, 12])
                cg.strokeEllipse(in: r)
            }
        }
    }

    /// The request that "arrives" with -DemoSimulateRequest.
    static func liveRequest() -> BookingRequest {
        BookingRequest(id: UUID().uuidString.lowercased(), customerName: "Isabella García", customerEmail: "isabella.garcia@gmail.com",
                       customerPhone: "+34 612 345 678", requestedVehicle: "suzuki-ignis", checkIn: Day.add(4, to: Day.today),
                       checkOut: Day.add(9, to: Day.today), pickupLocation: "Λιμάνι Καμάρες", returnLocation: "Λιμάνι Καμάρες",
                       partySize: 2, childSeat: false, arrivalInfo: "Seajets 11:20", message: "Hola! Is the Ignis available?",
                       estimatedTotal: 275, locale: "es", status: .new, bookingID: nil, adminNotes: nil, source: "website", createdAt: ISO.string(Date()))
    }
}

struct SeededRNG: RandomNumberGenerator {
    private var state: UInt64
    init(seed: UInt64) { state = seed &* 6364136223846793005 &+ 1442695040888963407 }
    mutating func next() -> UInt64 {
        state = state &* 6364136223846793005 &+ 1442695040888963407
        var z = state
        z = (z ^ (z >> 33)) &* 0xff51afd7ed558ccd
        z = (z ^ (z >> 33)) &* 0xc4ceb9fe1a85ec53
        return z ^ (z >> 33)
    }
}
#endif
