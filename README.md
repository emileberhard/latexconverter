# LaTeX Converter App 📸➡️📝

This is a simple Expo React Native app I made while studying for a math exam, designed to capture images of mathematical equations using the device camera and convert them into LaTeX code using the OpenAI API + copy to clipboard. Combined with handoff sync on Apple devices it becomes a very convenient & fast way of transferring handwritten math into latex easily passed into tutor-LLMs or similar.

## ✨ Features

*   **Camera Input:** Uses `react-native-vision-camera` for a native camera experience.
*   **Multiple Capture Modes:**
    *   **Direct Capture:** Takes a photo and sends the whole image for conversion.
    *   **Crop:** Allows cropping the photo before sending for conversion using `react-native-image-crop-picker`.
    *   **Annotate/Paint:** Allows drawing a circle on the photo (using `@shopify/react-native-skia`) to specify the area with math to convert.
*   **AI Conversion:** Leverages OpenAI's vision models (GPT-4o or GPT-4o-mini) to analyze the image and generate LaTeX.
*   **Clipboard:** Automatically copies the generated LaTeX code to the clipboard.
*   **Cost Tracking:** Logs estimated token usage and cost for OpenAI API calls in the console.
*   **Built with Expo:** Easy setup and development workflow.

## 🚀 Getting Started

1.  **Clone the repository (if you haven't):**
    ```bash
    git clone <your-repo-url>
    cd emileberhard-latexconverter
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up OpenAI API Key:**
    *   You need an API key from OpenAI.
    *   Create a `.env` file in the root of the project (`emileberhard-latexconverter/.env`).
    *   Add your API key to the `.env` file like this:
        ```
        EXPO_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here
        ```
    *   *(Note: For EAS builds, you'll need to configure the `OPENAI_API_KEY` as an EAS Secret).*

4.  **Start the app:**
    *   **Using Expo Go (on device):**
        ```bash
        npx expo start
        ```
        Scan the QR code with the Expo Go app on your Android or iOS device.
    *   **Using Simulator/Emulator (requires setup):**
        ```bash
        npm run ios
        # or
        npm run android
        ```

## 🛠️ How it Works

1.  The app displays a camera view.
2.  You can use pinch gestures to zoom.
3.  Choose one of the three capture buttons:
    *   ⚡️ **Direct:** Captures the current view.
    *   ✂️ **Crop:** Captures, then opens a cropping interface.
    *   🖌️ **Paint:** Captures, then opens a painting interface where you circle the math.
4.  The selected (and possibly edited) image is sent to the configured OpenAI model.
5.  The API attempts to identify math in the image (or the circled area) and returns it as LaTeX code.
6.  If successful, the LaTeX code is copied to your clipboard, and a confirmation message appears briefly.

---

Enjoy converting math to LaTeX! 🎉
