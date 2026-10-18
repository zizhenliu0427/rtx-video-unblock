# RTX Video Unblock (prototype)

English | [中文](README.zh-CN.md)

Chrome / Edge extension for Windows + NVIDIA RTX. It clears invisible page
elements that keep NVIDIA RTX Video (VSR / RTX HDR) away from a browser video,
and tells you when something visible is in the way.

Background and measurements: Framegen's
[docs/rtx_video.md](https://github.com/zizhenliu0427/Framegen/blob/main/docs/rtx_video.md).

## Why

The driver only enhances a video that Chromium shows as a DirectComposition
overlay. Chromium skips the overlay when

- the frame holds a second video (`DCLayerResult` 8) - e.g. a 1x1 px
  autoplay-unlock `<video>`;
- a `backdrop-filter` quad sits above the video (`DCLayerResult` 11) - e.g. a
  blurred drawer parked outside an `overflow: hidden` player.

## What it does

In every frame with a video of at least 200x112 CSS px, every 250 ms:

- hides other videos of 16 CSS px² or less (`visibility: hidden`);
- drops `backdrop-filter` from elements within one device pixel of the video
  whose visible part (after the viewport and overflow clips) is under one device
  pixel - and gives it back once the element slides into view;
- reports visible blockers (a blurred control bar over the picture, a second
  visible video) without touching them.

Everything is restored when the video goes away or the extension is removed.

## Toolbar badge

| badge | meaning |
|---|---|
| green number | blockers cleared on this page (hover for the list) |
| orange `!` | something visible keeps RTX Video off; hover to see what |
| none | no video, or nothing in the way |

Details also go to the DevTools console, prefixed `[RTX Video Unblock]`.

To confirm the overlay itself: `edge://histograms/#DirectComposition`
(`chrome://` in Chrome), `GPU.DirectComposition.DCLayerResult.Video.Clear` -
bucket 0 means promoted.

## Install

`edge://extensions` (or `chrome://extensions`) → Developer mode → Load unpacked →
this folder.

## Tested (off-screen Chromium 2552x1313 @150%, logged out)

| page | as loaded | with the extension | badge |
|---|---|---|---|
| yifan.tv, Thor 3 | 8 + 11 | 0 | 2 |
| yifan.tv, Detective Conan (opened directly) | 8 | 0 | 2 |
| bilibili, YouTube, Twitch, AcFun | 0 | 0 | none |
| visible blur injected over a bilibili video | 11 | 11 | ! |

## Limits

- Only invisible blockers are cleared; visible ones are the site's design.
- Each frame is handled on its own: a blocker in the parent page over a
  video inside an iframe is not seen.
- An extension cannot read `chrome://histograms`, so the badge is a heuristic;
  the histogram is the ground truth.
- Framegen's *RTX Video page fix* does the same job; don't run both at once.

## License

[MIT](LICENSE)
