import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { TabBarProvider } from '../../src/context/TabBarContext';
import AnimatedTabBar from '../../src/components/AnimatedTabBar';

export default function AdminLayout() {
  return (
    <TabBarProvider>
      <Tabs
        tabBar={(props) => <AnimatedTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.outline,
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="workers"
          options={{
            title: 'Workers',
            tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="verifications"
          options={{
            title: 'Verify',
            tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: 'Reports',
            tabBarIcon: ({ color, size }) => <Ionicons name="flag-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
          }}
        />
      </Tabs>
    </TabBarProvider>
  );
}
