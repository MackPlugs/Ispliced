import { useState } from "react";
import {
  Button, Modal, ModalBackdrop, ModalBody, ModalCloseTrigger, ModalContainer,
  ModalDialog, ModalFooter, ModalHeader, ModalHeading,
} from "@heroui/react";
import { LabelProposal } from "../../native";

const HIGH_CONFIDENCE = "high";

export default function LabelDialog({ proposals, onApply, onClose }: {
  proposals: LabelProposal[];
  onApply: (selected: LabelProposal[]) => void;
  onClose: () => void;
}) {
  const actionable = proposals.filter(proposal => proposal.reason === "");
  const [selected, setSelected] = useState(
    () => new Set(actionable.filter(proposal => proposal.confidence === HIGH_CONFIDENCE)
      .map(proposal => proposal.path)),
  );

  const toggle = (path: string) => {
    setSelected(current => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const chosen = actionable.filter(proposal => selected.has(proposal.path));

  return (
    <Modal isOpen onOpenChange={open => { if (!open) onClose(); }}>
      <ModalBackdrop>
        <ModalContainer size="lg">
          <ModalDialog className="max-h-full min-h-0">
            <ModalCloseTrigger />

            <ModalHeader className="flex flex-col gap-1">
              <ModalHeading className="text-base font-semibold tracking-tight">
                Label downloaded loops
              </ModalHeading>
              <p className="text-sm text-muted">
                {actionable.length} loops have a detected key; {proposals.length - actionable.length} were skipped.
                Only the ticked ones get renamed.
              </p>
            </ModalHeader>

            <ModalBody className="flex flex-col overflow-y-auto">
              {actionable.map(proposal => (
                <label key={proposal.path} className="flex items-center gap-3 py-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 cursor-pointer"
                    checked={selected.has(proposal.path)}
                    onChange={() => toggle(proposal.path)}
                  />
                  <span className="flex-1 min-w-0 truncate" title={proposal.name}>{proposal.name}</span>
                  <span className="text-muted shrink-0">→</span>
                  <span className="flex-1 min-w-0 truncate font-medium" title={proposal.newName}>{proposal.label}</span>
                  <span className="text-xs text-muted shrink-0 tabular-nums">
                    {Math.round(proposal.probability * 100)}%
                  </span>
                </label>
              ))}

              {actionable.length === 0 &&
                <p className="text-sm text-muted py-2">No loops to label.</p>
              }
            </ModalBody>

            <ModalFooter className="justify-between">
              <span className="text-sm text-muted">{selected.size} selected</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>Not now</Button>
                <Button variant="primary" isDisabled={chosen.length === 0} onClick={() => onApply(chosen)}>
                  Apply labels
                </Button>
              </div>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
}
