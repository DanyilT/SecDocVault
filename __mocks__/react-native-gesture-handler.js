// Manual mock for react-native-gesture-handler (package not installed)
const React = require('react');
const { View } = require('react-native');

const GestureHandlerRootView = ({ children, ...props }) =>
  React.createElement(View, props, children);

module.exports = {
  GestureHandlerRootView,
  Swipeable: View,
  DrawerLayout: View,
  State: {},
  ScrollView: View,
  Slider: View,
  Switch: View,
  TextInput: View,
  ToolbarAndroid: View,
  ViewPagerAndroid: View,
  DrawerLayoutAndroid: View,
  WebView: View,
  NativeViewGestureHandler: View,
  TapGestureHandler: View,
  FlingGestureHandler: View,
  ForceTouchGestureHandler: View,
  LongPressGestureHandler: View,
  PanGestureHandler: View,
  PinchGestureHandler: View,
  RotationGestureHandler: View,
  RawButton: View,
  BaseButton: View,
  RectButton: View,
  BorderlessButton: View,
  FlatList: View,
  gestureHandlerRootHOC: jest.fn(c => c),
  Directions: {},
};

