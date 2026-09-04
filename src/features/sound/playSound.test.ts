import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { playSound } from "./playSound";

class StubAudio {
  static instances: StubAudio[] = [];
  src: string;
  preload = "";
  readyState = 0;
  currentTime = 0;
  playCalls = 0;
  playResult: Promise<void> | null = null;
  constructor(src: string) {
    this.src = src;
    StubAudio.instances.push(this);
  }
  play(): Promise<void> {
    this.playCalls += 1;
    return this.playResult ?? Promise.resolve();
  }
}

/** playSound caches one element per sound at module scope, so lookups must
 * tolerate instances created by earlier tests. */
function findAudio(fileName: string): StubAudio {
  const matching = StubAudio.instances.filter((a) => a.src.endsWith(`/sounds/${fileName}`));
  const audio = matching[matching.length - 1];
  if (!audio) throw new Error(`no audio instance for ${fileName}`);
  return audio;
}

const globalWithMedia = globalThis as Record<string, unknown>;
const originalAudio = globalWithMedia.Audio;
const originalHtmlMediaElement = globalWithMedia.HTMLMediaElement;

beforeEach(() => {
  globalWithMedia.Audio = StubAudio;
  globalWithMedia.HTMLMediaElement = { HAVE_METADATA: 1 };
});

afterEach(() => {
  if (originalAudio === undefined) delete globalWithMedia.Audio;
  else globalWithMedia.Audio = originalAudio;
  if (originalHtmlMediaElement === undefined) delete globalWithMedia.HTMLMediaElement;
  else globalWithMedia.HTMLMediaElement = originalHtmlMediaElement;
});

describe("playSound", () => {
  test("plays the requested sound from public/sounds", () => {
    const doneInstances = () =>
      StubAudio.instances.filter((a) => a.src.endsWith("/sounds/done.ogg"));
    playSound("done");
    expect(doneInstances()).toHaveLength(1);
    expect(findAudio("done.ogg").playCalls).toBe(1);
    expect(findAudio("done.ogg").preload).toBe("auto");
  });

  test("reuses one audio element per sound and restarts it", () => {
    const errorInstances = () =>
      StubAudio.instances.filter((a) => a.src.endsWith("/sounds/error.ogg"));
    playSound("error");
    const audio = findAudio("error.ogg");
    audio.readyState = 4; // HAVE_ENOUGH_DATA: metadata loaded
    audio.currentTime = 7;
    playSound("error");
    expect(errorInstances()).toHaveLength(1);
    expect(audio.playCalls).toBe(2);
    expect(audio.currentTime).toBe(0);
  });

  test("does not seek before metadata is loaded", () => {
    playSound("notification");
    const audio = findAudio("notification.ogg");
    audio.readyState = 0;
    audio.currentTime = 3;
    playSound("notification");
    expect(audio.currentTime).toBe(3);
    expect(audio.playCalls).toBe(2);
  });

  test("stays silent when playback fails", () => {
    const audio = findAudio("notification.ogg");
    const rejectedPlayback = Promise.reject(new Error("autoplay blocked"));
    rejectedPlayback.catch(() => {}); // handled; playSound attaches its own catch
    audio.playResult = rejectedPlayback;
    expect(() => playSound("notification")).not.toThrow();
  });
});
