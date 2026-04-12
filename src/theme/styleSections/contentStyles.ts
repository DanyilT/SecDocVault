/**
 * theme/styleSections/contentStyles.ts
 *
 * Content focused style tokens (cards, labels, lists) used by screens.
 */

export const contentStyles = {
  pageTitle: {
    color: '#f9fafb',
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#111827',
    gap: 6,
  },
  cardTitle: {
    color: '#f9fafb',
    fontSize: 16,
    fontWeight: '700',
  },
  cardMeta: {
    color: '#9ca3af',
    fontSize: 13,
  },
  cardActions: {
    flexDirection: 'row' as const,
    gap: 10,
    marginTop: 6,
  },
  primaryButton: {
    marginTop: 4,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  primaryButtonDisabled: {
    backgroundColor: '#334155',
  },
  primaryButtonDanger: {
    backgroundColor: '#b91c1c',
  },
  primaryButtonText: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 15,
  },
  primaryButtonTextOutline: {
    color: '#93c5fd',
  },
  primaryButtonContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: '#cbd5e1',
    fontWeight: '600',
  },
  previewLabel: {
    color: '#93c5fd',
    fontWeight: '700',
    fontSize: 13,
  },
  hashBlock: {
    color: '#93c5fd',
    fontFamily: 'Courier',
    backgroundColor: '#111827',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    padding: 12,
  },
  previewText: {
    color: '#d1d5db',
    fontSize: 14,
  },
  previewImage: {
    width: '100%',
    height: 260,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111827',
  },
  backupStatus: {
    color: '#93c5fd',
    fontSize: 14,
    marginTop: 6,
  },
  previewActionsWrap: {
    marginTop: 6,
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  previewActionButton: {
    marginTop: 0,
    flexGrow: 1,
    minWidth: 150,
  },
  footerActions: {
    marginTop: 4,
  },
  settingsCardGap: {
    gap: 10,
  },
  settingsStatus: {
    color: '#cbd5e1',
    fontSize: 14,
  },
  settingsNote: {
    color: '#9ca3af',
    fontSize: 13,
  },
};
