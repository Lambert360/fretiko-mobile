import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import notificationsAPI from '../services/notificationsAPI';
import { chatAPI } from '../services/chatAPI';

// Import screens
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import KonnectScreen from '../screens/KonnectScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

interface TabIconProps {
  focused: boolean;
  color: string;
  size: number;
  iconName: string;
  badgeCount?: number;
  avatarUrl?: string;
}

const TabIcon: React.FC<TabIconProps> = ({ focused, iconName, size = 24, badgeCount = 0, avatarUrl }) => {
  const iconColor = focused ? '#007AFF' : '#666';
  const scale = focused ? 1.1 : 1;

  const renderIcon = () => {
    switch (iconName) {
      case 'Home':
        return (
          <View style={[styles.iconContainer, { transform: [{ scale }] }]}>
            <Ionicons 
              name={focused ? "home" : "home-outline"} 
              size={size} 
              color={iconColor} 
            />
          </View>
        );
      case 'Search':
        return (
          <View style={[styles.iconContainer, { transform: [{ scale }] }]}>
            <Ionicons 
              name="search" 
              size={size} 
              color={iconColor} 
            />
          </View>
        );
      case 'Konnect':
        return (
          <View style={[styles.konnectIconContainer, focused && styles.konnectIconFocused]}>
            <Image 
              source={require('../../assets/images/connect-icon.jpeg')} 
              style={[styles.konnectIcon, focused && styles.konnectIconActive]}
            />
            {badgeCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {badgeCount > 99 ? '99+' : badgeCount}
                </Text>
              </View>
            )}
          </View>
        );
      case 'Notifications':
        return (
          <View style={[styles.iconContainer, { transform: [{ scale }] }]}>
            <Ionicons 
              name={focused ? "notifications" : "notifications-outline"} 
              size={size} 
              color={iconColor} 
            />
            {badgeCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {badgeCount > 99 ? '99+' : badgeCount}
                </Text>
              </View>
            )}
          </View>
        );
      case 'Profile':
        return (
          <View style={[styles.iconContainer, { transform: [{ scale }] }]}>
            {avatarUrl ? (
              <View style={[
                styles.profileAvatarContainer,
                focused && styles.profileAvatarFocused
              ]}>
                <Image 
                  source={{ uri: avatarUrl }} 
                  style={[styles.profileAvatar, { width: size, height: size }]}
                />
              </View>
            ) : (
              <Ionicons 
                name={focused ? "person" : "person-outline"} 
                size={size} 
                color={iconColor} 
              />
            )}
          </View>
        );
      default:
        return <View />;
    }
  };

  return renderIcon();
};

interface TabLabelProps {
  focused: boolean;
  color: string;
  children: string;
}

const TabLabel: React.FC<TabLabelProps> = ({ focused, color, children }) => (
  <View style={styles.labelContainer}>
    <Text style={[
      styles.tabLabel,
      { 
        color: focused ? '#007AFF' : '#666',
        fontWeight: focused ? '600' : '400'
      }
    ]}>
      {children}
    </Text>
  </View>
);

export const BottomTabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { accessToken, isAuthenticated, user } = useAuth();
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  // Fetch unread notification count
  useEffect(() => {
    if (!accessToken || !isAuthenticated) {
      setUnreadNotificationCount(0);
      return;
    }

    const fetchUnreadCount = async () => {
      try {
        const result = await notificationsAPI.getUnreadCount(accessToken);
        setUnreadNotificationCount(result.unread_count || 0);
      } catch (error) {
        console.error('Error fetching unread notification count:', error);
        // Don't set to 0 on error - keep previous value
      }
    };

    // Fetch immediately
    fetchUnreadCount();

    // Poll every 30 seconds to keep count updated
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, [accessToken, isAuthenticated]);

  // Fetch unread message count
  useEffect(() => {
    if (!accessToken || !isAuthenticated) {
      setUnreadMessageCount(0);
      return;
    }

    const fetchUnreadMessageCount = async () => {
      try {
        const count = await chatAPI.getTotalUnreadCount();
        setUnreadMessageCount(count);
      } catch (error) {
        console.error('Error fetching unread message count:', error);
        // Don't set to 0 on error - keep previous value
      }
    };

    // Fetch immediately
    fetchUnreadMessageCount();

    // Poll every 30 seconds to keep count updated
    const interval = setInterval(fetchUnreadMessageCount, 30000);

    return () => clearInterval(interval);
  }, [accessToken, isAuthenticated]);

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true, // Prevents inactive screens from re-rendering
        lazy: true, // Only renders screen when first focused
        tabBarStyle: [
          styles.tabBar,
          {
            paddingBottom: Math.max(insets.bottom, 8),
            height: 82 + Math.max(insets.bottom, 8),
          },
        ],
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#666',
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon focused={focused} color={color} size={size} iconName="Home" />
          ),
          tabBarLabel: ({ focused, color, children }) => (
            <TabLabel focused={focused} color={color}>{children}</TabLabel>
          ),
        }}
      />
      <Tab.Screen 
        name="Search" 
        component={SearchScreen}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon focused={focused} color={color} size={size} iconName="Search" />
          ),
          tabBarLabel: ({ focused, color, children }) => (
            <TabLabel focused={focused} color={color}>{children}</TabLabel>
          ),
        }}
      />
      <Tab.Screen 
        name="Konnect" 
        component={KonnectScreen}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon 
              focused={focused} 
              color={color} 
              size={size} 
              iconName="Konnect" 
              badgeCount={unreadMessageCount}
            />
          ),
          tabBarLabel: ({ focused, color, children }) => (
            <TabLabel focused={focused} color={color}>{children}</TabLabel>
          ),
        }}
        listeners={{
          focus: () => {
            // Refresh unread message count when Konnect screen is focused
            if (accessToken && isAuthenticated) {
              chatAPI.getTotalUnreadCount()
                .then(count => setUnreadMessageCount(count))
                .catch(err => console.error('Error refreshing unread message count:', err));
            }
          },
        }}
      />
      <Tab.Screen 
        name="Notifications" 
        component={NotificationsScreen}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon 
              focused={focused} 
              color={color} 
              size={size} 
              iconName="Notifications" 
              badgeCount={unreadNotificationCount}
            />
          ),
          tabBarLabel: ({ focused, color, children }) => (
            <TabLabel focused={focused} color={color}>{children}</TabLabel>
          ),
        }}
        listeners={{
          focus: () => {
            // Refresh unread count when notifications screen is focused
            if (accessToken && isAuthenticated) {
              notificationsAPI.getUnreadCount(accessToken)
                .then(result => setUnreadNotificationCount(result.unread_count || 0))
                .catch(err => console.error('Error refreshing unread count:', err));
            }
          },
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon 
              focused={focused} 
              color={color} 
              size={size} 
              iconName="Profile" 
              avatarUrl={user?.avatar_url}
            />
          ),
          tabBarLabel: ({ focused, color, children }) => (
            <TabLabel focused={focused} color={color}>{children}</TabLabel>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#000000',
    borderTopWidth: 0.5,
    borderTopColor: '#2A2A2A',
    paddingTop: 8,
    paddingBottom: 8,
    height: 82,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  tabItem: {
    paddingTop: 6,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
  },
  konnectIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
    marginBottom: 4,
    position: 'relative',
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  konnectIconFocused: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
    transform: [{ scale: 1.1 }],
    shadowColor: '#007AFF',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    borderWidth: 2,
  },
  konnectIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    opacity: 0.9,
  },
  konnectIconActive: {
    opacity: 1,
    transform: [{ scale: 1.05 }],
  },
  labelContainer: {
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  profileAvatarContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  profileAvatarFocused: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  profileAvatar: {
    borderRadius: 16,
  },
});