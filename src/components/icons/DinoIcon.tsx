import type { SVGProps } from 'react';

export function DinoIcon(props: SVGProps<SVGSVGElement>) {
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
        <path d="M15 15V11H19V10H15V9H16V6H14V9H13V10H14V11H10V10H9V12H10V14H11V15H15Z" />
        <path d="M7 19V18H8V17H9V16H15V17H14V18H13V19H12V20H10V19H7Z" />
    </svg>
  );
}
