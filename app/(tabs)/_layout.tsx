import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, Tabs } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";

import { useColorScheme } from "@/hooks/useColorScheme";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Tabs>
          <Tabs.Screen
            name="index"
            options={{
              title: "Camera",
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="camera" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="image-preview"
            options={{
              title: "Image Preview",
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="image" size={size} color={color} />
              ),
            }}
          />
        </Tabs>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
