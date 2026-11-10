import { useEffect, useState } from "react";

import {
  Button, Modal, ModalBackdrop, ModalCloseTrigger, ModalContainer, ModalDialog, useOverlayState,
} from "@heroui/react";
import { toast } from "@heroui/react";
import { ArrowLeft, ArrowRight, Pin } from "lucide-react";

import { cfg, mutateCfg } from "../config";
import { errorMessage } from "../errors";
import { IN_TAURI, checkDirExists } from "../native";
import { UpdateInfo, checkForUpdates } from "../updater";
import { LoopMatch } from "./loopMatch";
import { usePlayer } from "./player";
import { useBrowse } from "./useBrowse";
import BrowseView from "./components/BrowseView";
import LabelDialog from "./components/LabelDialog";
import LibraryView from "./components/LibraryView";
import LoopMatchView from "./components/LoopMatchView";
import PlayerBar from "./components/PlayerBar";
import SettingsModalContent from "./components/SettingsModalContent";
import UpdateModal from "./components/UpdateModal";
import { FIELD_BUTTON_CLASSES } from "./fieldStyles";
import { getCurrentWindow } from "@tauri-apps/api/window";

type Mode = "browse" | "library" | "match";

function App() {
  const settings = useOverlayState({ defaultOpen: !cfg().configured });
  const player = usePlayer();
  const browse = useBrowse({ onOpenSettings: settings.open });

  const [mode, setMode] = useState<Mode>("browse");
  const [alwaysOnTop, setAlwaysOnTop] = useState(() => cfg().alwaysOnTop);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [sampleDirMissing, setSampleDirMissing] = useState(false);

  // Drags silently fail when the sample folder doesn't exist (e.g. it was deleted,
  // or lives on a drive that's been unplugged), so warn about it up front.
  useEffect(() => {
    if (settings.isOpen) return; // re-check once the user is done changing settings

    const refresh = () => {
      checkDirExists(cfg().sampleDir)
        .then(exists => setSampleDirMissing(!exists))
        .catch(err => console.error("Failed to check the sample folder:", err));
    };

    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [settings.isOpen]);

  useEffect(() => {
    checkForUpdates()
      .then(setUpdate)
      .catch(err => console.error("Update check failed:", err));
  }, []);

  useEffect(() => {
    if (!IN_TAURI || !cfg().alwaysOnTop) return;
    void getCurrentWindow()
      .setAlwaysOnTop(true)
      .catch(error => console.error("could not keep the window on top:", error));
  }, []);

  async function toggleAlwaysOnTop() {
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);

    if (IN_TAURI) {
      try {
        await getCurrentWindow().setAlwaysOnTop(next);
      } catch (error) {
        setAlwaysOnTop(!next);
        toast.danger("Could not change the window mode", { description: errorMessage(error) });
        return;
      }
    }

    await mutateCfg({ alwaysOnTop: next }).catch(error => {
      toast.danger("Could not save the window preference", { description: errorMessage(error) });
    });
  }

  function openBrowse(view: "samples" | "packs") {
    if (mode === "browse" && browse.view === view) return;

    setMode("browse");
    if (view === "samples") browse.showSamples();
    else browse.showPacks();
  }

  function openLibrary() {
    if (mode === "library") return;
    player.pause();
    setMode("library");
  }

  function openMatch() {
    if (mode === "match") return;
    player.pause();
    setMode("match");
  }

  function matchLocalLoop(match: LoopMatch) {
    browse.applyMatch(match);
    setMode("browse");
  }

  const browsing = mode === "browse";

  return (
    <main className="flex flex-col gap-2 h-screen p-6">
      <Modal isOpen={settings.isOpen} onOpenChange={settings.setOpen}>
        <ModalBackdrop isDismissable={false}>
          <ModalContainer size="lg">
            <ModalDialog className="max-h-full min-h-0">
              {cfg().configured && <ModalCloseTrigger />}
              <SettingsModalContent onClose={settings.close} />
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>

      {update != null && <UpdateModal update={update} onDismiss={() => setUpdate(null)} />}

      {browse.downloads.labelProposals != null &&
        <LabelDialog proposals={browse.downloads.labelProposals} onApply={browse.downloads.applyLabels}
          onClose={browse.downloads.dismissLabelProposals} />}

      <div className="flex items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="flex gap-1" aria-label="Navigation history">
            <Button isIconOnly variant="outline" aria-label="Go back"
              isDisabled={!browse.canGoBack} onClick={() => browse.navigateHistory(-1)}>
              <ArrowLeft className="size-4" />
            </Button>
            <Button isIconOnly variant="outline" aria-label="Go forward"
              isDisabled={!browse.canGoForward} onClick={() => browse.navigateHistory(1)}>
              <ArrowRight className="size-4" />
            </Button>
          </div>
          <h1 className="text-xl font-semibold">Ispliced</h1>
        </div>

        <div className="flex items-center gap-2">
          <nav aria-label="Browse library" className="flex gap-2">
            <Button variant={browsing && browse.view === "samples" ? "primary" : "outline"}
              aria-current={browsing && browse.view === "samples" ? "page" : undefined}
              onClick={() => openBrowse("samples")}>Samples</Button>
            <Button variant={browsing && browse.view === "packs" ? "primary" : "outline"}
              aria-current={browsing && browse.view === "packs" ? "page" : undefined}
              onClick={() => openBrowse("packs")}>Sample packs</Button>
            <Button variant={mode === "library" ? "primary" : "outline"}
              aria-current={mode === "library" ? "page" : undefined}
              onClick={openLibrary}>Library</Button>
            <Button variant={mode === "match" ? "primary" : "outline"}
              aria-current={mode === "match" ? "page" : undefined}
              onClick={openMatch}>Loop match</Button>
          </nav>

          <Button isIconOnly variant={alwaysOnTop ? "primary" : "outline"} className={FIELD_BUTTON_CLASSES}
            aria-label={alwaysOnTop ? "Stop keeping the window on top" : "Keep the window on top"}
            onClick={() => void toggleAlwaysOnTop()}>
            <Pin className="size-4" />
          </Button>
        </div>
      </div>

      {browsing &&
        <BrowseView browse={browse} sampleDirMissing={sampleDirMissing} onOpenSettings={settings.open} />}

      {mode === "library" && <LibraryView />}

      {mode === "match" && <LoopMatchView onMatch={matchLocalLoop} />}

      <PlayerBar
        canPrevious={browse.canPrevious}
        canNext={browse.canNext}
        onPrevious={browse.playPrevious}
        onNext={browse.playNext}
      />
    </main>
  );
}

export default App;
