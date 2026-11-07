import type { ComponentType, Ref } from 'react';
import { WebView as RNWebView } from 'react-native-webview';
import type { WebViewProps } from 'react-native-webview';

export type WebViewRef = RNWebView;

// react-native-webview 14 declares `WebView<P = undefined>` which collapses its
// props to `never`; re-type it until upstream fixes the generic default.
export const WebView = RNWebView as unknown as ComponentType<
  WebViewProps & { ref?: Ref<RNWebView> }
>;
