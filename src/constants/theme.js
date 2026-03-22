import { createContext, useContext } from 'react';
import { lightColors } from './colors';

export const ThemeContext = createContext({
  colors: lightColors,
  isDark: false,
  toggleDarkMode: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}