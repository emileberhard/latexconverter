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
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import * as ImageManipulator from "expo-image-manipulator";

const OPENAI_API_KEY =
  "sk-proj-VFyGtiY1hPXxUAxYs8v1T3BlbkFJ79xSOLRuWvoKLdR8Pmet";

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const { width, height } = Dimensions.get("window");

export default function CameraScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const cropBoxSize = useSharedValue({
    width: width * 0.8,
    height: height * 0.3,
  });
  const cropBoxPosition = useSharedValue({ x: width * 0.1, y: height * 0.35 });

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  const updateCropBoxSize = useCallback(
    (newWidth: number, newHeight: number) => {
      cropBoxSize.value = {
        width: Math.max(100, Math.min(newWidth, width)),
        height: Math.max(100, Math.min(newHeight, height)),
      };
    },
    []
  );

  const panGesture = Gesture.Pan().onUpdate((e) => {
    cropBoxPosition.value = {
      x: Math.max(
        0,
        Math.min(
          e.absoluteX - cropBoxSize.value.width / 2,
          width - cropBoxSize.value.width
        )
      ),
      y: Math.max(
        0,
        Math.min(
          e.absoluteY - cropBoxSize.value.height / 2,
          height - cropBoxSize.value.height
        )
      ),
    };
  });

  const cornerGesture = Gesture.Pan()
    .onStart(() => {
      runOnJS(updateCropBoxSize)(
        cropBoxSize.value.width,
        cropBoxSize.value.height
      );
    })
    .onUpdate((e) => {
      const newWidth = cropBoxSize.value.width + e.translationX;
      const newHeight = cropBoxSize.value.height + e.translationY;
      runOnJS(updateCropBoxSize)(newWidth, newHeight);
    });

  const composed = Gesture.Simultaneous(panGesture, cornerGesture);

  const animatedStyles = useAnimatedStyle(() => ({
    width: withTiming(cropBoxSize.value.width, { duration: 100 }),
    height: withTiming(cropBoxSize.value.height, { duration: 100 }),
    transform: [
      { translateX: cropBoxPosition.value.x },
      { translateY: cropBoxPosition.value.y },
    ] as const,
  }));

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

        // Calculate crop region
        const cropRegion = {
          originX: cropBoxPosition.value.x / width,
          originY: cropBoxPosition.value.y / height,
          width: cropBoxSize.value.width / width,
          height: cropBoxSize.value.height / height,
        };

        // Use Image Manipulator to crop the image
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ crop: cropRegion }],
          { base64: true }
        );

        // Save the cropped image to the cache directory
        const fileName = `cropped_image_${Date.now()}.jpg`;
        const filePath = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(
          filePath,
          manipulatedImage.base64!,
          {
            encoding: FileSystem.EncodingType.Base64,
          }
        );

        console.log(`Cropped image saved to: ${filePath}`);
        alert(`Cropped image saved to: ${filePath}`);

        try {
          const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: "Convert this to LaTeX" },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${manipulatedImage.base64}`,
                    },
                  },
                ],
              },
            ],
          });

          const latexResponse = response.choices[0].message.content;
          if (latexResponse) {
            await Clipboard.setStringAsync(latexResponse);
            alert("LaTeX conversion copied to clipboard!");
          } else {
            alert("Error: No LaTeX conversion received");
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
  }, [router, cropBoxPosition.value, cropBoxSize]);

  if (hasPermission === null) {
    return <View />;
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={"back"} />
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.cropBox, animatedStyles]}>
          <View style={styles.cornerTopLeft} />
          <View style={styles.cornerTopRight} />
          <View style={styles.cornerBottomLeft} />
          <View style={styles.cornerBottomRight} />
        </Animated.View>
      </GestureDetector>
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
  cropBox: {
    borderWidth: 2,
    borderColor: "white",
    position: "absolute",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  cornerTopLeft: {
    position: "absolute",
    top: -10,
    left: -10,
    width: 20,
    height: 20,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: "white",
  },
  cornerTopRight: {
    position: "absolute",
    top: -10,
    right: -10,
    width: 20,
    height: 20,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: "white",
  },
  cornerBottomLeft: {
    position: "absolute",
    bottom: -10,
    left: -10,
    width: 20,
    height: 20,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: "white",
  },
  cornerBottomRight: {
    position: "absolute",
    bottom: -10,
    right: -10,
    width: 20,
    height: 20,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: "white",
  },
});
