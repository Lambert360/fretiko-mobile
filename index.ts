import { registerRootComponent } from 'expo';

// Register the background notification task before the app root so the
// headless task is available when an Android call push arrives.
import './src/services/callBackgroundTask';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
