# Scene video

Drop looping point-of-view footage here and point `src/config/scenes.ts` at it:

    { kind: "video", src: "/assets/video/bus.mp4", label: "Mountain road" }

Guidelines:

- Muted-autoplay friendly, seamlessly loopable, no audio track needed — the
  music is a separate stream.
- H.264 MP4 for reach, with a WebM/AV1 alongside if you want the bitrate back.
- Encode at the size you will actually show: the stage covers the viewport, so
  1080p is plenty and 4K mostly costs battery.

Use only footage you are licensed to use: your own recordings, properly
licensed stock, or Creative Commons material. Nothing is bundled here, and the
canvas scene underneath keeps working until you add something.
