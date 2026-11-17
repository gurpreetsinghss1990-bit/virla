import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';

/**
 * Last line of defence: any uncaught render error inside the tree would
 * otherwise leave the user on a white screen with no way out.
 */
export function AppErrorFallback({
  error,
  onRetry,
  onReload,
}: {
  error?: Error | null;
  onRetry?: () => void;
  onReload?: () => void;
}) {
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>!</Text>
        </View>
        <Text style={styles.title}>Kuch gadbad ho gayi</Text>
        <Text style={styles.body}>
          App ko ek unexpected problem aayi. Neeche wale button se dobara try karein — aapka data safe hai.
        </Text>

        {__DEV__ && error?.message ? (
          <View style={styles.debugBox}>
            <Text style={styles.debugText} numberOfLines={12}>
              {error.message}
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>Try Again</Text>
        </Pressable>

        <Pressable
          onPress={onReload}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>Restart App</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error?.message, info?.componentStack);
  }

  private reset = () => this.setState({ error: null });

  private reload = async () => {
    try {
      await Updates.reloadAsync();
    } catch {
      this.reset();
    }
  };

  render() {
    if (this.state.error) {
      return <AppErrorFallback error={this.state.error} onRetry={this.reset} onReload={this.reload} />;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 48,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF1F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  badgeText: { fontSize: 26, fontWeight: '800', color: '#E11D48' },
  title: { fontSize: 20, fontWeight: '700', color: '#101828', marginBottom: 8, textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 21, color: '#667085', textAlign: 'center', marginBottom: 24 },
  debugBox: {
    alignSelf: 'stretch',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  debugText: { fontSize: 11, color: '#98A2B3' },
  primary: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E11D48',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  secondary: { alignSelf: 'stretch', height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  secondaryText: { color: '#667085', fontSize: 14, fontWeight: '500' },
  pressed: { opacity: 0.85 },
});
