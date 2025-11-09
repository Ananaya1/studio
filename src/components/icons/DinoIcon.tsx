import type { SVGProps } from 'react';

export function DinoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="16" 
      height="16" 
      shape-rendering="crispEdges"
      viewBox="0 0 16 16"
      fill="hsl(var(--foreground))"
      {...props}
    >
      <rect x="2" y="7" width="10" height="5" />
      <rect x="4" y="6" width="5" height="2" />
      <rect x="9" y="4" width="5" height="3" />
      <rect x="13" y="5" width="1" height="1" fill="#fff"/>
      <rect x="1" y="9" width="3" height="1" />
      <rect x="1" y="11" width="4" height="2" />
      <rect x="6" y="11" width="4" height="2" />
      <rect x="0" y="8" width="2" height="2" />
    </svg>
  );
}
