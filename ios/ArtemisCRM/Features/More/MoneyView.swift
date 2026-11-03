import SwiftUI
import Charts

/// Οικονομικά (MoneyPage.tsx): season total, collected vs open, monthly bars by pickup month.
struct MoneyView: View {
    @EnvironmentObject private var store: AppStore
    @State private var year = Day.calendar.component(.year, from: Date())
    @State private var selectedMonth: Int? = Day.calendar.component(.month, from: Date())

    struct MonthRow: Identifiable {
        let month: Int
        var collected: Double = 0
        var open: Double = 0
        var count = 0
        var id: Int { month }
        var total: Double { collected + open }
        var label: String {
            let f = DateFormatter(); f.locale = greek; f.dateFormat = "LLL"
            return f.string(from: Day.date(String(format: "2026-%02d-01", month))).capitalizedFirst.replacingOccurrences(of: ".", with: "")
        }
    }

    private var inYear: [Booking] { store.bookings.filter { $0.isActive && $0.checkIn.hasPrefix(String(year)) } }

    private var months: [MonthRow] {
        var rows = (1...12).map { MonthRow(month: $0) }
        for b in inYear {
            let m = Int(b.checkIn.dropFirst(5).prefix(2)) ?? 1
            rows[m - 1].collected += min(b.paid, b.total)
            rows[m - 1].open += b.balance
            rows[m - 1].count += 1
        }
        return rows
    }

    private var total: Double { inYear.reduce(0) { $0 + $1.total } }
    private var paid: Double { inYear.reduce(0) { $0 + min($1.paid, $1.total) } }
    private var open: Double { max(total - paid, 0) }
    private var openBalances: [Booking] { store.bookings.filter { $0.isActive && $0.balance > 0 }.sorted { $0.balance > $1.balance } }
    private var methods: [(String, Double)] {
        var d: [String: Double] = [:]
        for b in inYear where b.paid > 0 { d[b.paymentMethod ?? "cash", default: 0] += min(b.paid, b.total) }
        return d.sorted { $0.value > $1.value }.map { (Labels.payment($0.key), $0.value) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                headline
                chartCard
                if let m = selectedMonth { monthCard(months[m - 1]) }
                kpis
                if !methods.isEmpty { methodsCard }
                balancesCard
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 28)
        }
        .background(Color.screen)
        .navigationTitle("Οικονομικά")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    ForEach(availableYears, id: \.self) { y in Button(String(y)) { year = y } }
                } label: {
                    HStack(spacing: 3) { Text(String(year)); Image(systemName: "chevron.down").font(.caption) }
                }
            }
        }
        .refreshable { await store.refresh() }
    }

    private var availableYears: [Int] {
        let ys = Set(store.bookings.compactMap { Int($0.checkIn.prefix(4)) })
        return ys.union([Day.calendar.component(.year, from: Date())]).sorted(by: >)
    }

    private var headline: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Η σεζόν \(String(year))").font(.title.weight(.bold))
            Text(Money.format(total))
                .font(.system(size: 44, weight: .bold, design: .rounded))
                .foregroundStyle(Color.navy)
                .monospacedDigit()
                .contentTransition(.numericText())
            Text("\(inYear.count) κρατήσεις · \(Money.format(paid)) εισπραγμένα")
                .font(.subheadline).foregroundStyle(.secondary)
        }
        .padding(.top, 8)
        .animation(.snappy, value: year)
    }

    private var chartCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 14) {
                legend("Εισπραγμένα", .navy)
                legend("Ανοιχτά", .sun)
                Spacer()
            }
            Chart {
                ForEach(months) { row in
                    BarMark(x: .value("Μήνας", row.label), y: .value("€", row.collected), width: .ratio(0.62))
                        .foregroundStyle(Color.navy.opacity(selectedMonth == nil || selectedMonth == row.month ? 1 : 0.35))
                        .cornerRadius(4)
                    BarMark(x: .value("Μήνας", row.label), y: .value("€", row.open), width: .ratio(0.62))
                        .foregroundStyle(Color.sun.opacity(selectedMonth == nil || selectedMonth == row.month ? 1 : 0.35))
                        .cornerRadius(4)
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading) { value in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [3]))
                    AxisValueLabel { if let v = value.as(Double.self) { Text(Money.compact(v)).font(.caption2) } }
                }
            }
            .chartXAxis {
                AxisMarks { value in
                    AxisValueLabel { if let s = value.as(String.self) { Text(String(s.prefix(1))).font(.caption2) } }
                }
            }
            .chartOverlay { proxy in
                GeometryReader { geo in
                    Rectangle().fill(.clear).contentShape(Rectangle())
                        .onTapGesture { location in
                            guard let frame = proxy.plotFrame else { return }
                            let x = location.x - geo[frame].origin.x
                            if let label: String = proxy.value(atX: x), let row = months.first(where: { $0.label == label }) {
                                Haptics.select()
                                withAnimation(.snappy) { selectedMonth = selectedMonth == row.month ? nil : row.month }
                            }
                        }
                }
            }
            .frame(height: 210)
            Text("Ανά μήνα παραλαβής · πατήστε μια μπάρα").font(.caption2).foregroundStyle(.tertiary)
        }
        .card()
    }

    private func legend(_ t: String, _ c: Color) -> some View {
        HStack(spacing: 5) { RoundedRectangle(cornerRadius: 2).fill(c).frame(width: 10, height: 10); Text(t).font(.caption).foregroundStyle(.secondary) }
    }

    private func monthCard(_ row: MonthRow) -> some View {
        let f = DateFormatter(); f.locale = greek; f.dateFormat = "LLLL yyyy"
        let title = f.string(from: Day.date(String(format: "%04d-%02d-01", year, row.month))).capitalizedFirst
        let pct = row.total > 0 ? row.collected / row.total : 0
        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(title).font(.headline)
                Spacer()
                Text(row.count == 1 ? "1 κράτηση" : "\(row.count) κρατήσεις").font(.caption).foregroundStyle(.secondary)
            }
            HStack(alignment: .firstTextBaseline) {
                Text(Money.format(row.total)).font(.title2.weight(.bold)).monospacedDigit()
                Spacer()
                Text("\(Int((pct * 100).rounded()))% εισπράχθηκε").font(.caption.weight(.semibold)).foregroundStyle(Color.success)
            }
            ProgressView(value: pct).tint(Color.success)
            HStack {
                InfoRow(icon: "arrow.down.left", title: "Εισπραγμένα", value: Money.format(row.collected), valueColor: .success)
            }
            InfoRow(icon: "hourglass", title: "Ανοιχτά", value: Money.format(row.open), valueColor: .sun)
        }
        .card()
        .transition(.opacity)
    }

    private var kpis: some View {
        HStack(spacing: 12) {
            KPITile(title: "Εισπραγμένα", value: Money.compact(paid), icon: "checkmark.circle", tint: .success,
                    caption: total > 0 ? "\(Int((paid / total * 100).rounded()))% του συνόλου" : nil)
            KPITile(title: "Ανοιχτά", value: Money.compact(open), icon: "hourglass", tint: .sun, caption: "υπόλοιπα σεζόν")
        }
    }

    private var methodsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader("Τρόποι πληρωμής")
            VStack(spacing: 12) {
                ForEach(methods, id: \.0) { m in
                    VStack(alignment: .leading, spacing: 5) {
                        HStack {
                            Text(m.0).font(.subheadline)
                            Spacer()
                            Text(Money.format(m.1)).font(.subheadline.weight(.semibold)).monospacedDigit()
                        }
                        ProgressView(value: paid > 0 ? m.1 / paid : 0).tint(Color.navy)
                    }
                }
            }
            .card()
        }
    }

    private var balancesCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader("Ανοιχτά υπόλοιπα", count: openBalances.count,
                          trailing: AnyView(Text(Money.format(openBalances.reduce(0) { $0 + $1.balance })).font(.footnote.weight(.bold)).foregroundStyle(Color.sun)))
            VStack(spacing: 0) {
                if openBalances.isEmpty {
                    Label("Όλα εξοφλημένα", systemImage: "checkmark.seal").foregroundStyle(.secondary).padding(16).frame(maxWidth: .infinity)
                }
                ForEach(Array(openBalances.prefix(10).enumerated()), id: \.element.id) { i, b in
                    NavigationLink(value: Route.booking(b.id)) {
                        HStack(spacing: 12) {
                            Avatar(name: b.customerName, size: 34)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(b.customerName).font(.subheadline.weight(.medium)).lineLimit(1)
                                Text("\(store.vehicleName(b.vehicleID)) · επιστροφή \(Day.dayMonth(b.checkOut))").font(.caption).foregroundStyle(.secondary).lineLimit(1)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 2) {
                                Text(Money.format(b.balance)).font(.subheadline.weight(.bold)).foregroundStyle(Color.sun).monospacedDigit()
                                Text("από \(Money.format(b.total))").font(.caption2).foregroundStyle(.secondary)
                            }
                            Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
                        }
                        .padding(.horizontal, 14).padding(.vertical, 11)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    if i < min(openBalances.count, 10) - 1 { Divider().padding(.leading, 60) }
                }
            }
            .card(padding: 0)
        }
    }
}
