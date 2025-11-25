import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { store } from './src/store';
import { ToastProvider } from './src/components/ToastProvider';
import { useHydrateAuth } from './src/hooks/useHydrateAuth';

const Bootstrap = () => {
  useHydrateAuth();
  return <RootNavigator />;
};

export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <NavigationContainer>
          <ToastProvider>
            <Bootstrap />
          </ToastProvider>
        </NavigationContainer>
      </SafeAreaProvider>
    </Provider>
  );
}
