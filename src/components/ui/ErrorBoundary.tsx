/**
 * BeBig 2.0 — Component-Level Error Boundary
 *
 * Catches render-time errors in deeply nested trees (e.g. Exercise Picker,
 * Exercise Library list, complex cards) preventing full-app crashes or WebKit tab reloads.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { Icon } from './Icon';
import { spacing, radii } from '../../constants/theme';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  testID?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch {
        // Suppress secondary handler errors
      }
    }
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error || new Error('Unknown error'), this.reset);
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View
          testID={this.props.testID || 'error-boundary-fallback'}
          style={styles.fallbackContainer}
        >
          <View style={styles.iconCircle}>
            <Icon name="close" size={24} color="#EF4444" />
          </View>

          <Text variant="titleMedium" color="primary" style={styles.title}>
            {this.props.fallbackTitle || 'Something went wrong'}
          </Text>

          <Text variant="caption" color="muted" style={styles.message}>
            {this.props.fallbackMessage ||
              this.state.error?.message ||
              'A problem occurred rendering this component. Tap below to reload.'}
          </Text>

          <Button
            testID={`${this.props.testID || 'error-boundary'}-retry-button`}
            title="Try Again"
            onPress={this.reset}
            variant="secondary"
            size="sm"
            style={styles.retryButton}
          />
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  fallbackContainer: {
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#141824',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    marginVertical: spacing.sm,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 18,
  },
  retryButton: {
    marginTop: spacing.xs,
  },
});
