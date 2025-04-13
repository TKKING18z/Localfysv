// Removed: import { ExpoConfig } from 'expo/config';

const config = {
  name: "Localfy",
  slug: "localfy-app",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  assetBundlePatterns: [
    "**/*"
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.zalabsdigital.localfy",
    infoPlist: {
      NSLocationWhenInUseUsageDescription: "Localfy uses your location to find nearby businesses."
    }
  },
  android: {
    package: "com.zalabsdigital.localfy",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff"
    },
    permissions: ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "com.zalabsdigital.localfy"
          }
        ],
        category: ["BROWSABLE", "DEFAULT"]
      }
    ]
  },
  web: {
    favicon: "./assets/favicon.png"
  },
  plugins: [
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission: "Allow Localfy to use your location for finding nearby businesses."
      }
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/adaptive-icon.png",
        color: "#ffffff",
      }
    ]
  ],
  extra: {
    eas: {
      projectId: "5df16710-3ec7-47c3-b07c-a1cc5a36786e"
    },
    EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
    ANDROID_OAUTH_CLIENT_ID: "281205862532-r81b17icaar84ja153rhnegoslpbph53.apps.googleusercontent.com",
    IOS_OAUTH_CLIENT_ID: "281205862532-3o2ot4ulh7nbu3vu0q80qd4gbt6q3fi3.apps.googleusercontent.com", 
    WEB_OAUTH_CLIENT_ID: "281205862532-imt64nhl458nbm9jnf9gff2cb939ngr3.apps.googleusercontent.com"
  },
  newArchEnabled: true,
};

export default config;