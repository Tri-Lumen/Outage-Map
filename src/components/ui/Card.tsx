import { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  elevated?: boolean;
  padded?: boolean;
}

export default function Card({
  children,
  elevated = false,
  padded = true,
  className = '',
  ...rest
}: CardProps) {
  return (
    <div
      className={`rounded-2xl border ${
        elevated ? 'surface-elevated' : 'surface-card'
      } ${padded ? 'p-5' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
