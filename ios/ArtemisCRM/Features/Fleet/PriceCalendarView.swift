import SwiftUI

// The year view of VehicleRatesPage.tsx (PriceVisuals.tsx): seasonal strip, twelve month grids coloured
// by price, fill a year by month, copy a year forward.

enum PriceYear {
    static let monthsShort = ["Ιαν", "Φεβ", "Μαρ", "Απρ", "Μάι", "Ιούν", "Ιούλ", "Αύγ", "Σεπ", "Οκτ", "Νοέ", "Δεκ"]
    static let monthsLong = ["Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
                             "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"]
    static let weekdays = ["Δ", "Τ", "Τ", "Π", "Π", "Σ", "Κ"]
    /// PRICE_TIERS: the brand accent from faint to full.
    static let tierOpacity: [Double] = [0.12, 0.27, 0.47, 0.72, 1]

    static var currentYear: Int { Day.calendar.component(.year, from: Date()) }

    static func rates(_ rates: [VehicleRate], in year: Int) -> [VehicleRate] {
        rates.filter { $0.startDate <= "\(year)-12-31" && $0.endDate >= "\(year)-01-01" }
    }

    static func date(_ year: Int, _ month: Int, _ day: Int) -> Date {
        Day.calendar.date(from: DateComponents(year: year, month: month, day: day)) ?? Date()
    }

    static func daysInMonth(_ year: Int, _ month: Int) -> Int {
        Day.calendar.range(of: .day, in: .month, for: date(year, month, 1))?.count ?? 30
    }

    static func daysInYear(_ year: Int) -> Int {
        Day.calendar.range(of: .day, in: .year, for: date(year, 1, 1))?.count ?? 365
    }

    /// Days from 1 January (0-based).
    static func offset(_ day: String, in year: Int) -> Int { Day.nights(from: "\(year)-01-01", to: day) }

    /// shiftYear(): same month and day a year later; 29 Feb becomes 28 Feb.
    static func shiftYear(_ day: String) -> String {
        let p = day.prefix(10).split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return day }
        let last = daysInMonth(p[0] + 1, p[1])
        return Day.string(from: date(p[0] + 1, p[1], min(p[2], last)))
    }

    static func range(_ rates: [VehicleRate]) -> (min: Double, max: Double) {
        let values = rates.map(\.dailyRate).filter { $0 > 0 }
        return (values.min() ?? 0, values.max() ?? 0)
    }

    /// priceScale().tierOf
    static func tier(_ price: Double, min: Double, max: Double) -> Int {
        guard max > min else { return 2 }
        return Swift.min(tierOpacity.count - 1, Int((price - min) / (max - min) * Double(tierOpacity.count)))
    }

    static func rangeText(_ r: (min: Double, max: Double)) -> String {
        r.min == r.max ? Money.precise(r.min) : "\(Money.precise(r.min))–\(Money.precise(r.max))"
    }
}

struct PriceCalendarView: View {
    @EnvironmentObject private var store: AppStore
    let vehicleID: String

    @State private var year = PriceYear.currentYear
    @State private var pendingStart: String?
    @State private var sheet: RateSheet?
    @State private var fillingMonths = false
    @State private var confirmCopy = false

    struct RateSheet: Identifiable {
        let id = UUID()
        var rate: VehicleRate?
        var start: String?
        var end: String?
    }

    var body: some View {
        if let v = store.vehicle(vehicleID) { content(v) } else {
            ContentUnavailableView("Το όχημα δεν βρέθηκε", systemImage: "car.side")
        }
    }

    private func content(_ v: Vehicle) -> some View {
        let all = store.rates(for: v.id)
        let inYear = PriceYear.rates(all, in: year)
        let total = PriceYear.daysInYear(year)
        let priced = (0..<total).filter { Pricing.rate(for: Day.string(from: Day.add($0, to: PriceYear.date(year, 1, 1))), in: inYear) != nil }.count
        let coverage = total > 0 ? Int((Double(priced) / Double(total) * 100).rounded()) : 0
        return ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                UnderlineTabs(selection: $year.animation(.snappy), items: years(all).map { ($0, String($0), Int?.none) })
                HStack(spacing: 10) {
                    KPITile(title: "Εύρος \(String(year))", value: inYear.isEmpty ? "—" : PriceYear.rangeText(PriceYear.range(inYear)),
                            icon: "eurosign", tint: .sun, caption: "\(inYear.count) \(inYear.count == 1 ? "περίοδος" : "περίοδοι") · σύνολο \(all.count)")
                    KPITile(title: "Κάλυψη \(String(year))", value: "\(coverage)%", icon: "calendar", tint: coverage == 100 ? .success : .warning,
                            caption: "\(priced) από \(total) ημέρες")
                }
                VStack(alignment: .leading, spacing: 10) {
                    Text("Σεζόν \(String(year))").font(.headline)
                    YearPriceStrip(rates: all, year: year) { sheet = RateSheet(rate: $0) }
                    PriceLegend(rates: all, year: year)
                }
                .card(padding: 14)
                if inYear.isEmpty { emptyYear(v) }
                if let pendingStart { pendingBanner(pendingStart) }
                ForEach(1...12, id: \.self) { m in
                    MonthPriceGrid(rates: inYear, year: year, month: m, pendingStart: pendingStart, onTap: tap)
                        .card(padding: 14)
                }
                Text("Πατήστε μια ημέρα με τιμή για να αλλάξετε την περίοδό της. Σε κενή ημέρα, πατήστε την πρώτη και μετά την τελευταία ημέρα της νέας περιόδου.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            .padding(16)
        }
        .background(Color.screen)
        .navigationTitle("Τιμές · \(v.name)")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button { sheet = RateSheet() } label: { Label("Νέα περίοδος", systemImage: "plus") }
                    Button { fillingMonths = true } label: { Label("Συμπλήρωση ανά μήνα", systemImage: "calendar.badge.plus") }
                    Button { confirmCopy = true } label: { Label("Αντιγραφή \(String(year)) → \(String(year + 1))", systemImage: "doc.on.doc") }
                        .disabled(all.allSatisfy { !$0.startDate.hasPrefix(String(year)) })
                } label: { Image(systemName: "ellipsis.circle") }
                .accessibilityLabel("Ενέργειες τιμών")
            }
        }
        .sheet(item: $sheet) { s in RateEditView(vehicle: v, rate: s.rate, initialStart: s.start, initialEnd: s.end) }
        .sheet(isPresented: $fillingMonths) { FillMonthsView(vehicle: v, year: $year) }
        .confirmationDialog("Αντιγραφή τιμών", isPresented: $confirmCopy, titleVisibility: .visible) {
            Button("Αντιγραφή στο \(String(year + 1))") { Task { await copyForward(v, from: year, all) } }
            Button("Άκυρο", role: .cancel) {}
        } message: {
            Text("Οι περίοδοι που ξεκινούν το \(String(year)) θα αντιγραφούν με τις ίδιες ημερομηνίες στο \(String(year + 1)). Όσες επικαλύπτουν υπάρχουσες περιόδους παραλείπονται.")
        }
        .task {
            #if DEBUG
            if AppConfig.demoRoute == "fleet/prices/next", let next = years(all).last { year = next }
            #endif
        }
    }

    private func years(_ all: [VehicleRate]) -> [Int] {
        let now = PriceYear.currentYear
        let fromRates = all.compactMap { Int($0.startDate.prefix(4)) }
        return Array(Set([now, now + 1] + fromRates)).sorted()
    }

    private func emptyYear(_ v: Vehicle) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Καμία τιμή για το \(String(year))", systemImage: "exclamationmark.triangle.fill")
                .font(.subheadline.weight(.semibold)).foregroundStyle(Color.danger)
            Text("Χωρίς τιμή το site δεν δείχνει κόστος και η κράτηση δεν υπολογίζει αυτόματα σύνολο.")
                .font(.caption).foregroundStyle(.secondary)
            HStack {
                Button { fillingMonths = true } label: { Label("Συμπλήρωση ανά μήνα", systemImage: "calendar.badge.plus") }
                    .buttonStyle(.borderedProminent).tint(.navy)
                if store.rates(for: v.id).contains(where: { $0.startDate.hasPrefix(String(year - 1)) }) {
                    Button { Task { await copyForward(v, from: year - 1, store.rates(for: v.id)) } } label: { Label("Από \(String(year - 1))", systemImage: "doc.on.doc") }
                        .buttonStyle(.bordered)
                }
            }
            .font(.subheadline.weight(.semibold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(padding: 14)
    }

    private func pendingBanner(_ start: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "hand.tap.fill").foregroundStyle(Color.navy)
            VStack(alignment: .leading, spacing: 2) {
                Text("Από \(Day.format(start, "d MMM yyyy"))").font(.subheadline.weight(.semibold))
                Text("Πατήστε την τελευταία ημέρα της περιόδου").font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Button("Άκυρο") { withAnimation { pendingStart = nil } }.font(.subheadline.weight(.semibold))
        }
        .padding(12)
        .background(Color.navy.opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.navy.opacity(0.25)))
    }

    /// onDayClick(): a priced day edits its period; an empty day starts a range, the next tap ends it.
    private func tap(_ day: String, _ rate: VehicleRate?) {
        Haptics.select()
        if let start = pendingStart {
            withAnimation { pendingStart = nil }
            sheet = RateSheet(start: min(start, day), end: max(start, day))
        } else if let rate {
            sheet = RateSheet(rate: rate)
        } else {
            withAnimation { pendingStart = day }
        }
    }

    /// copyYearForward()
    private func copyForward(_ v: Vehicle, from: Int, _ all: [VehicleRate]) async {
        let rows = all.filter { $0.startDate.hasPrefix(String(from)) }.map { r in
            RateInput(vehicleID: v.id, label: r.label?.replacingOccurrences(of: String(from), with: String(from + 1)),
                      startDate: PriceYear.shiftYear(r.startDate), endDate: PriceYear.shiftYear(r.endDate),
                      dailyRate: r.dailyRate, minDays: r.minDays ?? 1)
        }
        let result = await store.addRates(rows, done: "Αντιγράφηκαν στο \(String(from + 1))")
        if result.added > 0 { withAnimation { year = from + 1 } }
    }
}

/// YearPriceStrip: each period is a column whose height and colour follow its daily price.
/// Unpriced stretches show as a red baseline.
struct YearPriceStrip: View {
    let rates: [VehicleRate]
    let year: Int
    var compact = false
    var onSelect: ((VehicleRate) -> Void)?

    var body: some View {
        let inYear = PriceYear.rates(rates, in: year)
        let total = Double(PriceYear.daysInYear(year))
        let scale = PriceYear.range(inYear)
        let gaps = gaps(inYear, Int(total))
        let todayOffset: Int? = PriceYear.currentYear == year ? PriceYear.offset(Day.today, in: year) : nil
        VStack(spacing: 6) {
            GeometryReader { geo in
                let w = geo.size.width, h = geo.size.height
                ZStack(alignment: .bottomLeading) {
                    RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.secondary.opacity(0.08))
                    ForEach(1..<12, id: \.self) { m in
                        Rectangle().fill(Color.hairline).frame(width: 1, height: h)
                            .offset(x: w * Double(PriceYear.offset(Day.string(from: PriceYear.date(year, m + 1, 1)), in: year)) / total)
                    }
                    ForEach(Array(gaps.enumerated()), id: \.offset) { _, g in
                        Capsule().fill(Color.danger.opacity(0.6))
                            .frame(width: max(2, w * Double(g.count) / total), height: 5)
                            .offset(x: w * Double(g.from) / total)
                    }
                    ForEach(inYear) { r in
                        let from = max(0, PriceYear.offset(r.startDate, in: year))
                        let to = min(Int(total) - 1, PriceYear.offset(r.endDate, in: year))
                        let t = scale.max > scale.min ? (r.dailyRate - scale.min) / (scale.max - scale.min) : 0.6
                        let tier = PriceYear.tier(r.dailyRate, min: scale.min, max: scale.max)
                        let bandW = max(2, w * Double(to - from + 1) / total)
                        Button { onSelect?(r) } label: {
                            UnevenRoundedRectangle(topLeadingRadius: 5, topTrailingRadius: 5, style: .continuous)
                                .fill(Color.sun.opacity(PriceYear.tierOpacity[tier]))
                                .overlay(alignment: .top) {
                                    if !compact && bandW > 26 {
                                        Text(Money.format(r.dailyRate))
                                            .font(.system(size: 10, weight: .bold)).monospacedDigit()
                                            .foregroundStyle(tier >= 3 ? Color.white : Color.primary)
                                            .padding(.top, 3)
                                    }
                                }
                                .overlay(UnevenRoundedRectangle(topLeadingRadius: 5, topTrailingRadius: 5, style: .continuous)
                                    .strokeBorder(Color.screen.opacity(0.7), lineWidth: 0.5))
                        }
                        .buttonStyle(.plain)
                        .disabled(onSelect == nil)
                        .frame(width: bandW, height: h * (0.34 + t * 0.66))
                        .offset(x: w * Double(from) / total)
                        .accessibilityLabel("\(r.label?.nilIfBlank ?? "Περίοδος"), \(Day.dayMonth(r.startDate)) – \(Day.dayMonth(r.endDate)), \(Money.precise(r.dailyRate)) ανά ημέρα")
                    }
                    if let todayOffset {
                        Rectangle().fill(Color.navy).frame(width: 2, height: h)
                            .offset(x: w * Double(todayOffset) / total)
                            .allowsHitTesting(false)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .frame(height: compact ? 56 : 120)
            GeometryReader { geo in
                ForEach(0..<12, id: \.self) { m in
                    if !compact || m % 2 == 0 {
                        Text(PriceYear.monthsShort[m])
                            .font(.system(size: 9, weight: .medium)).foregroundStyle(.secondary)
                            .fixedSize()
                            .offset(x: geo.size.width * Double(PriceYear.offset(Day.string(from: PriceYear.date(year, m + 1, 1)), in: year)) / total + 2)
                    }
                }
            }
            .frame(height: 12)
        }
    }

    private func gaps(_ inYear: [VehicleRate], _ total: Int) -> [(from: Int, count: Int)] {
        var out: [(Int, Int)] = []
        var open: Int?
        let first = PriceYear.date(year, 1, 1)
        for i in 0...total {
            let priced = i < total && Pricing.rate(for: Day.string(from: Day.add(i, to: first)), in: inYear) != nil
            if !priced, open == nil, i < total { open = i }
            if priced || i == total, let o = open { out.append((o, i - o)); open = nil }
        }
        return out
    }
}

struct PriceLegend: View {
    let rates: [VehicleRate]
    let year: Int

    var body: some View {
        let inYear = PriceYear.rates(rates, in: year)
        if !inYear.isEmpty {
            let r = PriceYear.range(inYear)
            HStack(spacing: 14) {
                HStack(spacing: 6) {
                    Text(Money.precise(r.min))
                    HStack(spacing: 0) {
                        ForEach(PriceYear.tierOpacity, id: \.self) { o in Rectangle().fill(Color.sun.opacity(o)).frame(width: 16, height: 8) }
                    }
                    .clipShape(Capsule())
                    Text(Money.precise(r.max))
                }
                HStack(spacing: 5) {
                    Capsule().fill(Color.danger.opacity(0.6)).frame(width: 16, height: 5)
                    Text("Χωρίς τιμή")
                }
                HStack(spacing: 5) {
                    Rectangle().fill(Color.navy).frame(width: 2, height: 10)
                    Text("Σήμερα")
                }
            }
            .font(.caption2).foregroundStyle(.secondary)
            .monospacedDigit()
        }
    }
}

/// One month of PriceYearCalendar: Monday first, each day coloured by its price.
struct MonthPriceGrid: View {
    let rates: [VehicleRate]
    let year: Int
    let month: Int
    var pendingStart: String?
    let onTap: (String, VehicleRate?) -> Void

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)

    var body: some View {
        let count = PriceYear.daysInMonth(year, month)
        let firstDay = Day.string(from: PriceYear.date(year, month, 1))
        let lastDay = Day.string(from: PriceYear.date(year, month, count))
        let monthRates = rates.filter { $0.startDate <= lastDay && $0.endDate >= firstDay }
        let scale = PriceYear.range(rates)
        let weekday = Day.calendar.component(.weekday, from: PriceYear.date(year, month, 1))
        let lead = (weekday + 5) % 7
        let today = Day.today
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(PriceYear.monthsLong[month - 1]).font(.subheadline.weight(.semibold))
                Spacer()
                if monthRates.isEmpty {
                    Text("χωρίς τιμή").font(.caption.weight(.medium)).foregroundStyle(Color.danger)
                } else {
                    Text(PriceYear.rangeText(PriceYear.range(monthRates))).font(.caption.weight(.medium)).foregroundStyle(.secondary).monospacedDigit()
                }
            }
            LazyVGrid(columns: columns, spacing: 4) {
                ForEach(0..<7, id: \.self) { i in
                    Text(PriceYear.weekdays[i]).font(.system(size: 10, weight: .medium)).foregroundStyle(.secondary)
                        .id("w\(i)")
                }
                ForEach(0..<lead, id: \.self) { i in Color.clear.frame(height: 1).id("l\(i)") }
                ForEach(1...count, id: \.self) { d in
                    let day = Day.string(from: PriceYear.date(year, month, d))
                    let rate = Pricing.rate(for: day, in: rates)
                    cell(d, day: day, rate: rate, tier: rate.map { PriceYear.tier($0.dailyRate, min: scale.min, max: scale.max) }, isToday: day == today, past: day < today)
                        .id(day)
                }
            }
        }
    }

    private func cell(_ d: Int, day: String, rate: VehicleRate?, tier: Int?, isToday: Bool, past: Bool) -> some View {
        let shape = RoundedRectangle(cornerRadius: 7, style: .continuous)
        let pending = pendingStart == day
        return Button { onTap(day, rate) } label: {
            Text("\(d)")
                .font(.caption.weight(isToday ? .bold : .medium))
                .monospacedDigit()
                .foregroundStyle(tier.map { $0 >= 3 } == true ? Color.white : Color.primary)
                .frame(maxWidth: .infinity)
                .frame(height: 34)
                .background {
                    if let tier { shape.fill(Color.sun.opacity(PriceYear.tierOpacity[tier])) } else { shape.fill(Color.danger.opacity(0.05)) }
                }
                .overlay {
                    if pending { shape.strokeBorder(Color.navy, lineWidth: 2) }
                    else if isToday { shape.strokeBorder(Color.navy, lineWidth: 1.5) }
                    else if tier == nil { shape.strokeBorder(Color.danger.opacity(0.3), style: StrokeStyle(lineWidth: 1, dash: [3])) }
                }
                .opacity(past ? 0.45 : 1)
                .contentShape(shape)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Day.format(day, "d MMMM") + (rate.map { ", \(Money.precise($0.dailyRate))" } ?? ", χωρίς τιμή"))
    }
}

/// addMonths(): twelve periods, one per month, at one price. Months that already have a period are skipped.
struct FillMonthsView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    let vehicle: Vehicle
    @Binding var year: Int

    @State private var target = PriceYear.currentYear + 1
    @State private var price: Double?
    @State private var saving = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Έτος", selection: $target) {
                        ForEach(PriceYear.currentYear...(PriceYear.currentYear + 2), id: \.self) { Text(String($0)).tag($0) }
                    }
                    HStack {
                        Text("Τιμή ανά ημέρα")
                        Spacer()
                        TextField("0", value: $price, format: .number.precision(.fractionLength(0...2)))
                            .keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(maxWidth: 100)
                        Text("€").foregroundStyle(.secondary)
                    }
                } footer: {
                    Text("Δημιουργεί 12 περιόδους, μία ανά μήνα (π.χ. «Ιούλιος \(String(target))»). Μήνες που έχουν ήδη τιμή παραλείπονται. Μετά αλλάζετε την τιμή κάθε μήνα από το ημερολόγιο.")
                }
            }
            .navigationTitle("Συμπλήρωση ανά μήνα")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Άκυρο") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if saving { ProgressView() } else {
                        Button("Προσθήκη", action: save).fontWeight(.semibold).disabled((price ?? 0) <= 0)
                    }
                }
            }
            .onAppear { target = max(year, PriceYear.currentYear) }
        }
        .presentationDetents([.medium])
    }

    private func save() {
        guard let price, price > 0 else { return }
        saving = true
        let rows = (1...12).map { m in
            RateInput(vehicleID: vehicle.id, label: "\(PriceYear.monthsLong[m - 1]) \(String(target))",
                      startDate: Day.string(from: PriceYear.date(target, m, 1)),
                      endDate: Day.string(from: PriceYear.date(target, m, PriceYear.daysInMonth(target, m))),
                      dailyRate: price, minDays: 1)
        }
        Task {
            let result = await store.addRates(rows, done: "Προστέθηκαν μήνες")
            saving = false
            if result.added > 0 || result.skipped == rows.count {
                year = target
                dismiss()
            }
        }
    }
}
