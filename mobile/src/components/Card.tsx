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
    borderRadius: 12,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginVertical: spacing.sm
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm
  }
});
