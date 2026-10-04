// PNG'ye dikey hareket bulanıklığı (makara dönerken gösterilen kopyalar). macOS Core Image.
// Kullanım: swift motion-blur.swift <girdi.png> <çıktı.png> <yarıçap> [...]
import AppKit
import CoreImage

let args = Array(CommandLine.arguments.dropFirst())
guard args.count % 3 == 0, !args.isEmpty else {
  FileHandle.standardError.write("kullanım: motion-blur.swift <girdi.png> <çıktı.png> <yarıçap> [...]\n".data(using: .utf8)!)
  exit(1)
}
let context = CIContext()
for i in stride(from: 0, to: args.count, by: 3) {
  let (input, output, radius) = (args[i], args[i + 1], Double(args[i + 2])!)
  guard let image = CIImage(contentsOf: URL(fileURLWithPath: input)) else {
    FileHandle.standardError.write("okunamadı: \(input)\n".data(using: .utf8)!)
    exit(1)
  }
  let blur = CIFilter(name: "CIMotionBlur")!
  blur.setValue(image.clampedToExtent(), forKey: kCIInputImageKey)
  blur.setValue(radius, forKey: kCIInputRadiusKey)
  blur.setValue(Double.pi / 2, forKey: kCIInputAngleKey)
  // Kenarları saydam bırak: kenar uzatması yerine saydam zeminle bulanıklaştır
  let transparent = CIImage(color: .clear).cropped(to: image.extent.insetBy(dx: 0, dy: -radius * 2))
  let source = image.composited(over: transparent)
  blur.setValue(source, forKey: kCIInputImageKey)
  let result = blur.outputImage!.cropped(to: image.extent)
  let rep = NSBitmapImageRep(ciImage: result)
  let png = rep.representation(using: .png, properties: [:])!
  try! png.write(to: URL(fileURLWithPath: output))
  _ = context
  print("\(output)")
}
