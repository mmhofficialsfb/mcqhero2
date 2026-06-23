import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  HelpCircle,
  Users as UsersIcon,
  FolderLock,
  CreditCard,
  Timer,
  Settings,
  LogOut,
  Sparkles,
  Loader2,
  Lock,
  ShieldCheck,
  Eye,
  Menu,
  X,
  Presentation,
  AlertTriangle,
  Calendar,
  Flag,
  ShieldAlert,
  PhoneCall,
  Briefcase
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User as FirebaseUser
} from "firebase/auth";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  limit
} from "firebase/firestore";
import { auth, db } from "./lib/firebase";

// Importing Subcomponents
import DashboardStats from "./components/DashboardStats";
import QuestionManage from "./components/QuestionManage";
import UserManage from "./components/UserManage";
import ResourceManage from "./components/ResourceManage";
import PaymentManage from "./components/PaymentManage";
import LiveExamManage from "./components/LiveExamManage";
import BulletinsAndSettings from "./components/BulletinsAndSettings";
import SmartboardGenerator from "./components/SmartboardGenerator";
import ExamRoutineManage from "./components/ExamRoutineManage";
import QuestionReportManage from "./components/QuestionReportManage";
import ActivityLogManage, { logActivity } from "./components/ActivityLogManage";
import ContactManage from "./components/ContactManage";
import QuizPosterGenerator from "./components/QuizPosterGenerator";
import JobCircularManage from "./components/JobCircularManage";


// Interfaces
import {
  UserProfile,
  Category,
  SubCategory,
  Question,
  Course,
  Payment,
  LiveExam,
  RecentInfo,
  Coupon,
  PremiumPlan,
  QuestionReport
} from "./types";

export default function App() {
  // Navigation & UI States
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "questions" | "users" | "resources" | "billing" | "exams" | "settings" | "smartboard" | "routine" | "reports" | "contact" | "quiz" | "circular"
  >("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [isSandboxMode, setIsSandboxMode] = useState(false);

  // Firestore Database Collections State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<SubCategory[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [exams, setExams] = useState<LiveExam[]>([]);
  const [bulletins, setBulletins] = useState<RecentInfo[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [premiumPlans, setPremiumPlans] = useState<PremiumPlan[]>([]);
  const [questionReports, setQuestionReports] = useState<QuestionReport[]>([]);
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [activePaymentAlerts, setActivePaymentAlerts] = useState<any[]>([]);

  // Global settings toggles in Firebase
  const [globalNotice, setGlobalNotice] = useState({ title: "", message: "", active: false, freeUserQuestionLimit: 20, dailyQuestionLimit: 15 });
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [showAdminLoginUnderMaint, setShowAdminLoginUnderMaint] = useState(false);
  const [notifConfig, setNotifConfig] = useState({
    telegramToken: "",
    telegramChatId: "",
    enabled: false,
    soundEnabled: true,
    webhookUrl: "",
    androidFcmEnabled: false
  });

  const [dbLoading, setDbLoading] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Trigger Reload logic
  const triggerReload = () => setReloadTrigger((prev) => prev + 1);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          // Check role claim in Firestore
          const pSnap = await getDoc(doc(db, "users", user.uid));
          const isDefaultAdmin = (user.email || "").toLowerCase().trim() === "mmhofficialsfb@gmail.com" || 
                                (user.email || "").toLowerCase().endsWith("@mcqhero.com");
          if (pSnap.exists()) {
            const data = pSnap.data() as UserProfile;
            if (isDefaultAdmin && data.role !== "admin") {
              data.role = "admin";
            }
            setUserProfile(data);
          } else {
            // Default safe role to 'free' or 'admin' depending on email
            setUserProfile({
              uid: user.uid,
              email: user.email || "",
              role: isDefaultAdmin ? "admin" : "free"
            });
          }
        } catch (e) {
          console.error("Firestore user verification failed:", e);
          const isDefaultAdmin = (user.email || "").toLowerCase().trim() === "mmhofficialsfb@gmail.com" || 
                                (user.email || "").toLowerCase().endsWith("@mcqhero.com");
          setUserProfile({
            uid: user.uid,
            email: user.email || "",
            role: isDefaultAdmin ? "admin" : "free"
          });
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
      setAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  // Setup Android Native Push notifications (FCM) if the logged-in user is an admin/moderator
  useEffect(() => {
    if (userProfile && (userProfile.role === "admin" || userProfile.role === "moderator")) {
      if (notifConfig.androidFcmEnabled) {
        const initPush = async () => {
          try {
            const { initPushNotifications } = await import("./lib/pushNotifications");
            await initPushNotifications(userProfile.uid, userProfile.email);
          } catch (err) {
            console.warn("Failed to load native push notification system module:", err);
          }
        };
        initPush();
      } else {
        console.log("Android Native FCM notifications are disabled by configuration. Skipping registration to prevent startup crashes on devices without google-services.json.");
      }
    }
  }, [userProfile, notifConfig.androidFcmEnabled]);

  // Real-time listen for App Config & Maintenance mode (instantly kicks out non-admin users)
  useEffect(() => {
    if (isSandboxMode) {
      const interval = setInterval(() => {
        const storedMaint = localStorage.getItem("local_maintenance_mode");
        if (storedMaint !== null) {
          setMaintenanceMode(storedMaint === "true");
        }
        const storedNotice = localStorage.getItem("local_global_notice");
        if (storedNotice) {
          try {
            setGlobalNotice(JSON.parse(storedNotice));
          } catch (e) {}
        }
      }, 1000);
      return () => clearInterval(interval);
    }

    // Live Snapshot Subscription
    const configDocRef = doc(db, "app_config", "app_config");
    const unsubConfig = onSnapshot(configDocRef, (snap) => {
      if (snap.exists()) {
        const val = snap.data().maintenance || false;
        setMaintenanceMode(val);
        localStorage.setItem("local_maintenance_mode", val ? "true" : "false");
      }
    }, (err) => {
      console.warn("Real-time snapshot sub error for app_config:", err);
    });

    const noticeDocRef = doc(db, "settings", "global_notice");
    const unsubNotice = onSnapshot(noticeDocRef, (snap) => {
      if (snap.exists()) {
        const ndata = snap.data();
        const updatedNotice = {
          title: ndata.title || "",
          message: ndata.message || "",
          active: ndata.active || false,
          freeUserQuestionLimit: typeof ndata.freeUserQuestionLimit === "number" ? ndata.freeUserQuestionLimit : (typeof ndata.free_user_limit === "number" ? ndata.free_user_limit : 20),
          dailyQuestionLimit: typeof ndata.dailyQuestionLimit === "number" ? ndata.dailyQuestionLimit : 15
        };
        setGlobalNotice(updatedNotice);
        localStorage.setItem("local_global_notice", JSON.stringify(updatedNotice));
      }
    }, (err) => {
      console.warn("Real-time snapshot sub error for global_notice:", err);
    });

    return () => {
      unsubConfig();
      unsubNotice();
    };
  }, [isSandboxMode]);

  // Auto-kick out students/ordinary users when maintenance mode is active
  useEffect(() => {
    if (maintenanceMode && userProfile) {
      const isElevated = userProfile.role === "admin" || userProfile.role === "moderator";
      if (!isElevated) {
        alert("দুঃখিত, অ্যাপ্লিকেশনটি বর্তমানে মেইনটেনেন্স (রক্ষণাবেক্ষণ) মোডে সক্রিয় হয়েছে। আপনাকে সুরক্ষার্থে লগআউট করানো হচ্ছে।");
        if (isSandboxMode) {
          setIsSandboxMode(false);
          setUserProfile(null);
          setCurrentUser(null);
        } else {
          signOut(auth).then(() => {
            setUserProfile(null);
            setCurrentUser(null);
          });
        }
        setShowAdminLoginUnderMaint(false);
      }
    }
  }, [maintenanceMode, userProfile, isSandboxMode]);

  // Fetch Firestore Databases
  useEffect(() => {
    const fetchAllData = async () => {
      setDbLoading(true);
      if (isSandboxMode) {
        try {
          loadSandboxMockData();
        } catch (e) {
          console.error("Local load failed", e);
        } finally {
          setDbLoading(false);
        }
        return;
      }
      try {
        // Safe individually caught fetches for robust resilience
        try {
          const uSnap = await getDocs(collection(db, "users"));
          setUsers(uSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id } as UserProfile)));
        } catch (e: any) {
          console.warn("Failed to fetch 'users' collection:", e.message || e);
          // If we fail on critical tables AND not authenticated or connection fails, we might switch to sandbox, but let's see.
        }

        try {
          const qSnap = await getDocs(collection(db, "questions"));
          setQuestions(qSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id } as Question)));
        } catch (e: any) {
          console.warn("Failed to fetch 'questions' collection:", e.message || e);
        }

        try {
          const cSnap = await getDocs(collection(db, "categories"));
          setCategories(cSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id } as Category)));
        } catch (e: any) {
          console.warn("Failed to fetch 'categories' collection:", e.message || e);
        }

        try {
          const sSnap = await getDocs(collection(db, "subcategories"));
          setSubcategories(sSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id } as SubCategory)));
        } catch (e: any) {
          console.warn("Failed to fetch 'subcategories' collection:", e.message || e);
        }

        try {
          const courseSnap = await getDocs(collection(db, "courses"));
          setCourses(courseSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id } as Course)));
        } catch (e: any) {
          console.warn("Failed to fetch 'courses' collection:", e.message || e);
        }

        try {
          const pSnap = await getDocs(collection(db, "payments"));
          setPayments(pSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id } as Payment)));
        } catch (e: any) {
          console.warn("Failed to fetch 'payments' collection:", e.message || e);
        }

        try {
          const eSnap = await getDocs(collection(db, "live_exams"));
          setExams(eSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id } as LiveExam)));
        } catch (e: any) {
          console.warn("Failed to fetch 'live_exams' collection:", e.message || e);
        }

        try {
          const bSnap = await getDocs(collection(db, "notices"));
          setBulletins(bSnap.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              title: data.title || "",
              description: data.message || data.description || "",
              message: data.message || "",
              category: data.category || "All",
              pinned: data.pinned || false,
              createdAt: data.createdAt
            };
          }));
        } catch (e: any) {
          console.warn("Failed to fetch 'notices' collection:", e.message || e);
        }

        try {
          const cpSnap = await getDocs(collection(db, "coupons"));
          setCoupons(cpSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id } as Coupon)));
        } catch (e: any) {
          console.warn("Failed to fetch 'coupons' collection:", e.message || e);
        }

        // Premium Plans
        try {
          const ppSnap = await getDocs(collection(db, "premium_plans"));
          setPremiumPlans(ppSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id } as PremiumPlan)));
        } catch (err: any) {
          console.warn("premium_plans collection failed to load:", err.message || err);
        }

        // Question Reports
        try {
          const qrSnap = await getDocs(collection(db, "qbank_reports"));
          setQuestionReports(qrSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id } as QuestionReport)));
        } catch (err: any) {
          console.warn("qbank_reports collection failed to load:", err.message || err);
        }

        // Support Messages
        try {
          const smSnap = await getDocs(collection(db, "support_messages"));
          setSupportMessages(smSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id })));
        } catch (err: any) {
          console.warn("support_messages collection failed to load:", err.message || err);
        }

        // Load configs
        try {
          const noticeRef = await getDoc(doc(db, "settings", "global_notice"));
          if (noticeRef.exists()) {
            const ndata = noticeRef.data();
            setGlobalNotice({
              title: ndata.title || "",
              message: ndata.message || "",
              active: ndata.active || false,
              freeUserQuestionLimit: typeof ndata.freeUserQuestionLimit === "number" ? ndata.freeUserQuestionLimit : (typeof ndata.free_user_limit === "number" ? ndata.free_user_limit : 20),
              dailyQuestionLimit: typeof ndata.dailyQuestionLimit === "number" ? ndata.dailyQuestionLimit : (typeof ndata.daily_question_limit === "number" ? ndata.daily_question_limit : 15)
            });
          }
        } catch (e: any) {
          console.warn("Failed to fetch 'global_notice' settings:", e.message || e);
        }

        try {
          const configRef = await getDoc(doc(db, "app_config", "app_config"));
          if (configRef.exists()) {
            setMaintenanceMode(configRef.data().maintenance || false);
          }
        } catch (e: any) {
          console.warn("Failed to fetch 'app_config' maintenance setting:", e.message || e);
        }

        try {
          const notifRef = await getDoc(doc(db, "settings", "notification_config"));
          if (notifRef.exists()) {
            const nd = notifRef.data();
            setNotifConfig({
              telegramToken: nd.telegramToken || "",
              telegramChatId: nd.telegramChatId || "",
              enabled: nd.enabled || false,
              soundEnabled: nd.soundEnabled !== false,
              webhookUrl: nd.webhookUrl || "",
              androidFcmEnabled: nd.androidFcmEnabled || false
            });
          }
        } catch (e: any) {
          console.warn("Failed to fetch 'notification_config' settings:", e.message || e);
        }
      } catch (err) {
        console.warn("Firestore tables critical fetch exception. Switching sandbox state:", err);
        // Explicitly set sandbox mode to true to indicate we're working in localized offline mode
        setIsSandboxMode(true);
        // Load default beautiful static sandbox data to show complete feature set
        loadSandboxMockData();
      } finally {
        setDbLoading(false);
      }
    };

    fetchAllData();
  }, [reloadTrigger, isSandboxMode, currentUser]);

  // Real-time payments listener for mobile & screen alerts
  useEffect(() => {
    if (!currentUser || isSandboxMode) return;

    // Prompt for browser notifications permission on Admin load
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    let isInitial = true;
    const unsubscribe = onSnapshot(
      collection(db, "payments"),
      (snapshot) => {
        const loadedPayments: Payment[] = [];
        snapshot.forEach((doc) => {
          loadedPayments.push({ ...doc.data(), id: doc.id } as Payment);
        });

        // Find and process new additions
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added" && !isInitial) {
            const pData = change.doc.data() as Payment;
            if (pData.status === "pending" || !pData.status) {
              triggerNewPaymentNotification(pData);
            }
          }
        });

        setPayments(loadedPayments);
        isInitial = false;
      },
      (error) => {
        console.error("Realtime payments snapshot subscription error:", error);
      }
    );

    return unsubscribe;
  }, [currentUser, isSandboxMode, notifConfig]);

  // Real-time support messages listener for live notifications and badge updates
  useEffect(() => {
    if (!currentUser || isSandboxMode) return;

    const collectionNames = [
      "support_tickets",
      "support_messages", 
      "messages", 
      "support", 
      "contacts", 
      "contact_messages", 
      "user_messages"
    ];
    const unsubscribes: (() => void)[] = [];
    const collectionsData: { [colName: string]: any[] } = {};
    let isInitial = true;

    collectionNames.forEach((colName) => {
      const unsub = onSnapshot(
        query(collection(db, colName), limit(100)),
        (snapshot) => {
          const list: any[] = [];
          snapshot.forEach((doc) => {
            list.push({ ...doc.data(), id: doc.id, _collection: colName });
          });

          // Trigger chime & toast alerts on new customer support inquiries from user app
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added" && !isInitial) {
              const mData = change.doc.data();
              if (notifConfig.soundEnabled) {
                try {
                  const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2013/2013-84.wav");
                  audio.play();
                } catch (err) {
                  console.warn("Chime playback failed:", err);
                }
              }
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification("নতুন কাস্টমার সাপোর্ট মেসেজ!", {
                  body: `উৎস: ${colName}\nপ্রেরক: ${mData.name || mData.username || mData.fullName || "অজ্ঞাতনামা শিক্ষার্থী"}\nবিষয়: ${mData.subject || mData.topic || mData.title || "সাপোর্ট"}\nবার্তা: ${mData.message || mData.msg || mData.text || ""}`,
                  icon: "https://cdn-icons-png.flaticon.com/512/3114/3114810.png"
                });
              }
            }
          });

          collectionsData[colName] = list;

          // Merge all
          const mergedMap = new Map<string, any>();
          collectionNames.forEach((cn) => {
            if (collectionsData[cn]) {
              collectionsData[cn].forEach((item) => {
                mergedMap.set(item.id, item);
              });
            }
          });

          setSupportMessages(Array.from(mergedMap.values()));
          isInitial = false;
        },
        (error) => {
          console.warn(`Realtime snapshot query on optional '${colName}' failed:`, error.message || error);
        }
      );
      unsubscribes.push(unsub);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [currentUser, isSandboxMode, notifConfig]);

  const triggerNewPaymentNotification = async (payment: Payment) => {
    // 0. Update the in-app active payment alerts state to show a beautiful interactive overlay banner
    setActivePaymentAlerts(prev => [
      {
        id: Date.now() + Math.random(),
        payment,
        timestamp: new Date()
      },
      ...prev
    ]);

    // 1. Play beautiful crisp check chime sound!
    if (notifConfig.soundEnabled) {
      try {
        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2013/2013-84.wav");
        audio.play();
      } catch (err) {
        console.warn("Chime playback blocked or failed:", err);
      }
    }

    // 2. Local desktop notification if allowed
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("নতুন পেমেন্ট রিকোয়েস্ট!", {
        body: `ইডি: ${payment.email}\nকোর্স/প্ল্যান: ${payment.planName}\nমেথড: ${payment.method}`,
        icon: "https://cdn-icons-png.flaticon.com/512/3114/3114810.png"
      });
    }

    // 3. Telegram Bot push to Mobile Messenger! (FREE and Instant!)
    if (notifConfig.enabled && notifConfig.telegramToken && notifConfig.telegramChatId) {
      try {
        const message = `🔔 *নতুন পেমেন্ট রিকোয়েস্ট!* 🔔\n\n` +
          `📧 *ইউজার ইমেইল:* ${payment.email}\n` +
          `💻 *প্ল্যান/কোর্স:* ${payment.planName}\n` +
          `💸 *পেমেন্ট মেথড:* ${payment.method}\n` +
          `🧾 *ট্রানজেকশন ID:* \`${payment.transactionId || 'N/A'}\`\n\n` +
          `⚠️ দয়া করে এডমিন প্যানেল চেক করে পেমেন্টটি দ্রুত অনুমোদন করুন।`;

        await fetch(`https://api.telegram.org/bot${notifConfig.telegramToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: notifConfig.telegramChatId,
            text: message,
            parse_mode: "Markdown"
          })
        });
        console.log("Telegram alert sent successfully!");
      } catch (err) {
        console.error("Failed to fire Telegram bot message:", err);
      }
    }

    // 4. Custom Webhook dispatch (e.g. Discord, Slack, Zapier)
    if (notifConfig.webhookUrl) {
      try {
        await fetch(notifConfig.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `🔔 **নতুন পেমেন্ট রিকোয়েস্ট!**\n**ইউজার ইমেইল:** ${payment.email}\n**প্ল্যান/কোর্স:** ${payment.planName}\n**পেমেন্ট মেথড:** ${payment.method}\n**ট্রানজেকশন ID:** ${payment.transactionId || 'N/A'}`
          })
        });
        console.log("Webhook alert sent successfully!");
      } catch (err) {
        console.error("Failed to fire custom Webhook:", err);
      }
    }

    // 5. Capacitor Native Local Notification Trigger (for Android devices)
    try {
      const { triggerLocalNativePaymentNotification } = await import("./lib/pushNotifications");
      await triggerLocalNativePaymentNotification(payment);
    } catch (err) {
      console.warn("Could not fire native Android alert: ", err);
    }
  };

  const loadSandboxMockData = () => {
    // Elegant realistic prefilled data so layout compiles immediately
    // 1. Users local state
    let storedUsers = localStorage.getItem("local_users");
    if (!storedUsers) {
      const defaultUsers = [
        {
          uid: "user-1",
          email: "ariful.islam@gmail.com",
          role: "premium" as const,
          banned: false,
          ownedCourses: [
            {
              courseId: "course-1",
              courseTitle: "বিসিএস প্রিলিমিনারি স্পেশাল মাস্টারব্যাচ",
              assignedAt: "2026-06-01T12:00:00Z",
              expiry: "2026-09-01T12:00:00Z"
            }
          ]
        },
        { uid: "user-2", email: "nusrat.jahan@yahoo.com", role: "free" as const, banned: false },
        { uid: "user-3", email: "tasnim_bcs_aspirant@outlook.com", role: "moderator" as const, banned: false },
        { uid: "user-4", email: "sadik.bcs_hero@gmail.com", role: "premium" as const, banned: true }
      ];
      localStorage.setItem("local_users", JSON.stringify(defaultUsers));
      storedUsers = JSON.stringify(defaultUsers);
    }
    setUsers(JSON.parse(storedUsers));

    // 2. Questions local state
    let storedQuestions = localStorage.getItem("local_questions");
    if (!storedQuestions) {
      const defaultQuestions = [
        {
          id: "q-1",
          question: "চর্যাপদ কোন যুগে রচিত হয়েছিল?",
          optA: "প্রাচীন যুগ",
          optB: "মধ্য যুগ",
          optC: "আধুনিক যুগ",
          optD: "অন্ধকার যুগ",
          correct: "A",
          explanation: "চর্যাপদ প্রাচীন যুগের একমাত্র নির্ভরযোগ্য ঐতিহাসিক নিদর্শন যা পাল আমলে রচিত হয়।",
          examTag: "চর্যাপদ",
          subId: "sub-1"
        },
        {
          id: "q-2",
          question: "The word 'Incredible' means what?",
          optA: "Unbelievable",
          optB: "Feasible",
          optC: "Eligible",
          optD: "Vulnerable",
          correct: "A",
          explanation: "Incredible শব্দের অর্থ অবিশ্বাস্য, যা Unbelievable এর সাথে সাদৃশ্যপূর্ণ।",
          examTag: "Vocabulary",
          subId: "sub-2"
        }
      ];
      localStorage.setItem("local_questions", JSON.stringify(defaultQuestions));
      storedQuestions = JSON.stringify(defaultQuestions);
    }
    setQuestions(JSON.parse(storedQuestions));

    // 3. Categories local state
    let storedCategories = localStorage.getItem("local_categories");
    if (!storedCategories) {
      const defaultCategories = [
        { id: "cat-1", name: "বিসিএস প্রিলিমিনারি সিলেবাস", access: "free" },
        { id: "cat-2", name: "প্রাথমিক সহকারী শিক্ষক নিয়োগ", access: "premium" }
      ];
      localStorage.setItem("local_categories", JSON.stringify(defaultCategories));
      storedCategories = JSON.stringify(defaultCategories);
    }
    setCategories(JSON.parse(storedCategories));

    // 4. Subcategories local state
    let storedSubcategories = localStorage.getItem("local_subcategories");
    if (!storedSubcategories) {
      const defaultSubcategories = [
        { id: "sub-1", name: "বাংলা ভাষা ও সাহিত্য", parentId: "cat-1" },
        { id: "sub-2", name: "English Language & Literature", parentId: "cat-1" }
      ];
      localStorage.setItem("local_subcategories", JSON.stringify(defaultSubcategories));
      storedSubcategories = JSON.stringify(defaultSubcategories);
    }
    setSubcategories(JSON.parse(storedSubcategories));

    // 5. Courses local state
    let storedCourses = localStorage.getItem("local_courses");
    if (!storedCourses) {
      const defaultCourses = [
        {
          id: "course-1",
          title: "বিসিএস প্রিলিমিনারি স্পেশাল মাস্টারব্যাচ",
          desc: "সম্পূর্ণ সিলেবাস ভিত্তিক ৩০০০+ কোয়েশ্চেন সলভিং ক্লাস, গাইডলাইন এবং প্রতিটি কোর্সের জন্য আলাদা পিডিএফ লেকচার শিট প্রদান করা হবে।",
          access: "premium",
          status: "running",
          live: true,
          pdfUrl: "https://example.com/bcs-masterclass-syllabus.pdf",
          pdfTitle: "বিসিএস মাস্টারব্যাচ সিলেবাস ও লেকচার প্ল্যান"
        },
        {
          id: "course-2",
          title: "Primary 100-Day Flash Course",
          desc: "প্রাথমিক শিক্ষক সাজেশনের সেরা মডেল টেস্ট সিরিজ ও প্রতিটি মডেল টেস্টের বিস্তারিত ব্যাখ্যা সহ পিডিএফ ডাউনলোডের সুবিধা।",
          access: "free",
          status: "running",
          live: false,
          pdfUrl: "https://example.com/primary-100day-plan.pdf",
          pdfTitle: "১০০ দিনের কমপ্লিট স্টাডি প্ল্যান"
        }
      ];
      localStorage.setItem("local_courses", JSON.stringify(defaultCourses));
      storedCourses = JSON.stringify(defaultCourses);
    }
    setCourses(JSON.parse(storedCourses));

    // 6. Payments local state
    let storedPayments = localStorage.getItem("local_payments");
    if (!storedPayments) {
      const defaultPayments = [
        {
          id: "pay-1",
          email: "aminul.bcs@gmail.com",
          userId: "user-1",
          planName: "Annual Standard (বার্ষিক প্যাকেজ)",
          method: "bKash",
          transactionId: "BKASHXTR9310",
          status: "pending",
          createdAt: "2026-06-15T09:40:00Z"
        },
        {
          id: "pay-2",
          email: "toma.exam@gmail.com",
          userId: "user-2",
          planName: "Monthly Standard (১ মাস)",
          method: "Nagad",
          transactionId: "NGDTX94321",
          status: "approved",
          createdAt: "2026-06-14T11:20:00Z"
        }
      ];
      localStorage.setItem("local_payments", JSON.stringify(defaultPayments));
      storedPayments = JSON.stringify(defaultPayments);
    }
    setPayments(JSON.parse(storedPayments));

    // 7. Exams local state
    let storedExams = localStorage.getItem("local_exams");
    if (!storedExams) {
      const defaultExams = [
        {
          id: "exam-1",
          title: "বাংলা সাহিত্য - চর্যাপদ ও মধ্যযুগ লাইভ টেস্ট",
          courseId: "course-1",
          startTime: "2026-06-16T18:00",
          endTime: "2026-06-16T22:00",
          duration: 20,
          negativeMark: 0.25,
          access: "free",
          status: "running",
          questionIds: ["q-1", "q-2"]
        }
      ];
      localStorage.setItem("local_exams", JSON.stringify(defaultExams));
      storedExams = JSON.stringify(defaultExams);
    }
    setExams(JSON.parse(storedExams));

    // 8. Bulletins local state
    let storedBulletins = localStorage.getItem("local_bulletins");
    if (!storedBulletins) {
      const defaultBulletins = [
        { id: "bul-1", title: "বিসিএস প্রিলিমিনারি পরীক্ষার লাইভ ক্লাস রুটিন প্রকাশিত হয়েছে", description: "সকল ছাত্রছাত্রীরা কোর্স প্যানেলে রুটিন ডাউনলোড করতে পারবেন।" }
      ];
      localStorage.setItem("local_bulletins", JSON.stringify(defaultBulletins));
      storedBulletins = JSON.stringify(defaultBulletins);
    }
    setBulletins(JSON.parse(storedBulletins));

    // 9. Coupons local state
    let storedCoupons = localStorage.getItem("local_coupons");
    if (!storedCoupons) {
      const defaultCoupons = [{ id: "cp-1", code: "MCQHERO50", discount: 50 }];
      localStorage.setItem("local_coupons", JSON.stringify(defaultCoupons));
      storedCoupons = JSON.stringify(defaultCoupons);
    }
    setCoupons(JSON.parse(storedCoupons));

    // 10. Premium Plans local state
    let storedPremiumPlans = localStorage.getItem("local_premium_plans");
    if (!storedPremiumPlans) {
      const defaultPremiumPlans = [
        {
          id: "plan-monthly",
          name: "মাসিক প্রিমিয়াম প্ল্যান (Monthly Premium)",
          validity: "১ মাস (30 Days)",
          price: 199,
          promoPrice: 99,
          features: ["সকল লাইভ মডেল টেস্ট অ্যাক্সেস", "সকল ক্যাটাগরি গ্রুপ কোশ্চেন ব্যাংক সলভিং", "আনলিমিটেড স্মার্টবোর্ড ক্লাস স্লাইডার"]
        },
        {
          id: "plan-halfyearly",
          name: "ষান্মাসিক প্রিমিয়াম প্ল্যান (Half-Yearly Premium)",
          validity: "৬ মাস (180 Days)",
          price: 799,
          promoPrice: 499,
          features: ["সকল লাইভ মডেল টেস্ট অ্যাক্সেস", "সকল ক্যাটাগরি গ্রুপ কোশ্চেন ব্যাংক সলভিং", "আনলিমিটেড স্মার্টবোর্ড ক্লাস স্লাইডার", "স্পেশাল পিডিএফ রুটিন ডাউনলোড সুবিধা"]
        },
        {
          id: "plan-yearly",
          name: "বার্ষিক প্রিমিয়াম প্ল্যান (Yearly Premium)",
          validity: "১ বছর (365 Days)",
          price: 1499,
          promoPrice: 899,
          features: ["সকল লাইভ মডেল টেস্ট অ্যাক্সেস", "সকল ক্যাটাগরি গ্রুপ কোশ্চেন ব্যাংক সলভিং", "আনলিমিটেড স্মার্টবোর্ড ক্লাস স্লাইডার", "ফ্রি পিডিএফ ডাউনলোড ও সেলফ টেস্ট", "২৪/৭ গ্রুপ সাপোর্ট সেবা"]
        }
      ];
      localStorage.setItem("local_premium_plans", JSON.stringify(defaultPremiumPlans));
      storedPremiumPlans = JSON.stringify(defaultPremiumPlans);
    }
    setPremiumPlans(JSON.parse(storedPremiumPlans));

    let storedNotice = localStorage.getItem("local_global_notice");
    if (!storedNotice) {
      const defaultNotice = { title: "জরুরি বিজ্ঞপ্তি", message: "আজ রাতে সার্ভার আপগ্রেড করা হবে।", active: true, freeUserQuestionLimit: 20, dailyQuestionLimit: 15 };
      localStorage.setItem("local_global_notice", JSON.stringify(defaultNotice));
      storedNotice = JSON.stringify(defaultNotice);
    }
    setGlobalNotice(JSON.parse(storedNotice));

    // 10. Results local state (Leaderboard mock data)
    let storedResults = localStorage.getItem("local_results");
    if (!storedResults) {
      const defaultResults = [
        {
          id: "res-1",
          examId: "exam-1",
          userId: "user-1",
          email: "ariful.islam@gmail.com",
          correct: 2,
          wrong: 0,
          score: 2.00,
          createdAt: "2026-06-16T19:00:00Z"
        },
        {
          id: "res-2",
          examId: "exam-1",
          userId: "user-2",
          email: "nusrat.jahan@yahoo.com",
          correct: 1,
          wrong: 1,
          score: 0.75,
          createdAt: "2026-06-16T19:15:00Z"
        },
        {
          id: "res-3",
          examId: "exam-1",
          userId: "user-3",
          email: "tasnim_bcs_aspirant@outlook.com",
          correct: 1,
          wrong: 0,
          score: 1.00,
          createdAt: "2026-06-16T19:30:00Z"
        }
      ];
      localStorage.setItem("local_results", JSON.stringify(defaultResults));
    }

    // Question reports sandbox local state
    let storedReports = localStorage.getItem("local_question_reports");
    if (!storedReports) {
      const defaultReports: QuestionReport[] = [
        {
          id: "report-1",
          questionId: "q-1",
          questionText: "চর্যাপদের মোট পদ সংখ্যা কতটি?",
          reporterEmail: "tareq.hossain@gmail.com",
          reportType: "ভুল উত্তর (Wrong Answer Key)",
          details: "চর্যাপদের মোট পদ সংখ্যা সাড়ে ছেচল্লিশটি, কিন্তু প্রশ্নে ছেচল্লিশটি সঠিক উত্তর হিসেবে দেওয়া আছে। দয়া করে সংশোধন করুন।",
          status: "pending",
          subject: "বাংলা ভাষা ও সাহিত্য",
          timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
        },
        {
          id: "report-2",
          questionId: "q-2",
          questionText: "শ্রীকৃষ্ণকীর্তন কাব্যটি কে আবিষ্কার করেন?",
          reporterEmail: "faria.islam99@yahoo.com",
          reportType: "বানান ভুল (Spelling/Typo)",
          details: "অপশনে 'শ্রীকৃষ্ণকীর্তন' বানানটি টাইপিং মিস্টেক রয়েছে।",
          status: "pending",
          subject: "বাংলা ভাষা ও সাহিত্য",
          timestamp: new Date(Date.now() - 3600000 * 12).toISOString()
        }
      ];
      localStorage.setItem("local_question_reports", JSON.stringify(defaultReports));
      storedReports = JSON.stringify(defaultReports);
    }
    setQuestionReports(JSON.parse(storedReports));

    let storedMsgs = localStorage.getItem("local_support_messages");
    if (!storedMsgs) {
      const defaultMsgs = [
        {
          id: "msg-1",
          name: "রাকিব হাসান",
          email: "rakib@gmail.com",
          phone: "01712345678",
          subject: "পেমেন্ট সমস্যা",
          message: "আমি বিকাশ দিয়ে ২৫০ টাকা পাঠিয়েছিলাম কিন্তু প্রিমিয়াম মেম্বারশিপ অ্যাক্টিভ হয়নি। ট্রানজেকশন আইডি: 8HDF99KLE",
          status: "pending",
          createdAt: { seconds: Date.now() / 1000 - 3600 }
        },
        {
          id: "msg-2",
          name: "সুমাইয়া আক্তার",
          email: "sumaiya@yahoo.com",
          phone: "01998765432",
          subject: "কোয়েশ্চন সংশোধন",
          message: "বিসিএস প্রিলি গণিত পার্টের স্লাইড ৫ এ একটি ছোট টাইপো বা ভুলের রিপোর্ট আছে। দয়া করে দেখবেন।",
          status: "resolved",
          createdAt: { seconds: Date.now() / 1000 - 86450 }
        }
      ];
      localStorage.setItem("local_support_messages", JSON.stringify(defaultMsgs));
      storedMsgs = JSON.stringify(defaultMsgs);
    }
    setSupportMessages(JSON.parse(storedMsgs));

    let storedMaint = localStorage.getItem("local_maintenance_mode");
    if (!storedMaint) {
      localStorage.setItem("local_maintenance_mode", "false");
      storedMaint = "false";
    }
    setMaintenanceMode(storedMaint === "true");
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;
    setAuthLoading(true);

    const emailClean = loginEmail.toLowerCase().trim();

    // 1. Look up user configuration in localStorage (Sandbox/Local)
    const localUsersStr = localStorage.getItem("local_users");
    let localMatchedUser: UserProfile | undefined;
    if (localUsersStr) {
      try {
        const localUsers = JSON.parse(localUsersStr) as UserProfile[];
        localMatchedUser = localUsers.find(
          (u) => (u.email || "").toLowerCase().trim() === emailClean
        );
      } catch (err) {
        console.warn("Could not parse local_users schema:", err);
      }
    }

    // 2. If already in Sandbox Mode, resolve via local sandbox users only (no dynamic elevation/keyword bypass)
    if (isSandboxMode) {
      if (localMatchedUser) {
        setUserProfile(localMatchedUser);
        setCurrentUser({ uid: localMatchedUser.uid || localMatchedUser.id || "local-sandbox-uid", email: localMatchedUser.email } as any);
        alert(`সফলভাবে ${localMatchedUser.role === 'admin' ? 'এডমিন' : localMatchedUser.role === 'moderator' ? 'মডারেটর' : 'শিক্ষার্থী'} হিসেবে প্রবেশ করেছেন! (স্যান্ডবক্স মোড)`);
        setAuthLoading(false);
        return;
      }

      alert("লগইন ব্যর্থ হয়েছে: স্যান্ডবক্স মোডে এই ইমেইলটি নিবন্ধিত নেই।");
      setAuthLoading(false);
      return;
    }

    try {
      // 3. Try standard production Firebase Auth Sign-in
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (err: any) {
      console.warn("Firebase sign-in failed:", err);
      alert("লগইন ব্যর্থ হয়েছে: " + err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (isSandboxMode) {
      setIsSandboxMode(false);
      setUserProfile(null);
      return;
    }
    await signOut(auth);
    alert("সফলভাবে লগআউট হয়েছেন!");
  };

  // Automatic redirect to questions for moderator
  useEffect(() => {
    if (userProfile?.role === "moderator") {
      setActiveTab("questions");
    }
  }, [userProfile]);

  // Nav Links
  const allNavigationItems = [
    { id: "dashboard", label: "ড্যাশবোর্ড তথ্য", icon: LayoutDashboard },
    { id: "questions", label: "কোয়েশ্চন ব্যাংক", icon: HelpCircle },
    { id: "quiz", label: "ফেসবুক কুইজ জেনারেটর", icon: Sparkles },
    { id: "reports", label: "সংশোধন রিপোর্ট", icon: Flag, badge: questionReports.filter(r => r.status !== "resolved").length },
    { id: "smartboard", label: "স্মার্টবোর্ড ক্লাস স্লাইডার", icon: Presentation },
    { id: "users", label: "শিক্ষার্থী ডাটাবেজ", icon: UsersIcon },
    { id: "resources", label: "পিডিএফ ও ব্যানার", icon: FolderLock },
    { id: "circular", label: "জব সার্কুলার", icon: Briefcase },
    { id: "billing", label: "পেমেন্ট অনুমোদন", icon: CreditCard, badge: payments.filter(p => p.status === "pending" || !p.status).length },
    { id: "exams", label: "লাইভ মডেল টেস্ট", icon: Timer },
    { id: "routine", label: "পরীক্ষার রুটিন", icon: Calendar },
    { id: "contact", label: "সরাসরি যোগাযোগ ও সাপোর্ট", icon: PhoneCall, badge: supportMessages.filter(m => m.status === "pending").length },
    { id: "settings", label: "গ্লোবাল সেটিংস", icon: Settings },
    { id: "logs", label: "অ্যাক্টিভিটি ও অডিট লগ", icon: ShieldAlert }
  ] as const;

  const navigationItems = userProfile?.role === "moderator"
    ? allNavigationItems.filter((item) => item.id === "questions" || item.id === "quiz" || item.id === "smartboard" || item.id === "reports")
    : allNavigationItems;

  // Render checks under active maintenance
  const isElevatedUser = userProfile?.role === "admin" || userProfile?.role === "moderator";

  if (maintenanceMode && !isElevatedUser && !showAdminLoginUnderMaint) {
    // Show the gorgeous, high-contrast, premium Bengali Maintenance Screen matching user app snapshot
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 relative font-sans leading-relaxed text-center overflow-hidden">
        {/* Glow ambient meshes */}
        <div className="absolute top-10 left-10 w-72 h-72 bg-red-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-md w-full space-y-6 bg-slate-900/60 border border-red-500/20 p-8 sm:p-10 rounded-3xl backdrop-blur-md relative z-10 shadow-2xl">
          <div className="mx-auto h-16 w-16 bg-red-500/15 text-red-400 rounded-full flex items-center justify-center border border-red-500/20 shadow-lg animate-bounce">
            <AlertTriangle className="w-8 h-8 text-red-400 font-bold" />
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-display">
              সার্ভার মেইনটেনেন্স চলছে
            </h2>
            <div className="h-1 w-20 bg-gradient-to-r from-red-500 to-amber-500 mx-auto rounded-full" />
            <p className="text-sm text-slate-300 leading-relaxed pt-2">
              দুঃখিত, <span className="text-red-400 font-bold">MCQ HERO APPS</span> বর্তমানে রক্ষণাবেক্ষণ ও ডাটাবেজ আপগ্রেডের কাজের জন্য সাময়িকভাবে ডাউন রয়েছে।
            </p>
            <p className="text-xs text-slate-400">
              আমরা অত্যন্ত দ্রুত সব ফিচার আরও গতিশীল ও উন্নত করে লাইভে ফিরে আসবো। সাময়িক অসুবিধার জন্য আন্তরিকভাবে দুঃখিত!
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 text-left text-xs text-slate-400 space-y-1">
              <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">সরাসরি সাহায্য বা তথ্যের জন্য:</span>
              <p className="text-teal-400 select-all font-mono font-medium">Email: support@mcqhero.com</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            {userProfile && (
              <button
                onClick={handleSignOut}
                className="w-full bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700/80 text-slate-300 font-bold py-3 rounded-xl transition-all cursor-pointer text-xs h-[46px]"
              >
                লগআউট করে প্রস্থান করুন
              </button>
            )}

            <button
              onClick={() => setShowAdminLoginUnderMaint(true)}
              className="w-full bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-slate-400 hover:text-white font-medium py-3 rounded-xl transition-all cursor-pointer text-[11px] border border-slate-805"
            >
              এডমিন প্রবেশ (Admin Gateway)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authentication Gate Layout
  if (!userProfile && !authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 relative font-sans leading-relaxed selection:bg-teal-500 selection:text-white overflow-hidden">
        {/* Glow ambient meshes */}
        <div className="absolute top-10 left-10 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-md w-full space-y-8 bg-slate-900/60 border border-slate-700/50 p-8 sm:p-10 rounded-3xl backdrop-blur-md relative z-10 shadow-2xl">
          <div className="text-center">
            <div className="mx-auto h-20 w-20 rounded-2xl flex items-center justify-center border border-slate-700/50 shadow-xl overflow-hidden bg-slate-950">
              <img src="/logo.png" alt="MCQ Hero Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <h2 className="mt-5 text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center justify-center gap-1 font-display">
              MCQ Hero <span className="text-teal-400 font-medium">Admin</span>
            </h2>
            <p className="mt-2 text-xs text-slate-400">
              ফায়ারবেস অথেনটিকেশন ও বিসিএস এডমিন প্যানেল গেটওয়ে
            </p>
          </div>

          <form onSubmit={handleSignIn} className="mt-6 space-y-4">
            <div>
              <label className="text-slate-300 text-xs font-semibold block mb-1.5">ইমেইল এড্রেস</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@mcqhero.com"
                className="w-full bg-slate-950 border border-slate-700/70 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-teal-400 h-[46px]"
              />
            </div>

            <div>
              <label className="text-slate-300 text-xs font-semibold block mb-1.5">গোপন পাসওয়ার্ড</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-700/70 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-teal-400 h-[46px]"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3.5 rounded-xl transition-all cursor-pointer text-sm shadow-lg hover:shadow-teal-500/20 h-[46px]"
            >
              লগইন কনফার্ম করুন
            </button>
          </form>

          {/* Go Back button (only visible under maintenance) */}
          {maintenanceMode && (
            <div className="pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowAdminLoginUnderMaint(false)}
                className="w-full bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all py-2.5 rounded-xl text-xs cursor-pointer border border-slate-805 font-medium"
              >
                ← মেইনটেনেন্স স্ক্রিনে ফিরে যান
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Dashboard layout configuration
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans leading-relaxed selection:bg-teal-500 selection:text-white">
      {/* Floating Real-Time In-App Live Payment Alerts Overlay */}
      <div className="fixed top-18 right-4 z-[9999] max-w-sm w-full pointer-events-none space-y-3">
        <AnimatePresence>
          {activePaymentAlerts.map((alertItem) => (
            <motion.div
              key={alertItem.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="pointer-events-auto bg-slate-900/95 border border-amber-500/30 shadow-2xl rounded-2xl p-4 backdrop-blur-md flex gap-3 relative overflow-hidden text-left"
            >
              {/* Pulsing indicator decor */}
              <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500 animate-pulse" />
              
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold font-display">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  নতুন পেমেন্ট রিকোয়েস্ট এসেছে!
                </div>
                <div className="text-[11px] text-slate-300 space-y-0.5 leading-normal">
                  <div className="truncate"><span className="font-semibold text-slate-400">ইউজার:</span> {alertItem.payment.email}</div>
                  <div><span className="font-semibold text-slate-400">প্ল্যান:</span> {alertItem.payment.planName || alertItem.payment.premiumPlan || "Standard Plan"}</div>
                  <div><span className="font-semibold text-slate-400">মেথড/টাকা:</span> {alertItem.payment.method || "N/A"}{alertItem.payment.amount ? ` (${alertItem.payment.amount}৳)` : ""}</div>
                </div>
                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => {
                      setActiveTab("billing");
                      setActivePaymentAlerts(prev => prev.filter(x => x.id !== alertItem.id));
                    }}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-[10px] py-1.5 px-3 rounded-lg transition-all shadow-md shadow-amber-500/10 cursor-pointer text-center"
                  >
                    পেমেন্ট চেক করুন ➔
                  </button>
                  <button
                    onClick={() => {
                      setActivePaymentAlerts(prev => prev.filter(x => x.id !== alertItem.id));
                    }}
                    className="px-2.5 py-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[10px] font-semibold cursor-pointer transition-all"
                  >
                    বাদ দিন
                  </button>
                </div>
              </div>

              {/* Close pin */}
              <button
                onClick={() => {
                  setActivePaymentAlerts(prev => prev.filter(x => x.id !== alertItem.id));
                }}
                className="absolute top-2.5 right-2.5 text-slate-500 hover:text-slate-300 transition-colors pointer-events-auto cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Top Header rail */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-40 px-4 sm:px-6 h-[64px] flex justify-between items-center">
        <div className="flex items-center gap-3">
          {/* Mobile responsive toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg bg-slate-800 border border-slate-750 text-slate-400 hover:text-white md:hidden cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="h-9 w-9 rounded-xl flex items-center justify-center border border-slate-700/60 overflow-hidden bg-slate-950">
            <img src="/logo.png" alt="MCQ Hero Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div>
            <span className="text-sm font-extrabold text-white font-display select-none">
              MCQ HERO <span className="text-teal-400">ADMIN</span>
            </span>
            {isSandboxMode && (
              <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 ml-2 rounded border border-emerald-500/10 leading-none">
                Sandbox Mode Enabled
              </span>
            )}
            {maintenanceMode && (
              <span className="bg-red-500/15 text-red-400 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 ml-2 rounded border border-red-500/30 animate-pulse leading-none inline-flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-red-400 animate-ping" />
                Maintenance Active
              </span>
            )}
          </div>
        </div>

        {/* Profile indicator and Logout panel */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-[11px] text-slate-400 line-clamp-1 select-all font-mono">
              {userProfile?.email}
            </span>
            <span className="text-[9px] uppercase font-bold text-teal-400 tracking-wider">
              অনুমোদন: {userProfile?.role}
            </span>
          </div>

          <button
            onClick={handleSignOut}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700/60 hover:bg-red-600/15 hover:border-red-500/30 text-slate-400 hover:text-red-400 transition-all cursor-pointer h-9 w-9 flex items-center justify-center"
            title="লগআউট"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex relative">
        {/* Sidebar panels */}
        <aside
          className={`fixed md:sticky top-[64px] left-0 h-[calc(100vh-64px)] w-64 bg-slate-900 border-r border-slate-800/80 z-30 transition-transform duration-300 md:translate-x-0 ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="p-4 space-y-1.5 h-full overflow-y-auto">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? "bg-teal-500 text-white shadow-lg shadow-teal-500/10"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {"badge" in item && item.badge && item.badge > 0 ? (
                    <span className="bg-red-500 text-white font-display text-[10px] h-5 w-5 rounded-full flex items-center justify-center animate-pulse">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}

            {/* Quick status board at standard margin */}
            <div className="pt-6 border-t border-slate-800">
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800/80 space-y-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  সিস্টেম স্ট্যাটাস
                </span>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">কোয়েশ্চন বুক</span>
                    <span className="text-white font-bold">{questions.length} টি</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">শিক্ষার্থী ট্র্যাকার</span>
                    <span className="text-white font-bold">{users.length} জন</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Overlay backdrop for mob menu */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/50 z-20 md:hidden animate-fade-in"
          />
        )}

        {/* Workspace Screen layout */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {dbLoading && (
            <div className="mb-4 bg-teal-500/10 border border-teal-500/20 p-3 rounded-xl flex items-center gap-2 text-xs text-teal-400 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>রিয়েল-টাইম ক্লাউড ফায়ারবেস ডাটাবেজ আপডেট সিঙ্ক হচ্ছে...</span>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
               {userProfile?.role !== "moderator" && activeTab === "dashboard" && (
                <DashboardStats
                  catsCount={categories.length}
                  subsCount={subcategories.length}
                  quesCount={questions.length}
                  recentCount={bulletins.length}
                  users={users}
                  pendingCount={payments.filter((p) => p.status === "pending" || !p.status).length}
                  approvedCount={payments.filter((p) => p.status === "approved").length}
                  examCount={exams.length}
                  highestScore={28.5}
                  averageScore={17.2}
                  userProfile={userProfile}
                />
              )}

              {activeTab === "questions" && (
                <QuestionManage
                  categories={categories}
                  subcategories={subcategories}
                  questionsCount={questions.length}
                  triggerReload={triggerReload}
                  adminRole={userProfile?.role === "moderator" ? "moderator" : "admin"}
                  allowedCategories={userProfile?.allowedCategories}
                  isSandboxMode={isSandboxMode}
                  userProfile={userProfile}
                  globalNotice={globalNotice}
                />
              )}

              {activeTab === "reports" && (
                <QuestionReportManage
                  questions={questions}
                  triggerReload={triggerReload}
                  isSandboxMode={isSandboxMode}
                />
              )}

              {activeTab === "quiz" && (
                <QuizPosterGenerator
                  categories={categories}
                  subcategories={subcategories}
                  questions={questions}
                  triggerReload={triggerReload}
                  isSandboxMode={isSandboxMode}
                />
              )}

              {activeTab === "smartboard" && (
                <SmartboardGenerator
                  categories={categories}
                  subcategories={subcategories}
                  triggerReload={triggerReload}
                />
              )}

              {userProfile?.role !== "moderator" && activeTab === "users" && (
                <UserManage
                  users={users}
                  courses={courses}
                  categories={categories}
                  triggerReload={triggerReload}
                />
              )}

              {userProfile?.role !== "moderator" && activeTab === "resources" && (
                <ResourceManage triggerReload={triggerReload} isSandboxMode={isSandboxMode} />
              )}

              {userProfile?.role !== "moderator" && activeTab === "circular" && (
                <JobCircularManage triggerReload={triggerReload} isSandboxMode={isSandboxMode} />
              )}

              {userProfile?.role !== "moderator" && activeTab === "billing" && (
                <PaymentManage
                  payments={payments}
                  courses={courses}
                  triggerReload={triggerReload}
                  isSandboxMode={isSandboxMode}
                />
              )}

              {userProfile?.role !== "moderator" && activeTab === "exams" && (
                <LiveExamManage
                  exams={exams}
                  courses={courses}
                  subcategories={subcategories}
                  triggerReload={triggerReload}
                  isSandboxMode={isSandboxMode}
                />
              )}

              {userProfile?.role !== "moderator" && activeTab === "routine" && (
                <ExamRoutineManage
                  courses={courses}
                  triggerReload={triggerReload}
                  isSandboxMode={isSandboxMode}
                />
              )}

              {userProfile?.role !== "moderator" && activeTab === "settings" && (
                <BulletinsAndSettings
                  categories={categories}
                  subcategories={subcategories}
                  questions={questions}
                  courses={courses}
                  bulletins={bulletins}
                  coupons={coupons}
                  premiumPlans={premiumPlans}
                  globalNotice={globalNotice}
                  maintenanceMode={maintenanceMode}
                  triggerReload={triggerReload}
                  isSandboxMode={isSandboxMode}
                  onSimulateAlert={triggerNewPaymentNotification}
                />
              )}

              {userProfile?.role !== "moderator" && activeTab === "contact" && (
                <ContactManage
                  isSandboxMode={isSandboxMode}
                  triggerReload={triggerReload}
                />
              )}

              {userProfile?.role !== "moderator" && activeTab === "logs" && (
                <ActivityLogManage
                  currentAdminEmailRef={userProfile?.email || "admin@mcqhero.com"}
                  isSandboxMode={isSandboxMode}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
