import type { SVGProps } from 'react';

export function BirdIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="16" 
      height="16" 
      shape-rendering="crispEdges"
      viewBox="0 0 16 16"
      {...props}
    >
      <rect x="4" y="3" width="8" height="10" fill="#222"/>
      <rect x="5" y="4" width="6" height="8" fill="#F6D84A"/>
      <rect x="5" y="8" width="3" height="3" fill="#FFF"/>
      <rect x="11" y="7" width="2" height="2" fill="#F39C12"/>
      <rect x="7" y="6" width="1" height="1" fill="#222"/>
      <rect x="6" y="9" width="2" height="2" fill="#E9C631"/>
    </svg>
  );
}
