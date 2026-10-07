// Kısa oyun efektleri: her ses bir kez belleğe alınır (AVAudioPlayer), çalma işi arka plandaki seri kuyrukta yapılır.
// expo-audio her efekt için AVPlayer kullanıyor ve başa sarma/oynatma ana iş parçacığında oluyordu; sık efektlerde
// (plinko çivileri, rulet tıkları) oyun kasıyordu. Ses oturumu (sessiz modda çalmama, başka müzikle karışma)
// uygulamanın genel ayarından gelir.
import AVFoundation
import ExpoModulesCore

public class StashSfxModule: Module {
  private let queue = DispatchQueue(label: "app.stashodds.sfx", qos: .userInteractive)
  /// Sadece `queue` üzerinde okunur ve yazılır
  private var pools: [String: Pool] = [:]

  private final class Pool {
    let players: [AVAudioPlayer]
    var next = 0
    init(_ players: [AVAudioPlayer]) { self.players = players }
  }

  public func definition() -> ModuleDefinition {
    Name("StashSfx")

    /// Bir efekti `voices` kadar oynatıcıyla yükler (aynı ses üst üste binebilsin diye)
    AsyncFunction("load") { (name: String, uri: String, voices: Int) -> Bool in
      return self.queue.sync {
        if self.pools[name] != nil { return true }
        guard let url = URL(string: uri) else { return false }
        let players = (0..<max(1, voices)).compactMap { _ -> AVAudioPlayer? in
          guard let player = try? AVAudioPlayer(contentsOf: url) else { return nil }
          player.enableRate = true
          player.prepareToPlay()
          return player
        }
        if players.isEmpty { return false }
        self.pools[name] = Pool(players)
        return true
      }
    }

    /// Hemen döner; çalma arka planda yapılır. Yüklenmemiş ses sessizce atlanır.
    Function("play") { (name: String, volume: Double, rate: Double) in
      self.queue.async {
        guard let pool = self.pools[name] else { return }
        let player = pool.players[pool.next]
        pool.next = (pool.next + 1) % pool.players.count
        player.volume = Float(min(1, max(0, volume)))
        player.rate = Float(min(2, max(0.5, rate)))
        player.currentTime = 0
        player.play()
      }
    }
  }
}
