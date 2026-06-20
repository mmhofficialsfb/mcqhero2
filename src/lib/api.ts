/**
 * Resolves an API path (like "/api/gemini/generate-questions") to either a local relative path
 * or the absolute hosted App URL if the app is running on a mobile device or offline standalone container
 * (such as Capacitor, Cordova, file://, localhost, or standard standalone single-file HTML).
 */
export const resolveApiUrl = (path: string): string => {
  if (typeof window !== "undefined") {
    const isLocal =
      window.location.protocol === "file:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.startsWith("192.168.") ||
      window.location.hostname.includes("capacitor") ||
      // If it is not running on the cloud deployment hostname
      !window.location.hostname.includes("asia-southeast1.run.app");

    if (isLocal) {
      const hostedBaseUrl = "https://ais-pre-zw3x24xm35bs526mu55sme-1013337780190.asia-southeast1.run.app";
      return `${hostedBaseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : "/" + path}`;
    }
  }
  return path;
};
