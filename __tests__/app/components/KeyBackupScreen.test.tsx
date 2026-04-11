import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import { KeyBackupScreen } from '../../../src/screens';

describe('KeyBackupScreen', () => {
  test('forwards displayed passphrase to copy callback', async () => {
    const onCopyPassphrase = jest.fn(async () => undefined);

    let root: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      root = ReactTestRenderer.create(
        <KeyBackupScreen
          isGuest={false}
          isSubmitting={false}
          onBackupKeys={async () => undefined}
          onRestoreKeys={async () => undefined}
          backupStatus=""
          recoverableDocsCount={1}
          totalDocsCount={1}
          displayPassphrase="abcd1234-abcd1234-abcd1234-abcd1234-abcd1234"
          onClearPassphrase={() => undefined}
          onCopyPassphrase={onCopyPassphrase}
          onDownloadPassphrase={async () => undefined}
          onDownloadBackupFile={async () => undefined}
        />,
      );
    });

    const copyButton = root!.root.findByProps({ label: 'Copy' });
    await ReactTestRenderer.act(async () => {
      await copyButton.props.onPress();
    });

    expect(onCopyPassphrase).toHaveBeenCalledWith('abcd1234-abcd1234-abcd1234-abcd1234-abcd1234');
  });
});
