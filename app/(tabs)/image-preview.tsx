import React from "react";
import { View, Image, StyleSheet, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";

export default function ImagePreviewScreen() {
  const { imageUri, latex } = useLocalSearchParams();
  const router = useRouter();

  const uri = Array.isArray(imageUri) ? imageUri[0] : imageUri;

  console.log("LaTeX:", latex);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
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
        {latex ? (
          <ThemedText style={styles.latexText}>{latex}</ThemedText>
        ) : (
          <ThemedText>No LaTeX response</ThemedText>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollViewContent: {
    alignItems: "center",
    justifyContent: "flex-start",
  },
  image: {
    width: "100%",
    height: 300,
  },
  latexText: {
    marginTop: 20,
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 10,
  },
});
