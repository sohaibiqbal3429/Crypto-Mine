import React from 'react';
import { View, Text, StyleSheet, TextInput, Button } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Card } from '../components/Card';
import { colors, spacing, typography } from '../styles/theme';
import * as supportApi from '../services/api/supportApi';
import { useToast } from '../components/ToastProvider';

interface SupportForm {
  subject: string;
  message: string;
}

const schema = yup.object().shape({
  subject: yup.string().required('Subject is required'),
  message: yup.string().required('Message is required').min(10, 'Please add more details')
});

const SupportScreen = () => {
  const { control, handleSubmit, formState, reset } = useForm<SupportForm>({
    resolver: yupResolver(schema),
    defaultValues: { subject: '', message: '' }
  });
  const { errors, isSubmitting } = formState;
  const { show } = useToast();

  const onSubmit = async (values: SupportForm) => {
    try {
      await supportApi.createTicket(values.subject, values.message);
      show('Ticket submitted', 'success');
      reset();
    } catch (error: any) {
      show(error?.message ?? 'Unable to submit ticket', 'error');
    }
  };

  return (
    <View style={styles.container}>
      <Card title="Support Ticket">
        <View style={styles.field}>
          <Text style={styles.label}>Subject</Text>
          <Controller
            control={control}
            name="subject"
            render={({ field: { onChange, value } }) => (
              <TextInput style={styles.input} value={value} onChangeText={onChange} placeholder="Subject" />
            )}
          />
          {errors.subject && <Text style={styles.error}>{errors.subject.message}</Text>}
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Message</Text>
          <Controller
            control={control}
            name="message"
            render={({ field: { onChange, value } }) => (
              <TextInput
                style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]}
                value={value}
                onChangeText={onChange}
                placeholder="Describe your issue"
                multiline
              />
            )}
          />
          {errors.message && <Text style={styles.error}>{errors.message.message}</Text>}
        </View>
        <Button title={isSubmitting ? 'Submitting...' : 'Submit Ticket'} onPress={handleSubmit(onSubmit)} disabled={isSubmitting} />
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  field: { marginBottom: spacing.md },
  label: { color: colors.text, marginBottom: spacing.xs, fontSize: typography.body },
  input: {
    borderWidth: 1,
    borderColor: colors.textMuted,
    borderRadius: 10,
    padding: spacing.md,
    color: colors.text
  },
  error: { color: colors.error, marginTop: spacing.xs }
});

export default SupportScreen;
