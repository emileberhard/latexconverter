import React, { useState, useCallback, useRef, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import {
  Canvas,
  Image as SkiaImage,
  useImage,
  Path,
  Skia,
  useTouchHandler,
  useCanvasRef,
} from "@shopify/react-native-skia";

// Define prop types
interface PaintOnImageProps {
  imageUrl: string;
  previewUrl: string;
  width: number;
  height: number;
  onSave: (editedImageUri: string) => void;
  onCancel: () => void;
}

const PaintOnImage = React.memo(
  ({
    imageUrl,
    previewUrl,
    width,
    height,
    onSave,
    onCancel,
  }: PaintOnImageProps) => {
    const [paths, setPaths] = useState([]);
    const canvasRef = useCanvasRef();
    const previewImage = useImage(previewUrl);
    const fullImage = useImage(imageUrl);
    const [currentImage, setCurrentImage] = useState(null);
    const [bbox, setBbox] = useState({
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    });

    useEffect(() => {
      if (previewImage) {
        setCurrentImage(previewImage);
      }
    }, [previewImage]);

    useEffect(() => {
      if (fullImage) {
        setCurrentImage(fullImage);
      }
    }, [fullImage]);

    const onDrawingStart = useCallback((touchInfo) => {
      setPaths((currentPaths) => {
        const { x, y } = touchInfo;
        const newPath = Skia.Path.Make();
        newPath.moveTo(x, y);
        return [...currentPaths, newPath];
      });
    }, []);

    const onDrawingActive = useCallback((touchInfo) => {
      setPaths((currentPaths) => {
        const { x, y } = touchInfo;
        const currentPath = currentPaths[currentPaths.length - 1];
        const lastPoint = currentPath.getLastPt();
        const xMid = (lastPoint.x + x) / 2;
        const yMid = (lastPoint.y + y) / 2;

        currentPath.quadTo(lastPoint.x, lastPoint.y, xMid, yMid);

        // Update bounding box
        setBbox((currentBbox) => {
          return {
            minX: Math.min(currentBbox.minX, x),
            minY: Math.min(currentBbox.minY, y),
            maxX: Math.max(currentBbox.maxX, x),
            maxY: Math.max(currentBbox.maxY, y),
          };
        });

        return [...currentPaths.slice(0, currentPaths.length - 1), currentPath];
      });
    }, []);

    const touchHandler = useTouchHandler(
      {
        onStart: onDrawingStart,
        onActive: onDrawingActive,
      },
      [onDrawingStart, onDrawingActive]
    );

    const handleConfirm = useCallback(() => {
      if (canvasRef.current) {
        const { minX, minY, maxX, maxY } = bbox;

        // Ensure bounding box is valid
        if (minX <= maxX && minY <= maxY) {
          const snapshot = canvasRef.current.makeImageSnapshot({
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
          });

          if (snapshot) {
            const base64 = snapshot.encodeToBase64();
            onSave(`data:image/png;base64,${base64}`);
          }
        } else {
          // Handle case where no drawing has been done
          console.warn("No drawing detected.");
        }
      }
    }, [onSave, bbox, canvasRef]);

    if (!currentImage) {
      return <View style={[styles.container, { width, height }]} />;
    }

    return (
      <View style={styles.container}>
        <Canvas
          style={{ width, height }}
          ref={canvasRef}
          onTouch={touchHandler}
        >
          <SkiaImage
            image={currentImage}
            fit="contain"
            x={0}
            y={0}
            width={width}
            height={height}
          />
          {paths.map((path, index) => (
            <Path
              key={index}
              path={path}
              strokeWidth={10}
              style="stroke"
              color="#ff2020"
            />
          ))}
        </Canvas>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.confirmButton]}
            onPress={handleConfirm}
          >
            <Text style={styles.buttonText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    position: "absolute",
    bottom: 20,
    paddingHorizontal: 20,
  },
  button: {
    padding: 15,
    borderRadius: 5,
  },
  confirmButton: {
    backgroundColor: "green",
  },
  cancelButton: {
    backgroundColor: "red",
  },
  buttonText: {
    color: "white",
  },
});

export default PaintOnImage;
