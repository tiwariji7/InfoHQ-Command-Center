import React from 'react';

interface InfoHQBrandLogoProps {
  className?: string;
}

export const InfoHQBrandLogo: React.FC<InfoHQBrandLogoProps> = ({ className = 'h-8' }) => {
  return (
    <div className={`inline-flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 168 38"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto"
        aria-label="InfoHQ Logo"
      >
        <defs>
          <linearGradient id="infohq-logo-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#E8604E" />
            <stop offset="45%" stopColor="#DD4985" />
            <stop offset="100%" stopColor="#914FBB" />
          </linearGradient>
        </defs>

        {/* 'info' in brand gradient */}
        {/* i */}
        <circle cx="10" cy="8.5" r="3" fill="url(#infohq-logo-gradient)" />
        <rect x="7" y="14" width="6" height="17" rx="3" fill="url(#infohq-logo-gradient)" />

        {/* n */}
        <rect x="19" y="14" width="5.5" height="17" rx="2.75" fill="url(#infohq-logo-gradient)" />
        <path
          d="M21 20C22.8 16.5 26.5 14 31 14C36.8 14 39.5 17.5 39.5 23.2V31H34V23.8C34 20.8 32.5 19 30 19C27 19 25 21 25 24.5V31H19.5V14"
          fill="url(#infohq-logo-gradient)"
        />

        {/* f */}
        <path
          d="M50 10.5C48.2 10.5 46.8 11.8 46.8 14.5V31H41.5V14H38V10.5H41.5V9C41.5 5 44 2.2 49 2.2C51 2.2 52.4 2.7 53.2 3.3L51.8 7.5C51.2 7.2 50.6 7 49.8 7C48 7 47 8 47 10V10.5H52.5V14H47"
          fill="url(#infohq-logo-gradient)"
        />

        {/* o */}
        <path
          d="M64 14C70 14 74.5 18 74.5 22.5C74.5 27 70 31 64 31C58 31 53.5 27 53.5 22.5C53.5 18 58 14 64 14ZM64 26.2C67 26.2 68.8 24.5 68.8 22.5C68.8 20.5 67 18.8 64 18.8C61 18.8 59.2 20.5 59.2 22.5C59.2 24.5 61 26.2 64 26.2Z"
          fill="url(#infohq-logo-gradient)"
        />

        {/* 'HQ' in dark navy #1A085C */}
        {/* H */}
        <path
          d="M82 4.5H89.5V14.8H100.5V4.5H108V31H100.5V20.5H89.5V31H82V4.5Z"
          fill="#1A085C"
        />

        {/* Q with server rack glyph */}
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M129.5 4C139.2 4 146.5 10 146.5 17.8C146.5 21.2 144.5 24.2 141.2 26.6L146.2 32H137.5L133.5 27.7C132.2 28 130.9 28.1 129.5 28.1C119.8 28.1 112.5 22.1 112.5 14.3C112.5 6.5 119.8 4 129.5 4ZM129.5 9.5C124 9.5 119.5 12.8 119.5 17.2C119.5 21.6 124 22.6 129.5 22.6C135 22.6 139.5 21.6 139.5 17.2C139.5 12.8 135 9.5 129.5 9.5Z"
          fill="#1A085C"
        />

        {/* Server rack inside Q: two horizontal server slots with status LEDs */}
        <rect x="123.5" y="13.5" width="12" height="2.8" rx="1.4" fill="#5B4CF5" />
        <circle cx="125.5" cy="14.9" r="0.7" fill="#FFFFFF" />
        <rect x="123.5" y="18" width="12" height="2.8" rx="1.4" fill="#E85AA0" />
        <circle cx="125.5" cy="19.4" r="0.7" fill="#FFFFFF" />
      </svg>
    </div>
  );
};
