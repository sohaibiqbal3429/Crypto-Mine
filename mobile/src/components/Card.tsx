import React, { PropsWithChildren } from 'react';
import { View, StyleSheet, ViewStyle, Text } from 'react-native';
import { colors, spacing } from '../styles/theme';

interface CardProps {
  title?: string;
  style?: ViewStyle;
}

export const Card: React.FC<PropsWithChildren<CardProps>> = ({ children, style, title }) => {
  return (
    <View style={[styles.card, style]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0f172a',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    marginVertical: spacing.sm,
    backdropFilter: 'blur(18px)'
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
    letterSpacing: 0.3
  }
});
