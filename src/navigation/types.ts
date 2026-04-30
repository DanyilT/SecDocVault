import type { UploadableDocumentDraft } from '../services/documentVault';

export type AuthStackParamList = {
  IntroHero: undefined;
  Auth: { accessMode: 'login' | 'guest' };
  Unlock: undefined;
  CompleteAuthSetup: undefined;
};

export type VaultStackParamList = {
  Main: undefined;
  Preview: { docId: string };
  Upload: {
    draft: UploadableDocumentDraft;
    saveOfflineByDefault: boolean;
    recoverableByDefault: boolean;
    canUseCloud: boolean;
  };
  Share: { docId: string };
  ShareDetails: { docId: string };
  Settings: undefined;
  RecoverKeys: undefined;
  RecoveryDocs: undefined;
};
