import { ReactNode } from "react";
import { Button, InputGroup, InputGroupInput, InputGroupPrefix, Link, ModalBody, ModalFooter, ModalHeader, ModalHeading, ModalIcon, Switch, SwitchControl, SwitchThumb } from "@heroui/react";
import { FolderOpen, Wrench } from "lucide-react";
import BrowseButton from "./BrowseButton";
import { cfg, mutateCfg, mutateCfgSync, useCfgSyncedState } from "../../config";
import { refreshDarkMode } from "../theming";
import { FIELD_BUTTON_CLASSES } from "../fieldStyles";

/**
 * A single settings row: a title with a short description on the left and,
 * optionally, a control (e.g. a switch) on the right and/or a full-width
 * control below (passed as `children`).
 */
function SettingRow({ title, description, control, children }: {
  title: string,
  description: string,
  control?: ReactNode,
  children?: ReactNode
}) {
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-8">
        <div className="space-y-0.5 min-w-0">
          <h4 className="text-sm font-medium text-foreground">{title}</h4>
          <p className="text-sm text-muted">{description}</p>
        </div>
        {control && <div className="shrink-0">{control}</div>}
      </div>
      {children}
    </div>
  );
}

/** A settings row whose control is an on/off switch. */
function SwitchSetting({ title, description, checked, onChange, label }: {
  title: string,
  description: string,
  checked: boolean,
  onChange: (enabled: boolean) => void,
  label: string
}) {
  return (
    <SettingRow
      title={title}
      description={description}
      control={
        <Switch isSelected={checked} onChange={onChange} aria-label={label}>
          <SwitchControl><SwitchThumb /></SwitchControl>
        </Switch>
      }
    />
  );
}

export default function SettingsModalContent({ onClose }: { onClose: () => void }) {
  const sampleDir = useCfgSyncedState("sampleDir");
  const placeholders = useCfgSyncedState("placeholders");
  const trimDelay = useCfgSyncedState("trimDelay");
  const labelDownloads = useCfgSyncedState("labelDownloads");
  const darkMode = useCfgSyncedState("darkMode");
  const checkUpdates = useCfgSyncedState("checkUpdates");

  async function closeFirstTimeSetup() {
    // Do not dismiss setup until both the folder and configured flag are on
    // disk. mutateCfg waits behind any pending folder write.
    await mutateCfg({ configured: true });
    onClose();
  }

  function changeDarkMode(enabled: boolean) {
    mutateCfgSync(enabled, darkMode);
    refreshDarkMode();
  }

  return (
    <>
      <ModalHeader className="flex-row items-center gap-3">
        <ModalIcon className="bg-default text-foreground">
          <Wrench className="size-5" />
        </ModalIcon>
        <div className="flex flex-col min-w-0">
          <ModalHeading className="text-base font-semibold tracking-tight">
            { cfg().configured ? "Settings" : "Welcome to Ispliced" }
          </ModalHeading>
          <p className="text-sm text-muted">
            { cfg().configured
              ? "Adjust how Ispliced stores and downloads samples."
              : "Tell Ispliced where to keep your samples and you're good to go." }
          </p>
        </div>
      </ModalHeader>

      <ModalBody className="mt-4">
        <div className="divide-y divide-separator">
          <SettingRow
            title="Sample folder"
            description="Downloaded samples are saved here. Drags into your DAW read from this folder."
          >
            <div className="flex gap-2 mt-3">
              <InputGroup className="flex-1">
                <InputGroupPrefix>
                  <FolderOpen className="size-4 text-muted" />
                </InputGroupPrefix>
                <InputGroupInput
                  type="text" required
                  placeholder='e.g. "D:/Samples/splice"'
                  value={ cfg().sampleDir }
                  onChange={ x => mutateCfgSync(x.target.value, sampleDir) }
                />
              </InputGroup>

              <BrowseButton variant="outline" className={FIELD_BUTTON_CLASSES} directory
                onPick={ x => mutateCfgSync(x, sampleDir) }
              >Browse</BrowseButton>
            </div>
          </SettingRow>

          <SwitchSetting
            title="Placeholder files"
            description="Drag samples into your DAW before they finish downloading. Some DAWs may not like this."
            checked={cfg().placeholders}
            onChange={x => mutateCfgSync(x, placeholders)}
            label="Enable placeholder files"
          />

          <SwitchSetting
            title="Trim MP3 delay"
            description="Remove the silence and pre-ringing that MP3 encoding adds to the start of samples."
            checked={cfg().trimDelay}
            onChange={x => mutateCfgSync(x, trimDelay)}
            label="Trim MP3 delay"
          />

          <SwitchSetting
            title="Label downloaded loops"
            description="Detect each loop's key after a download and offer to add it to the file name."
            checked={cfg().labelDownloads}
            onChange={x => mutateCfgSync(x, labelDownloads)}
            label="Label downloaded loops"
          />

          <SwitchSetting
            title="Check for updates"
            description="Ask to update when a new version of Ispliced is available."
            checked={cfg().checkUpdates}
            onChange={x => mutateCfgSync(x, checkUpdates)}
            label="Enable update checks"
          />

          <SwitchSetting
            title="Dark mode"
            description="Use a dark appearance."
            checked={cfg().darkMode}
            onChange={changeDarkMode}
            label="Enable dark mode"
          />
        </div>
      </ModalBody>

      <ModalFooter className="flex-col items-stretch gap-4">
        { !cfg().configured &&
          <Button
            variant="primary"
            isDisabled={cfg().sampleDir.trim() == ""}
            onClick={closeFirstTimeSetup}
          >Get started</Button>
        }

        <p className="text-xs text-muted text-center">
          Made with
          <img src="img/blob-heart.png" alt="love" className="w-3.5 inline mx-1 align-text-bottom" />
          by <Link className="text-xs" href="https://ascpixi.github.io" target="_blank">@ascpixi</Link>
          {" · "}
          <Link className="text-xs" href="https://github.com/ascpixi/splicedd" target="_blank">GitHub</Link>
          {" · "}
          v{__APP_VERSION__}
        </p>
      </ModalFooter>
    </>
  );
}
