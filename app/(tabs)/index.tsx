import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Dimensions,
} from "react-native";
import { CameraView, Camera } from "expo-camera";
import * as FileSystem from "expo-file-system";
import { OpenAI } from "openai";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import ImagePicker from "react-native-image-crop-picker";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod"; // Add this import

const OPENAI_API_KEY =
  "sk-proj-VFyGtiY1hPXxUAxYs8v1T3BlbkFJ79xSOLRuWvoKLdR8Pmet";

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const { width, height } = Dimensions.get("window");

// Define the Zod schema
const latexResponseSchema = z.object({
  latex: z.string(),
});

export default function CameraScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  const captureImage = useCallback(async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 1,
          base64: true,
          skipProcessing: true,
        });
        if (!photo) {
          throw new Error("Failed to take picture");
        }

        // Open the image cropper
        const croppedImage = await ImagePicker.openCropper({
          path: photo.uri,
          width: 1000,
          height: 1000,
          mediaType: "photo",
          cropping: true,
          freeStyleCropEnabled: true,
          includeBase64: true,
        });

        // Save the cropped image to the cache directory
        const fileName = `cropped_image_${Date.now()}.jpg`;
        const filePath = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(filePath, croppedImage.data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        console.log(`Cropped image saved to: ${filePath}`);
        alert(`Cropped image saved to: ${filePath}`);

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
          } else {
            console.error("Error: Invalid LaTeX conversion received", response);
            alert("Error: Invalid LaTeX conversion received");
          }
        } catch (error) {
          console.error("Error:", error);
          alert("Error converting image to LaTeX");
        }

        // Navigate to image preview with the saved file path
        router.push({
          pathname: "/image-preview",
          params: { imageUri: filePath },
        });
      } catch (error) {
        console.error("Error capturing image:", error);
        alert("Error capturing image");
      }
    }
  }, [router]);

  if (hasPermission === null) {
    return <View />;
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={"back"}
        autofocus="off"
        zoom={0}
        pictureSize="max"
      />
      <TouchableOpacity style={styles.captureButton} onPress={captureImage}>
        <Text style={styles.captureButtonText}>Capture</Text>
      </TouchableOpacity>
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
  captureButton: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
  },
  captureButtonText: {
    fontSize: 18,
  },
});
