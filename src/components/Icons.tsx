import React from 'react';

export type IconName =
  | 'wind'
  | 'grid'
  | 'calendar'
  | 'home'
  | 'arrow'
  | 'leaf'
  | 'message'
  | 'pin'
  | 'shield'
  | 'refresh'
  | 'sun'
  | 'cloud'
  | 'moon'
  | 'info'
  | 'external'
  | 'spark'
  | 'download'
  | 'menu'
  | 'close'
  | 'send'
  | 'people'
  | 'cube'
  | 'search';

interface IconProps {
  name: IconName;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({ name, className = '' }) => {
  const cls = className ? `icon ${className}` : 'icon';
  switch (name) {
    case 'wind':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 8h12a3 3 0 1 0-3-3M2 12h18a3 3 0 1 1-3 3M4 16h7a3 3 0 1 1-3 3" />
        </svg>
      );
    case 'grid':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case 'calendar':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M7 3v4M17 3v4M3 10h18M7 14h4M7 17h4" />
        </svg>
      );
    case 'home':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
          <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM9 21v-8h6v8" />
        </svg>
      );
    case 'arrow':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14m-6-6 6 6-6 6" />
        </svg>
      );
    case 'leaf':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 4c-11 0-16 4-16 11a5 5 0 0 0 5 5c7 0 11-5 11-16ZM4 20c4-5 8-8 13-11" />
        </svg>
      );
    case 'message':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5Z" />
        </svg>
      );
    case 'pin':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case 'shield':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10ZM9 12l2 2 4-4" />
        </svg>
      );
    case 'refresh':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 7v5h-5M4 17v-5h5M6 9a7 7 0 0 1 12-2l2 2M4 15l2 2a7 7 0 0 0 12-2" />
        </svg>
      );
    case 'sun':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M22 12h-2M4 12H2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19" />
        </svg>
      );
    case 'cloud':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 17a4 4 0 0 0-1-8 7 7 0 0 0-13 2 3 3 0 0 0 0 6h14Z" />
        </svg>
      );
    case 'moon':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 16A9 9 0 0 1 8 4a9 9 0 1 0 12 12Z" />
        </svg>
      );
    case 'info':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6M12 7h.01" />
        </svg>
      );
    case 'external':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 4h6v6M10 14 20 4M19 14v6H4V5h6" />
        </svg>
      );
    case 'spark':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z" />
        </svg>
      );
    case 'download':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3" />
        </svg>
      );
    case 'menu':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
    case 'close':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 5l14 14M19 5 5 19" />
        </svg>
      );
    case 'send':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
          <path d="m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2" />
        </svg>
      );
    case 'people':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="9" cy="8" r="3" />
          <path d="M3 21v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5v1" />
        </svg>
      );
    case 'cube':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 2 8.5 5v10L12 22l-8.5-5V7L12 2Z" />
          <path d="m12 22V12m0 0 8.5-5M12 12 3.5 7" />
        </svg>
      );
    case 'search':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
  }
};
