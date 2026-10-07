import { requireOptionalNativeModule } from 'expo';

/** Kısa oyun efektleri için düşük gecikmeli yerel çalar (iOS: AVAudioPlayer, Android: SoundPool) */
export interface StashSfxNative {
  /** Dosya adresinden (file://) yükler; voices: aynı anda çalabilecek kopya sayısı (iOS) */
  load(name: string, uri: string, voices: number): Promise<boolean>;
  /** Hemen döner; yüklenmemiş ses atlanır. rate 0.5–2 */
  play(name: string, volume: number, rate: number): void;
}

/** Modül derlemede yoksa (ör. Expo Go) null: çağıran eski yönteme döner */
export default requireOptionalNativeModule<StashSfxNative>('StashSfx');
