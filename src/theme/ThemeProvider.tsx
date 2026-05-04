import React from 'react';
import { useColorScheme } from 'react-native';
import { ThemeContext, lightColors, darkColors } from './colors';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? darkColors : lightColors;
  return <ThemeContext.Provider value={colors}>{children}</ThemeContext.Provider>;
}
