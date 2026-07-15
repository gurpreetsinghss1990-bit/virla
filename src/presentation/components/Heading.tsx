import React from 'react';
import { Text } from 'react-native';

interface HeadingProps {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export function Heading({ children, className = '', align = 'center' }: HeadingProps) {
  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }[align];

  return (
    <Text
      className={`text-3xl font-extrabold tracking-tight text-primary ${alignClass} ${className}`}
    >
      {children}
    </Text>
  );
}
