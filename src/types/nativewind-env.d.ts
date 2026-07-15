/// <reference types="nativewind/types" />

declare module "*.css" {
  const content: any;
  export default content;
}

declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

declare module "@expo/vector-icons" {
  import React from 'react';
  export const Ionicons: React.ComponentType<any>;
  export const Feather: React.ComponentType<any>;
  export const FontAwesome: React.ComponentType<any>;
}


