import SwiftUI

struct FleetView: View {
    @EnvironmentObject private var store: AppStore
    @State private var type: VehicleType?
    @State private var query = ""

    private var vehicles: [Vehicle] {
        store.vehicles
            .filter { type == nil || $0.type == type }
            .filter { query.isEmpty || $0.name.localizedCaseInsensitiveContains(query) || $0.unitPlates.contains { $0.localizedCaseInsensitiveContains(query) } }
            .sorted { ($0.active ? 0 : 1, $0.type == .car ? 0 : 1, $0.name) < ($1.active ? 0 : 1, $1.type == .car ? 0 : 1, $1.name) }
    }

    private var totals: (free: Int, units: Int) {
        let active = store.activeVehicles.filter { type == nil || $0.type == type }
        return (active.reduce(0) { $0 + store.freeToday($1) }, active.reduce(0) { $0 + $1.units })
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                Picker("Τύπος", selection: $type) {
                    Text("Όλα").tag(VehicleType?.none)
                    Text("Αυτοκίνητα").tag(VehicleType?.some(.car))
                    Text("Scooter").tag(VehicleType?.some(.scooter))
                }
                .pickerStyle(.segmented)

                summary

                if !store.hasLoaded {
                    ForEach(0..<4, id: \.self) { _ in VehicleCard(vehicle: Self.placeholder).skeleton(true) }
                } else if vehicles.isEmpty {
                    ContentUnavailableView.search(text: query).padding(.top, 40)
                } else {
                    ForEach(vehicles) { v in
                        NavigationLink(value: Route.vehicle(v.id)) { VehicleCard(vehicle: v) }
                            .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
        }
        .background(Color.screen)
        .navigationTitle("Στόλος")
        .searchable(text: $query, prompt: "Μοντέλο ή πινακίδα")
        .refreshable { await store.refresh() }
    }

    private var summary: some View {
        let t = totals
        return HStack(spacing: 14) {
            Gauge(value: Double(t.units - t.free), in: 0...Double(max(t.units, 1))) { EmptyView() } currentValueLabel: {
                Text("\(t.units > 0 ? Int((Double(t.units - t.free) / Double(t.units) * 100).rounded()) : 0)%").font(.caption.weight(.bold))
            }
            .gaugeStyle(.accessoryCircularCapacity)
            .tint(Color.navy)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(t.free) από \(t.units) μονάδες ελεύθερες σήμερα").font(.subheadline.weight(.semibold))
                Text("\(store.activeVehicles.filter { type == nil || $0.type == type }.count) ενεργά μοντέλα · πληρότητα σήμερα").font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
        }
        .card(padding: 14)
    }

    static let placeholder = Vehicle(id: "p", name: "Μοντέλο οχήματος", type: .car, cc: 1200, quantity: 4, plate: nil, plates: nil, imageURL: nil, active: true)
}

struct VehicleCard: View {
    @EnvironmentObject private var store: AppStore
    let vehicle: Vehicle

    var body: some View {
        let free = store.freeToday(vehicle)
        let rate = store.todayRate(vehicle)
        HStack(spacing: 14) {
            VehicleImage(url: vehicle.imageURL, type: vehicle.type, cornerRadius: 12)
                .frame(width: 112, height: 78)
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(vehicle.name).font(.headline).lineLimit(1)
                    if !vehicle.active { StatusPill(text: "Ανενεργό", color: .secondary) }
                }
                Text("\(Labels.vehicleType(vehicle.type)) · \(vehicle.cc) cc").font(.caption).foregroundStyle(.secondary)
                HStack(spacing: 8) {
                    CapacityBar(free: free, total: vehicle.units)
                        .frame(width: 70, height: 6)
                    Text("\(free)/\(vehicle.units) ελεύθερα")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(free == 0 ? Color.danger : Color.primary)
                        .monospacedDigit()
                }
                if let rate {
                    Text("\(Money.format(rate))/ημέρα σήμερα").font(.caption.weight(.medium)).foregroundStyle(Color.navy)
                } else {
                    Text("Χωρίς τιμή σήμερα").font(.caption).foregroundStyle(Color.warning)
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
        }
        .card(padding: 12)
        .opacity(vehicle.active ? 1 : 0.6)
        .accessibilityElement(children: .combine)
    }
}

struct CapacityBar: View {
    let free: Int
    let total: Int
    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.secondary.opacity(0.18))
                Capsule().fill(free == 0 ? Color.danger : Color.success)
                    .frame(width: total > 0 ? geo.size.width * CGFloat(free) / CGFloat(total) : 0)
            }
        }
    }
}
