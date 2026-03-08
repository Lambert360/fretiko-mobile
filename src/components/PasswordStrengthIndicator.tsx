import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface PasswordStrengthProps {
  password: string;
  onStrengthChange: (strength: 'weak' | 'medium' | 'strong') => void;
}

interface PasswordRequirements {
  length: boolean;
  uppercase: boolean;
  number: boolean;
  special: boolean;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthProps> = ({
  password,
  onStrengthChange,
}) => {
  const checkPasswordStrength = (pwd: string): PasswordRequirements => {
    return {
      length: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
    };
  };

  const getStrengthLevel = (requirements: PasswordRequirements): 'weak' | 'medium' | 'strong' => {
    const metRequirements = Object.values(requirements).filter(Boolean).length;
    
    if (metRequirements === 0) return 'weak';
    if (metRequirements <= 2) return 'weak';
    if (metRequirements === 3) return 'medium';
    return 'strong';
  };

  const requirements = checkPasswordStrength(password);
  const strength = getStrengthLevel(requirements);

  React.useEffect(() => {
    onStrengthChange(strength);
  }, [strength, onStrengthChange]);

  const getStrengthColor = () => {
    switch (strength) {
      case 'weak':
        return '#FF4757'; // Red
      case 'medium':
        return '#FFA502'; // Orange
      case 'strong':
        return '#34C759'; // Green
      default:
        return '#333'; // Gray
    }
  };

  const getStrengthText = () => {
    switch (strength) {
      case 'weak':
        return 'Weak';
      case 'medium':
        return 'Medium';
      case 'strong':
        return 'Strong';
      default:
        return '';
    }
  };

  const metRequirementsCount = Object.values(requirements).filter(Boolean).length;

  return (
    <View style={styles.container}>
      {/* Strength Bar */}
      <View style={styles.strengthBarContainer}>
        <View style={[styles.strengthBar, { backgroundColor: '#333' }]} />
        <View 
          style={[
            styles.strengthBar,
            styles.strengthBarFill,
            { 
              backgroundColor: getStrengthColor(),
              width: `${(metRequirementsCount / 4) * 100}%`,
            }
          ]} 
        />
      </View>
      <Text style={[styles.strengthText, { color: getStrengthColor() }]}>
        {getStrengthText()}
      </Text>

      {/* Requirements List */}
      <View style={styles.requirementsContainer}>
        <Text style={styles.requirementsTitle}>Password Requirements:</Text>
        
        <View style={styles.requirementItem}>
          <Text style={[
            styles.requirementText,
            requirements.length && styles.requirementMet
          ]}>
            ✓ At least 8 characters
          </Text>
        </View>

        <View style={styles.requirementItem}>
          <Text style={[
            styles.requirementText,
            requirements.uppercase && styles.requirementMet
          ]}>
            ✓ One uppercase letter
          </Text>
        </View>

        <View style={styles.requirementItem}>
          <Text style={[
            styles.requirementText,
            requirements.number && styles.requirementMet
          ]}>
            ✓ One number
          </Text>
        </View>

        <View style={styles.requirementItem}>
          <Text style={[
            styles.requirementText,
            requirements.special && styles.requirementMet
          ]}>
            ✓ One special character (!@#$%^&*)
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  strengthBarContainer: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  strengthBar: {
    height: '100%',
    borderRadius: 2,
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
  },
  requirementsContainer: {
    marginTop: 8,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E0E0E0',
    marginBottom: 8,
  },
  requirementItem: {
    marginBottom: 4,
  },
  requirementText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  requirementMet: {
    color: '#34C759',
    fontWeight: '600',
  },
});
