// Google Play tanıtım görseli (1024×500): koyu stadyum zemini, uygulama simgesi, ad ve slogan.
// Uygulamanın yazı tipleri (assets/fonts) kaydedilip kullanılır. Kullanım:
//   swift store-graphic.swift <çıktı.png> <simge.png> <fonts klasörü> <slogan> <alt yazı>
import AppKit
import CoreText

let args = CommandLine.arguments
guard args.count == 6 else {
  FileHandle.standardError.write("kullanım: store-graphic.swift <çıktı.png> <simge.png> <fonts> <slogan> <alt yazı>\n".data(using: .utf8)!)
  exit(1)
}
let (output, iconPath, fontDir, tagline, subline) = (args[1], args[2], args[3], args[4], args[5])
for file in (try? FileManager.default.contentsOfDirectory(atPath: fontDir)) ?? [] where file.hasSuffix(".ttf") {
  CTFontManagerRegisterFontsForURL(URL(fileURLWithPath: "\(fontDir)/\(file)") as CFURL, .process, nil)
}

let W = 1024, H = 500
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: W, pixelsHigh: H, bitsPerSample: 8, samplesPerPixel: 4,
                           hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
rep.size = NSSize(width: W, height: H)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
let rect = NSRect(x: 0, y: 0, width: W, height: H)

func color(_ hex: UInt32, _ a: CGFloat = 1) -> NSColor {
  NSColor(srgbRed: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: a)
}

// Zemin: lacivert geçiş ve iki ışık lekesi
NSGradient(colors: [color(0x0B1430), color(0x060A16), color(0x050812)])!.draw(in: rect, angle: -90)
NSGradient(colors: [color(0x2BFFA8, 0.22), color(0x2BFFA8, 0)])!.draw(fromCenter: NSPoint(x: 230, y: 250), radius: 0,
  toCenter: NSPoint(x: 230, y: 250), radius: 330, options: [])
NSGradient(colors: [color(0x3DD9FF, 0.14), color(0x3DD9FF, 0)])!.draw(fromCenter: NSPoint(x: 900, y: 460), radius: 0,
  toCenter: NSPoint(x: 900, y: 460), radius: 300, options: [])
// Saha çizgileri (ince, soluk)
color(0xFFFFFF, 0.05).setStroke()
let line = NSBezierPath()
line.lineWidth = 2
line.appendOval(in: NSRect(x: 112, y: 132, width: 236, height: 236))
line.move(to: NSPoint(x: 230, y: 0)); line.line(to: NSPoint(x: 230, y: CGFloat(H)))
line.stroke()

// Simge: yuvarlatılmış kare, gölgeli
if let icon = NSImage(contentsOfFile: iconPath) {
  let iconRect = NSRect(x: 120, y: 140, width: 220, height: 220)
  NSGraphicsContext.saveGraphicsState()
  let shadow = NSShadow()
  shadow.shadowColor = color(0x2BFFA8, 0.45)
  shadow.shadowBlurRadius = 40
  shadow.set()
  let clip = NSBezierPath(roundedRect: iconRect, xRadius: 50, yRadius: 50)
  clip.fill()
  NSGraphicsContext.restoreGraphicsState()
  NSGraphicsContext.saveGraphicsState()
  NSBezierPath(roundedRect: iconRect, xRadius: 50, yRadius: 50).addClip()
  icon.draw(in: iconRect)
  NSGraphicsContext.restoreGraphicsState()
}

func draw(_ text: String, font: NSFont, color c: NSColor, x: CGFloat, top: CGFloat, maxWidth: CGFloat) -> CGFloat {
  let style = NSMutableParagraphStyle()
  style.lineBreakMode = .byWordWrapping
  let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: c, .paragraphStyle: style]
  let s = NSAttributedString(string: text, attributes: attrs)
  let size = s.boundingRect(with: NSSize(width: maxWidth, height: 400), options: [.usesLineFragmentOrigin]).size
  s.draw(with: NSRect(x: x, y: top - size.height, width: maxWidth, height: size.height), options: [.usesLineFragmentOrigin])
  return top - size.height
}

let display = NSFont(name: "Unbounded-ExtraBold", size: 68) ?? NSFont.boldSystemFont(ofSize: 68)
let ui = NSFont(name: "Inter-SemiBold", size: 30) ?? NSFont.systemFont(ofSize: 30)
let small = NSFont(name: "Inter-Medium", size: 22) ?? NSFont.systemFont(ofSize: 22)
let x: CGFloat = 400, width: CGFloat = 580
var y: CGFloat = 372
// Ad: "Stash" beyaz, "Odds" neon yeşil
let name = NSMutableAttributedString(string: "Stash", attributes: [.font: display, .foregroundColor: color(0xEEF3FF)])
name.append(NSAttributedString(string: "Odds", attributes: [.font: display, .foregroundColor: color(0x2BFFA8)]))
let nameSize = name.size()
name.draw(at: NSPoint(x: x, y: y - nameSize.height))
y -= nameSize.height + 14
y = draw(tagline, font: ui, color: color(0xEEF3FF), x: x, top: y, maxWidth: width)
y -= 12
_ = draw(subline, font: small, color: color(0x93A3C4), x: x, top: y, maxWidth: width)

NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: output))
print(output)
