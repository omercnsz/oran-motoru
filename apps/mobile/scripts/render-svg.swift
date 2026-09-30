// SVG → PNG, macOS'un kendi işleyicisiyle. Kullanım: swift render-svg.swift <girdi.svg> <çıktı.png> <piksel> [...]
import AppKit

let args = Array(CommandLine.arguments.dropFirst())
guard args.count % 3 == 0, !args.isEmpty else {
  FileHandle.standardError.write("kullanım: render-svg.swift <girdi.svg> <çıktı.png> <piksel> [...]\n".data(using: .utf8)!)
  exit(1)
}

for i in stride(from: 0, to: args.count, by: 3) {
  let (input, output, size) = (args[i], args[i + 1], Int(args[i + 2])!)
  guard let image = NSImage(contentsOfFile: input) else {
    FileHandle.standardError.write("okunamadı: \(input)\n".data(using: .utf8)!)
    exit(1)
  }
  let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4,
    hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
  rep.size = NSSize(width: size, height: size)
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  image.draw(in: NSRect(x: 0, y: 0, width: size, height: size))
  NSGraphicsContext.restoreGraphicsState()
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: output))
  print("\(output) (\(size) px)")
}
