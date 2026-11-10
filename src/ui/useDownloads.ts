import { useRef, useState } from "react";
import { toast } from "@heroui/react";
import { join } from "@tauri-apps/api/path";

import { cfg } from "../config";
import { errorMessage } from "../errors";
import { IN_TAURI, LabelProposal, applyLoopLabels, checkDirExists, planLoopLabels } from "../native";
import { SpliceSample, SpliceSamplePack } from "../splice/api";
import { downloadPack as downloadPackFiles } from "../splice/downloadPack";
import { downloadSamples } from "../splice/downloadSamples";
import { savePackSample } from "../splice/saveSample";
import { safePart } from "../splice/samplePath";
import { spliceSearch } from "../splice/searchClient";

export type DownloadNotice = {
  status: "accent" | "success" | "danger";
  title: string;
  description: string;
};

/** Owns pack and batch downloads, their progress notice and post-download labelling. */
export function useDownloads({ onMissingFolder }: { onMissingFolder: () => void }) {
  const [downloadingPackId, setDownloadingPackId] = useState<string | null>(null);
  const [notice, setNotice] = useState<DownloadNotice | null>(null);
  const [labelProposals, setLabelProposals] = useState<LabelProposal[] | null>(null);
  const packBusy = useRef(false);
  const batchBusy = useRef(false);

  async function downloadPack(pack: SpliceSamplePack) {
    if (packBusy.current) return;
    packBusy.current = true;
    setDownloadingPackId(pack.uuid);

    try {
      if (!IN_TAURI) {
        throw new Error("Pack downloads require the desktop application. Browser mode contains mock samples only.");
      }

      // Capture settings once so changing them mid-download cannot split a pack.
      const { sampleDir, trimDelay } = cfg();
      if (!sampleDir.trim() || !await checkDirExists(sampleDir)) {
        onMissingFolder();
        throw new Error("Choose an existing sample folder in Settings before downloading a pack.");
      }

      setNotice({ status: "accent", title: "Downloading sample pack", description: pack.name });
      const result = await downloadPackFiles(pack, spliceSearch,
        (sample, relativePath) => savePackSample(sample, relativePath, sampleDir, trimDelay),
        progress => setNotice({
          status: "accent",
          title: "Downloading sample pack",
          description: `${pack.name} · ${progress.saved} saved of ${progress.found} found${progress.failed ? ` · ${progress.failed} failed` : ""}`,
        }));

      if (result.failed) {
        throw new Error(`${result.saved} saved; ${result.failed} failed. Retry the pack to download again. ${result.errors.join("; ")}`);
      }

      setNotice({
        status: "success",
        title: "Sample pack downloaded",
        description: `${pack.name} · ${result.saved} samples saved to ${sampleDir}`,
      });
      void offerLoopLabels(pack, sampleDir);
    } catch (error) {
      setNotice({ status: "danger", title: "Sample pack download failed", description: errorMessage(error) });
    } finally {
      packBusy.current = false;
      setDownloadingPackId(null);
    }
  }

  /** Resolves `true` once the batch finishes, even if some samples failed. */
  async function downloadSelection(samples: SpliceSample[]): Promise<boolean> {
    if (batchBusy.current || samples.length === 0) return false;

    const { sampleDir, trimDelay } = cfg();
    if (!sampleDir.trim() || !await checkDirExists(sampleDir)) {
      onMissingFolder();
      toast.danger("Choose an existing sample folder in Settings before downloading.");
      return false;
    }

    batchBusy.current = true;
    setNotice({ status: "accent", title: "Downloading samples", description: `${samples.length} selected` });

    try {
      const result = await downloadSamples(
        samples,
        (sample, relativePath) => savePackSample(sample, relativePath, sampleDir, trimDelay),
        progress => setNotice({
          status: "accent",
          title: "Downloading samples",
          description: `${progress.saved} saved of ${progress.found} found${progress.failed ? ` · ${progress.failed} failed` : ""}`,
        }),
      );

      setNotice({
        status: result.failed ? "danger" : "success",
        title: result.failed ? "Some samples failed" : "Samples downloaded",
        description: `${result.saved} saved${result.failed ? `, ${result.failed} failed` : ""}`,
      });
      return true;
    } catch (error) {
      toast.danger("Sample download failed", { description: errorMessage(error) });
      return false;
    } finally {
      batchBusy.current = false;
    }
  }

  /** Proposes key labels for a finished download; nothing is renamed until the user agrees. */
  async function offerLoopLabels(pack: SpliceSamplePack, folder: string) {
    if (!cfg().labelDownloads) return;

    try {
      const packFolder = await join(folder, safePart(pack.name));
      const proposals = await planLoopLabels(packFolder, "medium");
      if (proposals.some(proposal => proposal.reason === "")) setLabelProposals(proposals);
    } catch (error) {
      console.error("could not plan loop labels:", error);
    }
  }

  async function applyLabels(chosen: LabelProposal[]) {
    setLabelProposals(null);

    try {
      const report = await applyLoopLabels(chosen.map(proposal => ({
        path: proposal.path,
        newName: proposal.newName,
      })));

      if (report.failed.length) {
        toast.danger(`${report.renamed.length} labelled, ${report.failed.length} failed`,
          { description: report.failed[0].reason });
      } else {
        toast(`${report.renamed.length} loops labelled`);
      }
    } catch (error) {
      toast.danger(`Labelling failed: ${errorMessage(error)}`);
    }
  }

  return {
    downloadingPackId,
    notice,
    dismissNotice: () => setNotice(null),
    labelProposals,
    dismissLabelProposals: () => setLabelProposals(null),
    downloadPack,
    downloadSelection,
    applyLabels,
  };
}
