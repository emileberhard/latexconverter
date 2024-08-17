import React, { useState, useCallback } from "react";
import { View, Image, StyleSheet } from "react-native";
import {
  Canvas,
  Image as SkiaImage,
  useImage,
  Path,
  Skia,
  TouchInfo,
  useTouchHandler,
} from "@shopify/react-native-skia";

const PaintOnImage = ({ imageUrl, width, height, children }) => {
  const image = useImage(imageUrl);
  const [paths, setPaths] = useState([]);

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

  if (!image) {
    return <View style={[styles.container, { width, height }]} />;
  }

  return (
    <View style={styles.container}>
      <Canvas style={{ width, height }} onTouch={touchHandler}>
        <SkiaImage
          image={image}
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
            strokeWidth={5}
            style="stroke"
            color="red"
          />
        ))}
      </Canvas>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default PaintOnImage;
