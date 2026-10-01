import React from 'react';
import { View, Text, Image } from 'react-native';

interface AppLogoProps {
  size?: 'small' | 'medium' | 'large';
  textColor?: string;
}

export function AppLogo({ size = 'medium', textColor = '#101828' }: AppLogoProps) {
  const iconSizes = {
    small: { width: 22, height: 22 },
    medium: { width: 32, height: 32 },
    large: { width: 44, height: 44 },
  };

  const textStyles = {
    small: { fontSize: 18, letterSpacing: 3 },
    medium: { fontSize: 26, letterSpacing: 4 },
    large: { fontSize: 36, letterSpacing: 5 },
  };

  const dotSizes = {
    small: { width: 4, height: 4, marginLeft: 2 },
    medium: { width: 7, height: 7, marginLeft: 3 },
    large: { width: 10, height: 10, marginLeft: 4 },
  };

  return (
    <View className="flex-row items-center justify-center" style={{ gap: 4 }}>
      <Image
        source={require('../../../assets/images/splash-icon.png')}
        style={{
          width: iconSizes[size].width,
          height: iconSizes[size].height,
          resizeMode: 'contain',
        }}
      />
      <View className="flex-row items-baseline">
        <Text
          style={{
            color: textColor,
            fontWeight: '900',
            fontSize: textStyles[size].fontSize,
            letterSpacing: textStyles[size].letterSpacing,
            marginLeft: 2,
          }}
        >
          IRLA
        </Text>
        <View
          style={{
            width: dotSizes[size].width,
            height: dotSizes[size].height,
            borderRadius: dotSizes[size].width / 2,
            backgroundColor: '#F5B942',
            marginLeft: dotSizes[size].marginLeft,
            marginBottom: 2,
          }}
        />
      </View>
    </View>
  );
}
