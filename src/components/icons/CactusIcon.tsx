import type { SVGProps } from 'react';

export function CactusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="hsl(var(--foreground))" 
      stroke="hsl(var(--foreground))"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
        <path d="M10 20V12H9V8H10V9H11V7H7V8H6V11H7V12H8V20H10Z" />
        <path d="M13 20V9H14V10H15V8H18V9H19V11H18V12H17V20H13Z" />
    </svg>
  );
}
