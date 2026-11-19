import { Milestone, Project } from '@/types';

export interface CalendarEventInput {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start: string | Date;
  end?: string | Date;
  url?: string;
}

function toDate(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function formatIcsDate(value: string | Date): string {
  return toDate(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function foldIcsLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  for (const character of line) {
    if (current.length + 1 >= 73) {
      parts.push(current);
      current = ` ${character}`;
    } else {
      current += character;
    }
  }
  parts.push(current);
  return parts.join('\r\n');
}

function eventEnd(event: CalendarEventInput): Date {
  const start = toDate(event.start);
  const end = event.end ? toDate(event.end) : new Date(start.getTime() + 60 * 60 * 1000);
  return end.getTime() > start.getTime() ? end : new Date(start.getTime() + 60 * 60 * 1000);
}

export function getProjectUrl(project: Project): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${origin}/projects/${project.id}`;
}

export function buildMilestoneCalendarEvents(
  project: Project,
  milestones: Milestone[] = project.milestones || []
): CalendarEventInput[] {
  const projectUrl = getProjectUrl(project);
  const token = project.token || 'USDC';

  return milestones
    .filter((milestone) => Boolean(milestone.due_date))
    .sort((a, b) => new Date(a.due_date as string).getTime() - new Date(b.due_date as string).getTime())
    .map((milestone, index) => {
      const label = `Milestone ${milestone.milestone_index || index + 1}`;
      const details = [
        `${label}: ${milestone.title}`,
        `Amount: ${milestone.amount} ${token}`,
        `Project: ${project.title}`,
        `Project link: ${projectUrl}`,
      ].join('\n');

      return {
        id: `${project.id}-milestone-${milestone.milestone_index || index + 1}`,
        title: `${project.title} - ${label} Deadline`,
        description: details,
        location: projectUrl,
        start: milestone.due_date as string,
        end: milestone.due_date as string,
        url: projectUrl,
      };
    });
}

export function generateIcsContent(
  events: CalendarEventInput[],
  calendarName = 'TrustPay Escrow Milestones'
): string {
  const stamp = formatIcsDate(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TrustPay Escrow//Milestone Deadlines//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ];

  events.forEach((event) => {
    const end = eventEnd(event);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeIcsText(event.id)}@trustpay.escrow`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatIcsDate(event.start)}`,
      `DTEND:${formatIcsDate(end)}`,
      `SUMMARY:${escapeIcsText(event.title)}`
    );
    if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    if (event.url) lines.push(`URL:${escapeIcsText(event.url)}`);
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:-P1D',
      'DESCRIPTION:Milestone deadline is tomorrow',
      'END:VALARM',
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

export function buildGoogleCalendarUrl(event: CalendarEventInput): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatIcsDate(event.start)}/${formatIcsDate(eventEnd(event))}`,
    details: event.description || '',
    location: event.location || event.url || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildOutlookCalendarUrl(event: CalendarEventInput): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: toDate(event.start).toISOString(),
    enddt: eventEnd(event).toISOString(),
    body: event.description || '',
    location: event.location || event.url || '',
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function downloadIcsFile(events: CalendarEventInput[], filename: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([generateIcsContent(events)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
