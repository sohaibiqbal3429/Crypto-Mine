import React from 'react';
import { View, Text, StyleSheet, TextInput, Button } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { colors, spacing, typography } from '../styles/theme';
import { Card } from '../components/Card';
import { useToast } from '../components/ToastProvider';
import * as walletApi from '../services/api/walletApi';

interface WithdrawForm {
  amount: string;
  address: string;
}

const schema = yup.object().shape({
  amount: yup.number().required('Amount is required').positive('Amount must be positive'),
  address: yup.string().required('Wallet address is required').min(6, 'Too short')
});

const WithdrawScreen = () => {
  const { control, handleSubmit, formState, reset } = useForm<WithdrawForm>({
    resolver: yupResolver(schema),
    defaultValues: { amount: '', address: '' }
  });
  const { errors, isSubmitting } = formState;
  const { show } = useToast();

  const onSubmit = async (values: WithdrawForm) => {
    try {
      await walletApi.withdraw({
        amount: Number(values.amount),
        walletAddress: values.address,
      });
      show('Withdrawal request submitted', 'success');
      reset();
    } catch (error: any) {
      show(error?.message ?? 'Failed to submit withdrawal', 'error');
    }
  };

  return (
    <View style={styles.container}>
      <Card title="Withdraw">
        <View style={styles.field}>
          <Text style={styles.label}>Amount</Text>
          <Controller
            control={control}
            name="amount"
            render={({ field: { onChange, value } }) => (
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                onChangeText={onChange}
                value={value}
              />
            )}
          />
          {errors.amount && <Text style={styles.error}>{errors.amount.message}</Text>}
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Withdraw Address</Text>
          <Controller
            control={control}
            name="address"
            render={({ field: { onChange, value } }) => (
              <TextInput
                style={styles.input}
                placeholder="Wallet address"
                placeholderTextColor={colors.textMuted}
                onChangeText={onChange}
                value={value}
                autoCapitalize="none"
              />
            )}
          />
          {errors.address && <Text style={styles.error}>{errors.address.message}</Text>}
        </View>
        <Button title={isSubmitting ? 'Submitting...' : 'Withdraw'} onPress={handleSubmit(onSubmit)} disabled={isSubmitting} />
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background
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

export default WithdrawScreen;
