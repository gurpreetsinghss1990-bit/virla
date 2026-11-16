import React from 'react';
import { Host, RNHostView, VStack } from '@expo/ui/swift-ui';
import { glassEffect, cornerRadius } from '@expo/ui/swift-ui/modifiers';

export const NativeAuthCard: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  return (
    <Host matchContents={{ vertical: true }} style={{ width: '100%', marginVertical: 16 }}>
      <VStack
        modifiers={[
          glassEffect({ glass: { variant: 'regular', interactive: false } }),
          cornerRadius(36),
        ]}
      >
        <RNHostView matchContents>{children}</RNHostView>
      </VStack>
    </Host>
  );
};
