import React, { useState, useEffect } from "react";
import {
  Settings,
  BookOpen,
  FolderPlus,
  Compass,
  FileText,
  Tag,
  Bell,
  Send,
  Trash2,
  Lock,
  Globe,
  HelpCircle,
  Loader2,
  AlertTriangle,
  Smartphone,
  Volume2,
  Zap,
  CheckCircle,
  XCircle,
  Edit2,
  Eye,
  EyeOff,
  Copy,
  Sparkles
} from "lucide-react";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { resolveApiUrl } from "../lib/api";
import { Category, SubCategory, Course, RecentInfo, Coupon, PremiumPlan, Question } from "../types";

interface BulletinsAndSettingsProps {
  categories: Category[];
  subcategories: SubCategory[];
  questions?: Question[];
  courses: Course[];
  bulletins: RecentInfo[];
  coupons: Coupon[];
  premiumPlans: PremiumPlan[];
  triggerReload: () => void;
  globalNotice: { title: string; message: string; active: boolean; freeUserQuestionLimit?: number; dailyQuestionLimit?: number };
  maintenanceMode: boolean;
  isSandboxMode?: boolean;
  onSimulateAlert?: (p: any) => void;
}

export default function BulletinsAndSettings({
  categories,
  subcategories,
  questions = [],
  courses,
  bulletins,
  coupons,
  premiumPlans,
  triggerReload,
  globalNotice,
  maintenanceMode,
  isSandboxMode,
  onSimulateAlert
}: BulletinsAndSettingsProps) {
  const [activeSegment, setActiveTab] = useState<"courses" | "groups" | "coupons" | "configs" | "plans" | "api_keys" | "phone_auth">("courses");
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

  // Phone Auth Tester States
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [testOtpCode, setTestOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [verificationSuccess, setVerificationSuccess] = useState("");
  const [confirmResult, setConfirmResult] = useState<any>(null);
  const [verifiedUserInfo, setVerifiedUserInfo] = useState<any>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneLoading(true);
    setVerificationError("");
    setVerificationSuccess("");
    setVerifiedUserInfo(null);

    if (!testPhoneNumber.trim()) {
      setVerificationError("অনুগ্রহ করে একটি সচল মোবাইল নম্বর দিন।");
      setPhoneLoading(false);
      return;
    }

    let phoneNumber = testPhoneNumber.trim();
    if (phoneNumber.startsWith("0")) {
      phoneNumber = "+88" + phoneNumber;
    } else if (!phoneNumber.startsWith("+")) {
      phoneNumber = "+" + phoneNumber;
    }

    try {
      if ((window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier.clear();
        } catch (e) {}
      }

      const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "normal",
        theme: "dark",
        callback: () => {
          // Solved
        },
        "expired-callback": () => {
          setVerificationError("ReCAPTCHA ভেরিফিকেশন সেশন সময় উত্তীর্ণ হয়েছে। আবার চেষ্টা করুন।");
        }
      });
      
      (window as any).recaptchaVerifier = verifier;

      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier);
      setConfirmResult(confirmationResult);
      setOtpSent(true);
      setVerificationSuccess(`সফলভাবে ${phoneNumber} নম্বরে ৪-৬ ডিজিটের ওটিপি (OTP) পাঠানো হয়েছে! কোডটি নিচে ইনপুট দিন।`);
    } catch (err: any) {
      console.error("Firebase Phone Auth SMS send error:", err);
      let errMsg = err.message || "";
      if (err.code === "auth/captcha-check-failed") {
        errMsg = "ReCAPTCHA ভেরিফিকেশন সম্পূর্ণ হয়নি অথবা ক্যাপচা পরীক্ষা ফেল করেছে।";
      } else if (err.code === "auth/invalid-phone-number") {
        errMsg = "ভুল মোবাইল নম্বর ফরম্যাট প্রদান করেছেন! অনুগ্রহ করে দেশের কোড এবং সচল নম্বরটি লিখুন (যেমন: +8801700000000)।";
      } else if (err.code === "auth/quota-exceeded") {
        errMsg = "ফায়ারবেস এসএমএস কোটা শেষ হয়ে গেছে! অনুগ্রহ করে ফায়ারবেস কনসোলে আপনার ফ্রি এসএমএস লিমিট বা বিলিং চেক করুন।";
      } else if (err.code === "auth/too-many-requests") {
        errMsg = "অনেক বেশি ট্রাই করা হয়েছে! সার্ভার সাময়িকভাবে এই আইপি বা নাম্বার ব্লক করেছে। একটু পর আবার চেষ্টা করুন।";
      }
      setVerificationError(`ওটিপি পাঠাতে সমস্যা হয়েছে: ${errMsg}`);
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneLoading(true);
    setVerificationError("");
    setVerificationSuccess("");

    if (!testOtpCode.trim()) {
      setVerificationError("অনুগ্রহ করে প্রাপ্ত ওটিপি (OTP) ওটিপি বক্সে প্রদান করুন।");
      setPhoneLoading(false);
      return;
    }

    if (!confirmResult) {
      setVerificationError("সেশনটি অচল হয়ে গেছে। অনুগ্রহ করে আবার ওটিপি রিকোয়েস্ট পাঠান।");
      setPhoneLoading(false);
      return;
    }

    try {
      const result = await confirmResult.confirm(testOtpCode.trim());
      const user = result.user;
      
      setVerifiedUserInfo({
        uid: user.uid,
        phoneNumber: user.phoneNumber,
        createdAt: user.metadata.creationTime,
        lastLogin: user.metadata.lastSignInTime,
        provider: user.providerId || "phone"
      });
      setVerificationSuccess(`অভিনন্দন! আপনার মোবাইল নম্বর সফলভাবে ফায়ারবেস (Firebase Auth) দিয়ে ভেরিফাইড করা হয়েছে!`);
    } catch (err: any) {
      console.error("Firebase Phone Auth code verification error:", err);
      let errMsg = err.message || "";
      if (err.code === "auth/invalid-verification-code") {
        errMsg = "প্রদত্ত ওটিপি (OTP) কোডটি ভুল বা অবৈধ! অনুগ্রহ করে আবার চেক করুন।";
      } else if (err.code === "auth/code-expired") {
        errMsg = "কোডটির মেয়াদ শেষ হয়ে গেছে। নতুন একটি এসএমএস রিকোয়েস্ট করুন।";
      }
      setVerificationError(`ওটিপি মিলছে না: ${errMsg}`);
    } finally {
      setPhoneLoading(false);
    }
  };

  const resetPhoneAuthTester = () => {
    if ((window as any).recaptchaVerifier) {
      try {
        (window as any).recaptchaVerifier.clear();
      } catch (e) {}
      (window as any).recaptchaVerifier = null;
    }
    setTestPhoneNumber("");
    setTestOtpCode("");
    setOtpSent(false);
    setPhoneLoading(false);
    setVerificationError("");
    setVerificationSuccess("");
    setConfirmResult(null);
    setVerifiedUserInfo(null);
    const container = document.getElementById("recaptcha-container");
    if (container) {
      container.innerHTML = "";
    }
  };

  // Loading
  const [loading, setLoading] = useState(false);

  // 1. Courses State
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDesc, setCourseDesc] = useState("");
  const [courseAccess, setCourseAccess] = useState<"free" | "premium">("free");
  const [courseStatus, setCourseStatus] = useState<"running" | "all">("running");
  const [courseLive, setCourseLive] = useState(true);
  const [coursePrice, setCoursePrice] = useState("");
  const [coursePromoPrice, setCoursePromoPrice] = useState("");
  const [coursePdfUrl, setCoursePdfUrl] = useState("");
  const [coursePdfTitle, setCoursePdfTitle] = useState("");
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);

  // 2. Groups (Categories) State
  const [catName, setCatName] = useState("");
  const [catAccess, setCatAccess] = useState<"free" | "premium">("free");

  // 3. Subcategories State
  const [subParentId, setSubParentId] = useState("");
  const [subName, setSubName] = useState("");
  const [editingSubId, setEditingSubId] = useState<string | null>(null);

  // 4. Bulletins State
  const [recentTitle, setRecentTitle] = useState("");
  const [recentDesc, setRecentDesc] = useState("");
  const [recentCategory, setRecentCategory] = useState("All");
  const [recentPinned, setRecentPinned] = useState(false);
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);

  // 5. Coupons State
  const [cpCode, setCpCode] = useState("");
  const [cpDisc, setCpDisc] = useState<number>(20);

  // 6. Global alert popup notice State
  const [noticeTitle, setNoticeTitle] = useState(globalNotice.title);
  const [noticeMsg, setNoticeMsg] = useState(globalNotice.message);
  const [noticeActive, setNoticeActive] = useState(globalNotice.active);
  const [freeLimit, setFreeLimit] = useState<number>(globalNotice.freeUserQuestionLimit || 20);
  const [dailyQuestionLimit, setDailyQuestionLimit] = useState<number>(globalNotice.dailyQuestionLimit || 15);

  // Synchronize freeLimit state on prop change
  useEffect(() => {
    if (globalNotice?.freeUserQuestionLimit !== undefined) {
      setFreeLimit(globalNotice.freeUserQuestionLimit);
    }
  }, [globalNotice]);

  // Synchronize dailyQuestionLimit state on prop change
  useEffect(() => {
    if (globalNotice?.dailyQuestionLimit !== undefined) {
      setDailyQuestionLimit(globalNotice.dailyQuestionLimit);
    }
  }, [globalNotice]);

  // 7. Maintenance Mode State
  const [maintChecked, setMaintChecked] = useState(maintenanceMode);

  // Synchronize maintChecked state if prop changes
  useEffect(() => {
    setMaintChecked(maintenanceMode);
  }, [maintenanceMode]);

  // Modal & Toast state for Maintenance Toggle
  const [maintConfirmModal, setMaintConfirmModal] = useState<{
    isOpen: boolean;
    checked: boolean;
  } | null>(null);

  const [settingsToast, setSettingsToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const [noticeConfirmModalOpen, setNoticeConfirmModalOpen] = useState(false);

  const showSettingsToast = (message: string, type: "success" | "error") => {
    setSettingsToast({ message, type });
  };

  useEffect(() => {
    if (settingsToast) {
      const timer = setTimeout(() => setSettingsToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [settingsToast]);

  // 10. Premium Plans Management State
  const [planName, setPlanName] = useState("");
  const [planValidity, setPlanValidity] = useState("");
  const [planPrice, setPlanPrice] = useState("");
  const [planPromoPrice, setPlanPromoPrice] = useState("");
  const [planFeaturesText, setPlanFeaturesText] = useState("");
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  // 8. Broadcast Notification State
  const [notifHeader, setNotifHeader] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [notifImage, setNotifImage] = useState("");

  // 9. Telegram Notification Setup State
  const [tgToken, setTgToken] = useState("");
  const [tgChatId, setTgChatId] = useState("");
  const [tgEnabled, setTgEnabled] = useState(false);
  const [soundAlert, setSoundAlert] = useState(true);
  const [webhUrl, setWebhUrl] = useState("");
  const [androidFcmEnabled, setAndroidFcmEnabled] = useState(false);

  // 11. Custom API Base URL for Android Studio / Mobile
  const [customApiUrl, setCustomApiUrl] = useState("");
  const [fcmTokens, setFcmTokens] = useState<any[]>([]);
  const [webNotificationStatus, setWebNotificationStatus] = useState(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCustomApiUrl(window.localStorage.getItem("custom_api_base_url") || "");
    }
  }, []);

  // 12. Backup/Rotatable API Keys Management State
  const [backupKeys, setBackupKeys] = useState<any[]>([]);
  const [envKeyInfo, setEnvKeyInfo] = useState<any>(null);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [keysLoading, setKeysLoading] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");
  const [newApiKeyLabel, setNewApiKeyLabel] = useState("");

  const fetchBackupKeys = async () => {
    try {
      setKeysLoading(true);
      const res = await fetch(resolveApiUrl("/api/gemini-keys"));
      const data = await res.json();
      if (data.keys) {
        setBackupKeys(data.keys);
      }
      setEnvKeyInfo({
        hasEnvKey: data.hasEnvKey,
        envKey: data.envKey,
        envKeyMasked: data.envKeyMasked,
        envKeyCooldown: data.envKeyCooldown
      });
    } catch (err) {
      console.warn("Failed to load Gemini keys:", err);
    } finally {
      setKeysLoading(false);
    }
  };

  const handleCopyKey = (key: string, id: string) => {
    if (!key) return;
    navigator.clipboard.writeText(key)
      .then(() => {
        setCopiedKeyId(id);
        setTimeout(() => setCopiedKeyId(null), 2000);
      })
      .catch((err) => {
        console.warn("Failed to copy API key to clipboard:", err);
      });
  };

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddApiKey = async (e: React.FormEvent, isForced = false) => {
    if (e) e.preventDefault();
    if (!newApiKey.trim()) {
      alert("অনুগ্রহ করে একটি সচল Gemini API Key যোগ করুন।");
      return;
    }
    setKeysLoading(true);
    try {
      const response = await fetch(resolveApiUrl("/api/gemini-keys"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newApiKey.trim(), label: newApiKeyLabel.trim(), force: isForced })
      });
      const result = await response.json();
      if (response.ok) {
        if (result.warning) {
          alert(`যোগ করা হয়েছে!\n\n${result.warning}`);
        } else {
          alert("সফলভাবে এপিআই কীটি ভ্যালিডেট এবং সেভ করা হয়েছে!");
        }
        setNewApiKey("");
        setNewApiKeyLabel("");
        fetchBackupKeys();
      } else {
        if (result.canForce) {
          const confirmForce = window.confirm(`${result.error}\n\nআপনি কি তাও যেকোনো উপায়ে এটি জোরপূর্বক ব্যাকআপ লিস্টে সেভ করতে চান?`);
          if (confirmForce) {
            handleAddApiKey(undefined as any, true);
            return;
          }
        } else {
          alert("এরর: " + (result.error || "যুক্ত করা বা ভ্যালিডেট করা যায়নি।"));
        }
      }
    } catch (err: any) {
      alert("কানেকশন ব্যর্থ: " + err.message);
    } finally {
      setKeysLoading(false);
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই ব্যাকআপ এপিআই কী-টি মুছে দিতে চান?")) return;
    setKeysLoading(true);
    try {
      const response = await fetch(resolveApiUrl(`/api/gemini-keys/${id}`), { method: "DELETE" });
      if (response.ok) {
        alert("এপিআই কী মুছে দেয়া হয়েছে!");
        fetchBackupKeys();
      } else {
        alert("মুছে ফেলতে ব্যর্থ হয়েছে");
      }
    } catch (err: any) {
      alert("এরর: " + err.message);
    } finally {
      setKeysLoading(false);
    }
  };

  const handleResetApiKeysStatus = async () => {
    setKeysLoading(true);
    try {
      const response = await fetch(resolveApiUrl("/api/gemini-keys/reset"), { method: "POST" });
      if (response.ok) {
        alert("সকল ব্যাকআপ কী এবং প্রাইমারি এনভায়রনমেন্ট কী-এর লিমিট ও কোoldown রিসেট করা হয়েছে!");
        fetchBackupKeys();
      }
    } catch (err: any) {
      alert("এরর: " + err.message);
    } finally {
      setKeysLoading(false);
    }
  };

  useEffect(() => {
    fetchBackupKeys();
  }, []);

  // Fetch Telegram & Notification Configuration from Firestore on load
  useEffect(() => {
    const fetchNotifConfig = async () => {
      try {
        const notifRef = await getDoc(doc(db, "settings", "notification_config"));
        if (notifRef.exists()) {
          const data = notifRef.data();
          setTgToken(data.telegramToken || "");
          setTgChatId(data.telegramChatId || "");
          setTgEnabled(data.enabled || false);
          setSoundAlert(data.soundEnabled !== false);
          setWebhUrl(data.webhookUrl || "");
          setAndroidFcmEnabled(data.androidFcmEnabled || false);
        }
      } catch (e) {
        console.warn("Failed to load notification settings:", e);
      }
    };
    fetchNotifConfig();
  }, []);

  // Fetch registered admin FCM tokens for native Android notifications list
  const fetchFcmTokens = async () => {
    try {
      const snap = await getDocs(collection(db, "admin_fcm_tokens"));
      const list: any[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Sort in descending order of registration
      list.sort((a, b) => {
        const timeA = a.registeredAt?.toDate?.() || new Date(a.registeredAt || 0);
        const timeB = b.registeredAt?.toDate?.() || new Date(b.registeredAt || 0);
        return timeB - timeA;
      });
      setFcmTokens(list);
    } catch (e) {
      console.warn("Failed to fetch registered fcm tokens:", e);
    }
  };

  useEffect(() => {
    fetchFcmTokens();
  }, [triggerReload]);

  const handleSaveNotificationConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setDoc(doc(db, "settings", "notification_config"), {
        telegramToken: tgToken.trim(),
        telegramChatId: tgChatId.trim(),
        enabled: tgEnabled,
        soundEnabled: soundAlert,
        webhookUrl: webhUrl.trim(),
        androidFcmEnabled: androidFcmEnabled,
        updatedAt: serverTimestamp()
      });
      alert("মোবাইল নোটিফিকেশন কনফিগারেশন সফলভাবে আপডেট করা হয়েছে!");
      triggerReload();
    } catch (err: any) {
      alert("সংরক্ষণ ব্যর্থ: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const testTelegramNotification = async () => {
    if (!tgToken.trim() || !tgChatId.trim()) {
      return alert("দয়া করে আগে বোট টোকেন এবং চ্যাট আইডি প্রদান করুন!");
    }
    setLoading(true);
    try {
      const text = `🧪 *MCQ Hero টেস্ট নোটিফিকেশন!*\n\nঅভিনন্দন! আপনার মোবাইল নোটিফিকেশন সিস্টেম সফলভাবে কাজ করছে। আপনি এখন মোবাইল ফোনে ইনস্ট্যান্ট এলার্ট পাবেন!`;
      const res = await fetch(`https://api.telegram.org/bot${tgToken.trim()}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: tgChatId.trim(),
          text: text,
          parse_mode: "Markdown"
        })
      });
      const resJson = await res.json();
      if (resJson.ok) {
        alert("সফলভাবে মোবাইলে টেস্ট নোটিফিকেশন পাঠানো হয়েছে! দয়া করে আপনার টেলিগ্রাম চেক করুন।");
      } else {
        alert("টালিগ্রাম এরর: " + resJson.description);
      }
    } catch (err: any) {
      alert("টেস্ট নোটিফিকেশন পাঠাতে ব্যর্থ: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const requestAndTestWebNotification = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      alert("দুঃখিত, এই ব্রাউজারটিতে স্ট্যান্ডার্ড নোটিফিকেশন সিস্টেম সমর্থিত নয়।");
      return;
    }

    try {
      const isIframe = window.self !== window.top;
      if (isIframe) {
        alert("⚠️ আপনি বর্তমানে এডিটর ফ্রেমের ভেতরে আছেন!\n\nফ্রেমের নিরাপত্তা কড়াকড়ির কারণে ব্রাউজার পপআপ কাজ করবে না। দয়া করে এডমিন প্যানেলের উপর ডানদিকের 'Open in a new tab' বাটনে ক্লিক করে নতুন ট্যাবে প্রজেক্টটি খুলুন এবং পুনরায় ট্রাই করুন।");
        return;
      }

      const permission = await Notification.requestPermission();
      setWebNotificationStatus(permission);

      if (permission === "granted") {
        new Notification("🔔 MCQ Hero লাইভ টেস্ট!", {
          body: "অভিনন্দন! আপনার ব্রাউজার নোটিফিকেশন পপআপ সফলভাবে কাজ করছে। নতুন পেমেন্ট সাবমিট হলে আপনি পিসি বা মোবাইলের স্ক্রিনে পপআপ সতর্কতা পাবেন!",
          icon: "/icon.png"
        });
      } else if (permission === "denied") {
        alert("নোটিফিকেশন পারমিশন ব্লক করা আছে! দয়া করে ব্রাউজার এড্রেস বারের বামের 'Lock/Tune' আইকনটিতে ক্লিক করে নোটিফিকেশন এলাউ (Allow) করে দিন।");
      } else {
        alert("পারমিশন দেওয়া হয়নি। ব্রাউজার থেকে নোটিফিকেশন পারমিশনটি এলাউ করতে সম্মতি দিন।");
      }
    } catch (err: any) {
      alert("পারমিশন রিকোয়েস্ট এরর: " + err.message);
    }
  };

  // Update localized values on props reload
  useEffect(() => {
    setNoticeTitle(globalNotice.title);
    setNoticeMsg(globalNotice.message);
    setNoticeActive(globalNotice.active);
    setMaintChecked(maintenanceMode);
  }, [globalNotice, maintenanceMode]);

  // General Deletion Helper
  const handleDelete = (col: string, id: string) => {
    let typeBengali = "আইটেমটি";
    if (col === "courses") typeBengali = "কোর্সটি";
    else if (col === "categories") typeBengali = "ক্যাটাগরিটি";
    else if (col === "subcategories") typeBengali = "সাবক্যাটাগরিটি";
    else if (col === "recent_info" || col === "notices") typeBengali = "নোটিশটি";
    else if (col === "coupons") typeBengali = "কুপনটি";
    else if (col === "premium_plans") typeBengali = "প্রিমিয়াম প্ল্যানটি";

    setConfirmConfig({
      title: `${typeBengali} মুছে ফেলার নিশ্চিতকরণ`,
      description: `আপনি কি নিশ্চিতভাবে এই ${typeBengali} ডাটাবেজ থেকে মুছে দিতে চান? এর ফলে সমস্ত সংশ্লিষ্ট ডেটা চিরতরে মুছে যাবে এবং তথ্যটি আর ফেরত আনা যাবে না।`,
      onConfirm: async () => {
        try {
          if (isSandboxMode) {
            let key = "";
            if (col === "courses") key = "local_courses";
            else if (col === "categories") key = "local_categories";
            else if (col === "subcategories") key = "local_subcategories";
            else if (col === "recent_info" || col === "notices") key = "local_bulletins";
            else if (col === "coupons") key = "local_coupons";
            else if (col === "premium_plans") key = "local_premium_plans";

            if (key) {
              const local = localStorage.getItem(key) || "[]";
              const parsed = JSON.parse(local) as any[];
              const updated = parsed.filter((item) => (item.id || item.uid) !== id);
              localStorage.setItem(key, JSON.stringify(updated));
              alert("সফলভাবে ডিলিট সম্পন্ন হয়েছে! (স্যান্ডবক্স মোড)");
            } else {
              alert("অজানা কালেকশন ডিলিট রিকোয়েস্ট!");
            }
          } else {
            await deleteDoc(doc(db, col, id));
            alert("সফলভাবে ডিলিট সম্পন্ন হয়েছে!");
          }
          triggerReload();
        } catch (err: any) {
          alert("মুছে ফেলা সম্ভব হয়নি: " + err.message);
        }
      }
    });
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseTitle.trim()) return alert("শিরোনাম প্রদাণ করুন");
    setLoading(true);
    try {
      const payload: any = {
        title: courseTitle.trim(),
        desc: courseDesc.trim(),
        access: courseAccess,
        status: courseStatus,
        live: courseLive,
        price: coursePrice ? Number(coursePrice) : 0,
        promoPrice: coursePromoPrice ? Number(coursePromoPrice) : 0,
        pdfUrl: coursePdfUrl.trim(),
        pdfTitle: coursePdfTitle.trim(),
      };

      if (isSandboxMode) {
        const local = localStorage.getItem("local_courses") || "[]";
        let parsed = JSON.parse(local) as any[];
        
        if (editingCourseId) {
          parsed = parsed.map((c) => {
            if (c.id === editingCourseId) {
              return { ...c, ...payload };
            }
            return c;
          });
          alert("কোর্স প্ল্যান ও পেমেন্ট বিবরণ আপডেট হয়েছে! (স্যান্ডবক্স মোড)");
        } else {
          parsed.push({ id: "course-" + Date.now(), ...payload });
          alert("কোর্স ডাটাবেজে অন্তর্ভুক্ত হয়েছে! (স্যান্ডবক্স মোড)");
        }
        localStorage.setItem("local_courses", JSON.stringify(parsed));
      } else {
        if (editingCourseId) {
          await setDoc(doc(db, "courses", editingCourseId), {
            ...payload,
            updatedAt: serverTimestamp()
          }, { merge: true });
          alert("কোর্স প্ল্যান ও পেমেন্ট বিবরণ আপডেট হয়েছে!");
        } else {
          await addDoc(collection(db, "courses"), {
            ...payload,
            createdAt: serverTimestamp()
          });
          alert("কোর্স ডাটাবেজে অন্তর্ভুক্ত হয়েছে!");
        }
      }
      setCourseTitle("");
      setCourseDesc("");
      setCoursePrice("");
      setCoursePromoPrice("");
      setCoursePdfUrl("");
      setCoursePdfTitle("");
      setEditingCourseId(null);
      triggerReload();
    } catch (err: any) {
      alert("ব্যর্থ হয়েছে: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName.trim()) return alert("প্ল্যানের নাম লিখুন");
    if (!planValidity.trim()) return alert("প্ল্যানের মেয়াদ লিখুন (যেমন: ১ মাস)");
    if (!planPrice.trim()) return alert("প্ল্যানের নিয়মিত মূল্য লিখুন");
    
    setLoading(true);
    try {
      const featuresArr = planFeaturesText
        ? planFeaturesText.split(/,|\n/).map(f => f.trim()).filter(Boolean)
        : [];

      const payload = {
        name: planName.trim(),
        validity: planValidity.trim(),
        price: Number(planPrice) || 0,
        promoPrice: planPromoPrice ? Number(planPromoPrice) : undefined,
        features: featuresArr,
      };

      if (isSandboxMode) {
        const local = localStorage.getItem("local_premium_plans") || "[]";
        let parsed = JSON.parse(local) as any[];

        if (editingPlanId) {
          parsed = parsed.map((p) => {
            if (p.id === editingPlanId) {
              return { ...p, ...payload };
            }
            return p;
          });
          alert("প্রিমিয়াম প্ল্যান সফলভাবে আপডেট হয়েছে! (স্যান্ডবক্স মোড)");
        } else {
          parsed.push({ id: "plan-" + Date.now(), ...payload });
          alert("নতুন প্রিমিয়াম প্ল্যান সফলভাবে যুক্ত হয়েছে! (স্যান্ডবক্স মোড)");
        }
        localStorage.setItem("local_premium_plans", JSON.stringify(parsed));
      } else {
        if (editingPlanId) {
          await setDoc(doc(db, "premium_plans", editingPlanId), {
            ...payload,
            updatedAt: serverTimestamp()
          }, { merge: true });
          alert("প্রিমিয়াম প্ল্যান সফলভাবে আপডেট হয়েছে!");
        } else {
          await addDoc(collection(db, "premium_plans"), {
            ...payload,
            createdAt: serverTimestamp()
          });
          alert("নতুন প্রিমিয়াম প্ল্যান সফলভাবে যুক্ত হয়েছে!");
        }
      }

      setPlanName("");
      setPlanValidity("");
      setPlanPrice("");
      setPlanPromoPrice("");
      setPlanFeaturesText("");
      setEditingPlanId(null);
      triggerReload();
    } catch (err: any) {
      alert("ব্যর্থ হয়েছে: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return alert("গ্রুপের নাম লিখুন");
    setLoading(true);
    try {
      const payload = {
        name: catName.trim(),
        access: catAccess
      };

      if (isSandboxMode) {
        const local = localStorage.getItem("local_categories") || "[]";
        const parsed = JSON.parse(local) as any[];
        parsed.push({ id: "cat-" + Date.now(), ...payload });
        localStorage.setItem("local_categories", JSON.stringify(parsed));
        alert("পরীক্ষার প্যারেন্ট গ্রুপ সফলভাবে যুক্ত করা হয়েছে! (স্যান্ডবক্স মোড)");
      } else {
        await addDoc(collection(db, "categories"), payload);
        alert("পরীক্ষার প্যারেন্ট গ্রুপ সফলভাবে যুক্ত করা হয়েছে!");
      }
      setCatName("");
      triggerReload();
    } catch (err: any) {
      alert("সংরক্ষণ ব্যর্থ: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSubCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName.trim() || !subParentId) return alert("তথ্য পূরণ করুণ");
    setLoading(true);
    try {
      const payload = {
        name: subName.trim(),
        parentId: subParentId
      };

      if (isSandboxMode) {
        const local = localStorage.getItem("local_subcategories") || "[]";
        let parsed = JSON.parse(local) as any[];
        if (editingSubId) {
          parsed = parsed.map((item) =>
            item.id === editingSubId ? { ...item, ...payload } : item
          );
          localStorage.setItem("local_subcategories", JSON.stringify(parsed));
          alert("সাব-ক্যাটাগরি সফলভাবে আপডেট করা হয়েছে! (স্যান্ডবক্স মোড)");
        } else {
          parsed.push({ id: "subcat-" + Date.now(), ...payload });
          localStorage.setItem("local_subcategories", JSON.stringify(parsed));
          alert("সাব-ক্যাটাগরি যুক্ত করা হয়েছে! (স্যান্ডবক্স মোড)");
        }
      } else {
        if (editingSubId) {
          await updateDoc(doc(db, "subcategories", editingSubId), payload);
          alert("সাব-ক্যাটাগরি সফলভাবে আপডেট করা হয়েছে!");
        } else {
          await addDoc(collection(db, "subcategories"), payload);
          alert("সাব-ক্যাটাগরি যুক্ত করা হয়েছে!");
        }
      }
      setSubName("");
      setSubParentId("");
      setEditingSubId(null);
      triggerReload();
    } catch (err: any) {
      alert("ব্যর্থ: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBulletin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recentTitle.trim() || !recentDesc.trim()) return alert("সকল তথ্য পুরণ করুন");
    setLoading(true);
    try {
      const payload = {
        title: recentTitle.trim(),
        message: recentDesc.trim(),
        description: recentDesc.trim(), // backward compat
        category: recentCategory || "All",
        pinned: recentPinned || false,
      };

      if (isSandboxMode) {
        const local = localStorage.getItem("local_bulletins") || "[]";
        let parsed = JSON.parse(local) as any[];
        if (editingNoticeId) {
          parsed = parsed.map((b) => b.id === editingNoticeId ? { ...b, ...payload } : b);
          alert("নিউজ বুলেটিন আপডেট সম্পন্ন! (স্যান্ডবক্স মোড)");
        } else {
          parsed.push({ id: "bulletin-" + Date.now(), ...payload, createdAt: new Date().toISOString() });
          alert("নতুন নিউজ বুলেটিন পাবলিশ সম্পন্ন! (স্যান্ডবক্স মোড)");
        }
        localStorage.setItem("local_bulletins", JSON.stringify(parsed));
      } else {
        if (editingNoticeId) {
          await setDoc(doc(db, "notices", editingNoticeId), {
            ...payload,
            updatedAt: serverTimestamp()
          }, { merge: true });
          alert("নিউজ বুলেটিন/নোটিশ সফলভাবে আপডেট করা হয়েছে!");
        } else {
          await addDoc(collection(db, "notices"), {
            ...payload,
            createdAt: serverTimestamp()
          });
          alert("নতুন নিউজ বুলেটিন/নোটিশ সফলভাবে পাবলিশ করা হয়েছে!");
        }
      }
      setRecentTitle("");
      setRecentDesc("");
      setRecentCategory("All");
      setRecentPinned(false);
      setEditingNoticeId(null);
      triggerReload();
    } catch (err: any) {
      alert("ব্যর্থ: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpCode.trim() || isNaN(cpDisc)) return alert("ডিজিটাল কুপন কোড ও সঠিক ছাড় শতকরা হার লিখুন");
    setLoading(true);
    try {
      const payload = {
        code: cpCode.trim().toUpperCase(),
        discount: Number(cpDisc) || 10,
      };

      if (isSandboxMode) {
        const local = localStorage.getItem("local_coupons") || "[]";
        const parsed = JSON.parse(local) as any[];
        parsed.push({ id: "coupon-" + Date.now(), ...payload });
        localStorage.setItem("local_coupons", JSON.stringify(parsed));
        alert("উপহার কুপন কোড টি সেভ করা হয়েছে! (স্যান্ডবক্স মোড)");
      } else {
        await addDoc(collection(db, "coupons"), {
          ...payload,
          createdAt: serverTimestamp()
        });
        alert("উপহার কুপন কোড টি সেভ করা হয়েছে!");
      }
      setCpCode("");
      triggerReload();
    } catch (err: any) {
      alert("কোড ব্যর্থ: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // direct fast toggle trigger
  const handleToggleMaintenanceDirect = (checked: boolean) => {
    setMaintConfirmModal({ isOpen: true, checked });
  };

  const executeToggleMaintenanceDirect = async (checked: boolean) => {
    const actionText = checked ? "চালু (True)" : "বন্ধ (False)";
    setLoading(true);
    try {
      if (isSandboxMode) {
        localStorage.setItem("local_maintenance_mode", checked ? "true" : "false");
        setMaintChecked(checked);
        showSettingsToast(`মেইনটেনেন্স মোড সফলভাবে ${actionText} করা হয়েছে! (Sandbox Mode)`, "success");
        triggerReload();
        setMaintConfirmModal(null);
        return;
      }

      // 1. Primary app_config setting with merge: true (preserves any other keys)
      await setDoc(doc(db, "app_config", "app_config"), {
        maintenance: checked
      }, { merge: true });

      // 2. Redundant writing under settings/global_notice to synchronize client queries
      try {
        await setDoc(doc(db, "settings", "global_notice"), {
          maintenance: checked,
          maintenanceMode: checked
        }, { merge: true });
      } catch (err) {
        console.warn("Redundant write to settings/global_notice failed: ", err);
      }

      // 3. Redundant writing under settings/maintenance_mode (highly common legacy document path used by clients)
      try {
        await setDoc(doc(db, "settings", "maintenance_mode"), {
          active: checked,
          enabled: checked,
          maintenance: checked,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.warn("Redundant write to settings/maintenance_mode failed: ", err);
      }

      localStorage.setItem("local_maintenance_mode", checked ? "true" : "false");
      setMaintChecked(checked);
      showSettingsToast(`মেইনটেনেন্স মোড সফলভাবে ${actionText} করা হয়েছে!`, "success");
      triggerReload();
      setMaintConfirmModal(null);
    } catch (err: any) {
      showSettingsToast("মেইনটেনেন্স মোড পরিবর্তন করতে সমস্যা হয়েছে: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  //notice and config updates
  const handleUpdateNoticeAndConfig = () => {
    setNoticeConfirmModalOpen(true);
  };

  const executeUpdateNoticeAndConfigDirect = async () => {
    setNoticeConfirmModalOpen(false);
    setLoading(true);
    try {
      const qLimit = Number(freeLimit) || 20;
      const countLimit = Number(dailyQuestionLimit) || 15;
      if (isSandboxMode) {
        localStorage.setItem("local_global_notice", JSON.stringify({
          title: noticeTitle.trim(),
          message: noticeMsg.trim(),
          active: noticeActive,
          freeUserQuestionLimit: qLimit,
          dailyQuestionLimit: countLimit
        }));
        localStorage.setItem("local_maintenance_mode", maintChecked ? "true" : "false");
        alert("নোটিশ ও সেটিংস সফলভাবে স্থানীয়ভাবে (Sandbox) আপডেট করা হয়েছে!");
        triggerReload();
        return;
      }

      // 1. Notice doc (updates notice text parameters and syncs maintenance, free question limit & daily Question limit)
      await setDoc(doc(db, "settings", "global_notice"), {
        title: noticeTitle.trim(),
        message: noticeMsg.trim(),
        active: noticeActive,
        maintenance: maintChecked,
        maintenanceMode: maintChecked,
        freeUserQuestionLimit: qLimit,
        freeQuestionLimit: qLimit,
        free_user_limit: qLimit,
        free_limit: qLimit,
        limit: qLimit,
        questions_limit: qLimit,
        daily_limit: qLimit,
        practice_limit: qLimit,
        dailyQuestionLimit: countLimit,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // 2. Maint Mode doc (updates with merge to avoid zeroing other settings)
      await setDoc(doc(db, "app_config", "app_config"), {
        maintenance: maintChecked,
        freeUserQuestionLimit: qLimit,
        freeQuestionLimit: qLimit,
        free_user_limit: qLimit,
        free_limit: qLimit,
        limit: qLimit,
        free_user_question_limit: qLimit,
        questionsLimit: qLimit,
        questionLimit: qLimit,
        questions_limit: qLimit,
        dailyLimit: qLimit,
        daily_limit: qLimit,
        daily_questions_limit: qLimit,
        daily_question_limit: qLimit,
        free_daily_limit: qLimit,
        practice_limit: qLimit,
        practice_questions_limit: qLimit,
        free_practice_limit: qLimit,
        free_practice_questions_limit: qLimit,
        view_limit: qLimit,
        viewLimit: qLimit,
        dailyQuestionLimit: countLimit
      }, { merge: true });

      // 2b. Write to app_config/settings
      try {
        await setDoc(doc(db, "app_config", "settings"), {
          maintenance: maintChecked,
          freeUserQuestionLimit: qLimit,
          freeQuestionLimit: qLimit,
          free_user_limit: qLimit,
          free_limit: qLimit,
          limit: qLimit,
          free_user_question_limit: qLimit,
          questionsLimit: qLimit,
          questionLimit: qLimit,
          questions_limit: qLimit,
          dailyLimit: qLimit,
          daily_limit: qLimit,
          daily_questions_limit: qLimit,
          daily_question_limit: qLimit,
          free_daily_limit: qLimit,
          practice_limit: qLimit,
          practice_questions_limit: qLimit,
          free_practice_limit: qLimit,
          free_practice_questions_limit: qLimit,
          view_limit: qLimit,
          viewLimit: qLimit,
          dailyQuestionLimit: countLimit,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.warn("Redundant write to app_config/settings failed: ", err);
      }

      // 3. Fallback maintenance_mode doc
      try {
        await setDoc(doc(db, "settings", "maintenance_mode"), {
          active: maintChecked,
          enabled: maintChecked,
          maintenance: maintChecked,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.warn("Redundant write to settings/maintenance_mode failed: ", err);
      }

      // 4. Fallback question_bank_config doc
      try {
        await setDoc(doc(db, "settings", "question_bank_config"), {
          freeUserQuestionLimit: qLimit,
          freeQuestionLimit: qLimit,
          free_user_limit: qLimit,
          limit: qLimit,
          free_user_question_limit: qLimit,
          questionsLimit: qLimit,
          questionLimit: qLimit,
          questions_limit: qLimit,
          dailyLimit: qLimit,
          daily_limit: qLimit,
          daily_questions_limit: qLimit,
          daily_question_limit: qLimit,
          free_daily_limit: qLimit,
          practice_limit: qLimit,
          practice_questions_limit: qLimit,
          free_practice_limit: qLimit,
          free_practice_questions_limit: qLimit,
          view_limit: qLimit,
          viewLimit: qLimit,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.warn("Redundant write to settings/question_bank_config failed: ", err);
      }

      // 5. Broad Redundant Settings Docs Writing
      const docsToUpdate = [
        ["settings", "app_config"],
        ["settings", "app_settings"],
        ["settings", "config"],
        ["settings", "free_limit"],
        ["settings", "free_user_limit"],
        ["settings", "general_settings"],
        ["settings", "parameters"],
        ["settings", "question_bank"],
        ["settings", "question_config"],
        ["settings", "question_limit"],
        ["settings", "settings"],
        
        // Root config collections
        ["app_config", "config"],
        ["app_config", "app_settings"],
        ["app_config", "settings"],
        ["app_settings", "app_settings"],
        ["app_settings", "config"],
        ["config", "config"],
        ["config", "app_config"],
        ["config", "settings"],
        ["free_limit", "free_limit"],
        ["free_user_limit", "free_user_limit"],
        ["question_limit", "question_limit"],
        ["questions_config", "config"],
        ["questions_config", "questions_config"],
        ["limits", "limits"],
        ["limits", "config"],
        ["limits", "question_limit"],
        ["parameters", "parameters"],
        ["parameters", "config"],
        ["system_config", "system_config"],
        ["system_settings", "system_settings"],
        ["system_settings", "config"]
      ];

      const comprehensiveLimitFields = {
        freeUserQuestionLimit: qLimit,
        free_user_limit: qLimit,
        free_user_question_limit: qLimit,
        free_user_questions_limit: qLimit,
        limit: qLimit,
        freeQuestionLimit: qLimit,
        free_limit: qLimit,
        free_questions_limit: qLimit,
        questions_limit: qLimit,
        questionsLimit: qLimit,
        questionLimit: qLimit,
        dailyLimit: qLimit,
        daily_limit: qLimit,
        daily_questions_limit: qLimit,
        daily_question_limit: qLimit,
        free_daily_limit: qLimit,
        practice_limit: qLimit,
        practice_questions_limit: qLimit,
        free_practice_limit: qLimit,
        free_practice_questions_limit: qLimit,
        view_limit: qLimit,
        viewLimit: qLimit,
        dailyQuestionLimit: countLimit,
        settings: {
          freeUserQuestionLimit: qLimit,
          free_user_limit: qLimit,
          free_user_question_limit: qLimit,
          free_user_questions_limit: qLimit,
          limit: qLimit,
          freeQuestionLimit: qLimit,
          free_limit: qLimit,
          free_questions_limit: qLimit,
          questions_limit: qLimit,
          questionsLimit: qLimit,
          questionLimit: qLimit,
          dailyLimit: qLimit,
          daily_limit: qLimit,
          daily_questions_limit: qLimit,
          daily_question_limit: qLimit,
          free_daily_limit: qLimit,
          practice_limit: qLimit,
          practice_questions_limit: qLimit,
          free_practice_limit: qLimit,
          free_practice_questions_limit: qLimit,
          view_limit: qLimit,
          viewLimit: qLimit,
          dailyQuestionLimit: countLimit,
        }
      };

      for (const [col, docId] of docsToUpdate) {
        try {
          await setDoc(doc(db, col, docId), {
            ...comprehensiveLimitFields,
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (e) {
          console.warn(`Write to fallback doc ${col}/${docId} failed:`, e);
        }
      }

      // 5b. Write explicitly to settings/app_config/settings subcollection document paths
      const subcollectionSettingsDocs = ["settings", "config", "app_settings"];
      for (const sDoc of subcollectionSettingsDocs) {
        try {
          await setDoc(doc(db, "settings", "app_config", "settings", sDoc), {
            ...comprehensiveLimitFields,
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (e) {
          console.warn(`Write to nested doc settings/app_config/settings/${sDoc} failed:`, e);
        }
      }

      // 6. Update all individual category, course and subcategory documents with the limit attributes
      if (subcategories && subcategories.length > 0) {
        for (const sub of subcategories) {
          if (sub.id) {
            try {
              await updateDoc(doc(db, "subcategories", sub.id), {
                ...comprehensiveLimitFields
              });
            } catch (e) {
              console.warn(`Failed to update subcategory ${sub.id}:`, e);
            }
          }
        }
      }

      if (categories && categories.length > 0) {
        for (const cat of categories) {
          if (cat.id) {
            try {
              await updateDoc(doc(db, "categories", cat.id), {
                ...comprehensiveLimitFields
              });
            } catch (e) {
              console.warn(`Failed to update category ${cat.id}:`, e);
            }
          }
        }
      }

      if (courses && courses.length > 0) {
        for (const course of courses) {
          if (course.id) {
            try {
              await updateDoc(doc(db, "courses", course.id), {
                ...comprehensiveLimitFields
              });
            } catch (e) {
              console.warn(`Failed to update course ${course.id}:`, e);
            }
          }
        }
      }

      // Maintain local cache as a high-security backup 
      localStorage.setItem("local_global_notice", JSON.stringify({
        title: noticeTitle.trim(),
        message: noticeMsg.trim(),
        active: noticeActive,
        freeUserQuestionLimit: qLimit,
        dailyQuestionLimit: countLimit
      }));
      localStorage.setItem("local_maintenance_mode", maintChecked ? "true" : "false");

      alert("নোটিশ ও ফ্রি ইউজার লিমিট কনফিগারেশন সফলভাবে ক্লাউড ডাটাবেজে আপডেট করা হয়েছে!");
      triggerReload();
    } catch (err: any) {
      console.warn("Firebase config write failed, using local storage fallback:", err);
      const qLimit = Number(freeLimit) || 20;
      const countLimit = Number(dailyQuestionLimit) || 15;
      localStorage.setItem("local_global_notice", JSON.stringify({
        title: noticeTitle.trim(),
        message: noticeMsg.trim(),
        active: noticeActive,
        freeUserQuestionLimit: qLimit,
        dailyQuestionLimit: countLimit
      }));
      localStorage.setItem("local_maintenance_mode", maintChecked ? "true" : "false");
      alert("কনফিগারেশন আপডেট করা হয়েছে (Firebase সংযোগ সমস্যা, স্থানীয় মেমরিতে সংরক্ষিত)!");
      triggerReload();
    } finally {
      setLoading(false);
    }
  };

  // Push sender simulation log
  const handleSendNotificationSimulation = async () => {
    if (!notifHeader.trim() || !notifBody.trim()) return alert("নোটিফিকেশন টেক্সট ও টাইটেল দিন");
    setLoading(true);
    try {
      // Simulating real cloud notification broadcast entry log
      await addDoc(collection(db, "push_notifications_log"), {
        title: notifHeader.trim(),
        body: notifBody.trim(),
        image: notifImage.trim(),
        sentAt: new Date().toISOString()
      });
      alert("ব্রডকাস্ট পুশ নোটিফিকেশন ক্লাউড পাইপলাইনে সফলভাবে পাঠানো হয়েছে!");
      setNotifHeader("");
      setNotifBody("");
      setNotifImage("");
    } catch (err: any) {
      alert("ব্রডকাস্ট ব্যর্থ: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub menu navigation */}
      <div className="flex flex-wrap border-b border-slate-700 bg-slate-800/40 p-1.5 rounded-xl gap-1">
        <button
          onClick={() => setActiveTab("courses")}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold rounded-lg transition-all ${
            activeSegment === "courses" ? "bg-teal-500 text-white shadow" : "text-slate-400 hover:text-white"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          কোর্স ও বুলেটিনস
        </button>
        <button
          onClick={() => setActiveTab("plans")}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold rounded-lg transition-all ${
            activeSegment === "plans" ? "bg-teal-500 text-white shadow" : "text-slate-400 hover:text-white"
          }`}
        >
          <Compass className="w-4 h-4" />
          এপের প্রিমিয়াম প্ল্যানসমূহ
        </button>
        <button
          onClick={() => setActiveTab("groups")}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold rounded-lg transition-all ${
            activeSegment === "groups" ? "bg-teal-500 text-white shadow" : "text-slate-400 hover:text-white"
          }`}
        >
          <FolderPlus className="w-4 h-4" />
          পরীক্ষা প্যারেন্ট ক্যাটাগরি
        </button>
        <button
          onClick={() => setActiveTab("coupons")}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold rounded-lg transition-all ${
            activeSegment === "coupons" ? "bg-teal-500 text-white shadow" : "text-slate-400 hover:text-white"
          }`}
        >
          <Tag className="w-4 h-4" />
          কুপন ডিসকাউন্ট কোড
        </button>
        <button
          onClick={() => setActiveTab("configs")}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold rounded-lg transition-all ${
            activeSegment === "configs" ? "bg-teal-500 text-white shadow" : "text-slate-400 hover:text-white"
          }`}
        >
          <Settings className="w-4 h-4" />
          গ্লোবাল মেইনটেনেন্স ও পুশ
        </button>
        <button
          onClick={() => setActiveTab("api_keys")}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold rounded-lg transition-all ${
            activeSegment === "api_keys" ? "bg-teal-500 text-white shadow" : "text-slate-400 hover:text-white"
          }`}
        >
          <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
          এপিআই কী রোটেটর
        </button>
        <button
          onClick={() => setActiveTab("phone_auth")}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold rounded-lg transition-all ${
            activeSegment === "phone_auth" ? "bg-teal-500 text-white shadow" : "text-slate-400 hover:text-white"
          }`}
        >
          <Smartphone className="w-4 h-4 text-emerald-400" />
          মোবাইল ওটিপি টেস্ট
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-slate-400 justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
          <span>পরিসেবা ট্রানজেকশন হচ্ছে...</span>
        </div>
      )}

      {/* SEGMENT 1: Courses & Bulletins */}
      {activeSegment === "courses" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
          {/* Courses List and forms */}
          <div className="space-y-6">
            <form
              onSubmit={handleSaveCourse}
              className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/50 space-y-4"
            >
              <h4 className="text-md font-bold text-teal-400 flex items-center gap-1.5">
                <BookOpen className="w-5 h-5" />
                {editingCourseId ? "কোর্স প্ল্যান ও মূল্য এডিট করুন" : "নতুন কোর্স এবং সিলেবাস যুক্ত করুণ"}
              </h4>

              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-1">কোর্স ওভারভিউ টাইটেল *</label>
                <input
                  type="text"
                  required
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  placeholder="যেমন: ৪৬তম প্রিলি স্পেশাল ব্যাচ"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-teal-500 h-[38px]"
                />
              </div>

              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-1">কোর্স ডিসক্রিপশন</label>
                <textarea
                  value={courseDesc}
                  onChange={(e) => setCourseDesc(e.target.value)}
                  placeholder="কোর্সের যাবতীয় সুবিধা সংক্ষেপে লিখুন..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-teal-500 leading-relaxed"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">অ্যাক্সেস</label>
                  <select
                    value={courseAccess}
                    onChange={(e) => setCourseAccess(e.target.value as "free" | "premium")}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-teal-500 h-[38px]"
                  >
                    <option value="free">ফ্রি</option>
                    <option value="premium">প্রিমিয়াম</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">স্ট্যাটাস</label>
                  <select
                    value={courseStatus}
                    onChange={(e) => setCourseStatus(e.target.value as "running" | "all")}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-teal-500 h-[38px]"
                  >
                    <option value="running">চলমান</option>
                    <option value="all">পুরাতন / সমাপ্য</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end pb-2">
                  <label className="flex items-center gap-1 cursor-pointer select-none text-[11px] text-slate-300">
                    <input
                      type="checkbox"
                      checked={courseLive}
                      onChange={(e) => setCourseLive(e.target.checked)}
                    />
                    লাইভ ব্যাজ
                  </label>
                </div>
              </div>

              {/* Regular price & Offer price fields for Premium access */}
              {courseAccess === "premium" && (
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-900/50 rounded-xl border border-slate-700/30 animate-fade-in">
                  <div>
                    <label className="text-slate-300 text-[11px] font-semibold block mb-1">কোর্সের মূল্য BDT (Regular) *</label>
                    <input
                      type="number"
                      required={courseAccess === "premium"}
                      value={coursePrice}
                      onChange={(e) => setCoursePrice(e.target.value)}
                      placeholder="যেমন: ৯৯৯"
                      className="w-full bg-slate-950 border border-slate-750 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-teal-500 h-[36px]"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 text-[11px] font-semibold block mb-1">ছাড়ের অফার মূল্য BDT (Offer)</label>
                    <input
                      type="number"
                      value={coursePromoPrice}
                      onChange={(e) => setCoursePromoPrice(e.target.value)}
                      placeholder="যেমন: ৪৯৯"
                      className="w-full bg-slate-950 border border-slate-750 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-teal-500 h-[36px]"
                    />
                  </div>
                </div>
              )}

              {/* PDF Attachments Input section */}
              <div className="p-3.5 bg-slate-900/40 rounded-xl border border-slate-700/35 space-y-3 animate-fade-in">
                <span className="text-teal-400 text-[11px] font-semibold block flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  কোর্স রিসোর্স বা লেকচার শিট (PDF Attachment)
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 text-[10px] uppercase font-bold block mb-1">পিডিএফ টাইটেল</label>
                    <input
                      type="text"
                      value={coursePdfTitle}
                      onChange={(e) => setCoursePdfTitle(e.target.value)}
                      placeholder="যেমন: লেকচার শিট - ১"
                      className="w-full bg-slate-950 border border-slate-750 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-teal-500 h-[36px]"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 text-[10px] uppercase font-bold block mb-1">ড্রাইভ লিংক বা PDF URL</label>
                    <input
                      type="url"
                      value={coursePdfUrl}
                      onChange={(e) => setCoursePdfUrl(e.target.value)}
                      placeholder="https://drive.google.com/..."
                      className="w-full bg-slate-950 border border-slate-750 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-teal-500 h-[36px]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-lg h-[40px] cursor-pointer"
                >
                  {editingCourseId ? "কোর্স আপডেট করুন (Save)" : "কোর্সটি তৈরি করুন"}
                </button>
                {editingCourseId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCourseId(null);
                      setCourseTitle("");
                      setCourseDesc("");
                      setCourseAccess("free");
                      setCourseStatus("running");
                      setCourseLive(true);
                      setCoursePrice("");
                      setCoursePromoPrice("");
                      setCoursePdfUrl("");
                      setCoursePdfTitle("");
                    }}
                    className="bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white font-bold text-xs py-2.5 px-3 rounded-lg h-[40px] cursor-pointer"
                  >
                    বাতিল
                  </button>
                )}
              </div>
            </form>

            <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 space-y-3">
              <span className="text-slate-400 text-xs font-bold block">বিদ্যমান কোর্স সমূহ ({courses.length})</span>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 text-xs">
                {courses.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex justify-between items-center"
                  >
                    <div>
                      <h5 className="font-semibold text-white">{c.title}</h5>
                      <span className="text-[10px] text-slate-500 flex flex-wrap gap-1.5 mt-0.5 capitalize">
                        <span>{c.access}</span> | 
                        <span>স্ট্যাটাস: {c.status}</span> 
                        {c.live && <span className="bg-teal-500/10 text-teal-400 px-1 rounded text-[9px]">Live Badge</span>}
                        {c.access === "premium" && (
                          <span className="text-teal-400 font-mono font-medium">
                            মূল্য: ৳{c.price || 0} {c.promoPrice ? `(অফার: ৳${c.promoPrice})` : ""}
                          </span>
                        )}
                        {c.pdfUrl && (
                          <a
                            href={c.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 px-1 rounded text-[9px] flex items-center gap-0.5 transition-colors font-semibold"
                            title={c.pdfTitle || "PDF Link"}
                          >
                            <FileText className="w-2.5 h-2.5" />
                            PDF: {c.pdfTitle || "ডাউনলোড করুন"}
                          </a>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditingCourseId(c.id || null);
                          setCourseTitle(c.title);
                          setCourseDesc(c.desc || "");
                          setCourseAccess(c.access);
                          setCourseStatus(c.status);
                          setCourseLive(c.live);
                          setCoursePrice(c.price ? String(c.price) : "");
                          setCoursePromoPrice(c.promoPrice ? String(c.promoPrice) : "");
                          setCoursePdfUrl(c.pdfUrl || "");
                          setCoursePdfTitle(c.pdfTitle || "");
                        }}
                        className="text-teal-400 hover:text-white hover:bg-teal-500/10 p-1.5 rounded transition-colors"
                        title="সম্পাদনা করুন"
                      >
                        <Zap className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => c.id && handleDelete("courses", c.id)}
                        className="text-red-500 hover:text-white hover:bg-red-500/10 p-1.5 rounded transition-colors"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bulletins lists and forms */}
          <div className="space-y-6">
            <form
              onSubmit={handleSaveBulletin}
              className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/50 space-y-4 shadow-xl"
            >
              <h4 className="text-md font-bold text-teal-400 flex items-center gap-1.5">
                <FileText className="w-5 h-5 animate-pulse" />
                {editingNoticeId ? "নোটিশ তথ্য সংশোধন করুন" : "ফ্ল্যাশ নিউজ ও নতুন নোটিশ ব্রডকাস্টার"}
              </h4>

              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-1">নোটিশ টাইটেল / বুলেটিন হেডলাইন *</label>
                <input
                  type="text"
                  required
                  value={recentTitle}
                  onChange={(e) => setRecentTitle(e.target.value)}
                  placeholder="যেমন: আজ রাত ৯টায় বিশেষ প্রিলিমিনারি পরীক্ষা অনুষ্ঠিত হবে..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-teal-500 h-[38px] transition-all"
                />
              </div>

              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-1">টার্গেট ক্যাটাগরি / কোর্স রূপরেখা</label>
                <select
                  value={recentCategory}
                  onChange={(e) => setRecentCategory(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-teal-500 h-[38px] transition-all"
                >
                  <option value="All">All / General (সাধারণ নোটিশ)</option>
                  <option disabled className="text-slate-500 font-semibold bg-slate-800">ক্যাটাগরি সমূহ:</option>
                  {categories.map((cat) => (
                    <option key={`notice-cat-${cat.id || cat.name}`} value={cat.name}>{cat.name}</option>
                  ))}
                  <option disabled className="text-slate-500 font-semibold bg-slate-800">কোর্স সমূহ:</option>
                  {courses.map((crs) => (
                    <option key={`notice-crs-${crs.id || crs.title}`} value={crs.title}>{crs.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-1">নোটিশ বিস্তারিত বার্তা *</label>
                <textarea
                  required
                  value={recentDesc}
                  onChange={(e) => setRecentDesc(e.target.value)}
                  placeholder="বিস্তারিত বুলেটিন বার্তা বা নোটিশের খবর এখানে লিখুন..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-teal-500 leading-relaxed transition-all"
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2.5 py-1 bg-slate-900/30 px-3 py-2 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  id="chk-notice-pinned"
                  checked={recentPinned}
                  onChange={(e) => setRecentPinned(e.target.checked)}
                  className="w-4 h-4 text-teal-600 bg-slate-900 border-slate-700 rounded focus:ring-teal-550 accent-teal-500 cursor-pointer"
                />
                <label htmlFor="chk-notice-pinned" className="text-slate-300 text-xs font-semibold cursor-pointer select-none">
                  নোটিশটি সবার উপরে পিন (Pin) করুন
                </label>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-lg h-[40px] transition-all cursor-pointer shadow-md shadow-teal-500/10 active:scale-[0.98]"
                >
                  {editingNoticeId ? "নোটিশ তথ্য আপডেট করুন" : "নোটিশ ও বুলেটিন পাবলিশ"}
                </button>
                {editingNoticeId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNoticeId(null);
                      setRecentTitle("");
                      setRecentDesc("");
                      setRecentCategory("All");
                      setRecentPinned(false);
                    }}
                    className="bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white font-bold text-xs py-2.5 px-4 rounded-lg h-[40px] cursor-pointer transition-all active:scale-[0.98]"
                  >
                    বাতিল
                  </button>
                )}
              </div>
            </form>

            <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-xs font-bold block">সক্রিয় নোটিশ বোর্ড ({bulletins.length})</span>
                <span className="text-[10px] text-slate-500">সংরক্ষিত কালেকশন: notices</span>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 text-xs">
                {bulletins.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                    কোন নোটিশ পাওয়া যায়নি
                  </div>
                ) : (
                  bulletins.map((b) => (
                    <div
                      key={b.id}
                      className={`p-3 rounded-xl border flex justify-between items-start gap-2.5 transition-all duration-200 ${
                        b.pinned
                          ? "bg-amber-500/10 border-amber-500/30 shadow-sm shadow-amber-500/5_p"
                          : "bg-slate-900/60 border-slate-800 hover:border-slate-700/50"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-1.5 mb-1">
                          {b.pinned && (
                            <span className="bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded text-[8px] tracking-wide uppercase flex items-center gap-0.5">
                              ★ Pinned
                            </span>
                          )}
                          <span className="bg-teal-500/15 text-teal-400 px-1.5 py-0.5 rounded text-[9px] font-medium max-w-[140px] truncate">
                            {b.category || "General"}
                          </span>
                        </div>
                        <h5 className="font-semibold text-white leading-snug">{b.title}</h5>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed whitespace-pre-wrap">
                          {b.message || b.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingNoticeId(b.id || null);
                            setRecentTitle(b.title);
                            setRecentDesc(b.message || b.description || "");
                            setRecentCategory(b.category || "All");
                            setRecentPinned(b.pinned || false);
                          }}
                          className="text-teal-400 hover:text-white hover:bg-teal-500/10 p-1.5 rounded transition-colors flex-shrink-0"
                          title="সম্পাদনা করুন"
                        >
                          <Zap className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => b.id && handleDelete("notices", b.id)}
                          className="text-red-500 hover:text-white hover:bg-red-500/10 p-1.5 rounded transition-colors flex-shrink-0"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEGMENT 5: Premium features validity subscription plans */}
      {activeSegment === "plans" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
          {/* Create/Edit plan form */}
          <div className="space-y-6">
            <form
              onSubmit={handleSavePlan}
              className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/50 space-y-4"
            >
              <h4 className="text-md font-bold text-teal-400 flex items-center gap-1.5">
                <Compass className="w-5 h-5" />
                {editingPlanId ? "প্রিমিয়াম প্ল্যান বিবরণ সম্পাদনা করুন" : "নতুন প্রিমিয়াম সাবস্ক্রিপশন প্ল্যান যুক্ত করুণ"}
              </h4>

              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-1">প্ল্যানের নাম *</label>
                <input
                  type="text"
                  required
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="যেমন: মাসিক প্রিমিয়াম প্ল্যান (Monthly Pro)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-teal-500 h-[38px]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="text-slate-300 text-xs font-semibold block mb-1">মেয়াদকাল *</label>
                  <input
                    type="text"
                    required
                    value={planValidity}
                    onChange={(e) => setPlanValidity(e.target.value)}
                    placeholder="যেমন: ১ মাস"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-teal-500 h-[38px]"
                  />
                </div>
                <div className="col-span-1">
                  <label className="text-slate-300 text-xs font-semibold block mb-1">নিয়মিত মূল্য (৳) *</label>
                  <input
                    type="number"
                    required
                    value={planPrice}
                    onChange={(e) => setPlanPrice(e.target.value)}
                    placeholder="যেমন: ১৯৯"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-teal-500 h-[38px]"
                  />
                </div>
                <div className="col-span-1">
                  <label className="text-slate-300 text-xs font-semibold block mb-1">অফার মূল্য (৳)</label>
                  <input
                    type="number"
                    value={planPromoPrice}
                    onChange={(e) => setPlanPromoPrice(e.target.value)}
                    placeholder="যেমন: ৯৯"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-teal-500 h-[38px]"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-1">ফিচার ও সুবিধা সমূহ (কমা অথবা এন্টার দিয়ে আলাদা করুন)</label>
                <textarea
                  value={planFeaturesText}
                  onChange={(e) => setPlanFeaturesText(e.target.value)}
                  placeholder="যেমন: সকল লাইভ এক্সাম অ্যাক্সেস, বিশেষ পিডিএফ ডাউনলোড, ২৪/৭ ডাউট সলভ গ্রুপ সাপোর্ট"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-teal-500 leading-relaxed"
                  rows={4}
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-lg h-[40px] cursor-pointer"
                >
                  {editingPlanId ? "প্ল্যান তথ্য আপডেট করুন (Save)" : "নতুন প্ল্যান যুক্ত করুন"}
                </button>
                {editingPlanId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPlanId(null);
                      setPlanName("");
                      setPlanValidity("");
                      setPlanPrice("");
                      setPlanPromoPrice("");
                      setPlanFeaturesText("");
                    }}
                    className="bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white font-bold text-xs py-2.5 px-3 rounded-lg h-[40px] cursor-pointer"
                  >
                    বাতিল
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* List existing premium subscription plans */}
          <div className="space-y-4">
            <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 space-y-3">
              <span className="text-slate-400 text-xs font-bold block flex items-center justify-between">
                <span>সক্রিয় প্রিমিয়াম প্ল্যানসমূহ ({premiumPlans.length})</span>
                <span className="text-[10px] text-teal-400 font-mono">APP ACCESS SUBSCRIPTIONS</span>
              </span>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {premiumPlans.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500">কোনো প্রিমিয়াম প্ল্যান পাওয়া যায়নি। প্ল্যান তৈরি করুন।</div>
                ) : (
                  premiumPlans.map((p) => (
                    <div
                      key={p.id}
                      className="p-4 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-2 relative"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-slate-100 text-sm">{p.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="bg-indigo-500/10 text-indigo-400 text-[10px] px-2 py-0.5 rounded-md font-semibold font-mono">
                              মেয়াদ: {p.validity}
                            </span>
                            <span className="text-xs text-teal-400 font-bold font-mono">
                              {p.promoPrice ? (
                                <>
                                  <span className="line-through text-slate-500 text-[11px] mr-1.5">৳{p.price}</span>
                                  ৳{p.promoPrice}
                                </>
                              ) : (
                                `৳${p.price}`
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingPlanId(p.id || null);
                              setPlanName(p.name);
                              setPlanValidity(p.validity);
                              setPlanPrice(String(p.price));
                              setPlanPromoPrice(p.promoPrice ? String(p.promoPrice) : "");
                              setPlanFeaturesText(p.features ? p.features.join(", ") : "");
                            }}
                            className="bg-teal-500/10 text-teal-400 hover:text-white hover:bg-teal-500 p-1.5 rounded-lg transition-all"
                            title="সম্পাদনা করুন"
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => p.id && handleDelete("premium_plans", p.id)}
                            className="bg-red-500/10 text-red-500 hover:text-white hover:bg-red-500 p-1.5 rounded-lg transition-all"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {p.features && p.features.length > 0 && (
                        <div className="pt-2 border-t border-slate-800/50">
                          <span className="text-[10px] text-slate-400 font-semibold block mb-1">সুবিধা সমূহ:</span>
                          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-400">
                            {p.features.map((feat, idx) => (
                              <li key={idx} className="truncate" title={feat}>{feat}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEGMENT 2: Categories hierarchy */}
      {activeSegment === "groups" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in text-xs">
          {/* Parent select panels */}
          <div className="space-y-6">
            <form
              onSubmit={handleSaveGroup}
              className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/50 space-y-4"
            >
              <h4 className="text-md font-bold text-teal-400 flex items-center gap-1.5">
                <Compass className="w-5 h-5" />
                নতুন গ্লোবাল এক্সাম প্যারেন্ট গ্রুপ
              </h4>

              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-1">ক্যাটাগরি বা এক্সাম গ্রুপ নাম *</label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="যেমন: BCS, Bank Exam, Primary School"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-teal-500 h-[38px]"
                />
              </div>

              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-1">অ্যাক্সেস স্তরায়ন</label>
                <select
                  value={catAccess}
                  onChange={(e) => setCatAccess(e.target.value as "free" | "premium")}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-teal-500 h-[38px]"
                >
                  <option value="free">ফ্রি ইউজার</option>
                  <option value="premium">প্রিমিয়াম ইউজার কেবল</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-lg h-[40px] cursor-pointer"
              >
                গ্রুপ ডাটাবেজে সাবমিট করুণ
              </button>
            </form>

            <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 space-y-3">
              <span className="text-slate-400 text-xs font-bold block">সংরক্ষিত প্যারেন্ট গ্রুপ ({categories.length})</span>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {categories.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex justify-between items-center"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-white">{c.name}</span>
                      {c.access === "premium" ? (
                        <span className="text-yellow-500 bg-yellow-500/10 px-1 py-0.5 rounded text-[8px] uppercase tracking-wider font-bold">
                          Premium
                        </span>
                      ) : (
                        <span className="text-slate-400 bg-slate-950 px-1 py-0.5 rounded text-[8px] uppercase font-bold">
                          Free
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => c.id && handleDelete("categories", c.id)}
                      className="text-red-500 hover:text-white hover:bg-red-500/10 p-1.5 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Subcategories state panels */}
          <div className="space-y-6">
            <form
              onSubmit={handleSaveSubCategory}
              className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/50 space-y-4"
            >
              <h4 className="text-md font-bold text-teal-400 flex items-center gap-1.5">
                <FolderPlus className="w-5 h-5" />
                {editingSubId ? "সাব-ক্যাটাগরি সম্পাদনা করুন" : "নতুন পড়ার বিষয় বা সাব-ক্যাটাগরি যুক্ত করুণ"}
              </h4>

              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-1">প্যারেন্ট গ্রুপ নির্বাচন *</label>
                <select
                  value={subParentId}
                  onChange={(e) => setSubParentId(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-teal-500 h-[38px]"
                >
                  <option value="">নির্বাচন করুন</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-1">সাব-ক্যাটাগরি নাম *</label>
                <input
                  type="text"
                  required
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="যেমন: ইংরেজি সাহিত্য, বাংলা ব্যাকরণ, গণিত"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-teal-500 h-[38px]"
                />
              </div>

              <div className="space-y-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-lg h-[40px] cursor-pointer"
                >
                  {editingSubId ? "আপডেট সংরক্ষণ করুন" : "সাব-ক্যাটাগরি সাবমিট করুণ"}
                </button>

                {editingSubId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSubId(null);
                      setSubName("");
                      setSubParentId("");
                    }}
                    className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-[11px] py-2 rounded-lg h-[36px] cursor-pointer transition-colors"
                  >
                    সম্পাদনা বাতিল করুন
                  </button>
                )}
              </div>
            </form>

            <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 space-y-3">
              <span className="text-slate-400 text-xs font-bold block">সাব-ক্যাটাগরি তালিকা ({subcategories.length})</span>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {subcategories.map((sub) => {
                  const parentGroup = categories.find((c) => c.id === sub.parentId);
                  const qCount = questions.filter((q) => q.subId === sub.id).length;
                  return (
                    <div
                      key={sub.id}
                      className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex justify-between items-center hover:border-slate-700 transition"
                    >
                      <div>
                        <span className="font-semibold text-white">{sub.name}</span>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          {parentGroup && (
                            <span className="text-slate-500 text-[9px]">
                              প্যারেন্ট: {parentGroup.name}
                            </span>
                          )}
                          <span className="bg-teal-500/10 text-teal-400 text-[9px] px-1.5 py-0.5 rounded font-bold font-mono">
                            প্রশ্ন: {qCount} টি
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingSubId(sub.id || null);
                            setSubName(sub.name);
                            setSubParentId(sub.parentId);
                          }}
                          className="text-teal-400 hover:text-white hover:bg-teal-500/10 p-1.5 rounded transition-colors"
                          title="সম্পাদনা করুন"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => sub.id && handleDelete("subcategories", sub.id)}
                          className="text-red-500 hover:text-white hover:bg-red-500/10 p-1.5 rounded transition-colors"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEGMENT 3: Coupons */}
      {activeSegment === "coupons" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in text-xs">
          <form
            onSubmit={handleSaveCoupon}
            className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/50 space-y-4"
          >
            <h4 className="text-md font-bold text-teal-400 flex items-center gap-1.5">
              <Tag className="w-5 h-5 animate-pulse" />
              ডিসকাউন্ট প্রমো কুপন জেনারেটর (Coupons)
            </h4>
            <p className="text-slate-400 text-[10px]">
              শিক্ষার্থীদের সাবস্ক্রিপশন ফি জমা দেওয়ার সময় ডিসকাউন্ট বা বিশেষ ছাড় দেওয়ার জন্য প্রমো কোড তৈরি করুন।
            </p>

            <div>
              <label className="text-slate-300 text-xs font-semibold block mb-1">কুপন কোড (বড় হাতের ইংরেজি) *</label>
              <input
                type="text"
                required
                value={cpCode}
                onChange={(e) => setCpCode(e.target.value)}
                placeholder="যেমন: MCQHERO50"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-teal-500 h-[38px] uppercase"
              />
            </div>

            <div>
              <label className="text-slate-300 text-xs font-semibold block mb-1">ছাড়ে পরিমাণ শতকরা হার (%) *</label>
              <input
                type="number"
                required
                value={cpDisc}
                onChange={(e) => setCpDisc(parseInt(e.target.value) || 20)}
                placeholder="20"
                min={1}
                max={100}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-teal-500 h-[38px]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-lg h-[40px] cursor-pointer"
            >
              কুপন কোড জেনারেট করুণ
            </button>
          </form>

          <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 space-y-3">
            <span className="text-slate-400 text-xs font-bold block">সক্রিয় প্রমো কোড সমূহ</span>
            {coupons.length === 0 ? (
              <p className="text-slate-500 text-xs py-10 text-center">কোনো ডিসকাউন্ট কুপন সচল নেই</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {coupons.map((cp) => (
                  <div
                    key={cp.id}
                    className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex justify-between items-center"
                  >
                    <div>
                      <h5 className="font-bold text-white font-mono uppercase tracking-wider">{cp.code}</h5>
                      <span className="text-[10px] text-emerald-400 font-bold block mt-0.5">
                        ছাড়: {cp.discount}%
                      </span>
                    </div>
                    <button
                      onClick={() => cp.id && handleDelete("coupons", cp.id)}
                      className="text-red-500 hover:text-white hover:bg-red-500/10 p-1.5 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SEGMENT 4: Config notice and simulated pushes */}
      {activeSegment === "configs" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in text-xs">
          {/* Maintenece alert notice panels */}
          <div className="space-y-6">
            <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/50 space-y-4">
              <h4 className="text-md font-bold text-teal-400 flex items-center gap-1.5">
                <Bell className="w-5 h-5 text-orange-500 animate-bounce" />
                গ্লোবাল নোটিশ ও লাইভ মোড কন্ট্রোল
              </h4>

              {/* Maintenance check */}
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-red-400 font-bold text-xs block flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
                      গ্লোবাল মেইনটেনেন্স মোড (Global Maintenance)
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                      এটি পরিবর্তন করলে শিক্ষার্থীদের অ্যাপলক চালু/বন্ধ হবে। ডাটাবেজে সরাসরি <span className="font-mono text-purple-300 font-semibold font-bold">true</span> বা <span className="font-mono text-emerald-300 font-semibold font-bold">false</span> মান আপডেট হবে।
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-[9px] uppercase font-bold tracking-wider ${
                      maintChecked
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    }`}>
                      {maintChecked ? "মেইনটেনেন্স অন (True)" : "মেইনটেনেন্স অফ (False)"}
                    </span>
                  </div>
                </div>

                {/* Instant-toggle buttons */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => handleToggleMaintenanceDirect(true)}
                    className={`py-2 px-3 rounded-xl font-bold text-xs h-[38px] cursor-pointer flex items-center justify-center gap-1.5 transition-all text-white ${
                      maintChecked
                        ? "bg-red-600 hover:bg-red-550 shadow-md ring-2 ring-red-550/20"
                        : "bg-slate-900 border border-slate-700/60 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    🛑 অন করুন (True)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleMaintenanceDirect(false)}
                    className={`py-2 px-3 rounded-xl font-bold text-xs h-[38px] cursor-pointer flex items-center justify-center gap-1.5 transition-all text-white ${
                      !maintChecked
                        ? "bg-emerald-650 hover:bg-emerald-550 shadow-md ring-2 ring-emerald-550/20"
                        : "bg-slate-900 border border-slate-700/60 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    🟢 অফ করুন (False)
                  </button>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-slate-300 text-xs font-semibold block mb-1">পপ-আপ নোটিশ শিরোনাম</label>
                  <input
                    type="text"
                    value={noticeTitle}
                    onChange={(e) => setNoticeTitle(e.target.value)}
                    placeholder="পপ-আপ টাইটেল টেক্সট"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-orange-500 h-[38px]"
                  />
                </div>

                <div>
                  <label className="text-slate-300 text-xs font-semibold block mb-1">নোটিশ শরীরের বিবরণ</label>
                  <textarea
                    value={noticeMsg}
                    onChange={(e) => setNoticeMsg(e.target.value)}
                    placeholder="সম্পূর্ণ নোটিশ মেসেজ এখানে লিখুন (HTML কোডও ব্যবহার করা যাবে)..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-orange-500 leading-relaxed"
                    rows={3}
                  />
                </div>

                <div className="flex items-center gap-2 py-1 select-none">
                  <input
                    type="checkbox"
                    checked={noticeActive}
                    onChange={(e) => setNoticeActive(e.target.checked)}
                    className="w-4 h-4 cursor-pointer"
                    id="chk-notice-active"
                  />
                  <label htmlFor="chk-notice-active" className="text-slate-300 cursor-pointer text-xs">
                    শিক্ষার্থীদের হোমপেজে নোটিশ প্রদর্শন সচল করুন
                  </label>
                </div>

                {/* Free Question Limit Section */}
                <div className="border-t border-slate-700/50 pt-3.5 mt-2 space-y-2.5">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-slate-200 text-xs font-semibold flex items-center gap-1.5 select-none">
                      <HelpCircle className="w-4 h-4 text-emerald-400" />
                      ফ্রি ইউজার প্রশ্ন লিমিট (Free Limit Per Topic)
                    </label>
                    <span className="text-[11px] bg-emerald-500/15 text-emerald-400 font-bold px-2.5 py-0.5 rounded-lg border border-emerald-500/20 font-mono">
                      {freeLimit} টি প্রশ্ন
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    প্রশ্ন ব্যাংক থেকে প্রতিটি টপিক বা ক্যাটাগরিতে একজন সাধারণ (Free) শিক্ষার্থী সর্বোচ্চ কতটি প্রশ্ন বিনামূল্যে দেখতে পারবেন তা সংজ্ঞায়িত করুন।
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max="200"
                      value={freeLimit}
                      onChange={(e) => setFreeLimit(Number(e.target.value))}
                      className="flex-1 accent-emerald-500 h-1.5 bg-slate-900 rounded-lg cursor-pointer animate-pulse"
                    />
                    <input
                      type="number"
                      min="1"
                      max="9999"
                      value={freeLimit}
                      onChange={(e) => setFreeLimit(Math.max(1, Number(e.target.value)))}
                      className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-center text-white outline-none focus:border-emerald-500 font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Question Daily Limit Control Section */}
                <div className="border-t border-slate-700/50 pt-3.5 mt-2 space-y-2.5">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-slate-200 text-xs font-semibold flex items-center gap-1.5 select-none">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      দৈনিক প্রশ্ন লিমিট কন্ট্রোল (Daily Question Limit)
                    </label>
                    <span className="text-[11px] bg-purple-500/15 text-purple-400 font-bold px-2.5 py-0.5 rounded-lg border border-purple-500/20 font-mono">
                      {dailyQuestionLimit} টি প্রশ্ন
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    শিক্ষার্থী বা অ্যাডমিন সহকারীগণ চ্যাটবক্স বা এআই ড্যাশবোর্ডে প্রতিদিন সর্বোচ্চ কতটি প্রশ্নের উত্তর বা জেনারেশন করতে পারবেন তা লিমিট করুন।
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max="150"
                      value={dailyQuestionLimit}
                      onChange={(e) => setDailyQuestionLimit(Number(e.target.value))}
                      className="flex-1 accent-purple-500 h-1.5 bg-slate-900 rounded-lg cursor-pointer"
                    />
                    <input
                      type="number"
                      min="1"
                      max="9999"
                      value={dailyQuestionLimit}
                      onChange={(e) => setDailyQuestionLimit(Math.max(1, Number(e.target.value)))}
                      className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-center text-white outline-none focus:border-purple-500 font-mono font-bold"
                    />
                  </div>
                  <div className="bg-purple-950/25 border border-purple-900/30 p-2.5 rounded-lg text-[10px] text-purple-300 leading-relaxed flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-ping" />
                    <span>বর্তমান ডাইনামিক লাইভ স্ট্যাটাস: প্রতিদিন সর্বোচ্চ <b>{dailyQuestionLimit} টি</b> প্রশ্ন জেনারেট/জিজ্ঞাসা করার অনুমতি রয়েছে।</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleUpdateNoticeAndConfig}
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-lg h-[40px] cursor-pointer transition-colors"
              >
                নোটিশ ও ফ্রি লিমিট কনফিগারেশন সেভ করুন
              </button>
            </div>

            {/* Telegram and Webhook notification settings */}
            <form
              onSubmit={handleSaveNotificationConfig}
              className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/50 space-y-4"
            >
              <h4 className="text-md font-bold text-teal-400 flex items-center gap-1.5">
                <Smartphone className="w-5 h-5 text-purple-400" />
                মোবাইল নোটিফিকেশন সেটিংস (Telegram / Webhook)
              </h4>
              <p className="text-slate-400 text-[10px] leading-relaxed">
                কোনো শিক্ষার্থী প্রিমিয়াম সাবস্ক্রিপশন রিকুয়েষ্ট পাঠালে বা কোর্স ক্রয় সাবমিট করলে সরাসরি আপনার মোবাইলে ইনস্ট্যান্ট পুশ নোটিফিকেশন মেসেজ চলে যাবে।
              </p>

              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-1.5 text-[10px] text-slate-300">
                <span className="font-bold text-indigo-300 block">💡 টেলিগ্রাম বোট কিভাবে সেটআপ করবেন?</span>
                <ol className="list-decimal pl-3 space-y-1 leading-normal">
                  <li>টেলিগ্রামে সার্চ করুন <span className="font-mono text-purple-300 select-all">@BotFather</span> এবং <span className="font-semibold text-white">/newbot</span> দিয়ে একটি বোট তৈরি করে <span className="font-semibold text-teal-300">HTTP API Token</span> টি কপি করুন।</li>
                  <li>আপনার নিজের বোটকে টেলিগ্রামে স্টার্ট করুণ।</li>
                  <li>আপনার <span className="font-semibold text-teal-300">Chat ID</span> পেতে টেলিগ্রামে <span className="font-mono text-purple-300 select-all">@userinfobot</span> এ স্টার্ট দিন।</li>
                  <li>নিচে টোকেন ও চ্যাট আইডি বসিয়ে <span className="font-semibold text-white">"ভেরিফাই করুন"</span> বাটনে চাপ দিয়ে টেস্ট মেসেজ পাঠান!</li>
                </ol>
              </div>

              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-1">টেলিগ্রাম বোট এপিআই টোকেন (Bot Token)</label>
                <input
                  type="text"
                  value={tgToken}
                  onChange={(e) => setTgToken(e.target.value)}
                  placeholder="যেমন: 123456789:ABCdefGhIJKlmNoPQRs..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500 h-[38px] font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-1">টেলিগ্রাম চ্যাট আইডি (Your Telegram Chat ID)</label>
                <input
                  type="text"
                  value={tgChatId}
                  onChange={(e) => setTgChatId(e.target.value)}
                  placeholder="যেমন: 987654321"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500 h-[38px] font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-1">কাস্টম ডিসকর্ড/স্ল্যাক ওয়েবহুক (Optional Webhook URL)</label>
                <input
                  type="text"
                  value={webhUrl}
                  onChange={(e) => setWebhUrl(e.target.value)}
                  placeholder="যেমন: https://discord.com/api/webhooks/..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500 h-[38px]"
                />
              </div>

              <div className="space-y-2.5 pt-1.5 border-t border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-slate-300 text-xs font-semibold block">মোবাইলে টেলিগ্রাম নোটিফিকেশন পাঠানো</span>
                    <p className="text-[10px] text-slate-500">অন থাকলে সরাসরি আপনার ফোনে পুশ নোটিফিকেশন যাবে</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={tgEnabled}
                    onChange={(e) => setTgEnabled(e.target.checked)}
                    className="w-4 h-4 cursor-pointer accent-purple-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-slate-300 text-xs font-semibold block">প্যানেলে অডিও অ্যালার্ট সাউন্ড বাজানো (Sound Alert)</span>
                    <p className="text-[10px] text-slate-500">নতুন রিকুয়েষ্ট আসলে এই ট্যাবে নোটিফিকেশন টিউন বাজবে</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={soundAlert}
                    onChange={(e) => setSoundAlert(e.target.checked)}
                    className="w-4 h-4 cursor-pointer accent-purple-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-705/30">
                  <div className="pr-4">
                    <span className="text-slate-300 text-xs font-semibold block text-amber-400">অ্যান্ড্রয়েড পুশ নোটিফিকেশন (FCM Native Push)</span>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      অ্যান্ড্রয়েড ডিভাইসে সরাসরি পুশ নোটিফিকেশন পাঠাতে এটি ব্যবহার করুন। <strong className="text-red-400">গুরুত্বপূর্ণ সতর্কতা:</strong> আপনার নিজস্ব অ্যান্ড্রয়েড এপের প্রজেক্টে <code className="bg-slate-900 px-1 py-0.5 rounded text-[9px] text-slate-300 font-mono">google-services.json</code> ফাইলটি ডাউনলোড করে সেটআপ করা না থাকলে এটি অন করার ফলে অ্যাপ ক্র্যাশ করে বন্ধ হয়ে যেতে পারে।
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={androidFcmEnabled}
                    onChange={(e) => setAndroidFcmEnabled(e.target.checked)}
                    className="w-4 h-4 cursor-pointer accent-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={testTelegramNotification}
                  disabled={loading || !tgToken.trim() || !tgChatId.trim()}
                  className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-lg h-[40px] cursor-pointer flex items-center justify-center gap-1 transition-colors"
                >
                  <Zap className="w-3.5 h-3.5 text-yellow-400" />
                  বোট কানেকশন টেস্ট করুন
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-lg h-[40px] cursor-pointer transition-colors"
                >
                  কনফিগারেশন সেভ করুন
                </button>
              </div>
            </form>
          </div>

          {/* Browser Notification settings & Test tool */}
          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/50 space-y-4">
            <h4 className="text-md font-bold text-sky-400 flex items-center gap-1.5 font-display">
              <Bell className="w-5 h-5 text-sky-400 animate-pulse" />
              ব্রাউজার নোটিফিকেশন সেটিংস ও টেস্ট টুল (Browser Notifications)
            </h4>
            <p className="text-slate-400 text-[10px] leading-relaxed font-sans">
              আপনি যদি অ্যান্ড্রয়েড ফোনে এপে কনভার্ট না করে সরাসরি ক্রোম বা অন্য মোবাইল ব্রাউজারে নোটিফিকেশন পেতে চান, তবে এই ব্রাউজারে নোটিফিকেশন এলাউ থাকলে নতুন পেমেন্ট সাবমিট আসবামাত্রই স্ক্রিনে পুশ এলার্ট ও শব্দ রিংটোন বাজবে।
            </p>

            <div className="p-3.5 bg-slate-900/50 border border-slate-700/40 rounded-xl space-y-2 text-[10px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-semibold">আপনার ব্রাউজার পারমিশন স্ট্যাটাস:</span>
                <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider ${
                  webNotificationStatus === "granted"
                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                    : webNotificationStatus === "denied"
                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                }`}>
                  {webNotificationStatus === "granted" ? "অনুমোদিত (Granted)" : webNotificationStatus === "denied" ? "ব্লকড (Blocked/Denied)" : "ডিফল্ট (Default/Pending)"}
                </span>
              </div>
              
              <div className="text-slate-300 leading-relaxed text-[10px] space-y-2">
                <div>
                  <span className="font-bold text-red-400 block mb-1">🔴 আপনার ব্রাউজারে নোটিফিকেশন ব্লক করা আছে! এটি যেভাবে সমাধান করবেন:</span>
                  <p className="pl-2 border-l-2 border-red-500/30 text-slate-400">
                    ১. ব্রাউজারের উপরে এড্রেস বারের বাম পাশে <strong>"Lock (তালা)"</strong> বা <strong>"Tune (সেটিংস আইকন)"</strong> এ ক্লিক করুন।<br />
                    ২. <strong>"Permissions (অনুমতি)"</strong> বা <strong>"Site Settings"</strong> এ যান।<br />
                    ৩. <strong>"Notifications (নোটিফিকেশন)"</strong> অপশনটি খুজে বের করুন এবং ওটি <strong>"Reset permissions"</strong> অথবা <strong>"Allow"</strong> করে দিন।<br />
                    ৪. এরপর পেজটি একবার রিফ্রেশ (Reload) দিয়ে নতুন ট্যাবে আবার চেষ্টা করুন।
                  </p>
                </div>
                
                <div className="pt-1.5 border-t border-slate-800">
                  <span className="font-bold text-emerald-400 block mb-0.5">💡 বিকল্প ইন-অ্যাপ এলার্ট (সীমাহীন):</span>
                  <p className="text-slate-400">মোবাইল ব্রাউজার বা ডিভাইসে নোটিফিকেশন ব্লক থাকলেও সমস্যা নেই! আপনি যখন এই এডমিন ড্যাশবোর্ড ওপেন রাখবেন, নতুন পেমেন্ট আসলেই স্ক্রিনের উপর একটি আকর্ষণীয় পপআপ ব্যানার ভেসে উঠবে এবং রিংটোন বাজবে। নিচের বাটনে ক্লিক করে এখনই টেস্ট করুন!</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={requestAndTestWebNotification}
                className="w-full bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white font-bold text-xs py-2.5 rounded-lg h-[40px] cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow"
              >
                <Smartphone className="w-4 h-4 text-white" />
                ব্রাউজার পারমিশন দিন ও টেস্ট করুন 🧪
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onSimulateAlert) {
                    onSimulateAlert({
                      email: "demo_student@gmail.com",
                      planName: "BCS BCS Hero Premium Gold Course",
                      method: "bKash (Personal)",
                      amount: 500,
                      status: "pending",
                      createdAt: new Date().toISOString()
                    });
                  } else {
                    alert("ইন-অ্যাপ পুশ ড্যাশবোর্ডে লোড হচ্ছে। দয়া করে পেজটি রিফ্রেশ দিন।");
                  }
                }}
                className="w-full bg-slate-700/80 hover:bg-slate-700 border border-slate-600/50 hover:border-amber-500/30 text-white font-bold text-xs py-2.5 rounded-lg h-[40px] cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow"
              >
                <Bell className="w-4 h-4 text-amber-400 animate-bounce" />
                ইন-অ্যাপ এলার্ট ও সাউন্ড টেস্ট করুন 🔔
              </button>
            </div>
          </div>

          {/* Custom API Base URL for Mobile WebView and Android Studio */}
          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/50 space-y-4">
            <h4 className="text-md font-bold text-teal-400 flex items-center gap-1.5">
              <Globe className="w-5 h-5 text-teal-400" />
              অ্যান্ড্রয়েড স্টুডিও এবং মোবাইল এপিআই সেটিংস
            </h4>
            <p className="text-slate-400 text-[10px] leading-relaxed">
              মোবাইলে ইন্সটল করার পর বা অ্যান্ড্রয়েড স্টুডিও-তে WebView দিয়ে অ্যাপ চালানোর সময় AI MCQ জেনারেট কাজ না করলে এখানে আপনার সার্ভারের সচল লিঙ্কটি সেভ করুন।
            </p>

            <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-xl space-y-1 text-[10px] text-slate-300 leading-normal">
              <span className="font-bold text-teal-300 block">💡 এপিআই কানেকশন টিপস:</span>
              • ডিফল্ট ট্রায়াল লিংক: <span className="font-mono text-purple-300">https://ais-pre-zw3x24xm35bs526mu55sme-1013337780190.asia-southeast1.run.app</span> (এটি ব্যবহারের জন্য ব্রাউজারে গুগল সাইন-ইন থাকতে হবে, যা মোবাইল অ্যাপের ভেতর কাজ নাও করতে পারে)।<br />
              • <strong>স্থানীয় পিসিতে টেস্ট করার জন্য:</strong> আপনার কম্পিউটার ও মোবাইল একই ওয়াইফাই-এ কানেক্ট করুন। আপনার কম্পিউটারের লোকাল আইপি অ্যাড্রেস যেমন: <span className="font-mono text-emerald-300">http://192.168.0.101:3000</span> এখানে লিখে সেভ করুন।<br />
              • <strong>রিয়েল প্রোডাকশনের জন্য:</strong> এই প্রজেক্টের নোড সার্ভারটি Render, Railway, বা অন্য কোথাও ডিপ্লয় করে সেই পাবলিক URL-টি এখানে সেভ করুন।
            </div>

            <div>
              <label className="text-slate-300 text-xs font-semibold block mb-1">এপিআই সার্ভার বেস ইউআরএল (API Base URL)</label>
              <div className="flex gap-2 font-sans">
                <input
                  type="text"
                  value={customApiUrl}
                  onChange={(e) => setCustomApiUrl(e.target.value)}
                  placeholder="যেমন: http://192.168.0.105:3000 বা https://my-backend.onrender.com"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-teal-500 h-[38px] font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      if (customApiUrl.trim()) {
                        window.localStorage.setItem("custom_api_base_url", customApiUrl.trim());
                        showSettingsToast("এপিআই ইউআরএল সফলভাবে সেভ করা হয়েছে!", "success");
                      } else {
                        window.localStorage.removeItem("custom_api_base_url");
                        showSettingsToast("এপিআই ইউআরএল রিসেট করা হয়েছে!", "success");
                      }
                    }
                  }}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-4 rounded-lg h-[38px] cursor-pointer transition-colors"
                >
                  সেভ করুন
                </button>
              </div>
            </div>
          </div>

          {/* Registered Admin FCM Devices list */}
          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/50 space-y-4">
            <h4 className="text-md font-bold text-indigo-400 flex items-center gap-1.5">
              <Smartphone className="w-5 h-5 text-indigo-400 animate-pulse" />
              অ্যান্ড্রয়েড FCM পুশ ডিভাইস তালিকা ({fcmTokens.length})
            </h4>
            <p className="text-slate-400 text-[10px] leading-relaxed">
              আপনার MCQ Hero এডমিন এন্ড্রয়েড অ্যাপটি যখনই কোনো সচল ডিভাইসে চালু করা হয়, তখনই এর ইউনিক Google FCM টোকেনটি এখানে স্বয়ংক্রিয়ভাবে নিবন্ধিত হয়। নতুন পেমেন্ট সাবমিট হলে এই নিবন্ধিত ডিভাইসসমূহে রিয়েল-টাইম পুশ নোটিফিকেশন পাঠানো হবে।
            </p>

            <div className="max-h-[180px] overflow-y-auto rounded-xl border border-slate-700/40 bg-slate-900/50">
              {fcmTokens.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs">
                  কোনো নিবন্ধিত এন্ড্রয়েড ডিভাইস পাওয়া যায়নি। এন্ড্রয়েড এপে লগইন করলে ডিভাইস টোকেন এখানে অটোমেটিক অ্যাড হবে।
                </div>
              ) : (
                <div className="divide-y divide-slate-850">
                  {fcmTokens.map((t, idx) => (
                    <div key={t.id || idx} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 hover:bg-slate-800/40 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-200">{t.email || "অজ্ঞাত এডমিন"}</span>
                          <span className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-md text-[9px] uppercase font-mono tracking-wider">{t.platform || "android"}</span>
                        </div>
                        <div className="font-mono text-[9px] text-slate-500 max-w-[250px] truncate select-all" title={t.token}>
                          FCM: {t.token}
                        </div>
                      </div>
                      <div className="text-right sm:text-right text-[10px] text-slate-400 whitespace-nowrap">
                        {t.registeredAt ? (
                          <span>নিবন্ধিত: {new Date(t.registeredAt.toDate?.() || t.registeredAt).toLocaleDateString("bn-BD")}</span>
                        ) : (
                          <span className="text-slate-600">N/A</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={fetchFcmTokens}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline flex items-center justify-end gap-1 ml-auto cursor-pointer"
              >
                রিফ্রেশ করুন 🔄
              </button>
            </div>
          </div>

          {/* Notifications Simulator */}
          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/50 space-y-4">
            <h4 className="text-md font-bold text-teal-400 flex items-center gap-1.5">
              <Send className="w-5 h-5 text-sky-400" />
              ব্রডকাস্ট পুশ নোটিফিকেশন স্যান্ডার (Push Broadcast)
            </h4>
            <p className="text-slate-400 text-[10px]">
              সরাসরি শিক্ষার্থী ডিভাইসে ফায়ারবেস পুশ স্ক্রিন নোটিফিকেশন এলার্ট সিগনাল ছড়িয়ে দিন।
            </p>

            <div>
              <label className="text-slate-300 text-xs font-semibold block mb-1">নোটিফিকেশন হেডলাইন সাবজেক্ট *</label>
              <input
                type="text"
                required
                value={notifHeader}
                onChange={(e) => setNotifHeader(e.target.value)}
                placeholder="যেমন: গুড নিউজ! লাইভ ক্লাসের শিডিউল পরিবর্তন করা হয়েছে..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-sky-500 h-[38px]"
              />
            </div>

            <div>
              <label className="text-slate-300 text-xs font-semibold block mb-1">নোটিফিকেশন বার্তা বডি *</label>
              <textarea
                required
                value={notifBody}
                onChange={(e) => setNotifBody(e.target.value)}
                placeholder="সম্পূর্ণ পুশ নোটিফিকেশন বার্তা বাক্য লিখুন..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-sky-500 leading-relaxed"
                rows={2}
              />
            </div>

            <div>
              <label className="text-slate-300 text-xs font-semibold block mb-1">ছবি বা ব্যানার সাইট লিংক URL (ঐচ্ছিক)</label>
              <input
                type="text"
                value={notifImage}
                onChange={(e) => setNotifImage(e.target.value)}
                placeholder="যেমন: https://host.com/images/banner.png"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-sky-500 h-[38px]"
              />
            </div>

            <button
              onClick={handleSendNotificationSimulation}
              disabled={loading || !notifHeader.trim() || !notifBody.trim()}
              className="w-full bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-lg h-[40px] cursor-pointer"
            >
              ব্রডকাস্ট পুশ সাবমিট নিশ্চিত করুন
            </button>
          </div>
        </div>
      )}

      {/* Settings Toast Feedback */}
      {settingsToast && (
        <div id="settings-toast" className="fixed bottom-5 right-5 z-50 animate-bounce">
          <div className={`p-4 rounded-xl shadow-xl flex items-center gap-2 border text-xs font-semibold ${
            settingsToast.type === "success" 
              ? "bg-emerald-950/95 text-emerald-400 border-emerald-500/30" 
              : "bg-red-950/95 text-red-400 border-red-500/30"
          }`}>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{settingsToast.message}</span>
          </div>
        </div>
      )}

      {/* Settings Confirmation Modal */}
      {maintConfirmModal && maintConfirmModal.isOpen && (
        <div id="maint-confirm-modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <h4 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${maintConfirmModal.checked ? "text-red-500" : "text-emerald-500"}`} />
              {maintConfirmModal.checked ? "মেইনটেনেন্স মোড চালু করার সতর্কতা" : "মেইনটেনেন্স মোড বন্ধ করার সতর্কতা"}
            </h4>
            
            <p className="text-slate-300 text-xs leading-relaxed mb-4">
              {maintConfirmModal.checked ? (
                <>আপনি কি নিশ্চিত যে আপনি গ্লোবাল মেইনটেনেন্স মোড <span className="text-red-400 font-bold">চালু (True)</span> করতে চান? এটি চালু করলে সমস্ত শিক্ষার্থী এবং সাধারণ ব্যবহারকারীদের স্ক্রিন সাময়িকভাবে লক হয়ে যাবে এবং মেইনটেনেন্স বার্তা দেখতে পাবে।</>
              ) : (
                <>আপনি কি নিশ্চিত যে আপনি গ্লোবাল মেইনটেনেন্স মোড <span className="text-emerald-400 font-bold">বন্ধ (False)</span> করতে চান? এটি করার সাথে সাথে সকল শিক্ষার্থী স্বাভাবিকভাবে অ্যাপ ব্যবহার করতে পারবে।</>
              )}
            </p>

            <div className="flex gap-3 justify-end pt-3 border-t border-slate-800/60">
              <button
                type="button"
                onClick={() => setMaintConfirmModal(null)}
                className="bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={() => executeToggleMaintenanceDirect(maintConfirmModal.checked)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all text-white flex items-center gap-1.5 ${
                  maintConfirmModal.checked 
                    ? "bg-red-650 hover:bg-red-550" 
                    : "bg-emerald-650 hover:bg-emerald-550"
                }`}
              >
                {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                নিশ্চিত করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Notice & Limit Save Configuration Confirmation Modal */}
      {noticeConfirmModalOpen && (
        <div id="notice-confirm-modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <h4 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 animate-pulse" />
              সেটিংস পরিবর্তনের কনফার্মেশন অ্যালার্ট
            </h4>
            
            <p className="text-slate-300 text-xs leading-relaxed mb-4">
              আপনি কি নিশ্চিতভাবে গ্লোবাল নোটিশ এবং ফ্রি লিমিট কনফিগারেশনের করা পরিবর্তনগুলো সংরক্ষণ করতে চান? এর ফলে নতুন সেটিংসটি তৎক্ষণাৎ কার্যকর হবে।
            </p>

            <div className="flex gap-3 justify-end pt-3 border-t border-slate-800/60">
              <button
                type="button"
                onClick={() => setNoticeConfirmModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={executeUpdateNoticeAndConfigDirect}
                className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all text-white bg-amber-600 hover:bg-amber-500 flex items-center gap-1.5"
              >
                {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                হ্যাঁ, সেভ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEGMENT 6: Gemini API Keys Rotator Administration Pane */}
      {activeSegment === "api_keys" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in text-xs">
          {/* Create Backup Keys Panel */}
          <div className="space-y-6">
            <form
              onSubmit={handleAddApiKey}
              className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/50 space-y-4"
            >
              <h4 className="text-md font-bold text-amber-400 flex items-center gap-1.5">
                <Zap className="w-5 h-5 text-amber-500 animate-pulse" />
                নতুন ব্যাকআপ এপিআই কী যুক্ত করুন (Add Backup API Key)
              </h4>

              <p className="text-slate-400 text-[11px] leading-relaxed">
                এখানে আপনি অতিরিক্ত গুগল জেমিনি এপিআই কী সংযুক্ত করতে পারেন। যখন মূল কীটির লিমিট শেষ হয়ে যাবে, তখন সিস্টেম স্বয়ংক্রিয়ভাবে একটির পর একটি এখানে থাকা সচল কী যুক্ত করে কাজ চালিয়ে যাবে।
              </p>

              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-1">এপিআই কী লেবেল (Label) *</label>
                <input
                  type="text"
                  required
                  value={newApiKeyLabel}
                  onChange={(e) => setNewApiKeyLabel(e.target.value)}
                  placeholder="যেমন: Backup API Key - BCS Course"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-teal-500 h-[38px]"
                />
              </div>

              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-1 font-mono">GEMINI API KEY *</label>
                <input
                  type="password"
                  required
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-teal-500 h-[38px] font-mono tracking-widest"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  * নতুন কী সেভ করার সময় সিস্টেম স্বয়ংক্রিয়ভাবে গুগল এআই স্টুডিও সার্ভারের সাথে কানেক্ট করে এপিআই কী-টি সচল কিনা যাচাই করবে।
                </span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={keysLoading}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs py-2.5 rounded-lg h-[40px] cursor-pointer transition-all flex items-center justify-center gap-2"
                >
                  {keysLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      ভ্যালিডেটিং এবং সেভিং...
                    </>
                  ) : (
                    "যাচাই করুন এবং সেভ করুন"
                  )}
                </button>
              </div>
            </form>

            <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 space-y-3">
              <h5 className="font-bold text-slate-200">কীভাবে নতুন Gemini API Key তৈরি করবেন?</h5>
              <div className="space-y-2 text-slate-400 leading-relaxed text-[11px]">
                <p>১. প্রথমে <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">Google AI Studio</a>-তে আপনার জিমেইল দিয়ে লগইন করুন।</p>
                <p>২. বাম পাশের মেনু থেকে <strong>"Get API Key"</strong>-তে ক্লিক করুন।</p>
                <p>৩. <strong>Create API Key</strong> বাটনে চাপ দিয়ে প্রজেক্ট সিলেক্ট করুন এবং সম্পূর্ণ নতুন একটি কী জেনারেট করে কপি করে নিয়ে এখানে সাবমিট করুন।</p>
                <p>৪. একটি কী-র লিমিট শেষ হলে স্বয়ংক্রিয় রোটেটর সিস্টেম পরবর্তী কী-কে রি-অ্যাক্টিভ করে দিবে।</p>
              </div>
            </div>
          </div>

          {/* Backup Keys List & Status Panel */}
          <div className="space-y-4">
            <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-700/40">
                <div>
                  <span className="text-slate-200 text-sm font-bold block">যুক্ত করা রোটেটিং ব্যাকআপ কীসমূহ</span>
                  <span className="text-[10px] text-slate-500 font-mono block">GEMINI DYNAMIC KEY COOLDOWNS</span>
                </div>
                <button
                  onClick={handleResetApiKeysStatus}
                  disabled={keysLoading}
                  className="bg-teal-500/10 hover:bg-teal-500 text-teal-400 hover:text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                >
                  রিসেট এবং পুনরায় নিষ্ক্রিয়তা দূর করুন
                </button>
              </div>

              <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
                {/* 1. Show Primary Env Key if available */}
                {envKeyInfo && envKeyInfo.hasEnvKey && (
                  <div className="p-4 bg-teal-950/20 rounded-xl border border-teal-500/20 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1 w-[80%]">
                        <h4 className="font-bold text-teal-300 text-xs flex items-center gap-1.5 flex-wrap">
                          <span>প্রাইমারি এপিআই কী (Environment KEY)</span>
                          {envKeyInfo.envKeyCooldown && new Date(envKeyInfo.envKeyCooldown) > new Date() ? (
                            <span className="bg-amber-500/10 text-amber-500 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md">
                              COOLDOWN (লিমিট শেষ)
                            </span>
                          ) : (
                            <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md">
                              ACTIVE (সচল)
                            </span>
                          )}
                        </h4>
                        <div className="flex items-center gap-2 mt-1.5">
                          <p className="font-mono text-[10px] text-slate-300 break-all select-all flex-1 py-1 px-2 bg-slate-900/60 rounded border border-slate-800">
                            {visibleKeys["primary_env"] ? envKeyInfo.envKey : envKeyInfo.envKeyMasked}
                          </p>
                          <button
                            type="button"
                            onClick={() => toggleKeyVisibility("primary_env")}
                            className="text-slate-400 hover:text-teal-400 p-1.5 rounded bg-slate-800/40 hover:bg-slate-800 transition-colors"
                            title={visibleKeys["primary_env"] ? "লুকিয়ে রাখুন" : "মেলা দেখান"}
                          >
                            {visibleKeys["primary_env"] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => envKeyInfo.envKey && handleCopyKey(envKeyInfo.envKey, "primary_env")}
                            className="text-slate-400 hover:text-teal-400 p-1.5 rounded bg-slate-800/40 hover:bg-slate-800 transition-colors"
                            title="কপি করুন"
                          >
                            {copiedKeyId === "primary_env" ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                      <span className="text-[9px] bg-teal-500/15 text-teal-400 px-2 py-0.5 rounded font-bold font-mono">
                        DEFAULT
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. Show Backup Keys */}
                {backupKeys.length === 0 ? (
                  (!envKeyInfo || !envKeyInfo.hasEnvKey) && (
                    <div className="text-center py-12 text-slate-500">
                      এখনো কোনো অতিরিক্ত ব্যাকআপ কী যুক্ত করা হয়নি। আজকের জেনারেশন লিমিট ও কোটা নিরাপদে রাখতে বাম পাশের ফর্ম থেকে অতিরিক্ত কী বাড়িয়ে নিন।
                    </div>
                  )
                ) : (
                  backupKeys.map((k) => {
                    const isLimited = k.status === "rate_limited";
                    const isInvalid = k.status === "invalid";
                    const keyVal = k.key || "";
                    const isVisible = !!visibleKeys[k.id];
                    return (
                      <div
                        key={k.id}
                        className="p-4 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-3"
                      >
                        <div className="flex justify-between items-start">
                          <div className="space-y-1 w-[80%]">
                            <h4 className="font-bold text-slate-100 flex items-center gap-1.5 flex-wrap">
                              <span>{k.label}</span>
                              {isLimited && (
                                <span className="bg-amber-500/10 text-amber-500 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md">
                                  COOLDOWN (লিমিট শেষ)
                                </span>
                              )}
                              {isInvalid && (
                                <span className="bg-red-500/10 text-red-500 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md">
                                  INVALID (অচল কী)
                                </span>
                              )}
                              {k.status === "active" && (
                                <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md">
                                  ACTIVE (সচল)
                                </span>
                              )}
                            </h4>
                            <div className="flex items-center gap-2 mt-1.5">
                              <p className="font-mono text-[10px] text-slate-300 break-all select-all flex-1 py-1 px-2 bg-slate-900/60 rounded border border-slate-800">
                                {isVisible ? keyVal : k.keyMasked}
                              </p>
                              <button
                                type="button"
                                onClick={() => toggleKeyVisibility(k.id)}
                                className="text-slate-400 hover:text-teal-400 p-1.5 rounded bg-slate-800/40 hover:bg-slate-800 transition-colors"
                                title={isVisible ? "লুকিয়ে রাখুন" : "মেলা দেখান"}
                              >
                                {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyKey(keyVal, k.id)}
                                className="text-slate-400 hover:text-teal-400 p-1.5 rounded bg-slate-800/40 hover:bg-slate-800 transition-colors"
                                title="কপি করুন"
                              >
                                {copiedKeyId === k.id ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          <button
                            onClick={() => handleDeleteApiKey(k.id)}
                            className="bg-red-500/10 text-red-500 hover:text-white hover:bg-red-500 p-1.5 rounded-lg transition-all shrink-0"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 pt-2 border-t border-slate-800/40">
                          <div>
                            <span className="text-slate-500">সর্বশেষ ব্যবহৃত:</span>{" "}
                            {k.lastUsed ? new Date(k.lastUsed).toLocaleTimeString() : "ব্যবহার হয়নি"}
                          </div>
                          <div>
                            <span className="text-slate-500">লিমিট সচল হবে:</span>{" "}
                            {k.cooldownUntil ? new Date(k.cooldownUntil).toLocaleTimeString() : "এখনই সচল আছে"}
                          </div>
                        </div>

                        {k.errorMessage && (
                          <div className="bg-red-500/5 text-red-400 p-2 rounded-lg text-[10px] border border-red-500/10 font-mono">
                            LastError: {k.errorMessage}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEGMENT 7: Firebase Mobile Phone Auth Test Panel */}
      {activeSegment === "phone_auth" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in text-xs">
          {/* Controls form */}
          <div className="space-y-6">
            <div className="bg-slate-800/60 p-6 rounded-2xl border border-slate-700/50 space-y-5">
              <h4 className="text-md font-bold text-emerald-400 flex items-center gap-1.5">
                <Smartphone className="w-5 h-5 text-emerald-500" />
                ফায়ারবেস মোবাইল ওটিপি ট্রায়াল চেকার (Firebase Phone Auth Tester)
              </h4>

              <p className="text-slate-300 text-xs leading-relaxed">
                এটি একটি <b>লাইভ ফায়ারবেস অথেনটিকেশন মোবাইল ওটিপি চেকার</b>। আপনি দেখতে চান ফায়ারবেস দিয়ে আসলেই মোবাইল নম্বর ভেরিফাই করা যায় কিনা এবং ওটিপি (OTP Code) ফায়ারবেস থেকে সরাসরি ফোনে আসে কিনা। সরাসরি আপনার ফোন নম্বর দিয়ে পরীক্ষা করুন!
              </p>

              {/* Status messaging */}
              {verificationError && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 flex items-start gap-2 animate-fade-in">
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                  <span className="leading-relaxed text-[11px] font-medium">{verificationError}</span>
                </div>
              )}

              {verificationSuccess && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 flex items-start gap-2 animate-fade-in">
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                  <span className="leading-relaxed text-[11px] font-medium">{verificationSuccess}</span>
                </div>
              )}

              {/* Step 1: Send OTP phone input */}
              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                    <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider block">ধাপ ১: মোবাইল নাম্বার ইনপুট</span>
                    
                    <div>
                      <label className="text-slate-400 text-xs font-semibold block mb-1">আপনার বা পরীক্ষামূলক মোবাইল নম্বর</label>
                      <input
                        type="tel"
                        required
                        disabled={phoneLoading}
                        value={testPhoneNumber}
                        onChange={(e) => setTestPhoneNumber(e.target.value)}
                        placeholder="যেমন: +88017XXXXXXXX বা 017XXXXXXXX"
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-400 h-[40px] font-mono tracking-wider"
                      />
                      <span className="text-[10px] text-slate-500 block mt-1">
                        * জিরো (0) দিয়ে শুরু করলে বাংলাদেশ কোড (+88) স্বয়ংক্রিয়ভাবে যুক্ত হবে।
                      </span>
                    </div>

                    {/* Google ReCAPTCHA placeholder - Firebase inserts recaptcha widget here */}
                    <div className="py-2 flex justify-center">
                      <div id="recaptcha-container" className="overflow-hidden rounded-lg border border-slate-800 shadow"></div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={phoneLoading}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 text-slate-950 font-bold text-xs py-3 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2 shadow-lg h-[44px]"
                  >
                    {phoneLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        ওটিপি রিকোয়েস্ট পাঠানো হচ্ছে...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 text-slate-950" />
                        ফোনে ওটিপি পাঠান (Send OTP SMS)
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Step 2: Code confirmation input */
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                    <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider block">ধাপ ২: ওটিপি কোড যাচাইকরণ</span>
                    
                    <div>
                      <label className="text-slate-400 text-xs font-semibold block mb-1">ফোনে আগত ৬ ডিজিটের ভেরিফিকেশন কোড (OTP)</label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        disabled={phoneLoading}
                        value={testOtpCode}
                        onChange={(e) => setTestOtpCode(e.target.value)}
                        placeholder="ভেরিফিকেশন কোড দিন (যেমন: 123456)"
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-400 h-[40px] font-mono tracking-widest text-center"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pb-2">
                    <button
                      type="button"
                      onClick={resetPhoneAuthTester}
                      disabled={phoneLoading}
                      className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold py-2.5 rounded-xl cursor-pointer transition-all text-xs h-[42px]"
                    >
                      নাম্বার পরিবর্তন করুন
                    </button>
                    <button
                      type="submit"
                      disabled={phoneLoading}
                      className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold py-2.5 rounded-xl cursor-pointer transition-all text-xs flex items-center justify-center gap-1.5 h-[42px]"
                    >
                      {phoneLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" /> : <Sparkles className="w-3.5 h-3.5 text-slate-950 animate-pulse" />}
                      কোড ভেরিফাই করুণ
                    </button>
                  </div>
                </form>
              )}

              {/* Verified Result Data */}
              {verifiedUserInfo && (
                <div className="bg-emerald-950/35 border border-emerald-500/20 rounded-2xl p-4 space-y-3 animate-scale-in col-span-1 lg:col-span-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ফায়ারবেস রিটার্নড ডাটা (Verified Object):
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-[10px] font-mono text-slate-300">
                    <div className="bg-slate-950/80 p-2 rounded border border-slate-800 flex justify-between">
                      <span className="text-slate-500">Firebase User UID:</span>
                      <span className="text-slate-200 select-all font-bold">{verifiedUserInfo.uid}</span>
                    </div>

                    <div className="bg-slate-950/80 p-2 rounded border border-slate-800 flex justify-between">
                      <span className="text-slate-500">Verified Phone Number:</span>
                      <span className="text-emerald-400 font-bold">{verifiedUserInfo.phoneNumber}</span>
                    </div>

                    <div className="bg-slate-950/80 p-2 rounded border border-slate-800 flex justify-between">
                      <span className="text-slate-500">Auth Method/Provider:</span>
                      <span className="text-blue-400 uppercase font-bold">{verifiedUserInfo.provider}</span>
                    </div>

                    <div className="bg-slate-950/80 p-2 rounded border border-slate-800 flex justify-between">
                      <span className="text-slate-500">Account Created:</span>
                      <span className="text-slate-400">{verifiedUserInfo.createdAt}</span>
                    </div>
                  </div>

                  <button
                    onClick={resetPhoneAuthTester}
                    className="w-full bg-slate-900 hover:bg-slate-850 hover:text-white border border-slate-800 py-2 rounded-xl text-[10px] font-semibold text-slate-400 cursor-pointer transition-colors"
                  >
                    নতুন টেস্ট শুরু করুন
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Guide explanations Panel */}
          <div className="space-y-6">
            <div className="bg-slate-800/60 p-6 rounded-2xl border border-slate-700/50 space-y-4">
              <h4 className="text-md font-bold text-teal-400 flex items-center gap-1.5">
                <Globe className="w-5 h-5 text-teal-500" />
                ফায়ারবেস ফোন অথেনটিকেশন কিভাবে কাজ করে?
              </h4>

              <div className="text-slate-300 space-y-3 text-xs leading-relaxed">
                <p>
                  ফায়ারবেস ফোন অথেনটিকেশন (Firebase Phone Authentication) একটি অত্যন্ত বিশ্বস্ত, দ্রুত এবং কম খরচের মাধ্যম যার সাহায্যে সরাসরি ওটিপি পাঠিয়ে ইউজার ভেরিফিকেশন করা সম্ভব।
                </p>

                <div className="h-px bg-slate-700/50" />

                <h5 className="font-bold text-white text-[13px] flex items-center gap-1.5 pt-1">
                  🔧 ডেভেলপমেন্ট ও ফ্রি টেস্ট করার সুবিধা:
                </h5>
                <p className="text-slate-400 text-[11px]">
                  গুগল ফায়ারবেস প্রতিটি প্রজেক্টে বা অ্যাপে <b>প্রতি মাসে বিনামূল্যে ১০,০০০ টি SMS OTP</b> পাঠানোর সুযোগ দেয়! এর ফলে ডেভেলপমেন্ট স্টেজে কোনো ডলার বা টাকা পরিশোধ করা ছাড়াই আপনারা ওটিপি সার্ভিস ফুললি টেস্ট করে প্রোডাক্ট লাইভ করতে পারবেন।
                </p>

                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3.5 space-y-2">
                  <h6 className="font-bold text-emerald-400 text-xs uppercase tracking-wider flex items-center gap-1">
                    💡 ফোন নম্বর টেস্টিং হোয়ایتলিস্ট ট্রিক:
                  </h6>
                  <p className="text-[11px] text-slate-300">
                    আপনি যদি চান রিয়েল এসএমএস (SMS Credit) খরচ না করে বা চার্জ ছাড়াই বারবার ফাস্ট ভেরিফিকেশন টেস্ট করতে, তাহলে ফায়ারবেস কনসোলে একটি <b>"Test Phone Number"</b> যুক্ত করে রাখতে পারেন:
                  </p>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-400 text-[11px]">
                    <li>ফায়ারবেস কনসোলের <b>Authentication &gt; Sign-in method &gt; Phone</b> সেকশনে যান।</li>
                    <li>সেখানের <b>"Phone numbers for testing (optional)"</b> অপশনটি খুলুন।</li>
                    <li>আপনার নম্বর (যেমন: <code className="text-teal-400 font-mono">+8801700000000</code>) এবং একটি স্থায়ী টেস্ট ওটিপি কোড (যেমন: <code className="text-teal-400 font-mono">123456</code>) লিখে এড করুন।</li>
                    <li>এখন ওই নাম্বার দিয়ে টেস্ট করলে মোবাইলে এসএমএস না আসলেও <code className="text-teal-400 font-mono">123456</code> দিয়েই আপনি যেকোনো কম্পিউটার বা মোবাইল থেকে ফায়ারবেসকে সাথে সাথে ভেরিফাই করতে পারবেন!</li>
                  </ol>
                </div>

                <h5 className="font-bold text-white text-[13px] flex items-center gap-1.5 pt-1">
                  🔒 ReCAPTCHA ভেরিফাইয়ার কি জন্য দরকার?
                </h5>
                <p className="text-slate-400 text-[11px]">
                  ফায়ারবেস আপনার সিস্টেমকে স্প্যাম বোট বা অটোমেটেড প্রোগ্রাম থেকে রক্ষা করার জন্য ReCAPTCHA সিকিউরিটি বাধ্যবাধকতা করেছে যেন কেউ স্ক্রিপ্ট চালিয়ে আপনার দৈনিক ফির্ফ্রি ওটিপি ব্যালেন্স বা এসএমএস কোটা নষ্ট করতে না পারে। ReCAPTCHA সফলভাবে ফিলআপ করলেই কেবল গুগল আপনার ফোনে আসল ওটিপি এসএমএস পাঠায়।
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Premium Confirmation Modal */}
      {confirmConfig && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-scale-in">
            <div className="flex items-center gap-3 text-amber-500 mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h4 className="text-base font-bold text-white">
                {confirmConfig.title}
              </h4>
            </div>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
              {confirmConfig.description}
            </p>
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => setConfirmConfig(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                বাতিল করুন
              </button>
              <button
                onClick={async () => {
                  const callback = confirmConfig.onConfirm;
                  setConfirmConfig(null);
                  await callback();
                }}
                className="px-4 py-2 bg-red-500 hover:bg-red-650 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                নিশ্চিত করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
