import React from 'react';
import { Text, TextProps, StyleProp, TextStyle } from 'react-native';

interface AdaptiveTextProps extends TextProps {
  children: React.ReactNode;
  baseFontSize: number;
  minFontSize?: number;
  maxChars?: number;
  style?: StyleProp<TextStyle>;
}

/**
 * Text component that automatically reduces font size when the text exceeds
 * a character threshold, keeping names looking neat on the homescreen.
 *
 * - If text length <= maxChars: uses baseFontSize
 * - If text length > maxChars: scales down proportionally, down to minFontSize
 */
const AdaptiveText: React.FC<AdaptiveTextProps> = ({
  children,
  baseFontSize,
  minFontSize = 10,
  maxChars = 15,
  style,
  ...rest
}) => {
  const text = React.Children.toArray(children).join('');
  const length = text.length;

  let fontSize = baseFontSize;
  if (length > maxChars) {
    // Scale down proportionally: each char beyond maxChars reduces font by ~0.3
    const overflow = length - maxChars;
    fontSize = Math.max(minFontSize, baseFontSize - overflow * 0.3);
    // Round to 1 decimal place for cleaner rendering
    fontSize = Math.round(fontSize * 10) / 10;
  }

  // Merge style — ensure our computed fontSize takes priority
  const mergedStyle = [
    { fontSize },
    style,
  ];

  return (
    <Text style={mergedStyle} {...rest}>
      {children}
    </Text>
  );
};

export default AdaptiveText;
