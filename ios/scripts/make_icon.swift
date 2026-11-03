// Renders the 1024px app icon: navy gradient, white Artemis logo, sun accent.
// Usage: swift scripts/make_icon.swift <logo.svg> <out.png>
import AppKit

let args = CommandLine.arguments
let logoURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])
let size = 1024.0
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 1024, pixelsHigh: 1024, bitsPerSample: 8,
                           samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                           bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
let ctx = NSGraphicsContext.current!.cgContext

let navyTop = NSColor(srgbRed: 0x12/255, green: 0x3D/255, blue: 0x55/255, alpha: 1)
let navyBottom = NSColor(srgbRed: 0x07/255, green: 0x1D/255, blue: 0x2A/255, alpha: 1)
let gradient = NSGradient(starting: navyTop, ending: navyBottom)!
gradient.draw(in: NSRect(x: 0, y: 0, width: size, height: size), angle: -90)

// Sun disc, top right
let sun = NSColor(srgbRed: 0xC9/255, green: 0x83/255, blue: 0x3A/255, alpha: 1)
sun.setFill()
NSBezierPath(ovalIn: NSRect(x: 150, y: 700, width: 170, height: 170)).fill()

// Sea waves
NSColor(white: 1, alpha: 0.07).setFill()
let wave = NSBezierPath()
wave.move(to: NSPoint(x: 0, y: 250))
wave.curve(to: NSPoint(x: 1024, y: 250), controlPoint1: NSPoint(x: 340, y: 340), controlPoint2: NSPoint(x: 680, y: 160))
wave.line(to: NSPoint(x: 1024, y: 0)); wave.line(to: NSPoint(x: 0, y: 0)); wave.close(); wave.fill()

// Logo, tinted white
if let logo = NSImage(contentsOf: logoURL) {
    let w = 820.0, h = w * logo.size.height / logo.size.width
    let rect = NSRect(x: (size - w) / 2, y: (size - h) / 2 - 40, width: w, height: h)
    let tinted = NSImage(size: logo.size, flipped: false) { r in
        logo.draw(in: r)
        NSColor.white.set()
        r.fill(using: .sourceAtop)
        return true
    }
    tinted.draw(in: rect)
} else {
    let s = NSAttributedString(string: "A", attributes: [.font: NSFont.systemFont(ofSize: 620, weight: .heavy), .foregroundColor: NSColor.white])
    s.draw(at: NSPoint(x: 300, y: 160))
}
_ = ctx
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: outURL)
print("wrote \(outURL.path)")
