"use client";

import { useState } from "react";

type Props = {
  text: string;
  title: string;
  ariaLabel: string;
  copiedLabel: string;
  className?: string;
  iconSize?: number;
};

async function writeClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

function CopyIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="9"
        y="9"
        width="11"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M5 15V5a2 2 0 0 1 2-2h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CopyNameButton({
  text,
  title,
  ariaLabel,
  copiedLabel,
  className = "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-border text-muted transition-colors hover:border-brass hover:text-brass",
  iconSize = 14,
}: Props) {
  const [copied, setCopied] = useState(false);

  async function onCopy(e: React.MouseEvent | React.PointerEvent) {
    e.stopPropagation();
    await writeClipboard(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <span className="relative shrink-0">
      <button
        type="button"
        onClick={onCopy}
        onPointerDown={(e) => e.stopPropagation()}
        title={title}
        aria-label={ariaLabel}
        className={className}
      >
        {copied ? <CheckIcon size={iconSize} /> : <CopyIcon size={iconSize} />}
      </button>
      {copied && (
        <p className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 whitespace-nowrap text-[10px] leading-none text-profit">
          {copiedLabel}
        </p>
      )}
    </span>
  );
}
