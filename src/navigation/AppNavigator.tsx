import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors } from '../theme/colors';
import { RootStackParamList } from '../types';
import { HomeScreen } from '../screens/HomeScreen';
import { CameraScreen } from '../screens/CameraScreen';
import { ManualIDScreen } from '../screens/ManualIDScreen';
import { ConfirmationScreen } from '../screens/ConfirmationScreen';
import { NotificationSettingsScreen } from '../screens/NotificationSettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const scheme = useColorScheme();
  const c = scheme === 'dark' ? darkColors : lightColors;

  const navTheme = {
    ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(scheme === 'dark' ? DarkTheme : DefaultTheme).colors,
      background:   c.bg,
      card:         c.surface,
      text:         c.text,
      border:       c.border,
      primary:      c.accent,
      notification: c.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}
      >
        <Stack.Screen name="Home"         component={HomeScreen} />
        <Stack.Screen name="Camera"       component={CameraScreen}
          options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="ManualID"     component={ManualIDScreen} />
        <Stack.Screen name="Confirmation" component={ConfirmationScreen}
          options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen}
          options={{ animation: 'slide_from_bottom' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
