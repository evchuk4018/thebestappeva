import { useEffect } from 'react';

interface UseResponsiveSidebarOptions {
  setIsMobile: (value: boolean) => void;
  setSidebarOpen: (value: boolean) => void;
}

export function useResponsiveSidebar({ setIsMobile, setSidebarOpen }: UseResponsiveSidebarOptions) {
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setIsMobile, setSidebarOpen]);
}
