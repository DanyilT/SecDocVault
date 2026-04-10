import { VaultDocument } from '../types/vault';

export const mockDocuments: VaultDocument[] = [
  {
    id: '1',
    name: 'Passport.pdf',
    description: 'Primary identification document backup.',
    hash: 'SHA-256 4f7e8d6ad57b1b...',
    size: '1.2 MB',
    uploadedAt: '2026-03-30',
  },
  {
    id: '2',
    name: 'Tax-Statement-2025.pdf',
    description: 'Annual tax statement for fiscal year 2025.',
    hash: 'SHA-256 b8f0f7ca2ff483...',
    size: '3.8 MB',
    uploadedAt: '2026-03-22',
  },
  {
    id: '3',
    name: 'Medical-Insurance.jpg',
    description: 'Insurance policy card photo.',
    hash: 'SHA-256 29ad53e765ab02...',
    size: '980 KB',
    uploadedAt: '2026-03-15',
  },
];
