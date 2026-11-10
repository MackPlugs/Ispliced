# Ispliced 2.2.0

## New features

- **Catalogue Loop Match:** drop or choose a WAV loop, detect its key and tempo on
  your machine, adjust the BPM or tolerance, and jump straight to matching loops
  in the catalogue.
- **Library filters and sorting:** narrow the local library by instrument, loop
  type, key and BPM range, and sort by any column. Facets combine with AND while
  values inside one facet combine with OR.
- **Named collections:** create, delete and select collections, add or remove the
  selected files, and see which saved paths are missing from the current folder.
- **Filter-wide exclusion:** **Exclude** now applies to instruments and genres as
  well as tags, so whole families of sounds can be filtered out.
- **Harmonic, rhythmic and combined similarity:** new rhythm analysis adds tempo,
  onset rate, spectral-flux variance, pulse clarity and band ratios to the audio
  profile. Choose which half of the profile to compare in the similar-sounds view.
- **Player next/previous:** step through the current result list from the player
  bar without reopening rows.
- **BPM from file names:** tempo lock now works when the catalogue leaves BPM
  empty but the sample name carries it, such as `STCR2_DMDH_125_Vocal`.
- **Downloads default:** the sample folder defaults to your user Downloads folder
  on first launch and stays there until you choose another folder in Settings.
- **Component tests and CI:** UI component tests plus a workflow that runs linting,
  the frontend build, unit tests, Playwright and the Rust tests.

## Improvements

- Library scans show progress and can be cancelled; hashing streams in chunks and
  audio reads stop at the analysis window.
- Favourites are stored separately from the index, so starring a file no longer
  rewrites the whole library index.
- Saved searches are validated, carry excluded instruments and genres, and restore
  the live query.
- Pack sample counts match count types case-insensitively.
- The sample browser is split into hooks and views for easier maintenance.

## Fixes

- Playback progress no longer re-renders every result row at 60 fps.
- Opening a pack no longer inherits excluded tags.
- A/B preview resumes each side where it left off instead of restarting at 0:00.
- Render errors now show a recoverable fallback instead of a blank window.
- Symlinked folders are skipped during library scans.
- Volume, tempo, window-mode and playback failures are surfaced instead of failing
  silently.
- Saving a search captures the live query rather than the last debounced one.

## Notes

- Loop Match analyses **WAV** files. AIFF/FLAC/MP3 analysis is planned for a later
  release; other formats are rejected with a clear message.
- The portable exe needs the Microsoft Edge WebView2 runtime. The installer sets it
  up automatically.
