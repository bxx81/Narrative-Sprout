/**
 * One-shot UI sound effects served from `public/sounds/`. Each sound keeps a
 * singleton HTMLAudioElement so repeat plays reuse the fetched/decoded media
 * and restart from the beginning instead of stacking overlapping playbacks.
 */
const soundUrls = {
  done: `${import.meta.env.BASE_URL ?? "/"}sounds/done.ogg`,
  notification: `${import.meta.env.BASE_URL ?? "/"}sounds/notification.ogg`,
  error: `${import.meta.env.BASE_URL ?? "/"}sounds/error.ogg`,
} as const;

export type SoundName = keyof typeof soundUrls;

const audioElements = new Map<SoundName, HTMLAudioElement>();

export function playSound(soundName: SoundName): void {
  try {
    let audio = audioElements.get(soundName);
    if (!audio) {
      audio = new Audio(soundUrls[soundName]);
      audio.preload = "auto";
      audioElements.set(soundName, audio);
    }
    // Restart from the top; seeking before metadata exists is invalid.
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      audio.currentTime = 0;
    }
    const playback = audio.play();
    if (playback) playback.catch(() => {});
  } catch {
    // Audio unavailable (no media support, autoplay blocked): stay silent.
  }
}
