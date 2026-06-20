import React, { useState, useEffect } from "react";
import {
  CreditCard,
  Search,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  Download,
  Loader2,
  Calendar,
  AlertCircle,
  ArrowUpDown
} from "lucide-react";
import { collection, getDocs, updateDoc, doc, query, orderBy, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Payment, Course } from "../types";
import * as XLSX from "xlsx";

interface PaymentManageProps {
  payments: Payment[];
  courses: Course[];
  triggerReload: () => void;
  isSandboxMode?: boolean;
}

function getPaymentTitle(p: any, courses?: Course[]): string {
  if (!p) return "";
  let name = p.itemName || p.planName || p.courseTitle || p.courseName || p.plan || p.packageName || p.course || p.title || "";
  name = name.trim();
  if (!name && (p.courseId || p.itemId) && courses) {
    const matched = courses.find((c) => c.id === (p.courseId || p.itemId));
    if (matched) {
      name = matched.title || "";
    }
  }
  return name || "N/A";
}

function findMatchedCourse(p: any, coursesList: Course[]): Course | undefined {
  if (!p || !coursesList) return undefined;
  return coursesList.find((c) => {
    if (p.courseId && c.id === p.courseId) return true;
    if (p.itemId && c.id === p.itemId) return true;
    const pTitle = getPaymentTitle(p, coursesList).toLowerCase().trim();
    if (!pTitle || pTitle === "n/a") return false;
    const normTitle = (c.title || "").trim().toLowerCase();
    return normTitle === pTitle || pTitle.includes(normTitle) || normTitle.includes(pTitle);
  });
}

function getRequestInfo(p: any, coursesList: Course[]) {
  const isCourseRequest = p.itemType === "course" || !!p.courseId || !!p.itemId;
  const matchedCourse = findMatchedCourse(p, coursesList);

  if (isCourseRequest || matchedCourse) {
    const title = matchedCourse?.title || getPaymentTitle(p, coursesList);
    return {
      type: "course",
      typeName: "📖 কোর্স পারচেজ",
      itemName: title,
      priceInfo: matchedCourse
        ? (matchedCourse.promoPrice ? `${matchedCourse.promoPrice} ৳ (প্রোমো)` : `${matchedCourse.price || 0} ৳`)
        : (p.price ? `${p.price} ৳` : "আলাদা কোর্স ফি"),
      badgeColor: "bg-teal-500/10 text-teal-400 border border-teal-500/20 text-[10px]"
    };
  } else {
    return {
      type: "premium",
      typeName: "👑 প্রিমিয়াম প্ল্যান",
      itemName: getPaymentTitle(p, coursesList),
      priceInfo: p.price ? `${p.price} ৳` : "আলাদা সাবস্ক্রিপশন ফি",
      badgeColor: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px]"
    };
  }
}

export default function PaymentManage({ payments, courses, triggerReload, isSandboxMode }: PaymentManageProps) {
  const [activeTab, setActiveTab] = useState<"pending" | "resolved">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentsList, setPaymentsList] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<"pending-first" | "newest-first" | "oldest-first">("pending-first");

  // Modern Dialog Confirmation & Toast States
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    payment: Payment;
    actionType: "approve" | "reject";
  } | null>(null);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
  };

  // Toast automatic clear effect
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Sync payments local tracker
  useEffect(() => {
    if (isSandboxMode) {
      const interval = setInterval(() => {
        const stored = localStorage.getItem("local_payments");
        if (stored) {
          try {
            setPaymentsList(JSON.parse(stored));
          } catch (e) {}
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setPaymentsList(payments);
    }
  }, [payments, isSandboxMode]);

  // Sort and Filter list
  const filtered = paymentsList
    .filter((p) => {
      const term = searchQuery.toLowerCase();
      const mailMatches = p.email?.toLowerCase().includes(term);
      const trxMatches = p.transactionId?.toLowerCase().includes(term);
      const pTitle = getPaymentTitle(p, courses).toLowerCase();
      const planMatches = pTitle.includes(term);

      const isPending = p.status === "pending" || !p.status;
      const tabMatch = activeTab === "pending" ? isPending : p.status === "approved" || p.status === "rejected";

      return tabMatch && (mailMatches || trxMatches || planMatches);
    })
    .sort((a, b) => {
      if (sortBy === "pending-first") {
        const isPendingA = a.status === "pending" || !a.status;
        const isPendingB = b.status === "pending" || !b.status;
        if (isPendingA && !isPendingB) return -1;
        if (!isPendingA && isPendingB) return 1;
        // fallback to newest first within priority
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      } else if (sortBy === "newest-first") {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      } else if (sortBy === "oldest-first") {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateA - dateB;
      }
      return 0;
    });

  const handleApprove = (p: Payment) => {
    if (!p.id) return;
    setConfirmModal({
      isOpen: true,
      payment: p,
      actionType: "approve"
    });
  };

  const handleReject = (p: Payment) => {
    if (!p.id) return;
    setConfirmModal({
      isOpen: true,
      payment: p,
      actionType: "reject"
    });
  };

  const executeApprove = async (p: Payment) => {
    if (!p.id) return;
    setLoading(true);
    try {
      const today = new Date();
      const expiry = new Date();

      // Calculation based on plan name (Monthly, Semi-Annual, Annual etc.)
      const planStr = getPaymentTitle(p, courses);
      if (planStr.includes("বার্ষিক") || planStr.includes("Annual") || planStr.includes("365") || planStr.includes("Yearly") || planStr.includes("বাতসরিক") || planStr.includes("বছরের")) {
        expiry.setDate(expiry.getDate() + 365);
      } else if (planStr.includes("ষান্মাসিক") || planStr.includes("Half") || planStr.includes("180") || planStr.includes("Semi-annual") || planStr.includes("৬ মাস") || planStr.includes("6 Month")) {
        expiry.setDate(expiry.getDate() + 180);
      } else {
        expiry.setDate(expiry.getDate() + 30);
      }

      // Check if this matches a course
      const matchedCourse = findMatchedCourse(p, courses);

      if (isSandboxMode) {
        // Appending / Updating Local Payments
        const storedPaymentsStr = localStorage.getItem("local_payments");
        if (storedPaymentsStr) {
          const lps = JSON.parse(storedPaymentsStr);
          const updatedLps = lps.map((pay: any) => {
            if (pay.id === p.id) {
              return { ...pay, status: "approved", approvedAt: today.toISOString() };
            }
            return pay;
          });
          localStorage.setItem("local_payments", JSON.stringify(updatedLps));
        }

        // Updating Local Users (make student premium or assign course access)
        if (p.userId) {
          const storedUsersStr = localStorage.getItem("local_users");
          if (storedUsersStr) {
            const lus = JSON.parse(storedUsersStr);
            const updatedLus = lus.map((user: any) => {
              if (user.uid === p.userId || user.id === p.userId) {
                const owned = user.ownedCourses || [];
                let nextOwned = [...owned];
                if (matchedCourse) {
                  const alreadyOwns = owned.some((c: any) => c.courseId === matchedCourse.id);
                  if (!alreadyOwns) {
                    nextOwned.push({
                      courseId: matchedCourse.id,
                      courseTitle: matchedCourse.title,
                      assignedAt: today.toISOString(),
                      expiry: expiry.toISOString()
                    });
                  }
                }

                // If matched course is found, keep core role intact (do NOT override to 'premium')
                if (matchedCourse) {
                  return {
                    ...user,
                    ownedCourses: nextOwned
                  };
                } else {
                  return {
                    ...user,
                    role: "premium",
                    premiumPlan: getPaymentTitle(p, courses) || "Monthly Standard",
                    premiumStart: today.toISOString(),
                    premiumExpiry: expiry.toISOString(),
                    ownedCourses: nextOwned
                  };
                }
              }
              return user;
            });
            localStorage.setItem("local_users", JSON.stringify(updatedLus));
          }
        }

        if (matchedCourse) {
          showToast(`পেমেন্ট সফলভাবে এপ্রুভ ও উনার আইডিতে "${matchedCourse.title}" কোর্সটি সফলভাবে যোগ করা হয়েছে! (Sandbox Mode)`, "success");
        } else {
          showToast("পেমেন্ট সফলভাবে এপ্রুভ ও উনার প্রিমিয়াম প্যাকেজ চালু করা হয়েছে! (Sandbox Mode)", "success");
        }
        triggerReload();
        setConfirmModal(null);
        return;
      }

      // Update payment doc status in actual Live Firebase Firestore
      await updateDoc(doc(db, "payments", p.id), {
        status: "approved",
        approvedAt: today.toISOString()
      });

      // Update student user profile docs role details in actual Live Firebase Firestore
      if (p.userId) {
        const userRef = doc(db, "users", p.userId);
        const userSnap = await getDoc(userRef);
        let ownedCourses = [];
        if (userSnap.exists()) {
          ownedCourses = userSnap.data().ownedCourses || [];
        }

        if (matchedCourse) {
          const alreadyOwns = ownedCourses.some((c: any) => c.courseId === matchedCourse.id);
          if (!alreadyOwns) {
            ownedCourses.push({
              courseId: matchedCourse.id,
              courseTitle: matchedCourse.title,
              assignedAt: today.toISOString(),
              expiry: expiry.toISOString()
            });
          }
        }

        // Only update role and subscription details if NOT a course purchase
        const updatePayload: any = {};
        if (matchedCourse) {
          updatePayload.ownedCourses = ownedCourses;
        } else {
          updatePayload.role = "premium";
          updatePayload.premiumPlan = getPaymentTitle(p, courses) || "Monthly Standard";
          updatePayload.premiumStart = today.toISOString();
          updatePayload.premiumExpiry = expiry.toISOString();
        }

        await updateDoc(userRef, updatePayload);
      }

      if (matchedCourse) {
        showToast(`পেমেন্ট সফলভাবে এপ্রুভ ও উনার আইডিতে "${matchedCourse.title}" কোর্সটি সফলভাবে যোগ করা হয়েছে!`, "success");
      } else {
        showToast("পেমেন্ট সফলভাবে এপ্রুভ ও উনার প্রিমিয়াম প্যাকেজ চালু করা হয়েছে!", "success");
      }
      triggerReload();
      setConfirmModal(null);
    } catch (err: any) {
      showToast("এপ্রুভাল প্রসেস ব্যর্থ: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const executeReject = async (p: Payment) => {
    if (!p.id) return;
    setLoading(true);
    try {
      if (isSandboxMode) {
        const storedPaymentsStr = localStorage.getItem("local_payments");
        if (storedPaymentsStr) {
          const lps = JSON.parse(storedPaymentsStr);
          const updatedLps = lps.map((pay: any) => {
            if (pay.id === p.id) {
              return { ...pay, status: "rejected", rejectedAt: new Date().toISOString() };
            }
            return pay;
          });
          localStorage.setItem("local_payments", JSON.stringify(updatedLps));
        }

        showToast("পেমেন্ট রিজেক্ট করা হয়েছে! (Sandbox Mode)", "success");
        triggerReload();
        setConfirmModal(null);
        return;
      }

      await updateDoc(doc(db, "payments", p.id), {
        status: "rejected",
        rejectedAt: new Date().toISOString()
      });

      showToast("পেমেন্ট রিজেক্ট করা হয়েছে!", "success");
      triggerReload();
      setConfirmModal(null);
    } catch (err: any) {
      showToast("রিজেক্ট ব্যর্থ: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Export payments spreadsheet
  const exportToExcel = () => {
    if (filtered.length === 0) return alert("রিপোর্ট জেনারেট করার জন্য কোনো ডাটা নেই!");

    const excelRows = filtered.map((p) => ({
      "User Email": p.email,
      "UserId (Firestore)": p.userId || "-",
      "Subscription Plan": getPaymentTitle(p, courses),
      "Gateway Method": p.method || "bKash",
      "Transaction ID": p.transactionId,
      "Current Status": p.status,
      "Record Date": p.createdAt
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Premium Transactions");
    XLSX.writeFile(workbook, `MCQ_Hero_Payments_${activeTab}_Report.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Search and header console */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50">
        <div>
          <h3 className="text-lg font-bold text-teal-400 flex items-center gap-2">
            <CreditCard className="w-5 h-5 animate-pulse" />
            পেমেন্ট অনুমোদন ও হিস্ট্রি কনসোল
          </h3>
          <p className="text-slate-400 text-xs mt-1">
            শিক্ষার্থীদের প্রিমিয়াম মেম্বারশিপ এবং বিকাশ/নগদ পেমেন্ট ট্রানজেকশন অনুমোদন নিশ্চিত করুণ
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="TrxID বা ইমেইল দিয়ে সার্চ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-teal-500 h-[36px] w-[200px]"
            />
          </div>

          <button
            onClick={exportToExcel}
            className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 h-[36px] rounded-lg transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" /> এক্সপোর্ট রিপোর্ট
          </button>
        </div>
      </div>

      {/* Table filter and sort controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Approve status sub tabs */}
        <div className="flex bg-slate-900/60 p-1.5 rounded-lg border border-slate-800 gap-1 w-full sm:max-w-[320px]">
          <button
            onClick={() => setActiveTab("pending")}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "pending" ? "bg-teal-500 text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            অপেক্ষমাণ তালিকা (Pending)
          </button>
          <button
            onClick={() => setActiveTab("resolved")}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "resolved" ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            মীমাংসিত তালিকা (Resolved)
          </button>
        </div>

        {/* Sorting dropdown */}
        <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-lg p-1.5 w-full sm:w-auto justify-between sm:justify-start">
          <span className="text-[11px] text-slate-400 font-medium px-2 flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-teal-400" />
            সর্টিং করুন:
          </span>
          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 outline-none px-2.5 py-1 focus:border-teal-500 cursor-pointer font-medium"
          >
            <option value="pending-first">পেন্ডিং পেমেন্ট আগে (Default)</option>
            <option value="newest-first">নতুন পেমেন্ট আগে (Newest First)</option>
            <option value="oldest-first">পুরোনো পেমেন্ট আগে (Oldest First)</option>
          </select>
        </div>
      </div>

      {/* Render tables or cards list */}
      {loading ? (
        <div className="text-center py-24 bg-slate-800/10 border border-slate-700/30 rounded-2xl flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
          <p className="text-slate-400 text-xs mt-3">পেমেন্ট রিকোয়েস্ট প্রসেস করা হচ্ছে...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-slate-800/20 border border-slate-700/50 rounded-2xl">
          <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">কোনো ট্রানজেকশন পেন্ডিং তালিকাভুক্ত নেই।</p>
        </div>
      ) : (
        <div className="bg-slate-800/40 rounded-2xl border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-700 text-slate-300 font-semibold uppercase tracking-wider">
                  <th className="p-4">ব্যবহারকারী ইমেইল</th>
                  <th className="p-4">অনুরোধের ধরন (Type)</th>
                  <th className="p-4">আবেদনকৃত কোর্স / প্ল্যান</th>
                  <th className="p-4">পদ্ধতি (Gateway)</th>
                  <th className="p-4">ট্রানজেকশন ID</th>
                  <th className="p-4">প্রদানের ডেট</th>
                  <th className="p-4 text-center">পরিস্থিতি / অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {filtered.map((p) => {
                  const reqInfo = getRequestInfo(p, courses);
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/20 text-slate-300 select-all transition-colors">
                      <td className="p-4 font-medium text-white">{p.email}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded inline-flex items-center gap-1 font-bold border transition-all ${reqInfo.badgeColor}`}>
                          {reqInfo.typeName}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="max-w-[250px] truncate">
                          <p className="font-semibold text-slate-200 text-xs">{reqInfo.itemName}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">নির্ধারিত মূল্য: {reqInfo.priceInfo}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="bg-slate-900 px-2 py-1 rounded text-slate-400 border border-slate-800 uppercase font-mono font-bold">
                          {p.method || "bKash"}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-bold text-teal-400 select-all">{p.transactionId}</td>
                      <td className="p-4 opacity-80 text-[10px]">
                        {p.createdAt ? new Date(p.createdAt).toLocaleString("bn-BD") : "-"}
                      </td>
                      <td className="p-4 text-center">
                        {activeTab === "pending" ? (
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => handleApprove(p)}
                              className="bg-emerald-500/10 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-md transition-colors font-bold cursor-pointer flex items-center gap-0.5"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> এপ্রুভ
                            </button>
                            <button
                              onClick={() => handleReject(p)}
                              className="bg-red-500/10 hover:bg-red-650 hover:text-white border border-red-500/20 text-red-400 px-2.5 py-1 rounded-md transition-colors font-bold cursor-pointer flex items-center gap-0.5"
                            >
                              <XCircle className="w-3.5 h-3.5" /> বাতিল
                            </button>
                          </div>
                        ) : (
                          <span
                            className={`font-semibold px-2 py-0.5 rounded text-[10px] uppercase tracking-wide inline-block leading-none ${
                              p.status === "approved"
                                ? "bg-emerald-555/15 text-emerald-400"
                                : "bg-red-500/15 text-red-400"
                            }`}
                          >
                            {p.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {toast && (
        <div id="payment-toast" className="fixed bottom-5 right-5 z-50 animate-bounce">
          <div className={`p-4 rounded-xl shadow-xl flex items-center gap-2 border text-xs font-semibold ${
            toast.type === "success" 
              ? "bg-emerald-950/95 text-emerald-400 border-emerald-500/30" 
              : "bg-red-950/95 text-red-400 border-red-500/30"
          }`}>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal && (
        <div id="payment-confirm-modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <h4 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              {confirmModal.actionType === "approve" ? (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
              {confirmModal.actionType === "approve" ? "পেমেন্ট অনুমোদন নিশ্চিতকরণ" : "পেমেন্ট বাতিল নিশ্চিতকরণ"}
            </h4>
            
            <p className="text-slate-300 text-xs leading-relaxed mb-4">
              {confirmModal.actionType === "approve" ? (
                (() => {
                  const p = confirmModal.payment;
                  const matchedCourse = findMatchedCourse(p, courses);
                  if (matchedCourse) {
                    return (
                      <>আপনি কি নিশ্চিত যে <span className="text-teal-400 font-bold select-all">{confirmModal.payment.email}</span> এর পেমেন্ট অনুমোদন করতে চান? এটি শিক্ষার্থীর আইডিতে সরাসরি <span className="text-teal-400 font-bold">"{matchedCourse.title}"</span> কোর্সটি সংযুক্ত করবে। এটি শিক্ষার্থীকে ফ্রি রোলে রেখে শুধুমাত্র এই নির্দিষ্ট কোর্সটির অ্যাক্সেস দিবে।</>
                    );
                  }
                  return (
                    <>আপনি কি নিশ্চিত যে <span className="text-teal-400 font-bold select-all">{confirmModal.payment.email}</span> এর পেমেন্ট অনুমোদন করতে চান? এটি শিক্ষার্থীর অ্যাকাউন্ট সরাসরি প্রিমিয়াম ক্যাটাগরিতে অন্তর্ভুক্ত করবে এবং তাদের প্রিমিয়াম ফিচারের অ্যাক্সেস দিবে।</>
                  );
                })()
              ) : (
                <>আপনি কি নিশ্চিত যে <span className="text-red-400 font-bold select-all">{confirmModal.payment.email}</span> এর পেমেন্ট বাতিল/রিজেক্ট করতে চান?</>
              )}
            </p>

            {confirmModal.actionType === "approve" && (
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-400 mb-5 space-y-1">
                <p>📦 <span className="font-semibold text-slate-300">আবেদনকৃত প্ল্যান/কোর্স:</span> {getPaymentTitle(confirmModal.payment, courses)}</p>
                {(() => {
                  const p = confirmModal.payment;
                  const matchedCourse = findMatchedCourse(p, courses);
                  if (matchedCourse) {
                    return (
                      <p className="bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2.5 py-1.5 rounded mt-2 text-[10px] font-bold">
                        🎯 সনাক্তকৃত কোর্স: {matchedCourse.title} (শিক্ষার্থী শুধুমাত্র এই কোর্সের অ্যাক্সেস পাবেন, তার রোল 'free' থাকবে)
                      </p>
                    );
                  } else {
                    return (
                      <p className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2.5 py-1.5 rounded mt-2 text-[10px] font-bold">
                        👑 সনাক্তকৃত প্ল্যান: সাইট-ওয়াইড প্রিমিয়াম সাবস্ক্রিপশন (শিক্ষার্থী প্রিমিয়াম রোল পাবেন)
                      </p>
                    );
                  }
                })()}
                <p className="pt-1.5">💳 <span className="font-semibold text-slate-300">ট্রানজেকশন ID:</span> <span className="text-teal-400 font-mono font-bold select-all">{confirmModal.payment.transactionId}</span></p>
                <p>💸 <span className="font-semibold text-slate-300">মেথড / গেটওয়ে:</span> {confirmModal.payment.method || "bKash"}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2 border-t border-slate-800/60">
              <button
                onClick={() => setConfirmModal(null)}
                className="bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
              >
                বন্ধ করুন
              </button>
              <button
                onClick={() => {
                  if (confirmModal.actionType === "approve") {
                    executeApprove(confirmModal.payment);
                  } else {
                    executeReject(confirmModal.payment);
                  }
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all text-white ${
                  confirmModal.actionType === "approve" 
                    ? "bg-emerald-650 hover:bg-emerald-550" 
                    : "bg-red-650 hover:bg-red-550"
                }`}
              >
                {confirmModal.actionType === "approve" ? "অনুমোদন করুন" : "বাতিল করুন"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
