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
import { Image } from "react-native";

const OPENAI_API_KEY = Constants.expoConfig?.extra?.openaiApiKey;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const logTokenUsageAndCost = (usage: {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}) => {
  const inputCost = (usage.prompt_tokens / 1000000) * 0.15;
  const outputCost = (usage.completion_tokens / 1000000) * 0.6;
  const totalCost = inputCost + outputCost;
  const costFor1000Requests = totalCost * 1000;

  console.log(
    `Token usage - Input: ${usage.prompt_tokens}, Output: ${usage.completion_tokens}`
  );
  console.log(
    `Estimated cost - Input: $${inputCost.toFixed(
      6
    )}, Output: $${outputCost.toFixed(6)}, Total: $${totalCost.toFixed(6)}`
  );
  console.log(
    `Estimated cost for 1000 identical requests: $${costFor1000Requests.toFixed(
      2
    )}`
  );
};

const DEFAULT_ZOOM = 1;

const latexResponseSchema = z.object({
  latex: z.string(),
});

export default function CameraScreen() {
  const [hasPermission, setHasPermission] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [isLoading, setIsLoading] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  const cameraRef = useRef<Camera>(null);
  const overlayOpacity = useSharedValue(0);
  const scale = useSharedValue(DEFAULT_ZOOM);
  const savedScale = useSharedValue(DEFAULT_ZOOM);

  const device = useCameraDevice("back", {
    physicalDevices: ["wide-angle-camera", "telephoto-camera"],
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

  useEffect(() => {
    setZoom(DEFAULT_ZOOM);
    scale.value = DEFAULT_ZOOM;
    savedScale.value = DEFAULT_ZOOM;
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

  const captureAndProcessImage = useCallback(
    async (shouldCrop: boolean) => {
      if (cameraRef.current) {
        try {
          const photo = await cameraRef.current.takePhoto({
            flash: "off",
          });

          let imageToProcess;
          if (shouldCrop) {
            try {
              imageToProcess = await ImagePicker.openCropper({
                path: `file://${photo.path}`,
                width: 512,
                height: 512,
                mediaType: "photo",
                cropping: true,
                cropperToolbarTitle: "Crop Image (1:1)",
                freeStyleCropEnabled: true,
                includeBase64: true,
              });
            } catch (cropError) {
              console.log("User cancelled image cropping");
              return;
            }
          } else {
            const base64 = await new Promise<string>((resolve, reject) => {
              Image.getSize(
                `file://${photo.path}`,
                async (width, height) => {
                  const imageData = await fetch(`file://${photo.path}`);
                  const blob = await imageData.blob();
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = (error) => reject(error);
                  reader.readAsDataURL(blob);
                },
                (error) => reject(error)
              );
            });

            imageToProcess = {
              path: photo.path,
              data: base64.split(",")[1],
            };
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
                        url: `data:image/jpeg;base64,${imageToProcess.data}`,
                        detail: "low",
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

            if (response.usage) {
              logTokenUsageAndCost(response.usage);
            }

            const parsedResponse = response.choices[0].message.parsed;

            if (parsedResponse) {
              console.log("Parsed LaTeX:", parsedResponse.latex);
              await Clipboard.setStringAsync(parsedResponse.latex);
              showTemporaryOverlay();
            } else {
              console.error(
                "Error: Invalid LaTeX conversion received",
                response
              );
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
    },
    [showTemporaryOverlay]
  );

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
        <TouchableOpacity
          style={styles.captureButton}
          onPress={() => captureAndProcessImage(false)}
        >
          <MaterialIcons name="flash-on" size={40} color="#000000" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.captureButton}
          onPress={() => captureAndProcessImage(true)}
        >
          <MaterialIcons name="crop" size={40} color="#000000" />
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
    justifyContent: "space-evenly",
    paddingHorizontal: 20,
  },
  captureButton: {
    backgroundColor: "white",
    borderRadius: 50,
    width: 80,
    height: 80,
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
