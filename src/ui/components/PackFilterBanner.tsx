import { Button } from "@heroui/react";
import { X } from "lucide-react";

import { SpliceSamplePack } from "../../splice/api";

/** Header shown while a single pack narrows the sample list. */
export default function PackFilterBanner({ pack, downloading, downloadDisabled, canReturnToPacks, onDownload, onReturnToPacks, onClear }: {
  pack: SpliceSamplePack;
  downloading: boolean;
  downloadDisabled: boolean;
  canReturnToPacks: boolean;
  onDownload: () => void;
  onReturnToPacks: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-2xl bg-surface shadow-md">
      <img
        src={pack.files.find(file => file.asset_file_type_slug == "cover_image")?.url ?? "img/missing-cover.png"}
        alt="" width={36} height={36}
        className="rounded-sm object-cover shrink-0"
        draggable={false}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <span className="text-xs text-muted">Samples in this pack</span>
        <span className="truncate font-medium">{pack.name}</span>
      </div>

      <Button size="sm" variant="outline" isDisabled={downloadDisabled} onClick={onDownload}>
        {downloading ? "Downloading…" : "Download whole pack"}
      </Button>

      {canReturnToPacks && <Button size="sm" variant="outline" onClick={onReturnToPacks}>Back to packs</Button>}

      <button
        type="button"
        aria-label={`Stop filtering by ${pack.name}`}
        onClick={onClear}
        className="flex items-center justify-center w-8 h-8 rounded-full shrink-0
                   cursor-pointer transition-colors hover:bg-surface-tertiary"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
