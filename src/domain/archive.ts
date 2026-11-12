/**
 * Why a vehicle is archived (no longer in use). Keys are persisted in `vehicles.archived_reason`:
 * never rename them, add new ones.
 */
export interface ArchiveReason {
  key: string;
  label: string;
  icon: string;
}

export const ARCHIVE_REASONS: readonly ArchiveReason[] = [
  { key: 'venta', label: 'Venta', icon: 'handshake-outline' },
  { key: 'perdida', label: 'Pérdida', icon: 'map-marker-question-outline' },
  { key: 'robo', label: 'Robo', icon: 'shield-alert-outline' },
  { key: 'cedido', label: 'Cedido', icon: 'account-arrow-right-outline' },
  { key: 'embargado', label: 'Embargado', icon: 'gavel' },
  { key: 'siniestro', label: 'Siniestro (destrucción total)', icon: 'car-emergency' },
  { key: 'baja', label: 'Baja / desguace', icon: 'car-off' },
  { key: 'otro', label: 'Otro', icon: 'dots-horizontal' },
];

/** Label of a stored reason; archives made before reasons existed have none. */
export function archiveReasonLabel(key: string | null | undefined): string {
  return ARCHIVE_REASONS.find((r) => r.key === key)?.label ?? 'Sin motivo';
}

export function archiveReasonIcon(key: string | null | undefined): string {
  return ARCHIVE_REASONS.find((r) => r.key === key)?.icon ?? 'archive-outline';
}
