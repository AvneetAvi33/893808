export type SceneId = "galaxy" | "bus" | "car" | "train";

/** How a scene paints its full screen background, in order of preference. */
export type BackgroundSource =
  | {
      kind: "youtube";
      /**
       * A channel id resolves to whatever that channel is streaming right now,
       * which survives a live stream being restarted under a new video id.
       */
      channelId?: string;
      videoId?: string;
      label: string;
    }
  | { kind: "video"; src: string; poster?: string; label: string }
  | { kind: "canvas"; label: string };

export interface Scene {
  id: SceneId;
  /** Display name, e.g. "Bus journey". */
  name: string;
  /** One line of mood shown under the name on the selector card. */
  mood: string;
  /** Longer line used by screen readers and the scene switcher tooltip. */
  description: string;
  accent: string;
  accentSoft: string;
  /**
   * Tried top to bottom. The last entry is always a canvas scene, so the
   * screen is never empty even with no media and no network.
   */
  sources: BackgroundSource[];
  /** Ambient realism layer, mixed far under the music. Off by default. */
  ambient: AmbientKind;
}

export type AmbientKind = "space" | "engine" | "rails";

export interface Track {
  id: string;
  /** Latin transliteration, used as the primary label. */
  title: string;
  /** Devanagari form of the same title, shown as a second line. */
  titleNative?: string;
  artist: string;
  artistNative?: string;
  /**
   * Real audio file. Empty string means "no licensed file wired up yet", and
   * the engine synthesises a calm placeholder tone in its place.
   */
  src: string;
  /** Metadata hint in seconds, shown before the file reports its own length. */
  duration: number;
  artwork?: string;
}

export type RepeatMode = "off" | "all" | "one";
