import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut, reload, FirebaseAuthTypes } from '@react-native-firebase/auth';

type AuthContextType = {
  user: FirebaseAuthTypes.User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  reloadUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, signOut: async () => {}, reloadUser: async () => {} });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const authInstance = getAuth();
    const unsubscribe = onAuthStateChanged(authInstance, currentUser => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'background' || nextState === 'inactive') {
        firebaseSignOut(getAuth()).catch(console.error);
      }
    });
    return () => subscription.remove();
  }, []);

  const signOut = async () => {
    await firebaseSignOut(getAuth());
  };

  const reloadUser = async () => {
    const currentUser = getAuth().currentUser;
    if (currentUser) {
      await reload(currentUser);
      setUser(getAuth().currentUser);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, reloadUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);