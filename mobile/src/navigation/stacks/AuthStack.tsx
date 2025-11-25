import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../../screens/LoginScreen';
import RegisterScreen from '../../screens/RegisterScreen';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Login' }} />
    <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Register' }} />
  </Stack.Navigator>
);

export default AuthStack;
