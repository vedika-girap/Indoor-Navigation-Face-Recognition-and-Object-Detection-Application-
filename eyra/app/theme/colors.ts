/**
 * Centralized Color Theme
 * Use this throughout the app for consistent styling
 */

export const AppColors = {
  // Background colors
  background: '#E8F0F2',
  cardBackground: '#FFFFFF',
  overlayBackground: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',
  
  // Primary brand colors
  primary: '#20639B',
  primaryLight: '#4A90E2',
  primaryDark: '#2F5061',
  
  // Secondary colors
  secondary: '#A3D2CA',
  secondaryLight: '#D6DBD2',
  secondaryDark: '#7B9EA8',
  
  // Accent colors
  accent: '#7B68EE',
  accentLight: '#F8F2F7',
  
  // Functional colors
  success: '#50C878',
  successLight: '#4CAF50',
  warning: '#FF9800',
  warningLight: '#FFB74D',
  error: '#E74C3C',
  errorLight: '#F44336',
  info: '#4A90E2',
  
  // Text colors
  textPrimary: '#20639B',
  textSecondary: '#395B64',
  textTertiary: '#7F8C8D',
  textLight: '#FFFFFF',
  textDark: '#2C3E50',
  textDisabled: '#B0BEC5',
  
  // Button colors
  buttonPrimary: '#A3D2CA',
  buttonSecondary: '#4A90E2',
  buttonSuccess: '#50C878',
  buttonWarning: '#FF9800',
  buttonDanger: '#E74C3C',
  buttonDisabled: '#c5dacf',
  
  // Border colors
  border: '#E0E6ED',
  borderDark: '#2F5061',
  borderLight: '#D6DBD2',
  
  // Special UI colors
  placeholder: '#D6DBD2',
  shadow: '#000000',
  transparent: 'transparent',
  
  // Detection/Recognition colors
  detectionBox: 'rgba(74, 144, 226, 0.3)',
  detectionBoxBorder: '#4A90E2',
  detectionLabel: 'rgba(74, 144, 226, 0.95)',
  detectionText: '#FFFFFF',
  
  // Navigation colors
  navigationActive: '#50C878',
  navigationInactive: '#E74C3C',
  navigationBackground: 'rgba(0, 0, 0, 0.7)',
  
  // Status indicators
  online: '#4CAF50',
  offline: '#FF9800',
  cached: '#4CAF50',
  loading: '#4A90E2',
};

/**
 * Opacity helpers
 */
export const withOpacity = (color: string, opacity: number): string => {
  // Simple opacity helper - you can enhance this
  return `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
};

/**
 * Theme object for easy access
 */
export const Theme = {
  colors: AppColors,
  
  // Common spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 30,
  },
  
  // Common border radius
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 15,
    xl: 20,
    xxl: 30,
    round: 9999,
  },
  
  // Common font sizes
  fontSize: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 24,
    xxxl: 28,
  },
  
  // Common font weights
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export default Theme;
