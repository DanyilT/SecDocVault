import { StyleSheet } from 'react-native';

export const overlayStyles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(3,7,18,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  keyBackupCard: {
    width: '100%',
    maxWidth: 360,
    gap: 12,
  },
  discardCard: {
    width: '100%',
    maxWidth: 340,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  actionButtonNoTopMargin: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: 0,
  },
  actionButtonLabel: {
    textAlign: 'center',
    width: '100%',
  },
  discardWarningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  discardWarningCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#60a5fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardWarningCheckboxChecked: {
    backgroundColor: '#2563eb',
  },
  discardWarningCheckboxText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  discardWarningLabel: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 18,
    flexShrink: 1,
  },
});
