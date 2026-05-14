// START ST-900 Logic — Shadow Mode (User Impersonation) Context
'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface ShadowState {
  isActive: boolean;
  shadowUserId: string | null;
  shadowUserName: string | null;
  shadowUserEmail: string | null;
}

interface ShadowContextType extends ShadowState {
  enterShadow: (userId: string, name: string, email: string) => void;
  exitShadow: () => void;
}

const ShadowContext = createContext<ShadowContextType>({
  isActive: false,
  shadowUserId: null,
  shadowUserName: null,
  shadowUserEmail: null,
  enterShadow: () => {},
  exitShadow: () => {},
});

export function ShadowProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ShadowState>({
    isActive: false,
    shadowUserId: null,
    shadowUserName: null,
    shadowUserEmail: null,
  });

  const enterShadow = useCallback((userId: string, name: string, email: string) => {
    setState({
      isActive: true,
      shadowUserId: userId,
      shadowUserName: name,
      shadowUserEmail: email,
    });
  }, []);

  const exitShadow = useCallback(() => {
    setState({
      isActive: false,
      shadowUserId: null,
      shadowUserName: null,
      shadowUserEmail: null,
    });
  }, []);

  return (
    <ShadowContext.Provider value={{ ...state, enterShadow, exitShadow }}>
      {children}
    </ShadowContext.Provider>
  );
}

export function useShadow() {
  return useContext(ShadowContext);
}
// END ST-900 Logic
