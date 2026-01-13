
import React from 'react';

interface Props {
  fullPage?: boolean;
}

const LoadingSpinner: React.FC<Props> = ({ fullPage }) => {
  const content = (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-blue-900 font-medium animate-pulse">Loading IGIHOZO...</p>
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        {content}
      </div>
    );
  }

  return content;
};

export default LoadingSpinner;
