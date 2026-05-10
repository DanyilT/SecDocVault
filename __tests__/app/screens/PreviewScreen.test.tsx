import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { PreviewScreen } from '../../../src/screens/PreviewScreen';

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(async () => 'base64data'),
}));

jest.mock('react-native-fs', () => ({
  writeFile: jest.fn(async () => {}),
  DocumentDirectoryPath: '/doc',
  DownloadDirectoryPath: '/download',
}));

jest.mock('react-native-heroicons/solid', () => ({
  ArrowDownTrayIcon: () => null,
  CloudArrowDownIcon: () => null,
  CloudArrowUpIcon: () => null,
  InformationCircleIcon: () => null,
  KeyIcon: () => null,
  MinusCircleIcon: () => null,
  ShareIcon: () => null,
  TrashIcon: () => null,
  DocumentArrowDownIcon: () => null,
}));

jest.mock('../../../src/components/ui', () => {
  const React = require('react');
  return {
    PrimaryButton: (props: any) => React.createElement('PrimaryButton', props),
  };
});

jest.mock('../../../src/components/CensoredImageView', () => ({
  CensoredImageView: () => null,
}));

jest.mock('../../../src/components/CensorToggle', () => ({
  CensorToggle: () => null,
}));

describe('PreviewScreen', () => {
  const mockDoc = {
    id: 'doc1',
    name: 'Test Document',
    size: '10 KB',
    uploadedAt: '2023-01-01',
    hash: 'hash123',
    owner: 'user1',
    references: [{ source: 'local', order: 0, type: 'image/png' }],
    recoverable: true,
  };

  const defaultProps = {
    selectedDoc: mockDoc,
    previewFileOrder: 0,
    previewImageUri: null,
    previewStatus: '',
    isDecrypting: false,
    isCurrentFileDecrypted: false,
    isGuest: false,
    canShareDocument: true,
    canSaveOfflineDocument: true,
    hasLocalCopy: true,
    hasFirebaseCopy: true,
    keyBackupEnabled: true,
    currentUserId: 'user1',
    onDecrypt: jest.fn(async () => {}),
    onExport: jest.fn(async () => {}),
    onSelectFile: jest.fn(),
    onShare: jest.fn(),
    onSaveOffline: jest.fn(async () => {}),
    onSaveToFirebase: jest.fn(async () => {}),
    onDeleteLocal: jest.fn(async () => {}),
    onDeleteFromFirebase: jest.fn(async () => {}),
    onToggleRecovery: jest.fn(async () => {}),
    onDeclineIncomingShare: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders document name and details', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<PreviewScreen {...defaultProps} />);
    });
    expect(renderer!.root.findByProps({ children: 'Test Document' })).toBeTruthy();
    const sizeText = renderer!.root.findAll(el => 
      el.children && el.children.some(c => typeof c === 'string' && c.includes('Stored Size:'))
    );
    expect(sizeText.length).toBeGreaterThan(0);
  });

  it('calls onDecrypt when decrypt area is pressed', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<PreviewScreen {...defaultProps} />);
    });
    const decryptPressable = renderer!.root.findByProps({ testID: 'decrypt-pressable' });
    act(() => {
      decryptPressable.props.onPress();
    });
    expect(defaultProps.onDecrypt).toHaveBeenCalled();
  });

  it('calls onExport when export button is pressed', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<PreviewScreen {...defaultProps} />);
    });
    const exportBtn = renderer!.root.findByProps({ label: 'Export' });
    act(() => {
      exportBtn.props.onPress();
    });
    expect(defaultProps.onExport).toHaveBeenCalled();
  });

  it('shows "Delete Offline" when local copy exists', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<PreviewScreen {...defaultProps} />);
    });
    expect(renderer!.root.findByProps({ label: 'Delete Offline' })).toBeTruthy();
  });

  it('calls onToggleRecovery when key backup button is pressed', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<PreviewScreen {...defaultProps} />);
    });
    const toggleBtn = renderer!.root.findByProps({ label: 'Disable Key Backup for this Doc' });
    act(() => {
      toggleBtn.props.onPress();
    });
    expect(defaultProps.onToggleRecovery).toHaveBeenCalledWith(mockDoc, false);
  });
});
