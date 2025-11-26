import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/theme';

interface IconProps {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size = 20, color = colors.text }) => {
  return <Ionicons name={name} size={size} color={color} />;
};
