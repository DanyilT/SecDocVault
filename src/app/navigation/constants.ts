export const RECOVERY_SUB_SCREENS = ['recoverkeys', 'recoverydocs'] as const;

export type AppScreen =
  | 'main'
  | 'upload'
  | 'preview'
  | 'share'
  | 'settings'
  | 'recoverkeys'
  | 'recoverydocs'
  | 'sharedetails';

export const APP_SCREEN_TITLES: Record<AppScreen, string> = {
  main: 'Documents',
  settings: 'Settings',
  recoverkeys: 'Recover Keys',
  recoverydocs: 'Document Recovery',
  sharedetails: 'Share Details',
  preview: 'Preview Document',
  upload: 'Upload Document',
  share: 'Share Document',
};
