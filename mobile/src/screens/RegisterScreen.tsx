import React from 'react';
import { View, Text, StyleSheet, TextInput, Button } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { colors, spacing, typography } from '../styles/theme';
import { useToast } from '../components/ToastProvider';
import * as authApi from '../services/api/authApi';

interface RegisterForm {
  email: string;
  password: string;
}

const schema = yup.object().shape({
  email: yup.string().required('Email is required').email('Invalid email'),
  password: yup.string().required('Password is required').min(6, 'At least 6 characters')
});

const RegisterScreen = () => {
  const { control, handleSubmit, formState } = useForm<RegisterForm>({
    resolver: yupResolver(schema),
    defaultValues: { email: '', password: '' }
  });
  const { errors, isSubmitting } = formState;
  const { show } = useToast();

  const onSubmit = async (values: RegisterForm) => {
    try {
      await authApi.register(values.email, values.password);
      show('Account created, you can now log in.', 'success');
    } catch (error: any) {
      show(error?.message ?? 'Registration failed', 'error');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create account</Text>
      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={onChange}
              value={value}
            />
          )}
        />
        {errors.email && <Text style={styles.error}>{errors.email.message}</Text>}
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Password</Text>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              onChangeText={onChange}
              value={value}
            />
          )}
        />
        {errors.password && <Text style={styles.error}>{errors.password.message}</Text>}
      </View>
      <Button title={isSubmitting ? 'Submitting...' : 'Register'} onPress={handleSubmit(onSubmit)} disabled={isSubmitting} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background, justifyContent: 'center' },
  title: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '700',
    marginBottom: spacing.xl,
    textAlign: 'center'
  },
  field: {
    marginBottom: spacing.md
  },
  label: {
    color: colors.text,
    marginBottom: spacing.xs,
    fontSize: typography.body
  },
  input: {
    borderWidth: 1,
    borderColor: colors.textMuted,
    borderRadius: 10,
    padding: spacing.md,
    color: colors.text
  },
  error: {
    color: colors.error,
    marginTop: spacing.xs
  }
});

export default RegisterScreen;
