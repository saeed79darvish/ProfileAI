/**
 * Single source of truth for ApplyPilot status mapping (DB ↔ UI).
 *
 * The DB has fine-grained lifecycle states (scouting, pending, preparing,
 * prepared, approved, submitting, submitted, rejected, needs_attention,
 * failed, error). The UI buckets these into four user-facing states:
 *
 *   scouting/pending/preparing/prepared → 'pending'   (still in queue)
 *   approved/submitting/submitted       → 'approved'  (moving toward sent)
 *   rejected                            → 'rejected'
 *   needs_attention/failed/error        → 'needs_attention'
 *                                         (UI shows finish-manually card)
 */

const UI_STATUS_TO_DB = Object.freeze({
  pending: ['prepared', 'preparing', 'pending', 'scouting'],
  approved: ['approved', 'submitting', 'submitted'],
  rejected: ['rejected'],
  needs_attention: ['needs_attention', 'failed', 'error'],
});

function mapStatusForUI(status) {
  if (UI_STATUS_TO_DB.pending.includes(status)) return 'pending';
  if (UI_STATUS_TO_DB.approved.includes(status)) return 'approved';
  if (status === 'rejected') return 'rejected';
  if (UI_STATUS_TO_DB.needs_attention.includes(status)) return 'needs_attention';
  return 'pending';
}

module.exports = { mapStatusForUI, UI_STATUS_TO_DB };
