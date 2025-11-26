import React, { createContext, useContext, useState, PropsWithChildren } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, spacing } from '../styles/theme';

interface ToastContextProps {
  show: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextProps>({ show: () => undefined });

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [message, setMessage] = useState<string | null>(null);
  const [type, setType] = useState<'success' | 'error' | 'info'>('info');
  const [opacity] = useState(new Animated.Value(0));

  const show = (text: string, toastType: 'success' | 'error' | 'info' = 'info') => {
    setMessage(text);
    setType(toastType);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true })
    ]).start(() => setMessage(null));
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {message ? (
        <Animated.View style={[styles.toast, styles[type], { opacity }]}> 
          <Text style={styles.text}>{message}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10
  },
  text: {
    color: colors.background,
    fontWeight: '600',
    textAlign: 'center'
  },
  success: {
    backgroundColor: colors.success
  },
  error: {
    backgroundColor: colors.error
  },
  info: {
    backgroundColor: colors.primary
  }
});
