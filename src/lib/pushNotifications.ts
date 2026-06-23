import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { db } from "./firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

// Global build-time constant injected by Vite
declare const __HAS_GOOGLE_SERVICES__: boolean;

/**
 * Initializes and registers Capacitor Push Notifications and Local Notifications on Android.
 * Automatically saves the FCM Registration Token to Firestore under "admin_fcm_tokens" for the admin.
 */
export async function initPushNotifications(userId: string, email: string) {
  if (Capacitor.getPlatform() !== "android") {
    console.log("Push notifications are disabled on web/non-android environment. Requesting browser notification permission fallback.");
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        if (Notification.permission === "default") {
          await Notification.requestPermission();
        }
        console.log("Web Notification status:", Notification.permission);
      } catch (err) {
        console.warn("Failed to request Web Notification permission:", err);
      }
    }
    return;
  }

  // Safety guard check for google-services.json existence at compile time
  if (typeof __HAS_GOOGLE_SERVICES__ !== "undefined" && !__HAS_GOOGLE_SERVICES__) {
    console.warn("FCM Push Notifications initialization aborted: google-services.json is not present in android/app. Safe local fallback.");
    return;
  }

  try {
    console.log("Initializing push notification system for admin:", email);

    // 1. Create a specialized High-Importance Notification Channel for Android 8.0+
    await PushNotifications.createChannel({
      id: "payment_alerts",
      name: "Payment & Live Alerts",
      description: "Real-time critical alerts for MCQ Hero Admin members",
      importance: 5, // Max importance: pop up on screen, play sound, vibrate
      visibility: 1, // Public on lockscreen
      vibration: true,
      sound: "default"
    });

    await LocalNotifications.createChannel({
      id: "payment_alerts",
      name: "Payment & Live Alerts",
      description: "Real-time critical alerts for MCQ Hero Admin members",
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: "default"
    });

    // 2. Request and verify notification permissions
    let pushPerm = await PushNotifications.checkPermissions();
    if (pushPerm.receive === "prompt") {
      pushPerm = await PushNotifications.requestPermissions();
    }

    let localPerm = await LocalNotifications.checkPermissions();
    if (localPerm.display === "prompt") {
      localPerm = await LocalNotifications.requestPermissions();
    }

    if (pushPerm.receive !== "granted") {
      console.warn("FCM push notification permissions are not granted.");
    }
    if (localPerm.display !== "granted") {
      console.warn("Local notification permissions are not granted.");
    }

    // 3. Register device with FCM / Google Services
    await PushNotifications.register();

    // 4. Listeners for token registration success
    await PushNotifications.addListener("registration", async (token) => {
      console.log("Registering FCM token with Firestore:", token.value);
      try {
        await setDoc(
          doc(db, "admin_fcm_tokens", token.value),
          {
            token: token.value,
            userId,
            email,
            platform: "android",
            status: "active",
            registeredAt: serverTimestamp(),
            lastActive: serverTimestamp(),
          },
          { merge: true }
        );
        console.log("FCM registration token persisted to Firestore successfully.");
        localStorage.setItem("admin_fcm_token", token.value);
      } catch (err) {
        console.error("Failed to persist FCM token in Firestore:", err);
      }
    });

    // 5. Registration failure listener
    await PushNotifications.addListener("registrationError", (error) => {
      console.error("Capacitor registration error:", error);
    });

    // 6. Listener for foreground/background incoming push notifications
    await PushNotifications.addListener("pushNotificationReceived", async (notification) => {
      console.log("Push notification received:", notification);
      
      // Schedule a local overlay banner with customized sound and vibration
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 100000) + 1,
            title: notification.title || "🔔 নতুন পেমেন্ট রিকোয়েস্ট!",
            body: notification.body || "নতুন লেনদেন পেমেন্ট অনুমোদন করুন।",
            channelId: "payment_alerts",
            extra: notification.data || {},
          },
        ],
      });
    });

    // 7. Listener for push notification action performance (tap)
    await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      console.log("Notification tapped:", action);
    });

  } catch (err) {
    console.error("Critical failure during Push Notification initialization:", err);
  }
}

/**
 * Triggers a real-time native local notification overlay on Android build.
 * Intended to run inside active admin session whenever snapshot listener registers a pending payment.
 */
export async function triggerLocalNativePaymentNotification(payment: any) {
  const isPending = !payment.status || payment.status === "pending";
  const title = isPending ? "🔔 নতুন পেমেন্ট রিকোয়েস্ট!" : "💰 পেমেন্ট ট্র্যাকার আপডেট";
  const body = `ইমেইল: ${payment.email || "অজ্ঞাতনামা"}\nপ্ল্যান/কোর্স: ${payment.planName || payment.premiumPlan || "N/A"}\nমেথড: ${payment.method || "N/A"}`;

  if (Capacitor.getPlatform() !== "android") {
    // Web fallback using standard HTML5 Notifications
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        try {
          new Notification(title, {
            body,
            icon: "/icon.png"
          });
          console.log("Web browser notification triggered successfully.");
        } catch (err) {
          console.warn("Failed to fire browser Notification:", err);
        }
      } else {
        console.warn("Browser Notification permissions not granted or denied.");
      }
    }
    return;
  }

  try {

    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 100000) + 1,
          title,
          body,
          channelId: "payment_alerts",
          extra: payment,
        },
      ],
    });
    console.log("Local Native Notification Alert triggered for payment:", payment.id);
  } catch (err) {
    console.warn("Failed to trigger local native notification overlay:", err);
  }
}
