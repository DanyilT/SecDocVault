/**
 * app/controllers/useAppControllerState.ts
 *
 * Local state hook used by the app controller. Centralizes many piece of
 * UI state and persistence keys so the `useAppController` can compose them
 * and keep implementation details hidden from presentation components.
 */

import { useRef, useState } from 'react';
import { Animated } from 'react-native';

import { UploadableDocumentDraft } from '../../services/documentVault';
import { AuthMode, VaultDocument } from '../../types/vault';

/**
 * useAppControllerState
 *
 * Local state hook used by the app controller. Centralizes UI state variables
 * and animation values so the controller can compose them into props for the
 * presentation layer.
 *
 * @returns object containing state values and setter functions used by the controller
 */
export function useAppControllerState() {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [accessMode, setAccessMode] = useState<'login' | 'guest'>('login');
  const [showCompleteAuthSetup, setShowCompleteAuthSetup] = useState(false);
  const [isCompletingAuthFlow, setIsCompletingAuthFlow] = useState(false);
  const [authCredentialSnapshot, setAuthCredentialSnapshot] = useState<{ email: string; password: string } | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailVerifiedForRegistration, setEmailVerifiedForRegistration] = useState(false);
  const [verificationLinkInput, setVerificationLinkInput] = useState('');
  const [verificationCooldown, setVerificationCooldown] = useState(0);
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<VaultDocument | null>(null);
  const [backupCloud, setBackupCloud] = useState(true);
  const [backupLocal, setBackupLocal] = useState(false);
  const [backupStatus, setBackupStatus] = useState('No backup running');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [pendingUploadDraft, setPendingUploadDraft] = useState<UploadableDocumentDraft | null>(null);
  const [pendingUploadName, setPendingUploadName] = useState('Document');
  const [pendingUploadDescription, setPendingUploadDescription] = useState('');
  const [pendingUploadRecoverable, setPendingUploadRecoverable] = useState(false);
  const [pendingUploadToCloud, setPendingUploadToCloud] = useState(false);
  const [pendingUploadAlsoSaveLocal, setPendingUploadAlsoSaveLocal] = useState(false);
  const [pendingUploadPreviewIndex, setPendingUploadPreviewIndex] = useState(0);
  const [showUploadDiscardWarning, setShowUploadDiscardWarning] = useState(false);
  const [dontShowUploadDiscardWarningAgain, setDontShowUploadDiscardWarningAgain] = useState(false);
  const [isVaultLocked, setIsVaultLocked] = useState(true);
  const [hasUnlockedThisLaunch, setHasUnlockedThisLaunch] = useState(false);
  const [isTransitioningToAuth, setIsTransitioningToAuth] = useState(false);
  const [accountStatus, setAccountStatus] = useState('');
  const [pendingNewEmail, setPendingNewEmail] = useState('');
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [guestAccountExists, setGuestAccountExists] = useState(false);

  const transitionOpacity = useRef(new Animated.Value(1)).current;
  const transitionTranslateY = useRef(new Animated.Value(0)).current;

  return {
    authMode,
    setAuthMode,
    accessMode,
    setAccessMode,
    showCompleteAuthSetup,
    setShowCompleteAuthSetup,
    isCompletingAuthFlow,
    setIsCompletingAuthFlow,
    authCredentialSnapshot,
    setAuthCredentialSnapshot,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    emailVerifiedForRegistration,
    setEmailVerifiedForRegistration,
    verificationLinkInput,
    setVerificationLinkInput,
    verificationCooldown,
    setVerificationCooldown,
    documents,
    setDocuments,
    selectedDoc,
    setSelectedDoc,
    backupCloud,
    setBackupCloud,
    backupLocal,
    setBackupLocal,
    backupStatus,
    setBackupStatus,
    isUploading,
    setIsUploading,
    uploadStatus,
    setUploadStatus,
    pendingUploadDraft,
    setPendingUploadDraft,
    pendingUploadName,
    setPendingUploadName,
    pendingUploadDescription,
    setPendingUploadDescription,
    pendingUploadRecoverable,
    setPendingUploadRecoverable,
    pendingUploadToCloud,
    setPendingUploadToCloud,
    pendingUploadAlsoSaveLocal,
    setPendingUploadAlsoSaveLocal,
    pendingUploadPreviewIndex,
    setPendingUploadPreviewIndex,
    showUploadDiscardWarning,
    setShowUploadDiscardWarning,
    dontShowUploadDiscardWarningAgain,
    setDontShowUploadDiscardWarningAgain,
    isVaultLocked,
    setIsVaultLocked,
    hasUnlockedThisLaunch,
    setHasUnlockedThisLaunch,
    isTransitioningToAuth,
    setIsTransitioningToAuth,
    accountStatus,
    setAccountStatus,
    pendingNewEmail,
    setPendingNewEmail,
    authNotice,
    setAuthNotice,
    guestAccountExists,
    setGuestAccountExists,
    transitionOpacity,
    transitionTranslateY,
  };
}
