import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleDarkMode = useCallback(() => {
    setTransitioning(true);
    // Short flash overlay then switch
    setTimeout(() => {
      setDarkMode(prev => !prev);
      setTimeout(() => setTransitioning(false), 400);
    }, 80);
  }, []);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode, transitioning }}>
      {/* Animated overlay on toggle */}
      {transitioning && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: darkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
          pointerEvents: 'none',
          animation: 'themeFlash 0.45s ease forwards',
        }} />
      )}
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
