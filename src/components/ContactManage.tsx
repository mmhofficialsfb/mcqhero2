import React, { useState, useEffect } from "react";
import {
  PhoneCall,
  MessageCircle,
  Send,
  Facebook,
  Mail,
  CheckCircle,
  HelpCircle,
  Clock,
  Search,
  Check,
  RefreshCw,
  FileText,
  User,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot
} from "firebase/firestore";
import { db } from "../lib/firebase";

interface ContactLinks {
  helpline: string;
  whatsapp: string;
  telegram: string;
  messenger: string;
  fbGroup: string;
  email: string;
}

interface SupportMessage {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: "pending" | "resolved";
  createdAt?: any;
  adminRemarks?: string;
}

interface ContactManageProps {
  isSandboxMode?: boolean;
  triggerReload: () => void;
}

export default function ContactManage({ isSandboxMode, triggerReload }: ContactManageProps) {
  // Links Settings States
  const [links, setLinks] = useState<ContactLinks>({
    helpline: "",
    whatsapp: "",
    telegram: "",
    messenger: "",
    fbGroup: "",
    email: ""
  });
  const [savingLinks, setSavingLinks] = useState(false);

  // Messages States
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "resolved">("all");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [savingRemarks, setSavingRemarks] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<SupportMessage | null>(null);

  // Load Contact Links & Messages
  useEffect(() => {
    let unsubscribeMsgs: () => void = () => {};

    const loadData = async () => {
      setLoadingMessages(true);
      try {
        if (isSandboxMode) {
          // Load links from localStorage
          const localLinks = localStorage.getItem("local_contact_links");
          if (localLinks) {
            setLinks(JSON.parse(localLinks));
          } else {
            setLinks({
              helpline: "+8801700000000",
              whatsapp: "https://wa.me/8801700000000",
              telegram: "https://t.me/mcqhero_support",
              messenger: "https://m.me/mcqhero",
              fbGroup: "https://facebook.com/groups/mcqhero",
              email: "support@mcqhero.com"
            });
          }

          // Load messages from localStorage
          const localMsgs = localStorage.getItem("local_support_messages");
          if (localMsgs) {
            setMessages(JSON.parse(localMsgs));
          } else {
            // Provide elegant initial mock messages for safety
            const initialMsgs: SupportMessage[] = [
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
                createdAt: { seconds: Date.now() / 1000 - 86400 }
              }
            ];
            localStorage.setItem("local_support_messages", JSON.stringify(initialMsgs));
            setMessages(initialMsgs);
          }
          setLoadingMessages(false);
        } else {
          // Real Firestore Loading
          const docRef = doc(db, "settings", "contact_links");
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setLinks(docSnap.data() as ContactLinks);
          }

          // Real-time listener for support messages with robust multi-collection fallback
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
          const collectionsData: { [colName: string]: SupportMessage[] } = {};

          // Safety timer to make sure loader resolves even for empty/unregistered databases
          const safetyTimer = setTimeout(() => {
            setLoadingMessages(false);
          }, 1500);

          collectionNames.forEach((colName) => {
            const q = query(collection(db, colName), limit(150));
            const unsub = onSnapshot(
              q,
              (snapshot) => {
                const list = snapshot.docs.map((d) => {
                  const data = d.data();
                  // Parse date fallback securely
                  let parsedDate: Date | null = null;
                  const rawTime = data.createdAt || data.created_at || data.timestamp || data.time || data.date || data.dateTime;
                  if (rawTime) {
                    if (typeof rawTime.toDate === "function") {
                      parsedDate = rawTime.toDate();
                    } else if (rawTime.seconds) {
                      parsedDate = new Date(rawTime.seconds * 1000);
                    } else if (typeof rawTime === "string" || typeof rawTime === "number") {
                      parsedDate = new Date(rawTime);
                    } else if (rawTime instanceof Date) {
                      parsedDate = rawTime;
                    }
                  }
                  if (!parsedDate) parsedDate = new Date();

                  return {
                    id: d.id,
                    _collection: colName,
                    name: data.name || data.username || data.fullName || data.studentName || "অজ্ঞাতনামা শিক্ষার্থী",
                    email: data.email || data.mail || data.userEmail || "",
                    phone: data.phone || data.mobile || data.phoneNumber || data.contact || "তথ্য নেই",
                    subject: data.subject || data.topic || data.sub || data.title || "সরাসরি যোগাযোগ",
                    message: data.message || data.msg || data.text || data.details || data.description || "খালি বার্তা",
                    status: data.status || "pending",
                    adminRemarks: data.adminRemarks || data.reply || data.replyMessage || "",
                    createdAt: rawTime,
                    _parsedDate: parsedDate,
                  } as any;
                }) as SupportMessage[];

                collectionsData[colName] = list;

                // Merge all lists, avoiding duplicate document IDs in memory
                const mergedMap = new Map<string, SupportMessage>();
                collectionNames.forEach((cn) => {
                  if (collectionsData[cn]) {
                    collectionsData[cn].forEach((item) => {
                      mergedMap.set(item.id, item);
                    });
                  }
                });

                const allMsgs = Array.from(mergedMap.values());
                allMsgs.sort((a, b) => {
                  const dateA = (a as any)._parsedDate ? (a as any)._parsedDate.getTime() : 0;
                  const dateB = (b as any)._parsedDate ? (b as any)._parsedDate.getTime() : 0;
                  return dateB - dateA;
                });

                setMessages(allMsgs);
                setLoadingMessages(false);
              },
              (err) => {
                console.warn(`Optional collection '${colName}' snapshot sub error: `, err);
              }
            );
            unsubscribes.push(unsub);
          });

          unsubscribeMsgs = () => {
            clearTimeout(safetyTimer);
            unsubscribes.forEach((unsub) => unsub());
          };
        }
      } catch (e) {
        console.error("Error loading support details: ", e);
        setLoadingMessages(false);
      }
    };

    loadData();

    return () => {
      unsubscribeMsgs();
    };
  }, [isSandboxMode]);

  // Keep a mock helper loadData if referenced elsewhere, but make it use current state
  const loadData = async () => {
    // Simply acts as trigger reload or silent resolve
  };

  useEffect(() => {
    if (selectedMsg) {
      setReplyText(selectedMsg.adminRemarks || "");
    } else {
      setReplyText("");
    }
  }, [selectedMsg]);

  // Save Contact Links
  const handleSaveLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLinks(true);
    try {
      if (isSandboxMode) {
        localStorage.setItem("local_contact_links", JSON.stringify(links));
        alert("সরাসরি যোগাযোগের লিংকগুলো স্যান্ডবক্স মেমরিতে সেভ হয়েছে!");
      } else {
        await setDoc(doc(db, "settings", "contact_links"), links);
        alert("সরাসরি যোগাযোগের লিংকগুলো সফলভাবে ডাটাবেজে সেভ হয়েছে!");
      }
      triggerReload();
    } catch (err: any) {
      alert("সংরক্ষণ ব্যর্থ হয়েছে: " + err.message);
    } finally {
      setSavingLinks(false);
    }
  };

  // Toggle Resolution Status of Support messages
  const handleToggleStatus = async (msg: SupportMessage) => {
    const newStatus = msg.status === "pending" ? "resolved" : "pending";
    try {
      if (isSandboxMode) {
        const updated = messages.map((m) => (m.id === msg.id ? { ...m, status: newStatus } : m));
        localStorage.setItem("local_support_messages", JSON.stringify(updated));
        setMessages(updated);
        if (selectedMsg && selectedMsg.id === msg.id) {
          setSelectedMsg({ ...selectedMsg, status: newStatus });
        }
      } else {
        const targetColl = (msg as any)._collection || "support_messages";
        await updateDoc(doc(db, targetColl, msg.id), {
          status: newStatus
        });
        setMessages(messages.map((m) => (m.id === msg.id ? { ...m, status: newStatus } : m)));
        if (selectedMsg && selectedMsg.id === msg.id) {
          setSelectedMsg({ ...selectedMsg, status: newStatus });
        }
      }
    } catch (e: any) {
      alert("স্ট্যাটাস পরিবর্তন ব্যর্থ: " + e.message);
    }
  };

  // Delete Support message
  const handleDeleteMessage = async (id: string) => {
    if (!window.confirm("আপনি কি নিশ্চিতভাবে এই সাপোর্ট মেসেজটি ডিলিট করতে চান?")) return;
    try {
      if (isSandboxMode) {
        const updated = messages.filter((m) => m.id !== id);
        localStorage.setItem("local_support_messages", JSON.stringify(updated));
        setMessages(updated);
        setSelectedMsg(null);
      } else {
        const targetColl = (selectedMsg as any)?._collection || "support_messages";
        await deleteDoc(doc(db, targetColl, id));
        setMessages(messages.filter((m) => m.id !== id));
        setSelectedMsg(null);
      }
    } catch (e: any) {
      alert("মেসেজ ধ্বংস করতে ত্রুটি: " + e.message);
    }
  };

  // Save Remarks/Reply directly
  const handleSaveRemarks = async () => {
    if (!selectedMsg) return;
    setSavingRemarks(true);
    try {
      if (isSandboxMode) {
        const updated = messages.map((m) => (m.id === selectedMsg.id ? { ...m, adminRemarks: replyText } : m));
        localStorage.setItem("local_support_messages", JSON.stringify(updated));
        setMessages(updated);
        setSelectedMsg({ ...selectedMsg, adminRemarks: replyText });
        alert("মন্তব্য/রিপ্লাই সফলভাবে স্যান্ডবক্স মেমরিতে সেভ হয়েছে!");
      } else {
        const targetColl = (selectedMsg as any)._collection || "support_messages";
        await updateDoc(doc(db, targetColl, selectedMsg.id), {
          adminRemarks: replyText,
          reply: replyText,
          replyMessage: replyText,
          status: "resolved" // On reply, mark as resolved automatically to save clicks!
        });
        setMessages(messages.map((m) => (m.id === selectedMsg.id ? { ...m, adminRemarks: replyText, status: "resolved" } : m)));
        setSelectedMsg({ ...selectedMsg, adminRemarks: replyText, status: "resolved" });
        alert("মন্তব্য/রিপ্লাই সফলভাবে ডাটাবেজে সেভ হয়েছে এবং স্ট্যাটাস সমাধানকৃত করা হয়েছে!");
      }
    } catch (e: any) {
      alert("রিপ্লাই সেভ ব্যর্থ হয়েছে: " + e.message);
    } finally {
      setSavingRemarks(false);
    }
  };

  // Submit test message
  const handleCreateTestMessage = async () => {
    const testName = prompt("পরীক্ষামূলক শিক্ষার্থীর নাম লিখুন:", "তারেক রহমান");
    if (!testName) return;
    const testPhone = prompt("মোবাইল নম্বর:", "01823456789");
    if (!testPhone) return;
    const testSub = prompt("বিষয় (যেমন: পেমেন্ট সমস্যা, কারিগরি সহায়তা):", "কারিগরি সহায়তা");
    if (!testSub) return;
    const testText = prompt("বিস্তারিত বার্তা:", "ইউজার অ্যাপে এপিআই কানেকশন পাওয়া যাচ্ছে না। লুপ এরর দেখায়।");
    if (!testText) return;

    try {
      if (isSandboxMode) {
        const current = localStorage.getItem("local_support_messages") || "[]";
        const parsed = JSON.parse(current) as SupportMessage[];
        const newMsg: SupportMessage = {
          id: "test-" + Date.now(),
          name: testName,
          email: `${testName.toLowerCase().replace(/\s+/g, "")}@example.com`,
          phone: testPhone,
          subject: testSub,
          message: testText,
          status: "pending",
          createdAt: { seconds: Date.now() / 1000 }
        };
        parsed.unshift(newMsg);
        localStorage.setItem("local_support_messages", JSON.stringify(parsed));
        setMessages(parsed);
        alert("পরীক্ষামূলক সরাসরি যোগাযোগ বার্তা সাবমিট করা হয়েছে!");
      } else {
        await addDoc(collection(db, "support_messages"), {
          name: testName,
          email: `${testName.toLowerCase().replace(/\s+/g, "")}@example.com`,
          phone: testPhone,
          subject: testSub,
          message: testText,
          status: "pending",
          createdAt: serverTimestamp()
        });
        alert("পরীক্ষামূলক সরাসরি যোগাযোগ বার্তা সফলভাবে ফায়ারবেজে এড হয়েছে!");
        loadData();
      }
    } catch (e: any) {
      alert("ভুল হয়েছে: " + e.message);
    }
  };

  // Filter and search logic
  const filteredMessages = messages.filter((msg) => {
    const name = String(msg?.name || "অজ্ঞাতনামা শিক্ষার্থী").toLowerCase();
    const email = String(msg?.email || "").toLowerCase();
    const phone = String(msg?.phone || "");
    const subject = String(msg?.subject || "").toLowerCase();
    const message = String(msg?.message || "").toLowerCase();
    const term = (searchQuery || "").toLowerCase().trim();

    const matchesSearch =
      name.includes(term) ||
      email.includes(term) ||
      phone.includes(term) ||
      subject.includes(term) ||
      message.includes(term);
    
    if (statusFilter === "all") return matchesSearch;
    return matchesSearch && msg.status === statusFilter;
  });

  const pendingCount = messages.filter((m) => m.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="bg-gradient-to-r from-teal-900/40 to-slate-900 p-6 rounded-2xl border border-teal-500/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <PhoneCall className="w-6 h-6 text-teal-400" />
            সরাসরি যোগাযোগ ও ইউজার সাপোর্ট ম্যানেজার
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            শিক্ষার্থী অ্যাপের "সরাসরি যোগাযোগ" স্ক্রিনের কনট্যাক্ট লিঙ্ক এবং শিক্ষার্থীদের সাবমিট করা সরাসরি সাপোর্ট মেসেজ ম্যানেজ করুন।
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadData}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingMessages ? "animate-spin" : ""}`} /> রিলোড করুন
          </button>
          <button
            onClick={handleCreateTestMessage}
            className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition"
          >
            + টেস্ট মেসেজ তৈরি করুন
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Config Panel (settings for the user app) */}
        <div className="lg:col-span-5 space-y-6">
          <form
            onSubmit={handleSaveLinks}
            className="bg-slate-800/60 p-6 rounded-2xl border border-slate-700/50 flex flex-col justify-between space-y-6 h-full"
          >
            <div className="space-y-4">
              <h3 className="text-md font-bold text-teal-400 flex items-center gap-2 border-b border-slate-700/60 pb-2">
                <ShieldCheck className="w-5 h-5 text-teal-400" />
                যোগাযোগ লিংক সেটিংস (User App Display)
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                শিক্ষার্থী অ্যাপ থেকে শিক্ষার্থীরা সরাসরি সাহায্য পেতে বা এডমিনের সাথে যোগাযোগ করার সময় এই লিঙ্কে রিডাইরেকক্ট হবে।
              </p>

              {/* Helpline Number */}
              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-1.5">অফিসিয়াল হেল্পলাইন নম্বর</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                    <PhoneCall className="w-4 h-4 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    value={links.helpline}
                    onChange={(e) => setLinks({ ...links, helpline: e.target.value })}
                    placeholder="যেমন: +8801700000000"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-white text-xs outline-none focus:border-teal-500 h-[38px]"
                  />
                </div>
              </div>

              {/* WhatsApp Link */}
              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-1.5">হোয়াটসঅ্যাপ চ্যাট লিংক</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                  </span>
                  <input
                    type="text"
                    value={links.whatsapp}
                    onChange={(e) => setLinks({ ...links, whatsapp: e.target.value })}
                    placeholder="যেমন: https://wa.me/8801700000000"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-white text-xs outline-none focus:border-teal-500 h-[38px] font-mono"
                  />
                </div>
              </div>

              {/* Telegram Support Link */}
              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-1.5">টেলিগ্রাম সাপোর্ট গ্রূপ / ইউজারলিঙ্ক</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                    <Send className="w-4 h-4 text-blue-400" />
                  </span>
                  <input
                    type="text"
                    value={links.telegram}
                    onChange={(e) => setLinks({ ...links, telegram: e.target.value })}
                    placeholder="যেমন: https://t.me/mcqhero_support"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-white text-xs outline-none focus:border-teal-500 h-[38px] font-mono"
                  />
                </div>
              </div>

              {/* Messenger Link */}
              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-1.5">ফেসবুক মেসেঞ্জার চ্যাট লিংক</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                    <Facebook className="w-4 h-4 text-indigo-400" />
                  </span>
                  <input
                    type="text"
                    value={links.messenger}
                    onChange={(e) => setLinks({ ...links, messenger: e.target.value })}
                    placeholder="যেমন: https://m.me/mcqhero"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-white text-xs outline-none focus:border-teal-500 h-[38px] font-mono"
                  />
                </div>
              </div>

              {/* FB Group / Page */}
              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-1.5">অফিসিয়াল ফেসবুক গ্রুপ লিংক</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                    <Facebook className="w-4 h-4 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    value={links.fbGroup}
                    onChange={(e) => setLinks({ ...links, fbGroup: e.target.value })}
                    placeholder="যেমন: https://facebook.com/groups/mcqhero"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-white text-xs outline-none focus:border-teal-500 h-[38px] font-mono"
                  />
                </div>
              </div>

              {/* Support Email */}
              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-1.5 font-sans">সাপোর্ট ইমেইল এড্রেস</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                    <Mail className="w-4 h-4 text-purple-400" />
                  </span>
                  <input
                    type="email"
                    value={links.email}
                    onChange={(e) => setLinks({ ...links, email: e.target.value })}
                    placeholder="যেমন: support@mcqhero.com"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-white text-xs outline-none focus:border-teal-500 h-[38px] font-mono"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingLinks}
              className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-teal-500/40 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-lg hover:shadow-teal-500/10"
            >
              {savingLinks ? "সেভ হচ্ছে..." : "যোগাযোগ লিংক সংরক্ষণ করুন"}
            </button>
          </form>
        </div>

        {/* Right Column: Support Messages List & Work Inbox */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-800/60 p-6 rounded-2xl border border-slate-700/50 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-700/60 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-indigo-400" />
                সরাসরি মেসেজ বক্স
                {pendingCount > 0 && (
                  <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {pendingCount}টি পেন্ডিং
                  </span>
                )}
              </h3>

              {/* Status Filters */}
              <div className="flex gap-1.5 bg-slate-900/80 p-1 rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`px-3 py-1 rounded text-xs transition cursor-pointer ${
                    statusFilter === "all" ? "bg-slate-700 text-white font-semibold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  সব ({messages.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("pending")}
                  className={`px-3 py-1 rounded text-xs transition cursor-pointer ${
                    statusFilter === "pending" ? "bg-red-500/30 text-white font-semibold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  পেন্ডিং ({pendingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("resolved")}
                  className={`px-3 py-1 rounded text-xs transition cursor-pointer ${
                    statusFilter === "resolved" ? "bg-emerald-500/30 text-emerald-300 font-semibold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  সমাধানকৃত ({messages.length - pendingCount})
                </button>
              </div>
            </div>

            {/* Live Search Field */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Search className="w-4 h-4 text-slate-400" />
              </span>
              <input
                type="text"
                placeholder="নাম, মোবাইল নম্বর বা বিষয়ের শব্দ লিখে সার্চ করুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-750 rounded-xl pl-10 pr-3 py-2 text-white text-xs outline-none focus:border-teal-500 h-[38px]"
              />
            </div>

            {/* List of Messages */}
            {loadingMessages ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-slate-400">লোডিং মেসেজেস ডাটা...</p>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="text-center py-12 bg-slate-900/30 rounded-xl border border-slate-800">
                <HelpCircle className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">কোনো সরাসরি সাপোর্ট মেসেজ পাওয়া যায়নি</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                {filteredMessages.map((msg) => {
                  const dateObj = (msg as any)._parsedDate || (msg.createdAt && msg.createdAt.seconds ? new Date(msg.createdAt.seconds * 1000) : new Date());
                  const dateStr = dateObj.toLocaleDateString("bn-BD") + " " + dateObj.toLocaleTimeString("bn-BD", { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={msg.id}
                      onClick={() => setSelectedMsg(msg)}
                      className={`p-4 rounded-xl border text-left cursor-pointer transition flex justify-between items-start ${
                        selectedMsg?.id === msg.id
                          ? "bg-slate-750/90 border-teal-500/60 shadow-lg"
                          : "bg-slate-900/60 hover:bg-slate-800 border-slate-800"
                      }`}
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              msg.status === "resolved"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-red-500/10 text-red-400 border border-red-500/20"
                            }`}
                          >
                            {msg.status === "resolved" ? "সমাধানকৃত" : "পেন্ডিং"}
                          </span>
                          <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-slate-600" /> {dateStr}
                          </span>
                        </div>

                        <h4 className="text-sm font-semibold text-white truncate">{msg.name}</h4>
                        <p className="text-xs text-teal-400 font-semibold">{msg.subject}</p>
                        <p className="text-xs text-slate-400 line-clamp-2 pr-4">{msg.message}</p>

                        <div className="flex flex-wrap gap-2 pt-1 font-sans text-[10px] text-slate-400">
                          <span>📞 {msg.phone}</span>
                          {msg.email && <span>| 📧 {msg.email}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 self-center">
                        <ChevronRight className="w-5 h-5 text-slate-500" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected Message Overlay Modal for Detail Operations */}
      {selectedMsg && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in text-left">
          <div className="bg-slate-900 border border-slate-700 max-w-xl w-full rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex justify-between items-start border-b border-slate-850 pb-3">
              <div>
                <span
                  className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    selectedMsg.status === "resolved"
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                      : "bg-red-500/15 text-red-500 border border-red-500/20"
                  }`}
                >
                  {selectedMsg.status === "resolved" ? "সমাধানকৃত" : "পেন্ডিং"}
                </span>
                <h3 className="text-base font-bold text-white mt-1.5 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-teal-400" />
                  {selectedMsg.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedMsg(null)}
                className="text-slate-400 hover:text-white bg-slate-800 max-h-[28px] max-w-[28px] p-2 rounded-lg cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">যোগাযোগের তথ্য</span>
                <div className="grid grid-cols-2 gap-3 mt-1 text-xs select-all text-slate-300">
                  <div>
                    <span className="text-slate-500 block text-[10px]">সরাসরি মোবাইল নম্বর:</span>
                    <p className="font-semibold text-white">{selectedMsg.phone}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">সাপোর্ট ইমেইল:</span>
                    <p className="font-semibold text-white">{selectedMsg.email || "নেই"}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-850 pt-2.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">বার্তার ক্যাটাগরি ও বিষয়</span>
                <p className="text-xs text-teal-400 font-bold mt-0.5">{selectedMsg.subject}</p>
              </div>

              <div className="border-t border-slate-850 pt-2.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">বিস্তারিত বার্তা বিবরণ</span>
                <p className="text-xs text-slate-200 leading-relaxed mt-1 whitespace-pre-wrap select-text">
                  {selectedMsg.message}
                </p>
              </div>
            </div>

            {/* Direct Reply / Admin Remarks Editor */}
            <div className="border-t border-slate-800/80 pt-4 space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">রিপ্লাই বা এডমিন মন্তব্য প্রদান</span>
              <div className="flex flex-col space-y-2 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
                <textarea
                  className="w-full bg-slate-900 border border-slate-750 rounded-lg p-2.5 text-xs text-white outline-none focus:border-teal-500 min-h-[75px] resize-y"
                  placeholder="এখানে আপনার উত্তর বা এডমিন মন্তব্যটি লিখুন যা ডাটাবেজে সংরক্ষণ হবে এবং শিক্ষার্থীর অ্যাপ সেকশনে চলে যাবে..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveRemarks}
                    disabled={savingRemarks}
                    className="bg-teal-500 hover:bg-teal-600 disabled:bg-slate-700 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {savingRemarks ? (
                      <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    মন্তব্য/রিপ্লাই সংরক্ষণ করুন
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Action Trigger Buttons */}
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-2">সরাসরি অ্যাকশনস</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <a
                  href={`tel:${selectedMsg.phone}`}
                  className="bg-slate-800 hover:bg-slate-750 text-white p-2.5 rounded-lg border border-slate-700 text-xs font-semibold text-center flex items-center justify-center gap-1 cursor-pointer transition-colors"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-teal-400" /> কল দিন
                </a>
                <a
                  href={`https://wa.me/${selectedMsg.phone.replace(/^0/, "880")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-slate-800 hover:bg-slate-755 text-white p-2.5 rounded-lg border border-slate-700 text-xs font-semibold text-center flex items-center justify-center gap-1 cursor-pointer transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400" /> হোয়াটসঅ্যাপ
                </a>
                <a
                  href={`mailto:${selectedMsg.email}?subject=Reply to support request from MCQ HERO`}
                  className="bg-slate-800 hover:bg-slate-755 text-white p-2.5 rounded-lg border border-slate-700 text-xs font-semibold text-center flex items-center justify-center gap-1 cursor-pointer transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-indigo-400" /> ইমেইল লিখুন
                </a>
                <button
                  onClick={() => handleToggleStatus(selectedMsg)}
                  className={`p-2.5 rounded-lg text-xs font-bold text-center flex items-center justify-center gap-1 cursor-pointer transition-all ${
                    selectedMsg.status === "resolved"
                      ? "bg-slate-800 hover:bg-slate-750 border border-slate-705 text-slate-400 hover:text-white"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  {selectedMsg.status === "resolved" ? "পুনরায় পেন্ডিং করুন" : "সমাধান মার্ক"}
                </button>
              </div>
            </div>

            {/* Quick Copy Action and Danger zone */}
            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-400">আইডি রেন্সফারেন্স: {selectedMsg.id}</span>
              <button
                onClick={() => handleDeleteMessage(selectedMsg.id)}
                className="text-red-500 hover:text-red-400 font-bold text-[10px] uppercase cursor-pointer"
              >
                মেসেজ ডিলিট করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
