import React from 'react';
import { Host, Surface, RNHostView } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';

export const NativeAuthCard: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  return (
    <Host matchContents={{ vertical: true }} style={{ width: '100%', marginVertical: 16 }}>
      <Surface
        color="#121216"
        tonalElevation={6}
        shadowElevation={12}
        modifiers={[fillMaxWidth()]}
      >
        <RNHostView matchContents>{children}</RNHostView>
      </Surface>
    </Host>
  );
};
