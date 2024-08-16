import React from "react";
import { View, Image, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";

export default function ImagePreviewScreen() {
  const { imageUri } = useLocalSearchParams();
  const router = useRouter();

  // Handle the case where imageUri might be an array
  const uri = Array.isArray(imageUri) ? imageUri[0] : imageUri;

  // Log the URI for debugging
  console.log("Image URI:", uri);

  return (
    <ThemedView style={styles.container}>
      {uri ? (
        <Image
          source={{ uri: uri.toString() }}
          style={styles.image}
          resizeMode="contain"
          onError={(error) =>
            console.error("Image loading error:", error.nativeEvent.error)
          }
        />
      ) : (
        <ThemedText>No image to preview</ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
