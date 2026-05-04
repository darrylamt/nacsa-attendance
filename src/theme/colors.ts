import { useContext, createContext } from 'react';
import { useColorScheme } from 'react-native';

export interface ColorTokens {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentDim: string;
  accentText: string;
  warning: string;
  info: string;
  overlay: string;
}

export const lightColors: ColorTokens = {
  bg: '#FFFFFF',
  surface: '#F5F5F5',
  surfaceRaised: '#EBEBEB',
  border: '#E0E0E0',
  text: '#111111',
  textSecondary: '#555555',
  textMuted: '#AAAAAA',
  accent: '#CC0000',
  accentDim: '#FFECEC',
  accentText: '#FFFFFF',
  warning: '#D97706',
  info: '#2563EB',
  overlay: 'rgba(0,0,0,0.5)',
};

export const darkColors: ColorTokens = {
  bg: '#0A0A0A',
  surface: '#141414',
  surfaceRaised: '#1E1E1E',
  border: '#2A2A2A',
  text: '#F0F0F0',
  textSecondary: '#8A8A8A',
  textMuted: '#4A4A4A',
  accent: '#E53935',
  accentDim: '#3D0000',
  accentText: '#FFFFFF',
  warning: '#FBBF24',
  info: '#60A5FA',
  overlay: 'rgba(0,0,0,0.7)',
};

export const ThemeContext = createContext<ColorTokens>(lightColors);

export function useColors(): ColorTokens {
  return useContext(ThemeContext);
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  full: 9999,
};

export const font = {
  xs: 11,
  sm: 13,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 40,
};
