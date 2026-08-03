import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { PreviewScreen } from '../../../src/screens';

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
  MusicalNoteIcon: () => null,
  PauseIcon: () => null,
  PlayIcon: () => null,
  ShareIcon: () => null,
  TrashIcon: () => null,
  DocumentArrowDownIcon: () => null,
  DocumentIcon: () => null,
  DocumentTextIcon: () => null,
  PhotoIcon: () => null,
  PresentationChartBarIcon: () => null,
  TableCellsIcon: () => null,
  FilmIcon: () => null,
}));

jest.mock('react-native-pdf', () => 'Pdf');

jest.mock('react-native-video', () => 'Video');

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
    references: [{ source: 'local' as const, order: 0, type: 'image/png', name: 'image.png', size: 5120 }],
    recoverable: true,
  };

  const defaultProps = {
    selectedDoc: mockDoc,
    previewFileOrder: 0,
    previewImageUri: null,
    previewPdfPath: null,
    previewVideoPath: null,
    previewAudioPath: null,
    previewText: null,
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

  it('renders a video player when previewVideoPath is set', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <PreviewScreen
          {...defaultProps}
          isCurrentFileDecrypted
          previewVideoPath="file:///tmp/preview-1.mp4"
        />,
      );
    });
    const video = renderer!.root.findAll(el => el.props.source?.uri === 'file:///tmp/preview-1.mp4');
    expect(video.length).toBeGreaterThan(0);
  });

  it('renders an audio player and toggles play/pause when previewAudioPath is set', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <PreviewScreen
          {...defaultProps}
          isCurrentFileDecrypted
          previewAudioPath="file:///tmp/preview-1.mp3"
        />,
      );
    });
    const findAudioElement = () =>
      renderer!.root.findAll(el => el.props.source?.uri === 'file:///tmp/preview-1.mp3')[0];
    expect(findAudioElement().props.paused).toBe(true);

    const playButton = renderer!.root.findByProps({ accessibilityLabel: 'Play audio' });
    act(() => {
      playButton.props.onPress();
    });

    expect(findAudioElement().props.paused).toBe(false);
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
