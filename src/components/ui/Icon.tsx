/**
 * BeBig 2.0 — Unified Athletic Icon System
 *
 * Cross-platform, crisp vector icon primitive powered by react-native-svg.
 * Eliminates platform-dependent Unicode emojis and renders uniform, scalable
 * athletic glyphs across iOS, Android, and Web PWA.
 */

import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Svg, {
  Path,
  Circle,
  Rect,
  Polyline,
  Line,
  Polygon,
} from 'react-native-svg';
import { useAppTheme } from '../../features/theme';

export type IconName =
  | 'home'
  | 'history'
  | 'workout'
  | 'dumbbell'
  | 'exercises'
  | 'profile'
  | 'user'
  | 'settings'
  | 'plus'
  | 'minus'
  | 'edit'
  | 'trash'
  | 'check'
  | 'chevronRight'
  | 'chevronLeft'
  | 'chevronDown'
  | 'chevronUp'
  | 'arrowLeft'
  | 'arrowRight'
  | 'arrowUp'
  | 'arrowDown'
  | 'moreVertical'
  | 'moreHorizontal'
  | 'close'
  | 'x'
  | 'trophy'
  | 'medal'
  | 'flame'
  | 'fire'
  | 'bolt'
  | 'chart'
  | 'calendar'
  | 'clock'
  | 'timer'
  | 'note'
  | 'copy'
  | 'link'
  | 'unlink'
  | 'play'
  | 'pause'
  | 'skipForward'
  | 'search'
  | 'filter'
  | 'sliders'
  | 'download'
  | 'upload';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  focused?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Icon({
  name,
  size = 22,
  color,
  strokeWidth: customStrokeWidth,
  focused = false,
  style,
  testID,
}: IconProps) {
  const { colors } = useAppTheme();

  // Active / focused icon color defaults to BeBig Signature Emerald
  const resolvedColor = color || (focused ? colors.primary : colors.textSecondary);
  const strokeWidth = customStrokeWidth ?? (focused ? 2.4 : 2);

  const renderIconPaths = () => {
    switch (name) {
      case 'home':
        return (
          <>
            <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <Polyline points="9 22 9 12 15 12 15 22" />
          </>
        );

      case 'history':
        return (
          <>
            <Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <Path d="M3 3v5h5" />
            <Path d="M12 7v5l4 2" />
          </>
        );

      case 'workout':
      case 'dumbbell':
        return <Path d="M6 5v14M18 5v14M2 9v6M22 9v6M6 12h12" />;

      case 'exercises':
        return (
          <>
            <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            <Line x1="8" y1="6" x2="16" y2="6" />
            <Line x1="8" y1="10" x2="14" y2="10" />
          </>
        );

      case 'profile':
      case 'user':
        return (
          <>
            <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <Circle cx="12" cy="7" r="4" />
          </>
        );

      case 'settings':
        return (
          <>
            <Circle cx="12" cy="12" r="3" />
            <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </>
        );

      case 'plus':
        return (
          <>
            <Line x1="12" y1="5" x2="12" y2="19" />
            <Line x1="5" y1="12" x2="19" y2="12" />
          </>
        );

      case 'minus':
        return <Line x1="5" y1="12" x2="19" y2="12" />;

      case 'edit':
        return (
          <>
            <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </>
        );

      case 'trash':
        return (
          <>
            <Polyline points="3 6 5 6 21 6" />
            <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </>
        );

      case 'check':
        return <Polyline points="20 6 9 17 4 12" />;

      case 'close':
      case 'x':
        return (
          <>
            <Line x1="18" y1="6" x2="6" y2="18" />
            <Line x1="6" y1="6" x2="18" y2="18" />
          </>
        );

      case 'chevronRight':
        return <Polyline points="9 18 15 12 9 6" />;

      case 'chevronLeft':
        return <Polyline points="15 18 9 12 15 6" />;

      case 'chevronDown':
        return <Polyline points="6 9 12 15 18 9" />;

      case 'chevronUp':
        return <Polyline points="18 15 12 9 6 15" />;

      case 'arrowLeft':
        return (
          <>
            <Line x1="19" y1="12" x2="5" y2="12" />
            <Polyline points="12 19 5 12 12 5" />
          </>
        );

      case 'arrowRight':
        return (
          <>
            <Line x1="5" y1="12" x2="19" y2="12" />
            <Polyline points="12 5 19 12 12 19" />
          </>
        );

      case 'arrowUp':
        return (
          <>
            <Line x1="12" y1="19" x2="12" y2="5" />
            <Polyline points="5 12 12 5 19 12" />
          </>
        );

      case 'arrowDown':
        return (
          <>
            <Line x1="12" y1="5" x2="12" y2="19" />
            <Polyline points="19 12 12 19 5 12" />
          </>
        );

      case 'moreVertical':
        return (
          <>
            <Circle cx="12" cy="12" r="1.5" fill={resolvedColor} />
            <Circle cx="12" cy="5" r="1.5" fill={resolvedColor} />
            <Circle cx="12" cy="19" r="1.5" fill={resolvedColor} />
          </>
        );

      case 'moreHorizontal':
        return (
          <>
            <Circle cx="12" cy="12" r="1.5" fill={resolvedColor} />
            <Circle cx="19" cy="12" r="1.5" fill={resolvedColor} />
            <Circle cx="5" cy="12" r="1.5" fill={resolvedColor} />
          </>
        );

      case 'search':
        return (
          <>
            <Circle cx="11" cy="11" r="8" />
            <Line x1="21" y1="21" x2="16.65" y2="16.65" />
          </>
        );

      case 'filter':
        return <Polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />;

      case 'sliders':
        return (
          <>
            <Line x1="4" y1="21" x2="4" y2="14" />
            <Line x1="4" y1="10" x2="4" y2="3" />
            <Line x1="12" y1="21" x2="12" y2="12" />
            <Line x1="12" y1="8" x2="12" y2="3" />
            <Line x1="20" y1="21" x2="20" y2="16" />
            <Line x1="20" y1="12" x2="20" y2="3" />
            <Line x1="1" y1="14" x2="7" y2="14" />
            <Line x1="9" y1="8" x2="15" y2="8" />
            <Line x1="17" y1="16" x2="23" y2="16" />
          </>
        );

      case 'flame':
      case 'fire':
        return (
          <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        );

      case 'bolt':
        return <Polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />;

      case 'trophy':
        return (
          <>
            <Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <Path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <Path d="M4 22h16" />
            <Path d="M10 14.66V17c0 .55-.45 1-1 1H7" />
            <Path d="M14 14.66V17c0 .55.45 1 1 1h2" />
            <Path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
          </>
        );

      case 'medal':
        return (
          <>
            <Circle cx="12" cy="8" r="6" />
            <Polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
          </>
        );

      case 'clock':
        return (
          <>
            <Circle cx="12" cy="12" r="10" />
            <Polyline points="12 6 12 12 16 14" />
          </>
        );

      case 'timer':
        return (
          <>
            <Line x1="10" y1="2" x2="14" y2="2" />
            <Line x1="12" y1="14" x2="15" y2="11" />
            <Circle cx="12" cy="14" r="8" />
          </>
        );

      case 'calendar':
        return (
          <>
            <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <Line x1="16" y1="2" x2="16" y2="6" />
            <Line x1="8" y1="2" x2="8" y2="6" />
            <Line x1="3" y1="10" x2="21" y2="10" />
          </>
        );

      case 'chart':
        return (
          <>
            <Line x1="18" y1="20" x2="18" y2="10" />
            <Line x1="12" y1="20" x2="12" y2="4" />
            <Line x1="6" y1="20" x2="6" y2="14" />
          </>
        );

      case 'note':
        return (
          <>
            <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <Polyline points="14 2 14 8 20 8" />
            <Line x1="16" y1="13" x2="8" y2="13" />
            <Line x1="16" y1="17" x2="8" y2="17" />
            <Line x1="10" y1="9" x2="8" y2="9" />
          </>
        );

      case 'copy':
        return (
          <>
            <Rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </>
        );

      case 'link':
        return (
          <>
            <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </>
        );

      case 'unlink':
        return (
          <>
            <Path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <Path d="M5.16 11.75l-1.72 1.71a5 5 0 0 0 7.07 7.07l1.72-1.71" />
            <Line x1="2" y1="2" x2="22" y2="22" />
          </>
        );

      case 'play':
        return <Polygon points="5 3 19 12 5 21 5 3" fill={resolvedColor} />;

      case 'pause':
        return (
          <>
            <Rect x="6" y="4" width="4" height="16" fill={resolvedColor} />
            <Rect x="14" y="4" width="4" height="16" fill={resolvedColor} />
          </>
        );

      case 'skipForward':
        return (
          <>
            <Polygon points="5 4 15 12 5 20 5 4" fill={resolvedColor} />
            <Line x1="19" y1="5" x2="19" y2="19" />
          </>
        );

      case 'download':
        return (
          <>
            <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <Polyline points="7 10 12 15 17 10" />
            <Line x1="12" y1="15" x2="12" y2="3" />
          </>
        );

      case 'upload':
        return (
          <>
            <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <Polyline points="17 8 12 3 7 8" />
            <Line x1="12" y1="3" x2="12" y2="15" />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        { width: size, height: size },
        style,
      ]}
    >
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={resolvedColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {renderIconPaths()}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
