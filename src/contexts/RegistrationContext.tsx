import React, { createContext, useContext, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types for registration data
export interface RegistrationData {
  // Stage 1: Basic Information
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  hasAcceptedTerms: boolean;

  // Stage 2: Role Selection
  user_role: 'citizen' | 'vendor' | 'rider';
  is_seller: boolean;
  is_rider: boolean;
}

export interface RegistrationContextType {
  registrationData: RegistrationData | null;
  updateRegistrationData: (stage: 'stage1' | 'stage2', data: Partial<RegistrationData>) => void;
  clearRegistrationData: () => void;
  isRegistrationComplete: () => boolean;
}

const RegistrationContext = createContext<RegistrationContextType | undefined>(undefined);

export const useRegistration = () => {
  const context = useContext(RegistrationContext);
  if (!context) {
    throw new Error('useRegistration must be used within a RegistrationProvider');
  }
  return context;
};

interface RegistrationProviderProps {
  children: ReactNode;
}

export const RegistrationProvider: React.FC<RegistrationProviderProps> = ({ children }) => {
  const [registrationData, setRegistrationData] = useState<RegistrationData | null>(null);

  // Load saved registration data on mount
  React.useEffect(() => {
    loadRegistrationData();
  }, []);

  const loadRegistrationData = async () => {
    try {
      const savedData = await AsyncStorage.getItem('registrationData');
      if (savedData) {
        setRegistrationData(JSON.parse(savedData));
      }
    } catch (error) {
      console.error('Error loading registration data:', error);
    }
  };

  const saveRegistrationData = async (data: RegistrationData) => {
    try {
      await AsyncStorage.setItem('registrationData', JSON.stringify(data));
    } catch (error) {
      console.error('Error saving registration data:', error);
    }
  };

  const updateRegistrationData = (stage: 'stage1' | 'stage2', data: Partial<RegistrationData>) => {
    setRegistrationData(prev => {
      const updated = {
        ...prev,
        ...data,
        // Set default values for stage 2 if not provided
        ...(stage === 'stage2' && !data.user_role && {
          user_role: 'citizen',
          is_seller: false,
          is_rider: false,
        }),
      } as RegistrationData;

      // Save to AsyncStorage
      saveRegistrationData(updated);
      return updated;
    });
  };

  const clearRegistrationData = async () => {
    try {
      await AsyncStorage.removeItem('registrationData');
      setRegistrationData(null);
    } catch (error) {
      console.error('Error clearing registration data:', error);
    }
  };

  const isRegistrationComplete = (): boolean => {
    if (!registrationData) return false;
    
    return !!(
      registrationData.email &&
      registrationData.password &&
      registrationData.firstName &&
      registrationData.lastName &&
      registrationData.hasAcceptedTerms &&
      registrationData.user_role
    );
  };

  return (
    <RegistrationContext.Provider
      value={{
        registrationData,
        updateRegistrationData,
        clearRegistrationData,
        isRegistrationComplete,
      }}
    >
      {children}
    </RegistrationContext.Provider>
  );
};
