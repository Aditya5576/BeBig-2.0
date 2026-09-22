import { useAppTheme } from '../../src/features/theme';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';


export default function AdminPlaceholder() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const { slug } = useLocalSearchParams();
  const path = Array.isArray(slug) ? slug.join('/') : slug;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{path?.toUpperCase() || 'SECTION'}</Text>
      <Text style={styles.subtitle}>This section is under construction.</Text>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
  },
});
