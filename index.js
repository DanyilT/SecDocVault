/**
 * @format
 */

import {install} from 'react-native-quick-crypto';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

install();

AppRegistry.registerComponent(appName, () => App);
