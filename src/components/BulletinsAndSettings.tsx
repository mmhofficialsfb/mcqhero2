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
  Loader2,
  AlertTriangle,
  Smartphone,
  Volume2,
  Zap,
  CheckCircle,
  XCircle
} from "lucide-react";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  doc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Category, SubCategory, Course, RecentInfo, Coupon, PremiumPlan } from "../types";

interface BulletinsAndSettingsProps {
  categories: Category[];
  subcategories: SubCategory[];
  courses: Course[];
  bulletins: RecentInfo[];
  coupons: Coupon[];
  premiumPlans: PremiumPlan[];
  triggerReload: () => void;
  globalNotice: { title: string; message: string; active: boolean };
  maintenanceMode: boolean;
  isSandboxMode?: boolean;
}

export default function BulletinsAndSettings({
  categories,
  subcategories,
  courses,
  bulletins,
  coupons,
  premiumPlans,
  triggerReload,
  globalNotice,
  maintenanceMode,
  isSandboxMode
}: BulletinsAndSettingsProps) {
  const [activeSegment, setActiveTab] = useState<"courses" | "groups" | "coupons" | "configs" | "plans">("courses");
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

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
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);

  // 2. Groups (Categories) State
  const [catName, setCatName] = useState("");
  const [catAccess, setCatAccess] = useState<"free" | "premium">("free");

  // 3. Subcategories State
  const [subParentId, setSubParentId] = useState("");
  const [subName, setSubName] = useState("");

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
        }
      } catch (e) {
        console.warn("Failed to load notification settings:", e);
      }
    };
    fetchNotifConfig();
  }, []);

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
        const parsed = JSON.parse(local) as any[];
        parsed.push({ id: "subcat-" + Date.now(), ...payload });
        localStorage.setItem("local_subcategories", JSON.stringify(parsed));
        alert("সাব-ক্যাটাগরি যুক্ত করা হয়েছে! (স্যান্ডবক্স মোড)");
      } else {
        await addDoc(collection(db, "subcategories"), payload);
        alert("সাব-ক্যাটাগরি যুক্ত করা হয়েছে!");
      }
      setSubName("");
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

  //notice and maint updates
  const handleUpdateNoticeAndConfig = async () => {
    setLoading(true);
    try {
      if (isSandboxMode) {
        localStorage.setItem("local_global_notice", JSON.stringify({
          title: noticeTitle.trim(),
          message: noticeMsg.trim(),
          active: noticeActive
        }));
        localStorage.setItem("local_maintenance_mode", maintChecked ? "true" : "false");
        alert("নোটিশ ও মেইনটেনেন্স কনফিগারেশন সফলভাবে স্থানীয়ভাবে (Sandbox) আপডেট করা হয়েছে!");
        triggerReload();
        return;
      }

      // 1. Notice doc (updates notice text parameters and syncs maintenance)
      await setDoc(doc(db, "settings", "global_notice"), {
        title: noticeTitle.trim(),
        message: noticeMsg.trim(),
        active: noticeActive,
        maintenance: maintChecked,
        maintenanceMode: maintChecked,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // 2. Maint Mode doc (updates with merge to avoid zeroing other settings)
      await setDoc(doc(db, "app_config", "app_config"), {
        maintenance: maintChecked
      }, { merge: true });

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

      // Maintain local cache as a high-security backup 
      localStorage.setItem("local_global_notice", JSON.stringify({
        title: noticeTitle.trim(),
        message: noticeMsg.trim(),
        active: noticeActive
      }));
      localStorage.setItem("local_maintenance_mode", maintChecked ? "true" : "false");

      alert("নোটিশ ও মেইনটেনেন্স কনফিগারেশন সফলভাবে ক্লাউড ডাটাবেজে আপডেট করা হয়েছে!");
      triggerReload();
    } catch (err: any) {
      console.warn("Firebase config write failed, using local storage fallback:", err);
      localStorage.setItem("local_global_notice", JSON.stringify({
        title: noticeTitle.trim(),
        message: noticeMsg.trim(),
        active: noticeActive
      }));
      localStorage.setItem("local_maintenance_mode", maintChecked ? "true" : "false");
      alert("নোটিশ ও মেইনটেনেন্স কনফিগারেশন আপডেট করা হয়েছে (Firebase সংযোগ সমস্যা, স্থানীয় মেমরিতে সংরক্ষিত)!");
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
                নতুন পড়ার বিষয় বা সাব-ক্যাটাগরি যুক্ত করুণ
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

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-lg h-[40px] cursor-pointer"
              >
                সাব-ক্যাটাগরি কন্টাক্ট করুণ
              </button>
            </form>

            <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 space-y-3">
              <span className="text-slate-400 text-xs font-bold block">সাব-ক্যাটাগরি তালিকা ({subcategories.length})</span>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {subcategories.map((sub) => {
                  const parentGroup = categories.find((c) => c.id === sub.parentId);
                  return (
                    <div
                      key={sub.id}
                      className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex justify-between items-center"
                    >
                      <div>
                        <span className="font-semibold text-white">{sub.name}</span>
                        {parentGroup && (
                          <span className="text-slate-500 text-[9px] block">
                            প্যারেন্ট: {parentGroup.name}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => sub.id && handleDelete("subcategories", sub.id)}
                        className="text-red-500 hover:text-white hover:bg-red-500/10 p-1.5 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
              </div>

              <button
                type="button"
                onClick={handleUpdateNoticeAndConfig}
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-lg h-[40px] cursor-pointer"
              >
                নোটিশ ফাইল কনফিগারেশন আপডেট করুন
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
