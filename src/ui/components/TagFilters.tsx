import { ToggleButton } from "@heroui/react";
import { EllipsisVertical } from "lucide-react";

import { SpliceTag } from "../../splice/entities";
import { TAG_PILL_CLASSES } from "../fieldStyles";
import { orderedTags } from "../tags";

export default function TagFilters({ tags, excludedTags, knownTags, expanded, onToggleTag, onExpandedChange }: {
  tags: SpliceTag[];
  excludedTags: SpliceTag[];
  knownTags: SpliceTag[];
  expanded: boolean;
  onToggleTag: (tag: SpliceTag) => void;
  onExpandedChange: (expanded: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-2">
      { /* Selected tags are pinned to the front; the rest follow, most popular first. */ }
      <div className={`flex-1 min-w-0 flex flex-wrap gap-1.5 ${expanded ? "" : "h-9 md:h-8 overflow-hidden"}`}>
        { orderedTags(tags, excludedTags, knownTags).map(tag => {
          const isExcluded = excludedTags.some(entry => entry.uuid == tag.uuid);

          return (
            <ToggleButton key={tag.uuid} size="sm"
              className={`${TAG_PILL_CLASSES} ${isExcluded ? "line-through text-danger" : ""}`}
              isSelected={isExcluded || tags.some(entry => entry.uuid == tag.uuid)}
              onChange={() => onToggleTag(tag)}
            >{tag.label}</ToggleButton>
          );
        })}
      </div>

      <ToggleButton size="sm" isIconOnly className={TAG_PILL_CLASSES}
        aria-label={expanded ? "Show fewer tags" : "Show all tags"}
        isSelected={expanded}
        onChange={onExpandedChange}
      >
        <EllipsisVertical className="size-4" />
      </ToggleButton>
    </div>
  );
}
