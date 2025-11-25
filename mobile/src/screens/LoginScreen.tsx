import React from 'react';
import { View, Text, StyleSheet, TextInput, Button, TouchableOpacity } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { colors, spacing, typography } from '../styles/theme';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { loginThunk } from '../store/slices/authSlice';
import { useToast } from '../components/ToastProvider';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/stacks/AuthStack';

interface LoginForm {
  email: string;
  password: string;
}

const schema = yup.object().shape({
  email: yup.string().required('Email is required').email('Invalid email'),
  password: yup.string().required('Password is required').min(6, 'At least 6 characters')
});

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { loading } = useAppSelector((state) => state.auth);
  const { show } = useToast();
  const {
    control,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginForm>({ resolver: yupResolver(schema), defaultValues: { email: '', password: '' } });

  const onSubmit = async (values: LoginForm) => {
    try {
      await dispatch(loginThunk(values)).unwrap();
      show('Logged in', 'success');
    } catch (error: any) {
      show(error?.message ?? 'Login failed', 'error');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MintMinePro</Text>
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
      <Button title={loading ? 'Signing in...' : 'Login'} onPress={handleSubmit(onSubmit)} disabled={loading} />
      <TouchableOpacity style={styles.linkContainer} onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>Create account</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
    justifyContent: 'center'
  },
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
  },
  linkContainer: {
    alignItems: 'center',
    marginTop: spacing.md
  },
  link: {
    color: colors.primary,
    fontWeight: '600'
  }
});

export default LoginScreen;
