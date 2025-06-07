declare module 'framer-motion' {
  import * as React from 'react';

  export interface AnimationProps {
    initial?: any;
    animate?: any;
    transition?: any;
    whileHover?: any;
    whileTap?: any;
    className?: string;
    [key: string]: any;
  }

  export const motion: {
    div: React.FC<AnimationProps & React.HTMLAttributes<HTMLDivElement>>;
    button: React.FC<AnimationProps & React.ButtonHTMLAttributes<HTMLButtonElement>>;
    // Añade más elementos según sea necesario
    [key: string]: React.FC<AnimationProps & any>;
  };
}