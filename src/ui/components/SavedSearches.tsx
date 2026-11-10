import { useState } from "react";
import { Button, Popover, PopoverContent, PopoverDialog } from "@heroui/react";
import { Bookmark, X } from "lucide-react";

import { FIELD_BUTTON_CLASSES } from "../fieldStyles";
import { SavedSearch } from "../searchStore";

export default function SavedSearches({ searches, onSave, onLoad, onDelete }: {
  searches: SavedSearch[];
  onSave: (name: string) => void;
  onLoad: (search: SavedSearch) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return;

    onSave(trimmed);
    setName("");
  }

  return (
    <Popover>
      <Button isIconOnly variant="outline" className={FIELD_BUTTON_CLASSES} aria-label="Saved searches">
        <Bookmark className="size-4" />
      </Button>

      <PopoverContent placement="bottom end">
        <PopoverDialog className="flex w-80 flex-col gap-3 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={event => setName(event.target.value)}
              onKeyDown={event => { if (event.key === "Enter") save(); }}
              placeholder="Name this search"
              aria-label="Saved search name"
              className="min-w-0 flex-1 rounded-md bg-surface-tertiary px-2 py-1 text-sm"
            />
            <Button isDisabled={!name.trim()} onClick={save}>Save</Button>
          </div>

          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {searches.length === 0 &&
              <p className="text-sm text-muted">No saved searches yet.</p>}

            {searches.map(search =>
              <div key={search.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onLoad(search)}
                  className="min-w-0 flex-1 cursor-pointer truncate rounded px-2 py-1 text-left
                             text-sm hover:bg-surface-tertiary"
                >
                  {search.name}
                </button>
                <Button isIconOnly size="sm" variant="ghost" aria-label={`Delete ${search.name}`}
                  onClick={() => onDelete(search.id)}>
                  <X className="size-4" />
                </Button>
              </div>)}
          </div>
        </PopoverDialog>
      </PopoverContent>
    </Popover>
  );
}
