// Play ekran görüntülerini 9:16'ya (1080×1920) çevirir: görüntü küçültülüp ortalanır,
// yanlardaki boşluğa aynı görüntünün bulanık ve karartılmış hâli konur. Kullanım:
//   swift store-shot-916.swift <giriş.png> <çıkış.png>
import AppKit
import CoreImage

let args = CommandLine.arguments
guard args.count == 3, let src = CIImage(contentsOf: URL(fileURLWithPath: args[1])) else {
  FileHandle.standardError.write("kullanım: store-shot-916.swift <giriş.png> <çıkış.png>\n".data(using: .utf8)!)
  exit(1)
}
let W: CGFloat = 1080, H: CGFloat = 1920
let ext = src.extent

// Zemin: genişliği dolduracak kadar büyütülmüş, ortadan kırpılmış, bulanık ve koyu
let cover = max(W / ext.width, H / ext.height)
let bg = src.clampedToExtent()
  .transformed(by: CGAffineTransform(scaleX: cover, y: cover))
  .applyingGaussianBlur(sigma: 40)
  .applyingFilter("CIColorControls", parameters: [kCIInputBrightnessKey: -0.18, kCIInputSaturationKey: 0.9])
  .transformed(by: CGAffineTransform(translationX: -(ext.width * cover - W) / 2, y: -(ext.height * cover - H) / 2))
  .cropped(to: CGRect(x: 0, y: 0, width: W, height: H))

// Ön plan: yüksekliğe sığdırılıp yatayda ortalanır
let fit = min(W / ext.width, H / ext.height)
let fg = src.transformed(by: CGAffineTransform(scaleX: fit, y: fit))
  .transformed(by: CGAffineTransform(translationX: (W - ext.width * fit) / 2, y: (H - ext.height * fit) / 2))

let out = fg.composited(over: bg)
let ctx = CIContext()
guard let cg = ctx.createCGImage(out, from: CGRect(x: 0, y: 0, width: W, height: H)) else { exit(1) }
let rep = NSBitmapImageRep(cgImage: cg)
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: args[2]))
