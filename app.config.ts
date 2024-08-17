import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const APP_VARIANT = process.env.APP_VARIANT || 'production';
  const OPENAI_API_KEY = process.env.EAS_BUILD ? process.env.OPENAI_API_KEY : process.env.EXPO_PUBLIC_OPENAI_API_KEY; 

  return {
    ...config,
    name: APP_VARIANT === 'production' ? "LatexConverterApp" : `LatexConverterApp (${APP_VARIANT})`,
    slug: "LatexConverterApp",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/images/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 
        APP_VARIANT === 'production' 
          ? "com.emileberhard.LatexConverterApp"
          : `com.emileberhard.LatexConverterApp.${APP_VARIANT}`,
      infoPlist: {
        NSCameraUsageDescription: "Allow $(PRODUCT_NAME) to access your camera"
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      permissions: [
        "android.permission.CAMERA"
      ],
      package: 
        APP_VARIANT === 'production'
          ? "com.emileberhard.LatexConverterApp"
          : `com.emileberhard.LatexConverterApp.${APP_VARIANT}`
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      "react-native-vision-camera"
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      router: {
        origin: false
      },
      eas: {
        projectId: "fb8837c3-e10c-48f9-bd1c-9e255d29ae39"
      },
      openaiApiKey: OPENAI_API_KEY, 
    },
  };
}