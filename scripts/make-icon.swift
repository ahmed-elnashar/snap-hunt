import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// Generates the app icon and the two splash marks.
//
// The icon is a single stamp impression caught half off the edge of the paper.
// Not a camera and not a magnifying glass: those are what the app uses, not
// what it is about. The app is about being ruled on.
//
// Construction is DESIGN.md's, exactly: solid buff ground, one violet ring
// cropped against the right edge, tilted so the broken ink reads as a real
// impression rather than a drawn circle. No alpha, no rounded corners, no text.
//
// Run: swift scripts/make-icon.swift assets

let outDir = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "assets"

// Straight from src/design/tokens.ts. Kept in sync by hand; the icon is the one
// artefact that cannot import them.
let buffLight = (0xE8 / 255.0, 0xDC / 255.0, 0xC4 / 255.0)
let violetLight = (0x4B / 255.0, 0x2E / 255.0, 0x83 / 255.0)
let violetDark = (0xA9 / 255.0, 0x8B / 255.0, 0xDB / 255.0)

let TILT = -7.0 * Double.pi / 180.0

/// Gaps in the rubber, as (start, end) angles in radians. Irregular on purpose:
/// an evenly broken ring reads as a dashed circle, not as ink.
/// Small and uneven. Large even gaps read as a dashed circle; these read as a
/// die that did not take ink evenly.
let GAPS: [(Double, Double)] = [
    (0.41, 0.49),
    (1.97, 2.02),
    (3.38, 3.50),
    (4.55, 4.59),
    (5.61, 5.68),
]

func inGap(_ angle: Double) -> Bool {
    let a = angle.truncatingRemainder(dividingBy: 2 * Double.pi)
    let n = a < 0 ? a + 2 * Double.pi : a
    return GAPS.contains { n >= $0.0 && n <= $0.1 }
}

func drawStamp(_ ctx: CGContext, size: Double, cx: Double, cy: Double,
               radius: Double, width: Double, ink: (Double, Double, Double)) {
    ctx.saveGState()
    ctx.translateBy(x: cx, y: cy)
    ctx.rotate(by: TILT)

    // The ring is drawn as many short segments so ink weight can vary along it:
    // a real stamp is pressed harder on one side and starved on the other.
    let steps = 2200
    for i in 0..<steps {
        let a0 = (Double(i) / Double(steps)) * 2 * Double.pi
        let a1 = (Double(i + 1) / Double(steps)) * 2 * Double.pi
        if inGap(a0) { continue }

        // Heavier on the lower-left arc, starved opposite it.
        let lean = cos(a0 - 3.9)
        let weight = width * (0.80 + 0.30 * lean)
        let alpha = min(1.0, max(0.35, 0.86 + 0.20 * lean))

        ctx.setStrokeColor(red: ink.0, green: ink.1, blue: ink.2, alpha: alpha)
        ctx.setLineWidth(weight)
        ctx.setLineCap(.round)
        ctx.move(to: CGPoint(x: cos(a0) * radius, y: sin(a0) * radius))
        ctx.addLine(to: CGPoint(x: cos(a1) * radius, y: sin(a1) * radius))
        ctx.strokePath()
    }

    // Ink that did not take: small bites out of the stroke, and a few specks
    // thrown outside it. Both are what stops this reading as vector art.
    var seed: UInt64 = 0x5E4D_1A05
    func rnd() -> Double {
        seed ^= seed << 13; seed ^= seed >> 7; seed ^= seed << 17
        return Double(seed % 100_000) / 100_000.0
    }

    for _ in 0..<80 {
        let a = rnd() * 2 * Double.pi
        if inGap(a) { continue }
        let r = radius + (rnd() - 0.5) * width * 0.9
        let d = size * (0.004 + rnd() * 0.009)
        ctx.setFillColor(red: buffLight.0, green: buffLight.1, blue: buffLight.2, alpha: 0.85)
        ctx.fillEllipse(in: CGRect(x: cos(a) * r - d / 2, y: sin(a) * r - d / 2,
                                   width: d, height: d))
    }
    for _ in 0..<22 {
        let a = rnd() * 2 * Double.pi
        let r = radius + (rnd() - 0.5) * width * 2.6
        let d = size * (0.002 + rnd() * 0.006)
        ctx.setFillColor(red: ink.0, green: ink.1, blue: ink.2, alpha: 0.55 * rnd())
        ctx.fillEllipse(in: CGRect(x: cos(a) * r - d / 2, y: sin(a) * r - d / 2,
                                   width: d, height: d))
    }

    ctx.restoreGState()
}

func write(_ path: String, _ image: CGImage) {
    let url = URL(fileURLWithPath: path) as CFURL
    guard let dest = CGImageDestinationCreateWithURL(url, UTType.png.identifier as CFString, 1, nil) else {
        exit(1)
    }
    CGImageDestinationAddImage(dest, image, nil)
    CGImageDestinationFinalize(dest)
    print("wrote \(path)  \(image.width)x\(image.height)  alpha=\(image.alphaInfo != .none && image.alphaInfo != .noneSkipLast ? "yes" : "no")")
}

/// The app icon. NO ALPHA — App Store rejects transparency, and a baked corner
/// radius fights the one iOS applies.
func makeIcon(_ path: String, size: Int) {
    let cs = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8,
                              bytesPerRow: 0, space: cs,
                              bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { exit(1) }
    let s = Double(size)
    ctx.setFillColor(red: buffLight.0, green: buffLight.1, blue: buffLight.2, alpha: 1)
    ctx.fill(CGRect(x: 0, y: 0, width: s, height: s))

    // Off-centre to the right so the ring crops against the edge. That
    // asymmetric silhouette is what makes it findable at 60px in a grid of
    // centred glyphs.
    drawStamp(ctx, size: s, cx: s * 0.60, cy: s * 0.50,
              radius: s * 0.44, width: s * 0.095, ink: violetLight)

    guard let img = ctx.makeImage() else { exit(1) }
    write(path, img)
}

/// Splash marks keep alpha: they sit on a background colour Expo paints.
func makeSplashMark(_ path: String, ink: (Double, Double, Double)) {
    let size = 512
    let cs = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8,
                              bytesPerRow: 0, space: cs,
                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { exit(1) }
    let s = Double(size)
    drawStamp(ctx, size: s, cx: s * 0.5, cy: s * 0.5,
              radius: s * 0.36, width: s * 0.088, ink: ink)
    guard let img = ctx.makeImage() else { exit(1) }
    write(path, img)
}

makeIcon("\(outDir)/icon.png", size: 1024)
makeSplashMark("\(outDir)/splash-mark.png", ink: violetLight)
makeSplashMark("\(outDir)/splash-mark-dark.png", ink: violetDark)

// Inspection renders. DESIGN.md requires looking at these before accepting the
// icon. They go to docs/icon/ rather than assets/ so they are kept as evidence
// of the check without being bundled into the app.
let docs = "docs/icon"
try? FileManager.default.createDirectory(atPath: docs, withIntermediateDirectories: true)
for px in [180, 120, 60] {
    makeIcon("\(docs)/icon-\(px).png", size: px)
}
