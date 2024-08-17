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

// Use the secret from Expo constants
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

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

  const switchCamera = useCallback(() => {
    if (mainBackDevices.length > 1) {
      setCurrentDeviceIndex(
        (prevIndex) => (prevIndex + 1) % mainBackDevices.length
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

        try {
          const response = await openai.beta.chat.completions.parse({
            model: "gpt-4o-2024-08-06",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: "Convert this to LaTeX" },
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
            alert("LaTeX conversion copied to clipboard!");

            router.push({
              pathname: "/image-preview",
              params: {
                imageUri: `data:image/jpeg;base64,${croppedImage.data}`,
                latex: parsedResponse.latex,
              },
            });
          } else {
            console.error("Error: Invalid LaTeX conversion received", response);
            alert("Error: Invalid LaTeX conversion received");
          }
        } catch (error) {
          console.error("Error:", error);
          alert("Error converting image to LaTeX");

          router.push({
            pathname: "/image-preview",
            params: { imageUri: `data:image/jpeg;base64,${croppedImage.data}` },
          });
        }
      } catch (error) {
        console.error("Error capturing image:", error);
        alert("Error capturing image");
      }
    }
  }, [router]);

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
          <TouchableOpacity style={styles.switchButton} onPress={switchCamera}>
            <Text style={styles.buttonText}>Switch Lens</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.captureButton} onPress={captureImage}>
          <Text style={styles.buttonText}>Capture</Text>
        </TouchableOpacity>
      </View>
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
  },
  switchButton: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
  },
  captureButton: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
  },
  buttonText: {
    fontSize: 18,
  },
});
