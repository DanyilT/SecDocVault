import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { MainScreen } from '../../../src/screens/MainScreen';
import { Pressable } from 'react-native';

jest.mock('react-native-heroicons/solid', () => ({
  ArrowDownTrayIcon: () => null,
  ChevronUpIcon: () => null,
  CloudArrowDownIcon: () => null,
  CloudArrowUpIcon: () => null,
  KeyIcon: () => null,
  MinusCircleIcon: () => null,
  ShareIcon: () => null,
  TrashIcon: () => null,
}));

jest.mock('../../../src/components/ui', () => {
  const React = require('react');
  return {
    SecondaryButton: (props: any) => React.createElement('SecondaryButton', props),
    SegmentButton: (props: any) => React.createElement('SegmentButton', props),
  };
});

describe('MainScreen', () => {
  const mockDoc = {
    id: 'doc1',
    name: 'Test Document',
    size: '10 KB',
    uploadedAt: '2023-01-01',
    hash: 'hash123',
    owner: 'user1',
    references: [{ source: 'local' }],
  };

  const defaultProps = {
    documents: [],
    incomingShareDecisions: {},
    currentUserId: 'user1',
    currentUserEmail: 'user1@test.com',
    isGuest: false,
    isUploading: false,
    uploadStatus: '',
    openPreview: jest.fn(),
    openShare: jest.fn(),
    onScanAndUpload: jest.fn(),
    onPickAndUpload: jest.fn(),
    onReloadDocuments: jest.fn(async () => {}),
    onSaveOffline: jest.fn(),
    onSaveToFirebase: jest.fn(),
    onDeleteLocal: jest.fn(),
    onDeleteFromFirebase: jest.fn(),
    onExport: jest.fn(async () => {}),
    onToggleRecovery: jest.fn(async () => {}),
    keyBackupEnabled: true,
    onAcceptIncomingShare: jest.fn(),
    onDeclineIncomingShare: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders empty state when no documents', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<MainScreen {...defaultProps} />);
    });
    expect(renderer!.root.findByProps({ children: 'No documents yet' })).toBeTruthy();
  });

  it('renders document list when documents are provided', () => {
    const props = { ...defaultProps, documents: [mockDoc] };
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<MainScreen {...props} />);
    });
    expect(renderer!.root.findByProps({ children: 'Test Document' })).toBeTruthy();
  });

  it('toggles document view mode', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<MainScreen {...defaultProps} />);
    });
    const sharedWithMeBtn = renderer!.root.findByProps({ label: 'Shared with me' });
    act(() => {
      sharedWithMeBtn.props.onPress();
    });
    // Check if the banner for shared with me is rendered
    expect(renderer!.root.findByProps({ children: 'Shared with me' })).toBeTruthy();
  });

  it('opens preview when document is pressed', () => {
    const props = { ...defaultProps, documents: [mockDoc] };
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<MainScreen {...props} />);
    });
    const docCard = renderer!.root.findByProps({ testID: 'doc-card-doc1' });
    act(() => {
      docCard.props.onPress();
    });
    expect(defaultProps.openPreview).toHaveBeenCalledWith(mockDoc);
  });

  it('shows actions on long press', () => {
    const props = { ...defaultProps, documents: [mockDoc] };
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<MainScreen {...props} />);
    });
    const docCard = renderer!.root.findByProps({ testID: 'doc-card-doc1' });
    act(() => {
      docCard.props.onLongPress();
    });
    // Now "Export" action should be visible
    // Now "Export" action should be visible. In renderCompactAction it's a Text component.
    expect(renderer!.root.findByProps({ children: 'Export' })).toBeTruthy();
  });

  it('calls onPickAndUpload when upload button is pressed', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<MainScreen {...defaultProps} />);
    });
    const uploadBtn = renderer!.root.findByProps({ label: 'Upload New Document' });
    act(() => {
      uploadBtn.props.onPress();
    });
    expect(defaultProps.onPickAndUpload).toHaveBeenCalled();
  });
});
