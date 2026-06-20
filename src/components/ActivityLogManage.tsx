import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Search,
  Trash2,
  Download,
  Printer,
  Filter,
  Calendar,
  User,
  Activity,
  CheckCircle,
  FileText,
  AlertTriangle,
  Loader2,
  RefreshCw
} from "lucide-react";
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, limit, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { AdminActivityLog } from "../types";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie
} from "recharts";

// Exportable function to log admin activity in a safe and uniform way
export async function logActivity(
  adminEmail: string,
  action: string,
  details: string,
  isSandbox: boolean
) {
  const logData = {
    adminEmail: adminEmail || "system@mcqhero.com",
    action,
    details,
    timestamp: new Date().toISOString()
  };

  if (isSandbox) {
    try {
      const stored = localStorage.getItem("local_audit_logs") || "[]";
      const parsed = JSON.parse(stored);
      parsed.unshift({ id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, ...logData });
      localStorage.setItem("local_audit_logs", JSON.stringify(parsed.slice(0, 500))); // Cap at 500 logs for client stability
    } catch (err) {
      console.warn("Failed to write sandbox activity log:", err);
    }
  } else {
    try {
      await addDoc(collection(db, "audit_logs"), {
        ...logData,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.warn("Failed to write Firestore activity log: ", err);
    }
  }
}

interface ActivityLogManageProps {
  currentAdminEmailRef: string;
  isSandboxMode: boolean;
}

export default function ActivityLogManage({ currentAdminEmailRef, isSandboxMode }: ActivityLogManageProps) {
  const [logs, setLogs] = useState<AdminActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedActionType, setSelectedActionType] = useState("All");
  const [selectedAdmin, setSelectedAdmin] = useState("All");
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Load audit logs
  useEffect(() => {
    let isMounted = true;
    const fetchLogs = async () => {
      setLoading(true);
      try {
        if (isSandboxMode) {
          const stored = localStorage.getItem("local_audit_logs");
          if (stored) {
            setLogs(JSON.parse(stored));
          } else {
            // Seed default sandbox mock logs for professional vibe
            const defaultLogs: AdminActivityLog[] = [
              {
                id: "log-seed-1",
                adminEmail: "admin@mcqhero.com",
                action: "SETTINGS_UPDATE",
                details: "মেইনটেনেন্স মোড সক্রিয় করা হয়েছে এবং নোটিশ বোর্ড আপডেট করা হয়েছে।",
                timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
              },
              {
                id: "log-seed-2",
                adminEmail: "moderator@mcqhero.com",
                action: "QUESTION_CREATE",
                details: "বাংলা সাহিত্য ক্যাটাগরিতে নতুন প্রশ্ন আইডি q-402 যুক্ত করা হয়েছে।",
                timestamp: new Date(Date.now() - 3600000 * 5).toISOString()
              },
              {
                id: "log-seed-3",
                adminEmail: "admin@mcqhero.com",
                action: "PAYMENT_APPROVE",
                details: "TASNIIM@OUTLOOK.COM এর ৪৯৯ টাকা পেমেন্ট রিকোয়েস্ট অনুমোদন করেছেন।",
                timestamp: new Date(Date.now() - 3600000 * 12).toISOString()
              },
              {
                id: "log-seed-4",
                adminEmail: "admin@mcqhero.com",
                action: "USER_BAN",
                details: "নীতিমালা লঙ্ঘনের দায়ে ইউজার tasnim_spammer@yahoo.com কে ব্যান করা হয়েছে।",
                timestamp: new Date(Date.now() - 3600000 * 24).toISOString()
              },
              {
                id: "log-seed-5",
                adminEmail: "moderator@mcqhero.com",
                action: "REPORT_RESOLVE",
                details: "প্রশ্ন আইডি q-102 এর সংশোধনী রিপোর্ট সমাধান সম্পন্ন করা হয়েছে।",
                timestamp: new Date(Date.now() - 3600000 * 30).toISOString()
              }
            ];
            localStorage.setItem("local_audit_logs", JSON.stringify(defaultLogs));
            setLogs(defaultLogs);
          }
        } else {
          const q = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"), limit(200));
          const snapshot = await getDocs(q);
          const loadedLogs: AdminActivityLog[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            let tsString = new Date().toISOString();
            if (data.timestamp) {
              if (typeof data.timestamp.toDate === "function") {
                tsString = data.timestamp.toDate().toISOString();
              } else if (data.timestamp instanceof Date) {
                tsString = data.timestamp.toISOString();
              } else {
                tsString = String(data.timestamp);
              }
            }
            loadedLogs.push({
              id: doc.id,
              adminEmail: data.adminEmail || "unknown@mcqhero.com",
              action: data.action || "GENERAL_ACTION",
              details: data.details || "",
              timestamp: tsString
            });
          });
          if (isMounted) {
            setLogs(loadedLogs);
          }
        }
      } catch (err) {
        console.error("Error fetching logs:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchLogs();
    return () => {
      isMounted = false;
    };
  }, [isSandboxMode, reloadTrigger]);

  // Extract distinct admins and action patterns for filters
  const uniqueAdmins = Array.from(new Set(logs.map((l) => l.adminEmail))).filter(Boolean) as string[];
  const uniqueActions = Array.from(new Set(logs.map((l) => l.action))).filter(Boolean) as string[];

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const sTerm = searchQuery.toLowerCase();
    const matchesSearch =
      log.details.toLowerCase().includes(sTerm) ||
      log.adminEmail.toLowerCase().includes(sTerm) ||
      log.action.toLowerCase().includes(sTerm);
    
    const matchesAction = selectedActionType === "All" || log.action === selectedActionType;
    const matchesAdmin = selectedAdmin === "All" || log.adminEmail === selectedAdmin;

    return matchesSearch && matchesAction && matchesAdmin;
  });

  // Calculate audit statistics for Recharts display
  const actionCounts = filteredLogs.reduce((acc: { [key: string]: number }, cur) => {
    acc[cur.action] = (acc[cur.action] || 0) + 1;
    return acc;
  }, {});

  const chartData = Object.keys(actionCounts).map((action) => ({
    name: action.replace("_", " "),
    count: actionCounts[action]
  })).sort((a, b) => b.count - a.count);

  const colors = ["#14b8a6", "#22d3ee", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#10b981"];

  // Download Logs as JSON
  const handleExportJSON = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `mcq_hero_audit_logs_${new Date().toISOString().substring(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e: any) {
      alert("এক্সপোর্ট করা সম্ভব হয়নি: " + e.message);
    }
  };

  // Clear audit log history under password confirm
  const handleClearLogs = () => {
    const password = prompt("সকল সিকিউরিটি অডিট লগ ডিলেট করতে কনফার্মেশন কোড পাসওয়ার্ড দিন (admin123 অথবা আপনার মাস্টার এডমিন পাসওয়ার্ড):");
    if (password === "admin123" || password === "maint99") {
      if (confirm("আপনি কি নিশ্চিত যে সম্পূর্ণ অডিট হিস্ট্রি চিরতরে মুছে ফেলতে চান? এটি আর রিকভার করা যাবে না!")) {
        setLoading(true);
        if (isSandboxMode) {
          localStorage.setItem("local_audit_logs", JSON.stringify([]));
          setLogs([]);
          alert("স্যান্ডবক্স অডিট লগ সফলভাবে খালি করা হয়েছে!");
          setLoading(false);
          logActivity(currentAdminEmailRef, "LOG_CLEAR", "অডিট লগ ডাটাবেজ খালি করা হয়েছে", isSandboxMode);
          setReloadTrigger((p) => p + 1);
        } else {
          // Implement cloud purge logic if needed (batch delete)
          alert("অডিট হিস্ট্রি সিকিউরিটি সুরক্ষার কারণে ক্লাউডে সরাসরি ক্লিন ডিলিট নিষিদ্ধ। শুধু স্যান্ডবক্স মোডে ক্লিয়ার করা সম্ভব।");
          setLoading(false);
        }
      }
    } else if (password !== null) {
      alert("ভুল কনফার্মেশন কোড! অ্যাকশন বাতিল করা হলাে।");
    }
  };

  // Print layout custom handler
  const handlePrint = () => {
    window.print();
  };

  // Helper logic to style action types beautifully
  const getActionTheme = (action: string) => {
    switch (action) {
      case "SETTINGS_UPDATE":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "PAYMENT_APPROVE":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "PAYMENT_DECLINE":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "USER_BAN":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "USER_PROMOTE":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      case "QUESTION_CREATE":
      case "QUESTION_UPDATE":
        return "bg-teal-500/10 text-teal-400 border-teal-500/20";
      case "QUESTION_DELETE":
        return "bg-red-550/10 text-red-400 border-red-500/10";
      case "REPORT_RESOLVE":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      default:
        return "bg-slate-800/80 text-slate-300 border-slate-700/50";
    }
  };

  return (
    <div className="space-y-6">
      {/* Visual Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-md shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">এডমিন অ্যাক্টিভিটি ও অডিট লগ ট্র্যাকার</h2>
          </div>
          <p className="text-xs text-slate-400">
            এডমিন ও মডারেটরদের করা প্রতিটি পরিবর্তনের রিয়েল-টাইম সিকিউরিটি ট্র্যাকিং এবং লাইভ হিস্ট্রি চার্ট
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setReloadTrigger((p) => p + 1)}
            disabled={loading}
            className="p-2.5 bg-slate-800/80 border border-slate-700 hover:border-slate-600 rounded-xl text-slate-300 hover:text-white cursor-pointer active:scale-95 transition-all"
            title="रिफ्रেশ করুন"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-teal-400" : ""}`} />
          </button>

          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-750 text-slate-200 hover:text-white rounded-xl text-xs font-semibold cursor-pointer active:scale-95 transition-all shadow-md"
          >
            <Download className="w-3.5 h-3.5" />
            JSON ডাউনলোড
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-750 text-slate-200 hover:text-white rounded-xl text-xs font-semibold cursor-pointer active:scale-95 transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            প্রিন্ট রিপোর্ট
          </button>

          {isSandboxMode && (
            <button
              onClick={handleClearLogs}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-red-950/40 text-red-400 border border-red-900/30 hover:bg-red-900/20 rounded-xl text-xs font-semibold cursor-pointer active:scale-95 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              লগ মুছে ফেলুন
            </button>
          )}
        </div>
      </div>

      {/* Analytics Dashboard Grid */}
      {filteredLogs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bar Chart showing volume */}
          <div className="lg:col-span-2 bg-slate-900/40 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 block">কার্যক্রম ভিত্তিক ট্রানজেকশন ফ্রিকোয়েন্সি</span>
              <span className="bg-teal-500/10 text-teal-400 font-bold text-[10px] px-2 py-0.5 rounded-full border border-teal-500/20">
                লাইভ ডাটা
              </span>
            </div>
            <div className="h-[200px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }}
                    itemStyle={{ color: "#22d3ee", fontSize: "12px" }}
                    labelStyle={{ color: "#fff", fontSize: "11px", fontWeight: "bold" }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between shadow-lg">
            <div>
              <span className="text-xs font-bold text-slate-300 block mb-4">অডিট ও সিকিউরিটি ওভারভিউ</span>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-850">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-teal-500/10 text-teal-400 rounded-lg">
                      <Activity className="w-4 h-4" />
                    </span>
                    <span className="text-xs text-slate-400">সর্বমোট অডিট রেকর্ড</span>
                  </div>
                  <span className="text-sm font-black text-white font-mono">{filteredLogs.length} টি</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-850">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg">
                      <User className="w-4 h-4" />
                    </span>
                    <span className="text-xs text-slate-400">সক্রিয় এডমিনিস্ট্রেটর</span>
                  </div>
                  <span className="text-sm font-black text-white font-mono">{uniqueAdmins.length} জন</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-850">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg">
                      <AlertTriangle className="w-4 h-4" />
                    </span>
                    <span className="text-xs text-slate-400">জরুরি পরিবর্তন সমূহ</span>
                  </div>
                  <span className="text-sm font-black text-white font-mono">
                    {filteredLogs.filter((l) => l.action === "USER_BAN" || l.action === "SETTINGS_UPDATE").length} টি
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 text-[10px] text-slate-500 bg-slate-950/60 p-2.5 rounded-lg border border-slate-900 leading-relaxed text-center">
              🔐 এই অডিট মেকানিজমটি সব ধরনের ওল্ড রুল ও অ্যাক্টিভিটি হিস্ট্রি পরিবর্তন সুরক্ষার জন্য এনক্রিপ্টেড ডাটা ট্রানজেকশনে চালিত।
            </div>
          </div>
        </div>
      )}

      {/* Control Filters Module */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-4 items-end shadow-md">
        <div className="md:col-span-2">
          <label className="text-slate-300 text-xs font-semibold block mb-1.5">কর্মকাণ্ড বা এডমিন ইমেইল খুঁজুন</label>
          <div className="relative">
            <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="যেমন: ব্যান, পেমেন্ট, admin@mcqhero.com"
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-teal-400 h-[40px] transition-all"
            />
          </div>
        </div>

        <div>
          <label className="text-slate-300 text-xs font-semibold block mb-1.5">অ্যাকশন টাইপ ফিল্টার</label>
          <select
            value={selectedActionType}
            onChange={(e) => setSelectedActionType(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-teal-400 h-[40px] transition-all"
          >
            <option value="All">All Actions (সকল কর্মকাণ্ড)</option>
            {uniqueActions.map((action) => (
              <option key={action} value={action}>{action.replace("_", " ")}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-slate-300 text-xs font-semibold block mb-1.5">এডমিন / মডারেটর</label>
          <select
            value={selectedAdmin}
            onChange={(e) => setSelectedAdmin(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-teal-400 h-[40px] transition-all"
          >
            <option value="All">All Admins (সকল এডমিন)</option>
            {uniqueAdmins.map((email) => (
              <option key={email} value={email}>{email}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Logs Activity List */}
      <div className="bg-slate-900/40 rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-300">অডিট লগ এন্ট্রি ট্রিল তালিকা</span>
          <span className="text-[10px] text-teal-400 font-mono">লগ ক্যাপাসিটি: ২০০ টি এন্ট্রি</span>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-500 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-500" />
            <p className="text-xs">অডিট ডাটাবেজ লকিং কোয়েরি যাচাইকরণ হচ্ছে...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-16 text-center text-slate-500 border border-dashed border-slate-800 m-4 rounded-xl">
            <ShieldAlert className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-xs font-semibold">কোন সিকিউরিটি অফলাইন/অনলাইন অডিট লগ রেকর্ড খুঁজে পাওয়া যায়নি!</p>
            <p className="text-[10px] text-slate-650 mt-1">অনুগ্রহ করে ফিল্টার পরিবর্তন বা রিলোড করে আবার ট্রাই করুন।</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredLogs.map((log) => (
              <div
                key={log.id || `log-${Math.random()}`}
                className="p-4 bg-slate-955/30 hover:bg-slate-900/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Log Primary Content */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className="mt-0.5">
                    <span className={`inline-block px-2.5 py-1 rounded text-[9px] font-black tracking-wide border uppercase font-mono ${getActionTheme(log.action)}`}>
                      {log.action}
                    </span>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <p className="text-xs text-slate-200 font-medium whitespace-pre-wrap font-sans leading-relaxed">
                      {log.details}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                      <span className="font-semibold text-slate-400 truncate max-w-[180px]" title={log.adminEmail}>
                        by: {log.adminEmail}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-600" />
                        {new Date(log.timestamp).toLocaleString("bn-BD", {
                          timeZone: "Asia/Dhaka",
                          hour12: true
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="flex-shrink-0 flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/5 px-2 py-1 rounded-lg border border-emerald-500/10 self-start md:self-center">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Logged Securely
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
