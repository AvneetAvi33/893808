# Songs

Drop licensed audio here and fill in the matching `src` in
`src/config/playlists.ts`:

    { id: "bs-1", title: "Suhana Safar…", src: "/assets/audio/suhana-safar.m4a", … }

Guidelines:

- AAC (.m4a) or MP3 for reach; keep one format per track, Howler picks the src
  it is given.
- The `duration` field in the config is only a hint used before the file loads.
- Until a track has a `src`, the app synthesises a calm placeholder tone in its
  place, so the player works end to end with this folder empty.

Use only recordings you are licensed to distribute. No audio is bundled here.
