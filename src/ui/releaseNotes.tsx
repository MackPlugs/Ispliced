import { Fragment } from "react";
import { open } from "@tauri-apps/plugin-shell";

/**
 * A minimal markdown renderer for GitHub release bodies. It covers the small
 * subset those bodies actually use: headings, bullet lists, paragraphs, and
 * inline bold, code, links, and bare URLs. Anything fancier is shown verbatim.
 */
export default function ReleaseNotesBody({ notes }: { notes: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = notes.split(/\r?\n/);

  let bullets: string[] = [];
  const flushBullets = () => {
    if (bullets.length == 0)
      return;

    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="flex flex-col gap-1 pl-4 list-disc marker:text-muted">
        { items.map((item, i) => <li key={i}>{renderInline(item)}</li>) }
      </ul>
    );
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.trim() == "") {
      flushBullets();
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet != null) {
      bullets.push(bullet[1]);
      continue;
    }

    flushBullets();

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading != null) {
      blocks.push(
        <h4 key={`h-${blocks.length}`} className="font-semibold text-foreground">
          {renderInline(heading[2])}
        </h4>
      );
      continue;
    }

    blocks.push(
      <p key={`p-${blocks.length}`} className="text-foreground/90">
        {renderInline(line)}
      </p>
    );
  }

  flushBullets();

  return <div className="flex flex-col gap-2">{blocks}</div>;
}

// Matches, in order: **bold**, `code`, [text](url), and bare http(s) URLs.
const INLINE_PATTERN = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))|(https?:\/\/\S+)/g;

function renderInline(text: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  INLINE_PATTERN.lastIndex = 0;
  while ((match = INLINE_PATTERN.exec(text)) != null) {
    if (match.index > last)
      nodes.push(<Fragment key={key++}>{text.slice(last, match.index)}</Fragment>);

    if (match[2] != null) {
      nodes.push(<strong key={key++} className="font-semibold text-foreground">{match[2]}</strong>);
    } else if (match[4] != null) {
      nodes.push(
        <code key={key++} className="rounded bg-default px-1 py-0.5 font-mono text-[0.85em]">
          {match[4]}
        </code>
      );
    } else if (match[6] != null) {
      nodes.push(<ExternalLink key={key++} href={match[7]}>{match[6]}</ExternalLink>);
    } else if (match[8] != null) {
      nodes.push(<ExternalLink key={key++} href={match[8]}>{shortenUrl(match[8])}</ExternalLink>);
    }

    last = INLINE_PATTERN.lastIndex;
  }

  if (last < text.length)
    nodes.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);

  return nodes;
}

/** Drops the scheme and any trailing slash so bare URLs read less noisily. */
function shortenUrl(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** A link that opens in the system browser rather than navigating the webview. */
function ExternalLink({ href, children }: { href: string, children: React.ReactNode }) {
  return (
    <a
      href={href}
      onClick={e => { e.preventDefault(); open(href).catch(() => {}); }}
      className="text-primary underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  );
}
