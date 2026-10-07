// Kısa oyun efektleri: SoundPool sesleri belleğe çözer ve düşük gecikmeyle, aynı sesi üst üste çalabilir.
// play() beklemeden döner; yüklenmemiş ses sessizce atlanır.
package expo.modules.stashsfx

import android.media.AudioAttributes
import android.media.SoundPool
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class StashSfxModule : Module() {
  private var soundPool: SoundPool? = null
  private val ids = HashMap<String, Int>()
  private val ready = HashSet<Int>()

  private fun pool(): SoundPool = synchronized(this) {
    soundPool ?: SoundPool.Builder()
      .setMaxStreams(16)
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_GAME)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
      )
      .build()
      .also { sp ->
        sp.setOnLoadCompleteListener { _, sampleId, status ->
          if (status == 0) synchronized(ready) { ready.add(sampleId) }
        }
        soundPool = sp
      }
  }

  override fun definition() = ModuleDefinition {
    Name("StashSfx")

    // voices: SoundPool aynı sesi kendiliğinden üst üste çalabildiği için Android'de kullanılmaz
    AsyncFunction("load") { name: String, uri: String, _: Int ->
      synchronized(ids) {
        if (!ids.containsKey(name)) ids[name] = pool().load(uri.removePrefix("file://"), 1)
      }
      true
    }

    Function("play") { name: String, volume: Double, rate: Double ->
      val id = synchronized(ids) { ids[name] }
      if (id != null && synchronized(ready) { ready.contains(id) }) {
        val v = volume.toFloat().coerceIn(0f, 1f)
        pool().play(id, v, v, 1, 0, rate.toFloat().coerceIn(0.5f, 2f))
      }
    }

    OnDestroy {
      synchronized(this@StashSfxModule) {
        soundPool?.release()
        soundPool = null
      }
    }
  }
}
