import React from 'react';
import { Redirect } from 'expo-router';

export function AdminPlaceholderScreen(props: { title?: string }) {
  void props;
  return <Redirect href="/admin" />;
}
