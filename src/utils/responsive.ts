import { Dimensions, PixelRatio } from 'react-native';

const { width, height } = Dimensions.get('window');

// Base dimensions (iPhone 14 / ~390pt wide)
const BASE_WIDTH  = 390;
const BASE_HEIGHT = 844;

// Scale a size proportionally to the screen width
export const rs = (size: number) =>
  Math.round((size * Math.min(width, BASE_WIDTH)) / BASE_WIDTH);

// Scale font sizes — also accounts for system font scale setting
export const rf = (size: number) =>
  Math.round(rs(size) / PixelRatio.getFontScale());

export const screenWidth  = width;
export const screenHeight = height;
export const isSmallScreen = width < 360;
