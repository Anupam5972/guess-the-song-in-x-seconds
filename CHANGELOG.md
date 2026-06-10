# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Animated circular participant countdown that shrinks as the remaining time approaches zero.
- Direct numeric score inputs for both teams in Host Controls.

### Changed

- Expanded quick timer presets to 1, 3, 5, 8, 10, 12, and 15 seconds.
- Keep the participant timer at `0.0` when an automatic countdown finishes.
- Simplified the shared header by removing the redundant "Game screen" label.
- Refreshed the participant and host screenshots in the project README.

## [1.0.0] - 2026-06-09

### Added

- Separate synchronized participant and host views.
- Display-only participant scoreboard, timer, game status, and answer reveal.
- Host-only team naming, score controls, round management, and game reset.
- YouTube Data API search with five playable suggestions.
- Movie and TV soundtrack filtering.
- Private YouTube preview using the IFrame Player API.
- Configurable clip duration with quick timer presets.
- Cross-tab synchronization using `BroadcastChannel` and `localStorage`.
- Responsive desktop and mobile layouts.
- Custom game branding and background watermark.
- Participant and host screenshots in the project README.
- GitHub Pages deployment with HTTPS.

### Security

- Keep the YouTube API key in browser storage rather than source control.
- Keep selected songs, private answers, and playback controls in the host view.

[Unreleased]: https://github.com/Anupam5972/guess-the-song-in-x-seconds/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Anupam5972/guess-the-song-in-x-seconds/releases/tag/v1.0.0
