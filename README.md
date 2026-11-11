# <img src="./src-tauri/icons/128x128.png" width="48" alt="" /> Ispliced

**Ispliced** is a desktop sample browser based on
[Splicedd by ascpixi](https://github.com/ascpixi/splicedd). It keeps the original
sample search, audio previews and DAW drag-and-drop, and adds artwork-based pack
browsing, whole-pack downloads and navigation history.

[Releases](https://github.com/MackPlugs/Ispliced/releases) ·
[Windows builds](https://github.com/MackPlugs/Ispliced/actions/workflows/windows-build.yml) ·
[Original project](https://github.com/ascpixi/splicedd)

![Ispliced sample pack browser showing artwork, search filters and a completed whole-pack download](./etc/ispliced-preview.png)

## Original features

These features were already present in the Splicedd checkout used to start this
fork, commit [`15db3b6`](https://github.com/MackPlugs/Ispliced/commit/15db3b65e599172dcc18a0828c0de2f546e1db4d):

- **Sample search:** search the Splice sample catalogue without an in-app sign-in.
- **Search filters:** instruments, genres, tags, musical key and major/minor
  scale, exact BPM or BPM range, and one-shot/loop sample types.
- **Sorting and pagination:** relevance, popularity, recency and random ordering,
  with multiple pages of sample results.
- **Audio previews:** play/stop controls, interactive waveform seeking, and sample
  metadata including key, tempo and duration.
- **DAW drag-and-drop:** download and decode individual sample previews, export
  WAV files to a chosen sample folder and drag them into another application.
- **Pack context:** show pack artwork with a sample and click it to filter the
  sample list to that pack.
- **Export settings:** optional placeholder files for dragging before a download
  finishes, MP3 delay trimming, and Windows path-length handling.
- **Desktop preferences:** configurable sample folder, dark/light appearance,
  saved settings and missing-folder warnings.
- **Update support:** release checks, update notifications, changelogs and
  platform-specific installer handling.
- **Development and packaging:** React/Vite browser development with mock samples,
  a Tauri/Rust desktop shell, and Windows, macOS and Linux release builds.

## New features added in Ispliced

These additions were made after cloning the original repository:

- **Sample packs tab:** a dedicated artwork grid with pack-name search. The
  sample search filters and sorting controls are also available when finding packs.
- **Pack details and tag exclusion:** pack cards show the sample count, provider and
  genre, and the tag row has an **Exclude** mode that filters tags out instead of in.
- **Saved searches:** name the current query, filters and view, then reload them from
  the bookmark button. Saved searches live in `searches.json` beside the config.
- **Pack-to-sample navigation:** open a pack to browse all of its samples,
  with pagination, then return to the pack search with its filters restored.
- **Faster pack filtering:** return the first matching sample page without waiting
  for a catalogue-wide scan. **Load more packs** discovers additional packs on
  demand and removes duplicates. Session caches reuse results, and duplicate
  helper requests are consolidated.
- **Back/forward arrows:** restore the previous view, search, filters, pagination
  and scroll position. History lasts for the current application session.
- **24-bit WAV exports:** individual sample drag-and-drop and whole-pack downloads
  now export 24-bit PCM WAV files instead of 16-bit, retaining the decoded sample
  rate and the configured MP3 delay trimming.
- **Whole-pack downloads:** save every sample across every page of a pack as
  24-bit WAV files under the configured sample folder, regardless of browse filters.
- **Key labels for downloaded loops:** a built-in K10 key detector estimates each
  loop's key after a pack download and offers to append it to the file name. Only
  high-confidence results are pre-selected, and nothing is renamed without confirmation.
- **Persistent preview player:** a bar along the bottom shows the sample that is
  playing with a pause/play button and a volume slider, and remembers the volume
  between launches.
- **Tempo-locked preview:** the player stretches a loop to a target BPM with its
  pitch preserved, so previews sit in time with the project. The target and the
  lock state are remembered.
- **Loop, A/B and always-on-top:** loop a preview, flip between the last two
  samples with A/B, and pin the window above other applications.
- **Per-sample and batch downloads:** every result row has a download button next
  to play, and multi-selected rows download together with a shared progress
  notice.
- **Local library view:** the **Library** tab indexes the sample folder and shows
  pack, instrument, loop type, key and BPM for every file, with search,
  favourites, duplicate detection and spectral "find similar", plus drag-to-DAW.
- **Library filters and sorting:** narrow the index by instrument, loop type, key
  and BPM range, and click any column header to sort. Facets combine with AND
  while values inside one facet combine with OR.
- **Named collections:** save selected library files into named collections,
  reopen them from the collection picker, and see which saved paths are missing
  from the current folder.
- **Catalogue loop match:** drop or choose a local WAV loop in the **Loop match**
  tab; its key and tempo are detected locally and turned into a catalogue search.
- **Filter-wide exclusion:** **Exclude** now applies to instruments and genres as
  well as tag pills, so whole families of sounds can be filtered out.
- **Tempo from file names:** when the catalogue leaves a sample's BPM empty, the
  player and the library recover it from names such as `STCR2_DMDH_125_Vocal`.
- **Preview next/previous:** step through the current result list from the player
  bar without leaving the keyboard or reopening rows.
- **Harmonic, rhythmic or combined similarity:** the library's similar-sounds
  view compares timbre, groove, or a weighted mix of both.
- **Persistent download notifications:** show **Downloading sample pack** while
  work is in progress and **Sample pack downloaded** only after every file has
  been saved. Progress remains visible while navigating between views; failed
  or partial downloads show an error instead of a success message.
- **Controlled batch exports:** process up to two samples concurrently, skip
  repeated sample IDs, keep conflicting filenames separate, and support audio
  longer than one minute when exporting a pack.
- **Automated checks:** unit tests for search, pack pagination, downloads, WAV
  conversion, navigation, library filters and build commands, component tests
  for the UI, browser tests for the browsing flows, and a CI workflow that runs
  linting, the frontend build, both test suites and the Rust tests.

## Browse samples and packs

Use **Samples** to search individual sounds or **Sample packs** to browse pack
artwork and search by pack name. Audio filters on the packs tab find packs
containing matching samples. If more matching sample pages remain, choose
**Load more packs** to continue discovering packs. A name search with audio
filters may need more pages before the desired pack appears.

Tick a row's checkbox to select samples and use **Download** to save the whole
selection; each row also has its own download button next to **play**. Press
**Exclude** above the filters to switch instrument, genre and tag clicks from
including to excluding; excluded entries are struck through. The **bookmark**
button names the current search so you can reload it later.

Click a pack to open its complete sample list. Discovery filters are cleared
when opening it so all its samples are available. **Back to packs** restores the
search used to find it. The arrows at the top move backward and forward through
browse history; starting a new search after going back replaces forward history.

## Download a whole pack

1. The **Sample folder** defaults to your user **Downloads** folder. Choose a
   different existing folder in Settings if you prefer.
2. Select **Download whole pack** on a pack card or in an open pack's header.
3. Keep the application open while **Downloading sample pack** is displayed.
4. Wait for **Sample pack downloaded**, which confirms all samples have been saved.

With **Label downloaded loops** enabled in Settings, the app then estimates each
loop's key and opens a review list. Ticked entries are renamed; nothing changes
until you apply.

Files are saved under the pack name, then the sample's instrument, then `Loops` or
`One-Shots` — for example `Aventador/Drums/Loops/kick_01.wav`. The instrument comes
from the sample's Splice metadata, falling back to its own folder name and then to
`Other` when neither is available. Exports use the same decoded preview audio as
individual drag-and-drop exports, converted to 24-bit WAV with the configured MP3
delay trimming. They are not a download of the original source WAV masters.

Only one whole-pack job runs at a time, with at most two audio downloads/conversions
in flight. If a sample or request fails, the notification reports the failure.
You can retry the pack; files at the same export paths are replaced. Browser
mock mode does not download audio or write files.

## Browse your library

Open **Library** to index the sample folder you download into. **Scan folder**
rebuilds the index and shows progress while it hashes and analyses each file;
**Cancel** stops it and keeps the previous index. Each row shows the pack,
instrument, loop type, key and BPM parsed from the file name. Star a row to mark
it a favourite, and **Favourites** narrows the list to those stars. **Duplicates**
shows files whose contents match, badged with how many copies exist.

Filter by instrument, type, key or BPM range, and click a column header to sort
by it. **Clear filters** resets the row. Use the checkboxes to select files, then
**Add selected** to place them in a named collection; collections persist in
`collections.json` and list saved paths that have disappeared from the folder.

The waveform icon on a row opens **similar sounds**, ranked by timbre, rhythm or a
combination of both against the rest of the index. Drag any row into your DAW to
use it. The index is stored next to `config.json`, favourites live in
`favorites.json`, and all of it survives restarts.

## Match a local loop

Open **Loop match** and drop a WAV file onto the page, or click the drop area to
choose one. The app detects the key with K10 and reads the tempo from the file
name, falling back to onset analysis. Adjust the detected BPM or the tempo
tolerance, then choose **Find matching samples** to search the catalogue for loops
in that key and tempo. Analysis stays on your machine; only the resulting catalogue
search leaves it. Other formats are rejected with a clear message while local
analysis remains WAV-based.

## macOS

Ispliced is not notarized by Apple. If macOS blocks the application, open
**System Settings → Privacy & Security** and select **Open Anyway** for Ispliced,
or run:

```sh
xattr -dr com.apple.quarantine /Applications/Ispliced.app
```

## Credits and license

Original application: [Splicedd](https://github.com/ascpixi/splicedd) by
[ascpixi](https://github.com/ascpixi). The original sample browser, audio workflow
and desktop foundation are credited above; Ispliced's additions are listed
separately under **New features added in Ispliced**.

Ispliced is distributed under the [GNU General Public License v3.0](./LICENSE).

<details>
<summary>Original Splicedd preview</summary>

![Original Splicedd sample browser](./etc/screenshot.png)

[Original basic demo](https://github.com/ascpixi/splicedd/assets/44982772/4406e3a2-1361-4198-baf9-cca5b4fb62af) ·
[Original drum loop demo](https://github.com/ascpixi/splicedd/assets/44982772/02dda4ce-d61c-4240-8759-bbd18c31de24)

</details>
