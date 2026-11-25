'use client';

import { useEffect, useRef } from 'react';

export interface KeyboardShortcut {
  /** Key value as reported by KeyboardEvent.key, compared case-insensitively. */
  key: string;
  /** Requires Cmd on macOS or Ctrl elsewhere. */
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** Fire even while the user is typing in a field. Defaults to true for `mod` shortcuts. */
  allowInInput?: boolean;
  handler: (event: KeyboardEvent) => void;
}

/** Window event other components dispatch to open the command palette. */
export const OPEN_COMMAND_PALETTE_EVENT = 'trustpay:open-command-palette';

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent || '');
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable === true
  );
}

export function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut, mac = isMacPlatform()): boolean {
  if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) return false;
  const modPressed = mac ? event.metaKey : event.ctrlKey;
  if (Boolean(shortcut.mod) !== modPressed) return false;
  if (Boolean(shortcut.shift) !== event.shiftKey) return false;
  if (Boolean(shortcut.alt) !== event.altKey) return false;
  return true;
}

/** Registers global keyboard shortcuts for the lifetime of the calling component. */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled = true) {
  const ref = useRef(shortcuts);

  useEffect(() => {
    ref.current = shortcuts;
  });

  useEffect(() => {
    if (!enabled) return;
    const mac = isMacPlatform();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      for (const shortcut of ref.current) {
        if (!matchesShortcut(event, shortcut, mac)) continue;
        const allowInInput = shortcut.allowInInput ?? Boolean(shortcut.mod);
        if (!allowInInput && isTypingTarget(event.target)) continue;
        event.preventDefault();
        shortcut.handler(event);
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
