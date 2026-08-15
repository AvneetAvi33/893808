import type { BackgroundSource, Scene, SceneId } from "../types";

/*
  Every piece of media in the app is declared here and nowhere else.

  To drop real content in later, edit only this file: point a `video` source at
  a file you have placed in `public/assets/video/` (or at any URL you are
  licensed to use) and it takes precedence over the canvas scene underneath it.
  No component needs to change.

  Licensing, from day one:
    - The galaxy scene streams NASA's public channel. NASA footage is public
      domain.
    - No road or rail footage ships with this repository. The bus, car and
      train scenes therefore fall through to their canvas scenes, which are
      drawn in code and owe nothing to anyone. Add your own recordings, or
      properly licensed or Creative Commons stock, at the paths below.
*/

/**
 * NASA's official YouTube channel id. The `live_stream?channel=` embed form
 * follows the channel rather than a single broadcast, so it keeps working when
 * NASA restarts the feed under a new video id. Verify this id if the embed
 * ever goes blank — the canvas star field takes over in the meantime.
 */
const NASA_CHANNEL_ID = "UCLA_DiR1FfKNvjuUpBHmylQ";

export const SCENES: Record<SceneId, Scene> = {
  galaxy: {
    id: "galaxy",
    name: "Galaxy",
    mood: "Weightless. Cosmic calm.",
    description: "Earth turning below the International Space Station.",
    accent: "#8b8cf0",
    accentSoft: "#c9a8ff",
    ambient: "space",
    sources: [
      {
        kind: "youtube",
        channelId: NASA_CHANNEL_ID,
        label: "NASA live from the International Space Station",
      },
      // Drop a looping space video here to sit between the stream and canvas:
      // { kind: "video", src: "/assets/video/galaxy.mp4", label: "Orbit loop" },
      { kind: "canvas", label: "Drifting star field" },
    ],
  },

  bus: {
    id: "bus",
    name: "Bus journey",
    mood: "Nostalgic mountain roads.",
    description: "The view from the front of a bus on a mountain highway.",
    accent: "#f0a55e",
    accentSoft: "#d97a52",
    ambient: "engine",
    sources: [
      // { kind: "video", src: "/assets/video/bus.mp4", label: "Mountain road" },
      { kind: "canvas", label: "Mountain road, drawn in code" },
    ],
  },

  car: {
    id: "car",
    name: "Car drive",
    mood: "Open road, no rush.",
    description: "An open highway at the end of the day, seen from the wheel.",
    accent: "#5fb3ad",
    accentSoft: "#f08a4b",
    ambient: "engine",
    sources: [
      // { kind: "video", src: "/assets/video/car.mp4", label: "Open road" },
      { kind: "canvas", label: "Open road, drawn in code" },
    ],
  },

  train: {
    id: "train",
    name: "Train ride",
    mood: "Rhythmic and meditative.",
    description: "Countryside sliding past the window of a moving train.",
    accent: "#a3b58c",
    accentSoft: "#c9a97e",
    ambient: "rails",
    sources: [
      // { kind: "video", src: "/assets/video/train.mp4", label: "Window seat" },
      { kind: "canvas", label: "Window seat, drawn in code" },
    ],
  },
};

/** Display order of the mood selector, and of the scene switcher. */
export const SCENE_ORDER: SceneId[] = ["galaxy", "bus", "car", "train"];

export const SCENE_LIST: Scene[] = SCENE_ORDER.map((id) => SCENES[id]);

export type YouTubeSource = Extract<BackgroundSource, { kind: "youtube" }>;

/** YouTube embed URL for a scene source, with every scrap of chrome disabled. */
export function youtubeEmbedUrl(source: YouTubeSource, origin: string): string {
  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    controls: "0",
    modestbranding: "1",
    rel: "0",
    playsinline: "1",
    iv_load_policy: "3",
    disablekb: "1",
    fs: "0",
    enablejsapi: "1",
    origin,
  });
  if (source.channelId) {
    params.set("channel", source.channelId);
    return `https://www.youtube.com/embed/live_stream?${params.toString()}`;
  }
  // A plain video id needs an explicit playlist to loop cleanly.
  params.set("loop", "1");
  params.set("playlist", source.videoId ?? "");
  return `https://www.youtube.com/embed/${source.videoId}?${params.toString()}`;
}
