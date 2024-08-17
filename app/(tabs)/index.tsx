import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Dimensions,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  VideoStabilizationMode,
} from "react-native-vision-camera";
import { OpenAI } from "openai";
import * as Clipboard from "expo-clipboard";
import ImagePicker from "react-native-image-crop-picker";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
} from "react-native-reanimated";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import Constants from "expo-constants";
import { MaterialIcons } from "@expo/vector-icons";

// Use the secret from Expo constants
const OPENAI_API_KEY = Constants.expoConfig?.extra?.openaiApiKey;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const { width, height } = Dimensions.get("window");

// Define the Zod schema
const latexResponseSchema = z.object({
  latex: z.string(),
});

export default function CameraScreen() {
  const [hasPermission, setHasPermission] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  const cameraRef = useRef<Camera>(null);
  const overlayOpacity = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const device = useCameraDevice("back", {
    physicalDevices: [
      "ultra-wide-angle-camera",
      "wide-angle-camera",
      "telephoto-camera",
    ],
  });

  const format = useCameraFormat(device, [
    { autoFocusSystem: "phase-detection" },
    { videoResolution: { width: 1920, height: 1080 } },
    { fps: 60 },
    { videoStabilizationMode: "cinematic-extended" },
  ]);

  const animatedOverlayStyle = useAnimatedStyle(() => {
    return {
      opacity: overlayOpacity.value,
    };
  });

  useEffect(() => {
    (async () => {
      const cameraPermission = await Camera.requestCameraPermission();
      setHasPermission(cameraPermission === "granted");
    })();
  }, []);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const newScale = Math.min(
        Math.max(savedScale.value * e.scale, device.minZoom),
        device.maxZoom
      );
      scale.value = newScale;
      runOnJS(setZoom)(newScale);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const tapGesture = Gesture.Tap()
    .onStart((event) => {
      if (cameraRef.current) {
        cameraRef.current.focus({ x: event.x, y: event.y });
      }
    })
    .runOnJS(true);

  const combinedGesture = Gesture.Simultaneous(pinchGesture, tapGesture);

  const showTemporaryOverlay = useCallback(() => {
    setShowOverlay(true);
    overlayOpacity.value = withSequence(
      withTiming(1, { duration: 300 }),
      withDelay(2400, withTiming(0, { duration: 300 }))
    );
    setTimeout(() => setShowOverlay(false), 3000);
  }, [overlayOpacity]);

  const captureImage = useCallback(async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePhoto({
          flash: "off",
        });

        let croppedImage;
        try {
          croppedImage = await ImagePicker.openCropper({
            path: `file://${photo.path}`,
            width: 1600,
            height: 900,
            mediaType: "photo",
            cropping: true,
            cropperToolbarTitle: "Crop Image (16:9)",
            freeStyleCropEnabled: true,
            includeBase64: true,
          });
        } catch (cropError) {
          console.log("User cancelled image cropping");
          return;
        }

        setIsLoading(true);
        try {
          const response = await openai.beta.chat.completions.parse({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Convert any math you see to LaTeX. If there is no math in the image, return 'No math found'.",
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${croppedImage.data}`,
                    },
                  },
                ],
              },
            ],
            response_format: zodResponseFormat(
              latexResponseSchema,
              "latex_response"
            ),
          });

          const parsedResponse = response.choices[0].message.parsed;

          if (parsedResponse) {
            await Clipboard.setStringAsync(parsedResponse.latex);
            showTemporaryOverlay();
          } else {
            console.error("Error: Invalid LaTeX conversion received", response);
            Alert.alert("Error", "Invalid LaTeX conversion received");
          }
        } catch (error) {
          console.error("Error:", error);
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          Alert.alert("Error", `Error processing image: ${errorMessage}`);
        } finally {
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error capturing image:", error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        Alert.alert("Error", `Error capturing image: ${errorMessage}`);
      }
    }
  }, [showTemporaryOverlay]);

  if (!hasPermission) {
    return <Text>No access to camera</Text>;
  }

  if (!device) {
    return <Text>No camera device found</Text>;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <GestureDetector gesture={combinedGesture}>
        <View style={StyleSheet.absoluteFill}>
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            photo={true}
            format={format}
            zoom={zoom}
            videoStabilizationMode="cinematic"
          />
        </View>
      </GestureDetector>
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.captureButton} onPress={captureImage}>
          <MaterialIcons name="camera" size={60} color="#000000" />
        </TouchableOpacity>
      </View>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      )}
      {showOverlay && (
        <Animated.View style={[styles.overlay, animatedOverlayStyle]}>
          <Text style={styles.overlayText}>LaTeX copied to clipboard</Text>
        </Animated.View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  captureButton: {
    backgroundColor: "white",
    borderRadius: 60,
    width: 300,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  overlay: {
    position: "absolute",
    top: 40,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
  },
  overlayText: {
    color: "white",
    fontSize: 16,
  },
});
