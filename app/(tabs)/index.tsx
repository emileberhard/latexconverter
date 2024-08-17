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
} from "react-native";
import { Camera, useCameraDevices } from "react-native-vision-camera";
import { OpenAI } from "openai";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import ImagePicker from "react-native-image-crop-picker";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { Alert } from "react-native";

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
  const cameraRef = useRef<Camera>(null);
  const router = useRouter();
  const devices = useCameraDevices();
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const mainBackDevices = useMemo(() => {
    const isIOS = Platform.OS === "ios";
    const deviceNameMap = isIOS
      ? {
          "Back Ultra Wide Camera": "ultra-wide",
          "Back Camera": "wide",
          "Back Telephoto Camera": "telephoto",
        }
      : {};

    return devices
      .filter((device) => {
        if (isIOS) {
          return (
            device.position === "back" &&
            Object.keys(deviceNameMap).includes(device.name)
          );
        } else {
          return device.position === "back";
        }
      })
      .sort((a, b) => {
        if (isIOS) {
          const order = ["ultra-wide", "wide", "telephoto"];
          return (
            order.indexOf(deviceNameMap[a.name as keyof typeof deviceNameMap]) -
            order.indexOf(deviceNameMap[b.name as keyof typeof deviceNameMap])
          );
        } else {
          return a.id.localeCompare(b.id);
        }
      });
  }, [devices]);

  useEffect(() => {
    console.log("Available main back camera lenses:");
    mainBackDevices.forEach((device, index) => {
      console.log(`Lens ${index + 1}:`);
      console.log(`  Device ID: ${device.id}`);
      console.log(`  Device Name: ${device.name}`);
      console.log(`  Has Flash: ${device.hasFlash}`);
      console.log(`  Has Torch: ${device.hasTorch}`);
      console.log(`  Minimum Zoom: ${device.minZoom}`);
      console.log(`  Maximum Zoom: ${device.maxZoom}`);
      console.log(
        `  Supports Low Light Boost: ${
          device.supportsLowLightBoost ? "Yes" : "No"
        }`
      );
      console.log(
        `  Supports RAW Capture: ${device.supportsRawCapture ? "Yes" : "No"}`
      );
      console.log("---");
    });
  }, [mainBackDevices]);

  React.useEffect(() => {
    (async () => {
      const cameraPermission = await Camera.requestCameraPermission();
      setHasPermission(cameraPermission === "granted");
    })();
  }, []);

  const switchToPreviousLens = useCallback(() => {
    if (mainBackDevices.length > 1) {
      setCurrentDeviceIndex((prevIndex) =>
        prevIndex > 0 ? prevIndex - 1 : prevIndex
      );
    }
  }, [mainBackDevices]);

  const switchToNextLens = useCallback(() => {
    if (mainBackDevices.length > 1) {
      setCurrentDeviceIndex((prevIndex) =>
        prevIndex < mainBackDevices.length - 1 ? prevIndex + 1 : prevIndex
      );
    }
  }, [mainBackDevices]);

  const captureImage = useCallback(async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePhoto({
          flash: "off",
        });

        const croppedImage = await ImagePicker.openCropper({
          path: `file://${photo.path}`,
          width: 1600,
          height: 900,
          mediaType: "photo",
          cropping: true,
          cropperToolbarTitle: "Crop Image (16:9)",
          freeStyleCropEnabled: true,
          includeBase64: true,
        });

        setIsLoading(true); // Start loading
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
            Alert.alert(
              "LaTeX Copied",
              "The LaTeX expression has been copied to your clipboard.",
              [{ text: "OK" }]
            );
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
          setIsLoading(false); // Stop loading regardless of success or failure
        }
      } catch (error) {
        console.error("Error capturing image:", error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        Alert.alert("Error", `Error capturing image: ${errorMessage}`);
      }
    }
  }, []);

  if (!hasPermission) {
    return <Text>No access to camera</Text>;
  }

  if (mainBackDevices.length === 0) {
    return <Text>No main back cameras found</Text>;
  }

  const currentDevice = mainBackDevices[currentDeviceIndex];

  return (
    <GestureHandlerRootView style={styles.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={currentDevice}
        isActive={true}
        photo={true}
      />
      <View style={styles.buttonContainer}>
        {mainBackDevices.length > 1 && (
          <>
            <TouchableOpacity
              style={[
                styles.lensButton,
                currentDeviceIndex === 0 && styles.disabledButton,
              ]}
              onPress={switchToPreviousLens}
              disabled={currentDeviceIndex === 0}
            >
              <Text style={styles.buttonText}>-</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.lensButton,
                currentDeviceIndex === mainBackDevices.length - 1 &&
                  styles.disabledButton,
              ]}
              onPress={switchToNextLens}
              disabled={currentDeviceIndex === mainBackDevices.length - 1}
            >
              <Text style={styles.buttonText}>+</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity style={styles.captureButton} onPress={captureImage}>
          <Text style={styles.buttonText}>Capture</Text>
        </TouchableOpacity>
      </View>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
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
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 20, // Add some horizontal padding
  },
  lensButton: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
    width: 80, // Increased from 50 to 80
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.5,
  },
  captureButton: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
    width: 100, // Added width to make it consistent with other buttons
    alignItems: "center", // Center the text
  },
  buttonText: {
    fontSize: 18,
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
});
