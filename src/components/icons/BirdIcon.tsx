import type { SVGProps } from 'react';

export function BirdIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="hsl(var(--primary))" 
      stroke="hsl(var(--primary-foreground))"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M22 8.6c-1.3 1.6-3.5 3.4-6 3.4-2.1 0-4.1-1.3-5.6-3-1.2-1.3-2.1-2.9-2.4-4.6.1-.2-.4-.6-.8-.5-1.5.3-2.1-.9-.9-1.8.8-.7 2.1.2 2.1.2.3 2.1 1.5 4.1 3 5.5 1.8 1.6 3.9 2.7 6.3 2.7 2.9 0 5.4-2.1 6.7-4.2.4-.6-.2-1.3-1.4-1.1z"/>
      <path d="M7 13.1c-1.9 1.4-3.5 2.5-3.5 2.5s0 .5.3.7c.3.2 1.2-.2 1.2-.2 1.2-.8 2.9-2.2 4-3.3-1.2-1.1-2.3-2-2-1.7z"/>
      <circle cx="17.5" cy="7.5" r="1.5" fill="hsl(var(--primary-foreground))" stroke="none" />
    </svg>
  );
}
