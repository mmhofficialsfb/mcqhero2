import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Question, QuestionReport } from "../types";
import {
  AlertTriangle,
  Trash2,
  Edit,
  User,
  Clock,
  Filter,
  HelpCircle,
  X,
  Check,
  RefreshCw,
  Search,
  BookOpen
} from "lucide-react";

interface QuestionReportManageProps {
  questions: Question[];
  triggerReload: () => void;
  isSandboxMode: boolean;
}

export default function QuestionReportManage({
  questions,
  triggerReload,
  isSandboxMode
}: QuestionReportManageProps) {
  const [reports, setReports] = useState<QuestionReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Question Edit Modal State
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editingQText, setEditingQText] = useState("");
  const [editingO1, setEditingO1] = useState("");
  const [editingO2, setEditingO2] = useState("");
  const [editingO3, setEditingO3] = useState("");
  const [editingO4, setEditingO4] = useState("");
  const [editingCorrect, setEditingCorrect] = useState<number>(1);
  const [editingExplanation, setEditingExplanation] = useState("");

  const loadReports = async () => {
    setLoading(true);
    try {
      if (isSandboxMode) {
        let stored = localStorage.getItem("local_question_reports");
        if (!stored) {
          // Prefill with realistic sandbox reports matching screenshot data types
          const defaultReports: QuestionReport[] = [
            {
              id: "report-1",
              questionId: questions[0]?.id || "question-demo-1",
              questionText: questions[0]?.question || "একটি ত্রিভুজের তিনটি কোণের অনুপাত ১:১:২ হলে ত্রিভুজটি কী ধরণের?",
              reporterEmail: "tareq.hossain@gmail.com",
              reportType: "প্রশ্ন বা তথ্যের অসংগতি (Information Inconsistency)",
              details: "চর্যাপদের মোট পদ সংখ্যা সাড়ে ছেচল্লিশটি, কিন্তু প্রশ্নে ছেচল্লিশটি সঠিক উত্তর হিসেবে দেওয়া আছে। দয়া করে সংশোধন করুন।",
              status: "pending",
              subject: "গাণিতিক যুক্তি ও মানসিক দক্ষতা",
              timestamp: new Date(Date.now() - 3600000 * 2).toISOString() // 2 hours ago
            },
            {
              id: "report-2",
              questionId: "qbank_def_6",
              questionText: "একটি ত্রিভুজের তিনটি কোণের অনুপাত ১:১:২ হলে ত্রিভুজটি কী ধরণের?",
              reporterEmail: "superadmin@gmail.com",
              reportType: "প্রশ্ন বা তথ্যের অসংগতি (Information Inconsistency)",
              details: "সঠিক করুন",
              status: "pending",
              subject: "গাণিতিক যুক্তি ও মানসিক দক্ষতা",
              timestamp: new Date(Date.now() - 3600000 * 5).toISOString() // 5 hours ago
            },
            {
              id: "report-3",
              questionId: questions[1]?.id || "question-demo-2",
              questionText: questions[1]?.question || "অপশনে শ্রীকৃষ্ণকীর্তন বানানটি টাইপিং মিস্টেক রয়েছে।",
              reporterEmail: "faria.islam99@yahoo.com",
              reportType: "বানান ভুল (Spelling/Typo)",
              details: "অপশনে 'শ্রীকৃষ্ণকীর্তন' বানানটি টাইপিং মিস্টেক রয়েছে।",
              status: "pending",
              subject: "বাংলা ভাষা ও সাহিত্য",
              timestamp: new Date(Date.now() - 3600000 * 12).toISOString() // 12 hours ago
            }
          ];
          localStorage.setItem("local_question_reports", JSON.stringify(defaultReports));
          stored = JSON.stringify(defaultReports);
        }
        setReports(JSON.parse(stored));
      } else {
        // Online Firebase Load using qbank_reports collection
        const snap = await getDocs(collection(db, "qbank_reports"));
        const rawReports = snap.docs.map(d => ({ ...d.data(), id: d.id } as QuestionReport));
        // Sort descending by timestamp
        rawReports.sort((a, b) => {
          const tA = a.timestamp?.seconds 
            ? a.timestamp.seconds * 1000 
            : a.timestamp?.toDate 
              ? a.timestamp.toDate().getTime() 
              : new Date(a.timestamp || 0).getTime();
          const tB = b.timestamp?.seconds 
            ? b.timestamp.seconds * 1000 
            : b.timestamp?.toDate 
              ? b.timestamp.toDate().getTime() 
              : new Date(b.timestamp || 0).getTime();
          return tB - tA;
        });
        setReports(rawReports);
      }
    } catch (e: any) {
      console.error("Error loading qbank_reports:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [questions]);

  // Handle Dismiss (Delete Report)
  const handleDismissReport = async (reportId: string) => {
    if (!confirm("আপনি কি এই রিপোর্টটি বাতিল করতে চান? এটি ডাটাবেজ থেকে মুছে যাবে।")) return;
    setLoading(true);
    try {
      if (isSandboxMode) {
        const stored = localStorage.getItem("local_question_reports") || "[]";
        const parsed = JSON.parse(stored) as QuestionReport[];
        const filtered = parsed.filter(r => r.id !== reportId);
        localStorage.setItem("local_question_reports", JSON.stringify(filtered));
        setReports(filtered);
        alert("রিপোর্টটি সফলভাবে ডিলিট করা হয়েছে! (স্যান্ডবক্স মোড)");
      } else {
        await deleteDoc(doc(db, "qbank_reports", reportId));
        alert("রিপোর্টটি সফলভাবে ডিলিট করা হয়েছে!");
        loadReports();
      }
      triggerReload();
    } catch (err: any) {
      alert("ব্যর্থ হয়েছে: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Open Edit Modal prefilled with question details
  const openEditModal = (report: QuestionReport, q: Question) => {
    setEditingReportId(report.id || null);
    setEditingQuestion(q);
    setEditingQText(q.question);
    setEditingO1(q.option1);
    setEditingO2(q.option2);
    setEditingO3(q.option3);
    setEditingO4(q.option4);
    setEditingCorrect(q.correctAnswer || 1);
    setEditingExplanation(q.explanation || "");
  };

  // Save the corrected question and automatically delete the report
  const handleSaveQuestionAndResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion?.id) return;
    
    setLoading(true);
    try {
      const payload = {
        question: editingQText.trim(),
        option1: editingO1.trim(),
        option2: editingO2.trim(),
        option3: editingO3.trim(),
        option4: editingO4.trim(),
        correctAnswer: Number(editingCorrect),
        explanation: editingExplanation.trim(),
        updatedAt: isSandboxMode ? new Date().toISOString() : serverTimestamp()
      };

      // 1. Update the Question
      if (isSandboxMode) {
        const localQ = localStorage.getItem("local_questions") || "[]";
        let parsedQ = JSON.parse(localQ) as any[];
        parsedQ = parsedQ.map(q => q.id === editingQuestion.id ? { ...q, ...payload } : q);
        localStorage.setItem("local_questions", JSON.stringify(parsedQ));
        
        // 2. Remove the Report (resolve)
        if (editingReportId) {
          const storedReports = localStorage.getItem("local_question_reports") || "[]";
          const filteredReports = (JSON.parse(storedReports) as QuestionReport[]).filter(r => r.id !== editingReportId);
          localStorage.setItem("local_question_reports", JSON.stringify(filteredReports));
          setReports(filteredReports);
        }
        alert("প্রশ্নটি সফলভাবে সংশোধন পরিবর্ধন এবং সমাধান করা হয়েছে! (স্যান্ডবক্স মোড)");
      } else {
        await updateDoc(doc(db, "questions", editingQuestion.id), payload);
        
        // 2. Delete the Report from qbank_reports (resolve)
        if (editingReportId) {
          await deleteDoc(doc(db, "qbank_reports", editingReportId));
        }
        alert("প্রশ্নটি সফলভাবে সংশোধন ও সমাধান করা হয়েছে!");
        loadReports();
      }

      setEditingQuestion(null);
      setEditingReportId(null);
      triggerReload();
    } catch (err: any) {
      alert("সংশোধন ব্যর্থ হয়েছে: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter reports
  const filteredReports = reports.filter(r => {
    // Reason / reportType filter
    if (filterType !== "all") {
      const rType = (r.reportType || "").toLowerCase();
      if (filterType === "wrong" && !rType.includes("wrong") && !rType.includes("ভুল উত্তর") && !rType.includes("অসংগতি") && !rType.includes("inconsistency")) return false;
      if (filterType === "spelling" && !rType.includes("spelling") && !rType.includes("typo") && !rType.includes("বানান")) return false;
    }
    // Search query matched with reporter email, details, subject, or question text
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchEmail = r.reporterEmail?.toLowerCase().includes(q);
      const matchDetails = r.details?.toLowerCase().includes(q);
      const matchType = r.reportType?.toLowerCase().includes(q);
      const matchSubject = r.subject?.toLowerCase().includes(q);
      const matchText = r.questionText?.toLowerCase().includes(q);
      return matchEmail || matchDetails || matchType || matchSubject || matchText;
    }
    return true;
  });

  // Calculate stats
  const pendingCount = reports.length;
  const spellingCount = reports.filter(r => (r.reportType || "").toLowerCase().includes("spelling") || (r.reportType || "").toLowerCase().includes("typo") || (r.reportType || "").toLowerCase().includes("বানান")).length;
  const wrongCount = reports.filter(r => (r.reportType || "").toLowerCase().includes("wrong") || (r.reportType || "").toLowerCase().includes("ভুল উত্তর") || (r.reportType || "").toLowerCase().includes("অসংগতি") || (r.reportType || "").toLowerCase().includes("inconsistency")).length;

  return (
    <div className="space-y-6" id="report-manage-container">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="report-stats">
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 flex items-center gap-4" id="total-pending-card">
          <div className="h-10 w-10 bg-rose-500/10 text-rose-400 rounded-xl flex items-center justify-center border border-rose-500/15">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">মোট পেন্ডিং রিপোর্ট</span>
            <span className="text-xl font-bold font-mono text-white">{pendingCount} টি</span>
          </div>
        </div>

        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 flex items-center gap-4" id="wrong-answer-card">
          <div className="h-10 w-10 bg-amber-500/10 text-amber-400 rounded-xl flex items-center justify-center border border-amber-500/15">
            <User className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">ভুল উত্তরের অভিযোগ</span>
            <span className="text-xl font-bold font-mono text-white">{wrongCount} টি</span>
          </div>
        </div>

        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 flex items-center gap-4" id="typo-report-card">
          <div className="h-10 w-10 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-500/15">
            <Filter className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">বানান ও টাইপো ভুল</span>
            <span className="text-xl font-bold font-mono text-white">{spellingCount} টি</span>
          </div>
        </div>

        <button
          onClick={loadReports}
          disabled={loading}
          id="refresh-reports-btn"
          className="bg-slate-900/40 hover:bg-slate-800/60 p-4 rounded-2xl border border-slate-850 cursor-pointer flex items-center justify-center gap-2 text-xs text-slate-300 font-bold hover:text-white transition-all group"
        >
          <RefreshCw className={`w-4 h-4 text-teal-400 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`} />
          <span>রিপোর্ট তালিকা রিফ্রেশ করুন</span>
        </button>
      </div>

      {/* Filter and Search actions */}
      <div className="bg-slate-900/30 p-4 rounded-2xl border border-slate-800/80 flex flex-col md:flex-row items-center gap-4 justify-between" id="report-filters">
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterType === "all" ? "bg-teal-500 text-white shadow" : "bg-slate-850 text-slate-400 hover:text-white"
            }`}
          >
            সব অভিযোগ ({pendingCount})
          </button>
          <button
            onClick={() => setFilterType("wrong")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterType === "wrong" ? "bg-indigo-600 text-white shadow" : "bg-slate-850 text-slate-400 hover:text-white"
            }`}
          >
            ভুল উত্তর/অসংগতি ({wrongCount})
          </button>
          <button
            onClick={() => setFilterType("spelling")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterType === "spelling" ? "bg-amber-600 text-white shadow" : "bg-slate-850 text-slate-400 hover:text-white"
            }`}
          >
            বানান ভুল ({spellingCount})
          </button>
        </div>

        {/* Searching */}
        <div className="relative w-full md:w-64" id="report-search-box">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ইমেইল, বিষয় বা বিবরণ সার্চ..."
            className="w-full bg-slate-950 border border-slate-800/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white outline-none focus:border-teal-500 h-[36px]"
          />
        </div>
      </div>

      {/* Main Reports List */}
      <div className="space-y-4" id="qbank-reports-list">
        {filteredReports.length === 0 ? (
          <div className="bg-slate-900/20 p-12 text-center rounded-2xl border border-slate-850 text-slate-500 text-xs">
            {loading ? (
              <div className="flex flex-col items-center gap-2 text-teal-400">
                <RefreshCw className="w-6 h-6 animate-spin" />
                <span>অভিযোগ তালিকা লোড হচ্ছে...</span>
              </div>
            ) : (
              "কোনো প্রশ্নের সংশোধন অভিযোগ পাওয়া যায়নি।"
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredReports.map((report) => {
              // Find the question matching this report
              const associatedQ = questions.find(q => q.id === report.questionId);
              
              // Handle Timestamp conversion cleanly
              let dateObj = new Date();
              if (report.timestamp) {
                if (report.timestamp.seconds) {
                  dateObj = new Date(report.timestamp.seconds * 1000);
                } else if (report.timestamp.toDate) {
                  dateObj = report.timestamp.toDate();
                } else {
                  dateObj = new Date(report.timestamp);
                }
              }

              return (
                <div
                  key={report.id}
                  className="bg-slate-900/40 rounded-2xl border border-slate-800/80 p-5 space-y-4 hover:border-slate-700/60 transition-all shadow-md group relative overflow-hidden"
                >
                  {/* Decorative warning corner */}
                  <div className="absolute top-0 right-0 h-10 w-10 bg-amber-500/5 rotate-45 translate-x-5 -translate-y-5" />

                  {/* Top line with metadata */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-rose-500/10 text-rose-400 border border-rose-500/15 text-[10px] px-2 py-0.5 rounded font-bold">
                        {report.reportType}
                      </span>
                      {report.subject && (
                        <span className="bg-teal-500/10 text-teal-400 border border-teal-500/15 text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          <span>{report.subject}</span>
                        </span>
                      )}
                      <span className="text-slate-500 text-[10px] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {dateObj.toLocaleString("bn-BD")}
                      </span>
                      <span className="text-slate-600 font-mono text-[9px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-900">
                        ID: {report.questionId}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {associatedQ ? (
                        <button
                          onClick={() => openEditModal(report, associatedQ)}
                          className="bg-teal-500/10 hover:bg-teal-500 hover:text-white text-teal-400 text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all h-[32px]"
                        >
                          <Edit className="w-3 h-3" />
                          <span>সংশোধন ও সমাধান</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
                          মূল প্রশ্নটি ডিলেট হয়েছে
                        </span>
                      )}
                      
                      <button
                        onClick={() => report.id && handleDismissReport(report.id)}
                        className="bg-slate-850 hover:bg-rose-950 hover:text-rose-400 text-slate-400 hover:border-rose-500/15 border border-transparent p-1.5 rounded-lg cursor-pointer transition-all h-[32px] w-[32px] flex items-center justify-center"
                        title="রিপোর্ট ডিলিট করুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Body content splitting reporter info and original question */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Reporter details */}
                    <div className="lg:col-span-5 space-y-2.5 p-3.5 bg-slate-950/40 rounded-xl border border-slate-850">
                      <div className="flex items-center gap-1.5 text-slate-300 font-semibold text-xs">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>অভিযোগকারী শিক্ষার্থী:</span>
                      </div>
                      <div className="text-teal-400 font-mono text-[11px] tracking-wide select-all">
                        {report.reporterEmail}
                      </div>

                      <div className="text-slate-200 text-xs font-medium leading-relaxed pt-2 border-t border-slate-800/40 pt-2">
                        <span className="text-slate-500 font-semibold text-[10px] block mb-1">শিক্ষার্থীর মন্তব্য/অনুরোধ:</span>
                        "{report.details || "কোনো ব্যাখ্যা বা মন্তব্য প্রদান করা হয়নি।"}"
                      </div>

                      {report.questionText && (
                        <div className="text-[10px] text-slate-400 bg-slate-950/50 p-2 rounded border border-slate-850 leading-relaxed font-sans">
                          <span className="text-slate-500 font-bold block text-[9px] mb-0.5">রিপোর্ট করার সময়ের প্রশ্ন টেক্সট:</span>
                          {report.questionText}
                        </div>
                      )}
                    </div>

                    {/* Question representation as-is in DB */}
                    <div className="lg:col-span-7 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-slate-300 font-semibold text-xs text-slate-400">
                        <HelpCircle className="w-3.5 h-3.5 text-teal-500" />
                        <span>সংশ্লিষ্ট লাইভ এমসিকিউ প্রশ্ন (লাইভ ভিউ):</span>
                      </div>

                      {associatedQ ? (
                        <div className="space-y-1.5">
                          <h4 className="text-xs font-bold text-slate-100 flex items-start gap-1 leading-relaxed">
                            <span className="text-teal-400 font-mono">Q.</span>
                            <span>{associatedQ.question}</span>
                          </h4>

                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className={`p-2 rounded-lg border ${
                              associatedQ.correctAnswer === 1 
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold" 
                                : "bg-slate-950/20 border-slate-850 text-slate-400"
                            }`}>
                              ১) {associatedQ.option1}
                            </div>
                            <div className={`p-2 rounded-lg border ${
                              associatedQ.correctAnswer === 2 
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold" 
                                : "bg-slate-950/20 border-slate-850 text-slate-400"
                            }`}>
                              ২) {associatedQ.option2}
                            </div>
                            <div className={`p-2 rounded-lg border ${
                              associatedQ.correctAnswer === 3 
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold" 
                                : "bg-slate-950/20 border-slate-850 text-slate-400"
                            }`}>
                              ৩) {associatedQ.option3}
                            </div>
                            <div className={`p-2 rounded-lg border ${
                              associatedQ.correctAnswer === 4 
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold" 
                                : "bg-slate-950/20 border-slate-850 text-slate-400"
                            }`}>
                              ৪) {associatedQ.option4}
                            </div>
                          </div>

                          {associatedQ.explanation && (
                            <div className="text-[10px] text-slate-400 bg-slate-950/10 px-2.5 py-1.5 rounded border border-slate-850/60 leading-relaxed truncate-2-lines" title={associatedQ.explanation}>
                              <strong className="text-slate-500">ব্যাখ্যা:</strong> {associatedQ.explanation}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-rose-400 bg-rose-500/5 p-3 rounded-xl border border-rose-500/10">
                          সংশ্লিষ্ট প্রশ্নটি ডাটাবেজে খুঁজে পাওয়া যায়নি। সম্ভবত এটি ইতিমধ্যে মুছে ফেলা হয়েছে।
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QUESTION CORRECTION MODAL (POPUP) */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" id="core-correction-modal">
          <div className="bg-slate-900 border border-slate-755 p-6 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl relative">
            <button
              onClick={() => {
                setEditingQuestion(null);
                setEditingReportId(null);
              }}
              title="Close modal"
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-teal-400 flex items-center gap-1.5" id="correction-title">
                <Edit className="w-5 h-5" />
                <span>প্রশ্ন সংশোধন ও সমাধান করুন</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                এখানে করা সংশোধনটি সরাসরি MCQ ডাটাবেজে সেভ হবে এবং অভিযোগ তালিকা থেকে এই রিপোর্টটি রিমুভ হবে।
              </p>
            </div>

            <form onSubmit={handleSaveQuestionAndResolve} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">প্রশ্ন কি? *</label>
                <textarea
                  required
                  value={editingQText}
                  onChange={(e) => setEditingQText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white outline-none focus:border-teal-500 leading-relaxed font-semibold"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">অপশন ১ *</label>
                  <input
                    type="text"
                    required
                    value={editingO1}
                    onChange={(e) => setEditingO1(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-teal-500 h-[38px]"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">অপশন ২ *</label>
                  <input
                    type="text"
                    required
                    value={editingO2}
                    onChange={(e) => setEditingO2(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-teal-500 h-[38px]"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">অপশন ৩ *</label>
                  <input
                    type="text"
                    required
                    value={editingO3}
                    onChange={(e) => setEditingO3(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-teal-500 h-[38px]"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">অপশন ৪ *</label>
                  <input
                    type="text"
                    required
                    value={editingO4}
                    onChange={(e) => setEditingO4(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-teal-500 h-[38px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1.5 text-teal-400 font-bold">সহজ নির্বাচন: সঠিক উত্তর নির্ধারণ করুন *</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map((num) => (
                      <button
                        type="button"
                        key={num}
                        onClick={() => setEditingCorrect(num)}
                        className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                          editingCorrect === num
                            ? "bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/10"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {num === 1 ? "১" : num === 2 ? "২" : num === 3 ? "৩" : "৪"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">বিশদ ব্যাখ্যা (Explanation)</label>
                  <textarea
                    value={editingExplanation}
                    onChange={(e) => setEditingExplanation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white outline-none focus:border-teal-500 h-[58px]"
                    placeholder="কেন এই উত্তরটি সঠিক, তার ব্যাখ্যা লিখুন"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setEditingQuestion(null);
                    setEditingReportId(null);
                  }}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold px-4 py-2.5 rounded-lg cursor-pointer h-[40px]"
                >
                  বাতিল করুন
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-lg cursor-pointer h-[40px] flex items-center gap-1.5 shadow"
                >
                  <Check className="w-4 h-4 font-bold" />
                  <span>সংরক্ষণ ও সমস্যার সমাধান</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
