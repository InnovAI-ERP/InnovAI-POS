import React from 'react';

interface AlertProps {
  variant?: 'default' | 'destructive' | 'warning';
  className?: string;
  children: React.ReactNode;
}

export function Alert({ 
  variant = 'default', 
  className = '', 
  children 
}: AlertProps) {
  const variantClasses = {
    default: 'bg-blue-50 border-blue-200 text-blue-800',
    destructive: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800'
  };

  return (
    <div className={`border rounded-md p-4 ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
}

interface AlertTitleProps {
  className?: string;
  children: React.ReactNode;
}

export function AlertTitle({ className = '', children }: AlertTitleProps) {
  return (
    <h5 className={`font-medium mb-1 ${className}`}>
      {children}
    </h5>
  );
}

interface AlertDescriptionProps {
  className?: string;
  children: React.ReactNode;
}

export function AlertDescription({ className = '', children }: AlertDescriptionProps) {
  return (
    <div className={`text-sm ${className}`}>
      {children}
    </div>
  );
}
