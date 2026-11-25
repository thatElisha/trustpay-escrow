'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Project } from '@/types';
import { downloadReceiptPdf } from '@/lib/receipt-generator';
import { getStellarExplorerUrl } from '@/lib/soroban';

export type ProjectActionGroup = 'general' | 'financial' | 'danger';

export interface ProjectActionItem {
  id: string;
  label: string;
  icon: string;
  group: ProjectActionGroup;
  onSelect: () => void;
  disabled?: boolean;
  /** Short reason shown as a tooltip when the item is disabled. */
  disabledReason?: string;
}

const GROUP_LABELS: Record<ProjectActionGroup, string> = {
  general: 'General',
  financial: 'Financial',
  danger: 'Danger zone',
};

const GROUP_ORDER: ProjectActionGroup[] = ['general', 'financial', 'danger'];

export function groupProjectActions(
  items: ProjectActionItem[]
): Array<{ group: ProjectActionGroup; label: string; items: ProjectActionItem[] }> {
  return GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    items: items.filter((item) => item.group === group),
  })).filter((section) => section.items.length > 0);
}

/** Downloads a PDF settlement summary for the project's current state. */
export async function exportProjectPdf(project: Project): Promise<void> {
  const milestone =
    project.milestones?.find((m) => m.status === 'approved') || project.milestones?.[0];
  const verificationId = project.tx_hash || project.contract_id || project.id;
  await downloadReceiptPdf({
    projectTitle: project.title,
    milestoneTitle: milestone?.title || 'Project Summary',
    milestoneIndex: milestone?.milestone_index,
    amount: Number(milestone?.amount ?? project.budget ?? 0),
    token: project.token || 'USDC',
    clientAddress: project.client_address,
    freelancerAddress: project.freelancer_address,
    txHash: project.tx_hash,
    closedAt: project.deadline || project.created_at || new Date().toISOString(),
    explorerUrl: getStellarExplorerUrl(verificationId, project.tx_hash ? 'tx' : 'contract'),
  });
}

export interface ProjectActionsDropdownProps {
  project: Project;
  onView?: () => void;
  /** Overrides the default "copy project link" behaviour. */
  onShare?: () => void;
  /** Overrides the default PDF export. */
  onExport?: () => void;
  /** Opens the contract in the explorer by default when the project has a contract / on-chain id. */
  onViewContract?: () => void;
  /** Danger actions are only rendered when a handler is supplied. */
  onDispute?: () => void;
  onCancel?: () => void;
  disputeDisabledReason?: string;
  cancelDisabledReason?: string;
  className?: string;
}

export function ProjectActionsDropdown({
  project,
  onView,
  onShare,
  onExport,
  onViewContract,
  onDispute,
  onCancel,
  disputeDisabledReason,
  cancelDisabledReason,
  className = '',
}: ProjectActionsDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const handleShare = useCallback(async () => {
    const link = `${window.location.origin}/projects/${project.id}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Project link copied to clipboard');
    } catch {
      toast.error('Could not copy the project link');
    }
  }, [project.id]);

  const handleExport = useCallback(async () => {
    try {
      await exportProjectPdf(project);
      toast.success('Project summary exported as PDF');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not export the PDF');
    }
  }, [project]);

  const hasContract = Boolean(project.contract_id || project.project_id_onchain != null);
  const handleViewContract = useCallback(() => {
    if (!project.contract_id) return;
    window.open(getStellarExplorerUrl(project.contract_id, 'contract'), '_blank', 'noopener,noreferrer');
  }, [project.contract_id]);

  const items: ProjectActionItem[] = [
    ...(onView
      ? [{ id: 'view', label: 'View project', icon: '👁️', group: 'general' as const, onSelect: onView }]
      : []),
    {
      id: 'share',
      label: 'Share link',
      icon: '🔗',
      group: 'general',
      onSelect: onShare || (() => void handleShare()),
    },
    {
      id: 'export',
      label: 'Export PDF',
      icon: '📄',
      group: 'financial',
      onSelect: onExport || (() => void handleExport()),
    },
    {
      id: 'contract',
      label: 'View contract',
      icon: '⛓️',
      group: 'financial',
      onSelect: onViewContract || handleViewContract,
      disabled: !onViewContract && !project.contract_id,
      disabledReason: hasContract ? 'Contract address not available yet' : 'No contract deployed yet',
    },
    ...(onDispute
      ? [
          {
            id: 'dispute',
            label: 'Raise dispute',
            icon: '⚖️',
            group: 'danger' as const,
            onSelect: onDispute,
            disabled: Boolean(disputeDisabledReason),
            disabledReason: disputeDisabledReason,
          },
        ]
      : []),
    ...(onCancel
      ? [
          {
            id: 'cancel',
            label: 'Cancel project',
            icon: '🛑',
            group: 'danger' as const,
            onSelect: onCancel,
            disabled: Boolean(cancelDisabledReason),
            disabledReason: cancelDisabledReason,
          },
        ]
      : []),
  ];
  const sections = groupProjectActions(items);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  // Focus the first enabled item when the menu opens
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])')?.focus();
  }, [open]);

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const enabled = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') || []
    );
    if (enabled.length === 0) return;
    const index = enabled.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | null = null;
    if (event.key === 'ArrowDown') next = (index + 1) % enabled.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + enabled.length) % enabled.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = enabled.length - 1;
    else if (event.key === 'Tab') {
      setOpen(false);
      return;
    }
    if (next !== null) {
      event.preventDefault();
      enabled[next].focus();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block text-left ${className}`}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        data-testid="project-actions-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Actions for ${project.title}`}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#333338] bg-[#232326] text-lg leading-none text-[#e4e4e7] transition-colors hover:bg-[#2d2d33] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <span aria-hidden="true">⋯</span>
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Project actions"
          data-testid="project-actions-menu"
          onKeyDown={handleMenuKeyDown}
          className="animate-menu-fade-in absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-[#333338] bg-[#18181c] py-1 shadow-2xl shadow-black/50"
        >
          {sections.map((section, sectionIndex) => (
            <div
              key={section.group}
              role="group"
              aria-label={section.label}
              className={sectionIndex > 0 ? 'mt-1 border-t border-[#27272a] pt-1' : ''}
            >
              <div
                className={`px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider ${
                  section.group === 'danger' ? 'text-red-400/80' : 'text-[#71717a]'
                }`}
              >
                {section.label}
              </div>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  data-testid={`project-action-${item.id}`}
                  disabled={item.disabled}
                  title={item.disabled ? item.disabledReason : undefined}
                  onClick={() => {
                    close(false);
                    item.onSelect();
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
                    item.group === 'danger'
                      ? 'text-red-300 hover:bg-red-500/10 focus:bg-red-500/10'
                      : 'text-[#e4e4e7] hover:bg-[#27272a] focus:bg-[#27272a]'
                  }`}
                >
                  <span aria-hidden="true" className="w-4 text-center">
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectActionsDropdown;
