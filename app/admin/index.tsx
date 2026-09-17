import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../../src/constants/theme';

export default function AdminDashboard() {
  const stats = [
    { label: 'Total Users', value: '1,248' },
    { label: 'Active Workouts', value: '42' },
    { label: 'Recent Errors', value: '3' },
    { label: 'Cloud Status', value: 'Healthy', color: '#4ade80' },
    { label: 'App Version', value: '2.0.4-prod' },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Dashboard Overview</Text>
      <Text style={styles.subtitle}>Welcome to the BeBig Admin Panel.</Text>
      
      <View style={styles.grid}>
        {stats.map((stat, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.cardLabel}>{stat.label}</Text>
            <Text style={[styles.cardValue, stat.color && { color: stat.color }]}>
              {stat.value}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.noticeBox}>
        <Text style={styles.noticeTitle}>Placeholder Data</Text>
        <Text style={styles.noticeText}>
          The analytics shown above are static placeholders for Milestone 3. 
          Real-time production data connection is pending future implementation.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 32,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#111',
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
    minWidth: 200,
    flex: 1,
  },
  cardLabel: {
    color: '#888',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  cardValue: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  noticeBox: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.dark.primary,
  },
  noticeTitle: {
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  noticeText: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
  },
});
