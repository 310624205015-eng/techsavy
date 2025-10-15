import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AdminContextType {
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminSession = () => {
      const adminSession = localStorage.getItem('adminSession');
      if (adminSession === 'true') {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    };
    checkAdminSession();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    if (username === 'admin' && password === 'admin123') {
      localStorage.setItem('adminSession', 'true');
      setIsAdmin(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('adminSession');
    setIsAdmin(false);
  };

  return (
    <AdminContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
