import { type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

export interface NativeDividerProps {
  /**
   * Orientation of the divider line. Defaults to 'horizontal'.
   */
  orientation?: 'horizontal' | 'vertical';
  /**
   * Line thickness in dp/points. Defaults to hairlineWidth or 1dp.
   */
  thickness?: number;
  /**
   * Color of the divider line. Uses platform standard if omitted.
   */
  color?: ColorValue;
  /**
   * Custom style for the wrapper view.
   */
  style?: StyleProp<ViewStyle>;
  /**
   * Tailwind class name for styling margins, etc.
   */
  className?: string;
}

