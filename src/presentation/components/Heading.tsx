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
      className={`text-[30px] font-black tracking-tight text-[#101828] leading-[38px] ${alignClass} ${className}`}
    >
      {children}
    </Text>
  );
}
