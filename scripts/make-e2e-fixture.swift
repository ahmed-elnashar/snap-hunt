import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// The submission used by the E2E harness.
//
// The iOS Simulator has no camera, so Maestro and the screenshot run need
// something for the shutter to produce. This is a still life — a blue bowl on a
// wooden surface, with directional light, a cast shadow, film grain and a
// vignette — rather than a flat shape, so the screens it appears in look like
// the app in use rather than like a test harness.
//
// Run: swift scripts/make-e2e-fixture.swift assets/e2e

let W = 1024, H = 1024
let outDir = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "assets/e2e"
try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

let cs = CGColorSpaceCreateDeviceRGB()
guard let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8,
                          bytesPerRow: 0, space: cs,
                          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { exit(1) }

// Wooden table: warm vertical gradient plus grain streaks.
let woodTop = CGColor(red: 0.62, green: 0.44, blue: 0.28, alpha: 1)
let woodBottom = CGColor(red: 0.38, green: 0.25, blue: 0.15, alpha: 1)
if let grad = CGGradient(colorsSpace: cs, colors: [woodTop, woodBottom] as CFArray, locations: [0, 1]) {
    ctx.drawLinearGradient(grad, start: CGPoint(x: 0, y: H), end: CGPoint(x: 0, y: 0), options: [])
}
for i in 0..<160 {
    let y = CGFloat.random(in: 0...CGFloat(H))
    ctx.setStrokeColor(CGColor(red: 0.25, green: 0.16, blue: 0.09, alpha: CGFloat.random(in: 0.03...0.12)))
    ctx.setLineWidth(CGFloat.random(in: 0.5...3))
    ctx.move(to: CGPoint(x: 0, y: y + CGFloat(i % 3)))
    ctx.addLine(to: CGPoint(x: CGFloat(W), y: y - CGFloat(i % 5)))
    ctx.strokePath()
}

// Soft cast shadow, offset down-right from the light.
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 26, height: -26), blur: 44,
              color: CGColor(red: 0, green: 0, blue: 0, alpha: 0.55))
ctx.setFillColor(CGColor(red: 0.10, green: 0.22, blue: 0.48, alpha: 1))
ctx.fillEllipse(in: CGRect(x: 232, y: 262, width: 560, height: 540))
ctx.restoreGState()

// The glaze: radial gradient, highlight up and to the left.
let rim = CGColor(red: 0.07, green: 0.16, blue: 0.38, alpha: 1)
let lit = CGColor(red: 0.42, green: 0.62, blue: 0.90, alpha: 1)
if let bowl = CGGradient(colorsSpace: cs, colors: [lit, rim] as CFArray, locations: [0, 1]) {
    ctx.saveGState()
    ctx.addEllipse(in: CGRect(x: 232, y: 262, width: 560, height: 540))
    ctx.clip()
    ctx.drawRadialGradient(bowl,
                           startCenter: CGPoint(x: 400, y: 660), startRadius: 10,
                           endCenter: CGPoint(x: 512, y: 520), endRadius: 400,
                           options: [.drawsAfterEndLocation])
    ctx.restoreGState()
}

// Inner shadow at the bowl's far rim, so it reads as a vessel not a disc.
ctx.saveGState()
ctx.addEllipse(in: CGRect(x: 232, y: 262, width: 560, height: 540))
ctx.clip()
ctx.setFillColor(CGColor(red: 0.03, green: 0.08, blue: 0.22, alpha: 0.45))
ctx.fillEllipse(in: CGRect(x: 292, y: 430, width: 440, height: 400))
ctx.restoreGState()

// Specular highlight.
ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 0.30))
ctx.fillEllipse(in: CGRect(x: 360, y: 640, width: 130, height: 70))

// Vignette.
if let vig = CGGradient(colorsSpace: cs,
                        colors: [CGColor(red: 0, green: 0, blue: 0, alpha: 0),
                                 CGColor(red: 0, green: 0, blue: 0, alpha: 0.5)] as CFArray,
                        locations: [0.55, 1]) {
    ctx.drawRadialGradient(vig, startCenter: CGPoint(x: 512, y: 512), startRadius: 0,
                           endCenter: CGPoint(x: 512, y: 512), endRadius: 760,
                           options: [.drawsAfterEndLocation])
}

// Film grain.
for _ in 0..<90_000 {
    let x = CGFloat.random(in: 0...CGFloat(W))
    let y = CGFloat.random(in: 0...CGFloat(H))
    let v = CGFloat.random(in: 0...1)
    ctx.setFillColor(CGColor(red: v, green: v, blue: v, alpha: CGFloat.random(in: 0.02...0.07)))
    ctx.fill(CGRect(x: x, y: y, width: 1.4, height: 1.4))
}

guard let img = ctx.makeImage() else { exit(1) }
let url = URL(fileURLWithPath: "\(outDir)/submission.jpg") as CFURL
guard let dest = CGImageDestinationCreateWithURL(url, UTType.jpeg.identifier as CFString, 1, nil) else { exit(1) }
CGImageDestinationAddImage(dest, img, [kCGImageDestinationLossyCompressionQuality: 0.62] as CFDictionary)
CGImageDestinationFinalize(dest)
print("wrote \(outDir)/submission.jpg")
