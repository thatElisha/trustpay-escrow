'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authFetch } from '@/lib/api';
import { bestFieldMatch, fuzzyScore } from '@/lib/fuzzy-search';
import {
  OPEN_COMMAND_PALETTE_EVENT,
  isMacPlatform,
  useKeyboardShortcuts,
} from '@/hooks/useKeyboardShortcuts';
import { useWalletStore, type ActiveRole } from '@/store/walletStore';

interface PaletteProject {
  id: string;
  title: string;
  clientAddress: string;
  status: string;
  milestones: Array<{ title: string; description: string }>;
}

interface PaletteItem {
  id: string;
  group: 'Projects' | 'Navigation' | 'Switch role' | 'Wallet';
  label: string;
  hint?: string;
  icon: string;
  keywords?: string;
  run: () => void;
}

const GROUP_ORDER: PaletteItem['group'][] = ['Projects', 'Navigation', 'Switch role', 'Wallet'];
const MAX_RESULTS = 30;

const ROLE_LABELS: Record<ActiveRole, string> = {
  client: 'Client',
  freelancer: 'Freelancer',
  arbiter: 'Arbiter',
};

function shorten(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

export function CommandPalette() {
  const router = useRouter();
  const { address, setActiveRole, disconnect } = useWalletStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [projects, setProjects] = useState<PaletteProject[]>([]);
  const [mac, setMac] = useState(false);
  const loadedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMac(isMacPlatform()), []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  }, []);

  // Cmd+K / Ctrl+K toggles the palette from any screen.
  useKeyboardShortcuts([
    {
      key: 'k',
      mod: true,
      handler: () => setOpen((v) => !v),
    },
  ]);

  // Lets the header button (or any component) open the palette.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
  }, []);

  // Load project data once, the first time the palette opens.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    if (loadedRef.current) return;
    loadedRef.current = true;

    (async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await authFetch(`${apiUrl}/api/projects?page=1&limit=100`);
        if (!res.ok) throw new Error('Failed to load projects');
        const data = await res.json();
        const list: PaletteProject[] = (Array.isArray(data.projects) ? data.projects : []).map(
          (p: any) => ({
            id: String(p.id),
            title: p.title || 'Untitled project',
            clientAddress: p.client_address || p.client_id || '',
            status: p.status || '',
            milestones: (p.milestones || []).map((m: any) => ({
              title: m.title || '',
              description: m.description || '',
            })),
          })
        );
        setProjects(list);
      } catch {
        // Allow a retry next time the palette opens.
        loadedRef.current = false;
      }
    })();
  }, [open]);

  const go = useCallback(
    (path: string) => () => {
      close();
      router.push(path);
    },
    [close, router]
  );

  const staticItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [
      { id: 'nav-home', group: 'Navigation', label: 'Go to Home', icon: '🏠', keywords: 'landing', run: go('/') },
      { id: 'nav-dashboard', group: 'Navigation', label: 'Go to Dashboard', icon: '📋', keywords: 'projects escrows', run: go('/projects') },
      { id: 'nav-create', group: 'Navigation', label: 'Create new project', icon: '➕', keywords: 'escrow new', run: go('/projects/create') },
      { id: 'nav-transactions', group: 'Navigation', label: 'View transactions', icon: '💸', keywords: 'ledger payments history', run: go('/transactions') },
      { id: 'nav-arbiter', group: 'Navigation', label: 'Open arbiter panel', icon: '⚖️', keywords: 'disputes voting', run: go('/arbiter') },
    ];

    (Object.keys(ROLE_LABELS) as ActiveRole[]).forEach((role) => {
      items.push({
        id: `role-${role}`,
        group: 'Switch role',
        label: `Switch to ${ROLE_LABELS[role]}`,
        icon: role === 'client' ? '👤' : role === 'freelancer' ? '💼' : '⚖️',
        keywords: 'role mode view',
        run: () => {
          setActiveRole(role);
          close();
          router.push('/projects');
          toast.success(`Switched to ${ROLE_LABELS[role]} view.`);
        },
      });
    });

    if (address) {
      items.push(
        {
          id: 'wallet-copy',
          group: 'Wallet',
          label: 'Copy wallet address',
          hint: shorten(address),
          icon: '📎',
          keywords: 'clipboard public key',
          run: async () => {
            close();
            try {
              await navigator.clipboard.writeText(address);
              toast.success('Wallet address copied.');
            } catch {
              toast.error('Could not copy the address.');
            }
          },
        },
        {
          id: 'wallet-disconnect',
          group: 'Wallet',
          label: 'Disconnect wallet',
          icon: '🔌',
          keywords: 'logout sign out',
          run: () => {
            close();
            disconnect();
            toast.success('Wallet disconnected.');
          },
        }
      );
    } else {
      items.push({
        id: 'wallet-connect',
        group: 'Wallet',
        label: 'Connect wallet',
        icon: '🔗',
        keywords: 'login freighter xbull albedo',
        run: go('/#wallet'),
      });
    }
    return items;
  }, [address, close, disconnect, go, router, setActiveRole]);

  const results = useMemo<Array<PaletteItem & { score: number }>>(() => {
    const q = query.trim();

    const projectItems: Array<PaletteItem & { score: number }> = [];
    for (const p of projects) {
      const fields = [
        { key: 'title', text: p.title },
        { key: 'client', text: p.clientAddress },
        ...p.milestones.flatMap((m) => [
          { key: 'milestone', text: m.title },
          { key: 'milestone', text: m.description },
        ]),
      ];
      const match = q ? bestFieldMatch(q, fields) : { score: 0, key: 'title' };
      if (!match) continue;
      projectItems.push({
        id: `project-${p.id}`,
        group: 'Projects',
        label: p.title,
        hint:
          match.key === 'client'
            ? `Client ${shorten(p.clientAddress)}`
            : match.key === 'milestone'
              ? 'Matched milestone'
              : p.status.replace('_', ' '),
        icon: '📁',
        score: match.score + 5,
        run: go(`/projects/${p.id}`),
      });
    }

    const commandItems: Array<PaletteItem & { score: number }> = [];
    for (const item of staticItems) {
      const score = q ? fuzzyScore(q, `${item.label} ${item.keywords || ''}`) : 0;
      if (score === null) continue;
      commandItems.push({ ...item, score });
    }

    // Without a query show commands first, then a short recent-projects list.
    const ordered = q
      ? [...projectItems, ...commandItems].sort((a, b) => b.score - a.score)
      : [...commandItems, ...projectItems.slice(0, 5)];

    const limited = ordered.slice(0, MAX_RESULTS);
    // Keep grouped display stable while preserving rank within each group.
    return GROUP_ORDER.flatMap((g) => limited.filter((i) => i.group === g));
  }, [projects, query, staticItems, go]);

  useEffect(() => setActiveIndex(0), [query]);

  // Keep the highlighted row visible while arrowing through results.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      results[activeIndex]?.run();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  let lastGroup = '';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[15vh] bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        data-testid="command-palette"
        onKeyDown={onKeyDown}
        className="w-full max-w-xl bg-[#18181b] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 border-b border-[#27272a]">
          <span aria-hidden className="text-[#71717a]">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects, clients, milestones, or run a command…"
            aria-label="Search commands"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-activedescendant={results[activeIndex] ? `cmd-${results[activeIndex].id}` : undefined}
            className="flex-1 bg-transparent py-4 text-sm text-white placeholder:text-[#71717a] focus:outline-none"
          />
          <kbd className="text-[10px] text-[#71717a] border border-[#3f3f46] rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        <div
          id="command-palette-list"
          ref={listRef}
          role="listbox"
          className="max-h-80 overflow-y-auto p-2"
        >
          {results.length === 0 ? (
            <p className="text-center text-sm text-[#71717a] py-8">No results for “{query}”.</p>
          ) : (
            results.map((item, index) => {
              const showHeader = item.group !== lastGroup;
              lastGroup = item.group;
              return (
                <React.Fragment key={item.id}>
                  {showHeader && (
                    <div className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#71717a]">
                      {item.group}
                    </div>
                  )}
                  <div
                    id={`cmd-${item.id}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    data-index={index}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => item.run()}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm ${
                      index === activeIndex ? 'bg-[#27272a] text-white' : 'text-[#d4d4d8]'
                    }`}
                  >
                    <span aria-hidden>{item.icon}</span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.hint && (
                      <span className="text-xs text-[#71717a] truncate max-w-[40%] capitalize">{item.hint}</span>
                    )}
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-[#27272a] text-[10px] text-[#71717a]">
          <span>↑↓ navigate · ↵ select</span>
          <span>{mac ? '⌘' : 'Ctrl'} + K to toggle</span>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
