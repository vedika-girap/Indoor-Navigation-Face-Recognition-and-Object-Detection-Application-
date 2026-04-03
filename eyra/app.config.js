// app.config.js
export default {
  expo: {
    name: "eyra",
    slug: "eyra",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.eyra.app"
    },
    android: {
      package: "com.eyra.app",
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.READ_EXTERNAL_STORAGE"
      ]
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-camera",
        {
          "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera for object detection and face recognition"
        }
      ],
      [
        "expo-speech-recognition",
        {
          "microphonePermission": "Allow $(PRODUCT_NAME) to access your microphone for voice commands",
          "speechRecognitionPermission": "Allow $(PRODUCT_NAME) to use speech recognition for voice assistant"
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      backendUrl: "http://192.168.1.101:8000",
      router: {
        origin: false
      },
      eas: {
        projectId: "your-project-id-here"
      }
    },
  },
};
