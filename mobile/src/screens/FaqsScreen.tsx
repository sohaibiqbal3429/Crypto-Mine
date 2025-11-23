import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Card } from '../components/Card';
import { colors, spacing, typography } from '../styles/theme';
import * as faqApi from '../services/api/faqApi';
import { useToast } from '../components/ToastProvider';

interface FAQ {
  id: string;
  question: string;
  answer: string;
}

const FaqsScreen = () => {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const { show } = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const response = await faqApi.fetchFaqs();
        setFaqs(response?.faqs ?? response ?? []);
      } catch (error: any) {
        show(error?.message ?? 'Unable to load FAQs', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [show]);

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator />
      ) : faqs.length ? (
        faqs.map((faq) => (
          <Card key={faq.id} title={faq.question} style={{ marginBottom: spacing.md }}>
            <Text style={styles.text}>{faq.answer}</Text>
          </Card>
        ))
      ) : (
        <Text style={styles.text}>No FAQs available.</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  text: { color: colors.text, fontSize: typography.body }
});

export default FaqsScreen;
