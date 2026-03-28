/**
 * @format
 */

import { install } from 'react-native-quick-crypto';
install(); // Overrides global.Buffer and global.crypto
import { AppRegistry } from 'react-native';
import App from './src/nav/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
