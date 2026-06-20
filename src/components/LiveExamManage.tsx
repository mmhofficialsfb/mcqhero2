import React, { useState, useEffect } from "react";
import {
  Timer,
  Plus,
  Loader2,
  Trash2,
  Edit,
  Award,
  BookOpen,
  Calendar,
  Layers,
  HelpCircle,
  Eye,
  CheckSquare,
  Users,
  X,
  AlertTriangle,
  Search,
  Sparkles,
  Check,
  Copy
} from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { resolveApiUrl } from "../lib/api";
import { LiveExam, Course, SubCategory, Question, ExamResult } from "../types";

interface LiveExamManageProps {
  courses: Course[];
  subcategories: SubCategory[];
  triggerReload: () => void;
  exams: LiveExam[];
  isSandboxMode?: boolean;
}

export default function LiveExamManage({
  courses,
  subcategories,
  triggerReload,
  exams,
  isSandboxMode = false
}: LiveExamManageProps) {
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [duration, setDuration] = useState<number>(30);
  const [negativeMark, setNegativeMark] = useState<number>(0.25);
  const [access, setAccess] = useState<"free" | "premium">("free");
  const [status, setStatus] = useState<"running" | "upcoming" | "closed">("upcoming");
  const [selectedQuesIds, setSelectedQuesIds] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);

  // Question Pick Selector State
  const [pickSubId, setPickSubId] = useState("");
  const [questionsToPick, setQuestionsToPick] = useState<Question[]>([]);
  const [loadingPickQuestions, setLoadingPickQuestions] = useState(false);
  const [reviewPickedMode, setReviewPickedMode] = useState(false);

  // Results Leaderboard Viewer State
  const [viewingExamId, setViewingExamId] = useState<string | null>(null);
  const [viewingExamTitle, setViewingExamTitle] = useState("");
  const [examLeaderboard, setExamLeaderboard] = useState<ExamResult[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // QUESTION SELECTION TABS STATE (DATABASE & AI AUTO-GENERATE)
  const [mcqPickTab, setMcqPickTab] = useState<"manual" | "database" | "ai">("manual");

  // 1. Database Full Question Bank Search State
  const [dbSearchQuery, setDbSearchQuery] = useState("");
  const [dbSearchSubId, setDbSearchSubId] = useState("");
  const [dbQuestions, setDbQuestions] = useState<Question[]>([]);
  const [loadingDbQuestions, setLoadingDbQuestions] = useState(false);
  const [dbSelectedIds, setDbSelectedIds] = useState<string[]>([]);

  // 2. AI Auto-Generate Options State
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState<number>(5);
  const [aiSubId, setAiSubId] = useState("");
  const [generatingAi, setGeneratingAi] = useState(false);
  const [generatedAiQuests, setGeneratedAiQuests] = useState<Question[]>([]);
  const [aiSelectedIndices, setAiSelectedIndices] = useState<number[]>([]);

  // Load questions for picking
  const loadPickQuestions = async () => {
    if (!pickSubId) {
      setQuestionsToPick([]);
      return;
    }
    setLoadingPickQuestions(true);
    setReviewPickedMode(false);
    try {
      if (isSandboxMode) {
        const stored = localStorage.getItem("local_questions") || "[]";
        let list = JSON.parse(stored) as Question[];
        list = list.filter((q) => q.subId === pickSubId);
        setQuestionsToPick(list);
      } else {
        const qSnap = await getDocs(query(collection(db, "questions"), where("subId", "==", pickSubId)));
        const list = qSnap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Question)
        );
        setQuestionsToPick(list);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPickQuestions(false);
    }
  };

  // Load All Questions in Database for Broad Bulk Selection
  const loadAllDbQuestions = async (force = false) => {
    if (dbQuestions.length > 0 && !force) return;
    setLoadingDbQuestions(true);
    try {
      if (isSandboxMode) {
        const stored = localStorage.getItem("local_questions") || "[]";
        const parsed = JSON.parse(stored) as Question[];
        setDbQuestions(parsed);
      } else {
        const snap = await getDocs(collection(db, "questions"));
        const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Question));
        setDbQuestions(list);
      }
    } catch (err) {
      console.error("Error loading questions from database:", err);
    } finally {
      setLoadingDbQuestions(false);
    }
  };

  useEffect(() => {
    loadPickQuestions();
  }, [pickSubId]);

  // Load bulk questions automatically when switching to the Database tab
  useEffect(() => {
    if (mcqPickTab === "database") {
      loadAllDbQuestions();
    }
  }, [mcqPickTab]);

  // Auto pre-fill the AI sub-category if pickSubId or course's sub-category is selected
  useEffect(() => {
    if (pickSubId && !aiSubId) {
      setAiSubId(pickSubId);
    }
  }, [pickSubId]);

  // Handle Pick Toggle
  const togglePickQuestion = (qId: string) => {
    if (selectedQuesIds.includes(qId)) {
      setSelectedQuesIds(selectedQuesIds.filter((id) => id !== qId));
    } else {
      setSelectedQuesIds([...selectedQuesIds, qId]);
    }
  };

  // Bulk add questions chosen in the database search tab
  const handleAddSelectedDbQuestions = () => {
    if (dbSelectedIds.length === 0) {
      alert("অনুগ্রহ করে কমপক্ষে একটি প্রশ্ন নির্বাচন করুন।");
      return;
    }
    const merged = [...selectedQuesIds];
    let inserted = 0;
    dbSelectedIds.forEach((id) => {
      if (!merged.includes(id)) {
        merged.push(id);
        inserted++;
      }
    });
    setSelectedQuesIds(merged);
    setDbSelectedIds([]);
    alert(`সফলভাবে ${inserted}টি নতুন বাচাইকৃত প্রশ্ন এই লাইভ পরীক্ষায় যোগ করা হয়েছে!`);
  };

  // Call server-side API to generate questions with AI
  const handleGenerateAiQuestions = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!aiTopic.trim()) {
      alert("অনুগ্রহ করে একটি পরীক্ষার টপিক বা কিওয়ার্ড টাইপ করুন।");
      return;
    }
    setGeneratingAi(true);
    setGeneratedAiQuests([]);
    try {
      const response = await fetch(resolveApiUrl("/api/gemini/generate-questions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: aiTopic.trim(),
          count: aiCount
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Generation request failed");
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.questions)) {
        setGeneratedAiQuests(data.questions);
        setAiSelectedIndices(data.questions.map((_, i) => i)); // Default checked all
      } else {
        throw new Error("Invalid response format received from AI server");
      }
    } catch (err: any) {
      console.error(err);
      alert("AI প্রশ্ন উৎপাদনে ব্যর্থতা: " + err.message);
    } finally {
      setGeneratingAi(false);
    }
  };

  // Save checked AI questions to database & link them to this live exam
  const handleSaveAndAddGeneratedQuestions = async () => {
    if (aiSelectedIndices.length === 0) {
      alert("অনুগ্রহ করে কমপক্ষে একটি জেনারেটেড প্রশ্ন সিলেক্ট করুন।");
      return;
    }
    if (!aiSubId) {
      alert("অনুগ্রহ করে প্রশ্নগুলোর জন্য একটি সাব-ক্যাটাগরি নির্ধারণ করুন।");
      return;
    }

    setSaving(true);
    try {
      const targets = generatedAiQuests.filter((_, idx) => aiSelectedIndices.includes(idx));
      const newlyAddedIds: string[] = [];

      for (const q of targets) {
        const cleanQuest: Question = {
          subId: aiSubId,
          question: q.question,
          option1: q.option1,
          option2: q.option2,
          option3: q.option3,
          option4: q.option4,
          correctAnswer: Number(q.correctAnswer) || 1,
          explanation: q.explanation || "",
          explanationImg: "",
          access: "free",
          difficulty: "medium",
          examTag: "AI Gen: " + aiTopic.substring(0, 15),
          year: new Date().getFullYear().toString(),
          status: "approved"
        };

        if (isSandboxMode) {
          const stored = localStorage.getItem("local_questions") || "[]";
          const parsed = JSON.parse(stored) as Question[];
          const newId = "ai-q-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4);
          const fullQuestion = { ...cleanQuest, id: newId, createdAt: new Date().toISOString() };
          parsed.push(fullQuestion);
          localStorage.setItem("local_questions", JSON.stringify(parsed));
          newlyAddedIds.push(newId);
        } else {
          const firestoreDoc = {
            ...cleanQuest,
            createdAt: serverTimestamp()
          };
          const docRef = await addDoc(collection(db, "questions"), firestoreDoc);
          newlyAddedIds.push(docRef.id);
        }
      }

      // Add IDs to selection
      setSelectedQuesIds((prev) => {
        const result = [...prev];
        newlyAddedIds.forEach((id) => {
          if (!result.includes(id)) {
            result.push(id);
          }
        });
        return result;
      });

      // Reload
      triggerReload();
      loadPickQuestions();
      setGeneratedAiQuests([]);
      setAiSelectedIndices([]);
      alert(`সফলভাবে ${newlyAddedIds.length}টি এআই জেনারেটেড প্রশ্ন ডাটাবেজে যুক্ত করা হয়েছে এবং পরীক্ষায় সংযুক্ত করা হয়েছে!`);
    } catch (err: any) {
      console.error(err);
      alert("এআই প্রশ্ন সংরক্ষণ করতে সমস্যা হয়েছে: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Save/Update Exam
  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !courseId) {
      return alert("অনুগ্রহ করে পরীক্ষার নাম এবং টার্গেট কোর্স সিলেক্ট করুন");
    }
    if (selectedQuesIds.length === 0) {
      return alert("পরীক্ষায় যোগ করার জন্য অন্তত একটি প্রশ্ন নির্বাচন করুন");
    }

    setSaving(true);
    try {
      const eData: Partial<LiveExam> = {
        title: title.trim(),
        courseId,
        startTime,
        endTime,
        duration: Number(duration) || 30,
        negativeMark: Number(negativeMark) || 0.25,
        access,
        status,
        questionIds: selectedQuesIds,
      };

      if (isSandboxMode) {
        const stored = localStorage.getItem("local_exams") || "[]";
        const list = JSON.parse(stored) as LiveExam[];
        if (editingId) {
          const index = list.findIndex((ex) => ex.id === editingId);
          if (index !== -1) {
            list[index] = { ...list[index], ...eData } as LiveExam;
          }
          localStorage.setItem("local_exams", JSON.stringify(list));
          alert("পরীক্ষার কনফিগারেশন আপডেট সম্পন্ন হয়েছে! (স্যান্ডবক্স মোড)");
        } else {
          const newExam = { ...eData, id: "exam-" + Date.now() } as LiveExam;
          list.push(newExam);
          localStorage.setItem("local_exams", JSON.stringify(list));
          alert("নতুন লাইভ পরীক্ষা সফলভাবে শিডিউল করা হয়েছে! (স্যান্ডবক্স মোড)");
        }
      } else {
        const firestoreData = {
          ...eData,
          updatedAt: serverTimestamp()
        };

        if (editingId) {
          await updateDoc(doc(db, "live_exams", editingId), firestoreData);
          alert("পরীক্ষার কনফিগারেশন আপডেট সম্পন্ন হয়েছে!");
        } else {
          firestoreData.createdAt = serverTimestamp();
          await addDoc(collection(db, "live_exams"), firestoreData);
          alert("নতুন লাইভ পরীক্ষা সফলভাবে শিডিউল করা হয়েছে!");
        }
      }

      // Reset
      setEditingId(null);
      setTitle("");
      setStartTime("");
      setEndTime("");
      setDuration(30);
      setNegativeMark(0.25);
      setAccess("free");
      setStatus("upcoming");
      setSelectedQuesIds([]);
      setPickSubId("");
      triggerReload();
    } catch (err: any) {
      alert("পরীক্ষা সেভ করতে ব্যর্থ হয়েছে: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Edit Live Exam Trigger
  const triggerEditExam = (e: LiveExam) => {
    setEditingId(e.id || null);
    setTitle(e.title);
    setCourseId(e.courseId);
    setStartTime(e.startTime || "");
    setEndTime(e.endTime || "");
    setDuration(e.duration || 30);
    setNegativeMark(e.negativeMark || 0.25);
    setAccess(e.access || "free");
    setStatus(e.status || "upcoming");
    setSelectedQuesIds(e.questionIds || []);
    setPickSubId("");
    setReviewPickedMode(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteExam = (id: string) => {
    setConfirmConfig({
      title: "লাইভ পরীক্ষা মুছে ফেলার নিশ্চিতকরণ",
      description: "আপনি কি নিশ্চিতভাবে এই লাইভ মডেল টেস্টটি মুছে ফেলতে চান? একই সাথে সমস্ত শিক্ষার্থীর সংশ্লিষ্ট পরীক্ষার ট্র্যাকার ও সাবমিশন ডাটা চিরতরে মুছে ফেলা হতে পারে। এই কাজটি রিভার্স করা যাবে না।",
      onConfirm: async () => {
        try {
          if (isSandboxMode) {
            const stored = localStorage.getItem("local_exams") || "[]";
            const list = JSON.parse(stored) as LiveExam[];
            const updated = list.filter((ex) => ex.id !== id);
            localStorage.setItem("local_exams", JSON.stringify(updated));
            alert("পরীক্ষাটি সফলভাবে মুছে ফেলা হয়েছে! (স্যান্ডবক্স মোড)");
          } else {
            await deleteDoc(doc(db, "live_exams", id));
            alert("পরীক্ষাটি সফলভাবে মুছে ফেলা হয়েছে!");
          }
          triggerReload();
        } catch (err: any) {
          alert("ডিলিট ব্যর্থ: " + err.message);
        }
      }
    });
  };

  // View leaderboard scoring log
  const handleLoadLeaderboard = async (exam: LiveExam) => {
    if (!exam.id) return;
    setViewingExamId(exam.id);
    setViewingExamTitle(exam.title);
    setLoadingLeaderboard(true);
    try {
      let list: ExamResult[] = [];
      if (isSandboxMode) {
        const stored = localStorage.getItem("local_results") || "[]";
        const parsed = JSON.parse(stored) as ExamResult[];
        list = parsed.filter((r) => r.examId === exam.id);

        if (list.length === 0) {
          // Auto-generate realistic demo submissions on the fly so the user never sees an empty leaderboard in Sandbox Mode
          const numQuestions = exam.questionIds?.length || 20;
          const generatedMockResults: ExamResult[] = [
            {
              id: `res-mock-${exam.id}-1`,
              examId: exam.id,
              userId: "user-1",
              email: "ariful.islam@gmail.com",
              correct: Math.min(numQuestions, Math.round(numQuestions * 0.85)),
              wrong: Math.max(0, Math.round(numQuestions * 0.05)),
              score: Number((Math.min(numQuestions, Math.round(numQuestions * 0.85)) - Math.max(0, Math.round(numQuestions * 0.05)) * (exam.negativeMark || 0.25)).toFixed(2)),
              createdAt: "2026-06-18T08:00:00Z"
            },
            {
              id: `res-mock-${exam.id}-2`,
              examId: exam.id,
              userId: "user-2",
              email: "nusrat.jahan@yahoo.com",
              correct: Math.min(numQuestions, Math.round(numQuestions * 0.75)),
              wrong: Math.max(0, Math.round(numQuestions * 0.15)),
              score: Number((Math.min(numQuestions, Math.round(numQuestions * 0.75)) - Math.max(0, Math.round(numQuestions * 0.15)) * (exam.negativeMark || 0.25)).toFixed(2)),
              createdAt: "2026-06-18T08:15:00Z"
            },
            {
              id: `res-mock-${exam.id}-3`,
              examId: exam.id,
              userId: "user-3",
              email: "tasnim_bcs_aspirant@outlook.com",
              correct: Math.min(numQuestions, Math.round(numQuestions * 0.65)),
              wrong: Math.max(0, Math.round(numQuestions * 0.10)),
              score: Number((Math.min(numQuestions, Math.round(numQuestions * 0.65)) - Math.max(0, Math.round(numQuestions * 0.10)) * (exam.negativeMark || 0.25)).toFixed(2)),
              createdAt: "2026-06-18T08:30:00Z"
            },
            {
              id: `res-mock-${exam.id}-4`,
              examId: exam.id,
              userId: "user-4",
              email: "sadik.bcs_hero@gmail.com",
              correct: Math.min(numQuestions, Math.round(numQuestions * 0.50)),
              wrong: Math.max(0, Math.round(numQuestions * 0.20)),
              score: Number((Math.min(numQuestions, Math.round(numQuestions * 0.50)) - Math.max(0, Math.round(numQuestions * 0.20)) * (exam.negativeMark || 0.25)).toFixed(2)),
              createdAt: "2026-06-18T08:45:00Z"
            }
          ];

          const updatedResults = [...parsed, ...generatedMockResults];
          localStorage.setItem("local_results", JSON.stringify(updatedResults));
          list = generatedMockResults;
        }
      } else {
        const snap = await getDocs(query(collection(db, "exam_results"), where("examId", "==", exam.id)));
        list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ExamResult));
      }
      // Sort scores descending
      list.sort((a, b) => b.score - a.score);
      setExamLeaderboard(list);
    } catch (e) {
      console.error(e);
      alert("লিডারবোর্ড তথ্য লোড হতে পারেনি!");
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Create and edit form schema */}
      <form
        onSubmit={handleSaveExam}
        className={`bg-slate-800/60 p-6 rounded-2xl border ${
          editingId ? "border-orange-500 bg-orange-500/[0.02]" : "border-slate-705/50"
        } space-y-6 transition-colors`}
      >
        <div className="flex justify-between items-center border-b border-slate-700 pb-3">
          <h3 className="text-lg font-bold text-teal-400 flex items-center gap-2">
            <Timer className="w-5 h-5" />
            {editingId ? "লাইভ পরীক্ষা মডিফায়ার প্যানেল" : "নতুন লাইভ মডেল টেস্ট ক্রিয়েটর"}
          </h3>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setTitle("");
                setSelectedQuesIds([]);
              }}
              className="text-xs text-orange-400 font-bold border border-orange-500/20 bg-orange-500/5 px-2 py-1 rounded"
            >
              নতুন তৈরি করতে ফিরে যান
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-slate-300 text-xs font-semibold block mb-2">টার্গেট কোর্স *</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500 h-[44px]"
            >
              <option value="">কোর্স নির্ধারণ করুন</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-300 text-xs font-semibold block mb-2">পরীক্ষার শিরোনাম (Title) *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="যেমন: ৪৬তম বিসিএস প্রিলিমিনারি মডেল টেস্ট - ০১"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500 h-[44px]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-slate-300 text-xs font-semibold block mb-2">স্টার্ট উইন্ডো ডেট ও সময় (Start Window)</label>
            <input
              type="datetime-local"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-teal-500 h-[44px]"
            />
          </div>

          <div>
            <label className="text-slate-300 text-xs font-semibold block mb-2">শেষ উইন্ডো ডেট ও সময় (End Window)</label>
            <input
              type="datetime-local"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-teal-500 h-[44px]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="text-slate-300 text-xs font-semibold block mb-2">সময়কাল (মিনিট) *</label>
            <input
              type="number"
              required
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500 h-[44px]"
              placeholder="30"
              min={1}
            />
          </div>

          <div>
            <label className="text-slate-300 text-xs font-semibold block mb-2">ভুল উত্তরে নেগেটিভ মার্ক</label>
            <input
              type="number"
              step="0.05"
              required
              value={negativeMark}
              onChange={(e) => setNegativeMark(parseFloat(e.target.value) || 0.25)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500 h-[44px]"
              placeholder="0.25"
            />
          </div>

          <div>
            <label className="text-slate-300 text-xs font-semibold block mb-2">মডেল টেস্ট অ্যাক্সেস</label>
            <select
              value={access}
              onChange={(e) => setAccess(e.target.value as "free" | "premium")}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500 h-[44px]"
            >
              <option value="free">ফ্রি ইউজার</option>
              <option value="premium">প্রিমিয়াম ইউজার কেবল</option>
            </select>
          </div>

          <div>
            <label className="text-slate-300 text-xs font-semibold block mb-2">পরীক্ষা পরিস্থিতি স্ট্যাটাস</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "running" | "upcoming" | "closed")}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500 h-[44px]"
            >
              <option value="upcoming">আসন্ন (Upcoming)</option>
              <option value="running">লাইভ সচল (Running)</option>
              <option value="closed">বন্ধ (Closed)</option>
            </select>
          </div>
        </div>

        {/* Dynamic MCQ manual/database/ai picker tabs */}
        <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-700/60 space-y-5">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-800 pb-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <BookOpen className="w-4.5 h-4.5 text-teal-400" />
              লাইভ পরীক্ষার প্রশ্নাবলি অ্যাড প্যানেল
            </h4>
            <span className="text-xs font-semibold text-slate-300 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 self-start sm:self-auto">
              নির্বাচিত প্রশ্নের সংখ্যা:{" "}
              <b className="text-teal-400 font-display text-sm">{selectedQuesIds.length}</b> টি
            </span>
          </div>

          {/* Tab Selector Links */}
          <div className="flex bg-slate-950/70 p-1 rounded-xl border border-slate-800/80 gap-1">
            <button
              type="button"
              onClick={() => setMcqPickTab("manual")}
              className={`flex-1 py-2 text-center text-xs font-bold rounded-lg cursor-pointer transition-all ${
                mcqPickTab === "manual"
                  ? "bg-teal-500 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              ১. সাব-ক্যাটাগরি ভিত্তিক
            </button>
            <button
              type="button"
              onClick={() => setMcqPickTab("database")}
              className={`flex-1 py-2 text-center text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1 ${
                mcqPickTab === "database"
                  ? "bg-teal-500 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Search className="w-3 h-3" />
              ২. ডাটাবেজ সার্চ ও সংযোজন
            </button>
            <button
              type="button"
              onClick={() => setMcqPickTab("ai")}
              className={`flex-1 py-2 text-center text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1 ${
                mcqPickTab === "ai"
                  ? "bg-teal-500 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Sparkles className="w-3 h-3 text-yellow-300 animate-pulse" />
              ৩. AI অটো-জেনারেটর ✨
            </button>
          </div>

          {/* TAB 1: MANUAL PICKER TAB */}
          {mcqPickTab === "manual" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-[10px] uppercase font-bold tracking-wide block mb-1">
                    সাব-ক্যাটাগরি টাইপ দিয়ে ফিল্টার করুন
                  </label>
                  <select
                    value={pickSubId}
                    onChange={(e) => setPickSubId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-teal-400 h-[38px]"
                  >
                    <option value="">সাব-ক্যাটাগরি নির্বাচন করুন</option>
                    {subcategories.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end justify-end">
                  <button
                    type="button"
                    onClick={() => setReviewPickedMode(!reviewPickedMode)}
                    className={`py-2 px-4 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                      reviewPickedMode
                        ? "bg-teal-500 text-white border-teal-500"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    {reviewPickedMode ? "সকল প্রশ্নাবলি বাচাই করুন" : "বাচাইকৃত প্রশ্নসমূহ রিভিউ করুন"}
                  </button>
                </div>
              </div>

              {/* List display */}
              <div className="bg-slate-950/60 rounded-lg border border-slate-850 p-3 max-h-[220px] overflow-y-auto space-y-2">
                {loadingPickQuestions ? (
                  <div className="flex justify-center items-center py-10 gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                    <span className="text-xs text-slate-400">কোয়েশ্চন ব্যাংক লোড হচ্ছে...</span>
                  </div>
                ) : reviewPickedMode ? (
                  selectedQuesIds.length === 0 ? (
                    <div className="text-center py-12 text-xs text-slate-500">এখনো কোনো প্রশ্ন বাচাই করা হয়নি!</div>
                  ) : (
                    <div className="space-y-1.5">
                      <span className="text-slate-400 text-[10px] font-bold block mb-2">
                        শুধুমাত্র বাচাইকৃত প্রশ্ন তালিকা:
                      </span>
                      {selectedQuesIds.map((id, index) => (
                        <div
                          key={id}
                          className="p-2 bg-slate-900 rounded border border-slate-800 flex justify-between items-center text-xs text-slate-300"
                        >
                          <span className="truncate pr-4 select-none">
                            <b>{index + 1}.</b> Question ID: {id}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePickQuestion(id)}
                            className="text-red-500 hover:text-red-400 font-semibold"
                          >
                            রিমুভ
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                ) : questionsToPick.length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-500">
                    সাব-ক্যাটাগরি নির্বাচন করার পর প্রশ্নাবলি ট্র্যাকার এখানে সজ্জিত হবে।
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/60">
                    {questionsToPick.map((q) => {
                      const isChecked = selectedQuesIds.includes(q.id || "");
                      return (
                        <div
                          key={q.id}
                          onClick={() => q.id && togglePickQuestion(q.id)}
                          className="flex items-start gap-2.5 py-2 hover:bg-slate-900/40 cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // Implemented on container div click
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-300 font-medium leading-relaxed">{q.question}</p>
                            <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                              ID: {q.id} | ট্যাগ: {q.examTag || "N/A"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DATABASE BROAD SEARCH TAB */}
          {mcqPickTab === "database" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">প্রশ্ন বা ট্যাগ টাইপ করুন</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={dbSearchQuery}
                      onChange={(e) => setDbSearchQuery(e.target.value)}
                      placeholder="কীওয়ার্ড বা ট্যাগ সার্চ করুন... (যেমন: বাংলা)"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-teal-400 h-[38px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">সাব-ক্যাটাগরি ফিল্টার</label>
                  <select
                    value={dbSearchSubId}
                    onChange={(e) => setDbSearchSubId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-teal-400 h-[38px]"
                  >
                    <option value="">সকল সাব-ক্যাটাগরি</option>
                    {subcategories.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bulk selector list */}
              <div className="bg-slate-950/60 rounded-lg border border-slate-850 p-3 max-h-[250px] overflow-y-auto space-y-2">
                {loadingDbQuestions ? (
                  <div className="flex justify-center items-center py-10 gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                    <span className="text-xs text-slate-400">ডাটাবেজ থেকে সকল কোয়েশ্চন ব্যাংক লোড হচ্ছে...</span>
                  </div>
                ) : (
                  (() => {
                    const matched = dbQuestions.filter((q) => {
                      const textMatch = !dbSearchQuery.trim() || 
                        q.question.toLowerCase().includes(dbSearchQuery.toLowerCase()) ||
                        (q.examTag && q.examTag.toLowerCase().includes(dbSearchQuery.toLowerCase())) ||
                        (q.id && q.id.toLowerCase().includes(dbSearchQuery.toLowerCase()));
                      const subMatch = !dbSearchSubId || q.subId === dbSearchSubId;
                      return textMatch && subMatch;
                    });

                    if (matched.length === 0) {
                      return <div className="text-center py-12 text-xs text-slate-500">ডাটাবেজে কোনো মিল পাওয়া যায়নি!</div>;
                    }

                    return (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center py-1.5 border-b border-slate-800 text-[10px] text-slate-400 font-bold mb-2">
                          <span>প্রশ্ন তালিকা ({matched.length} টি মিল রয়েছে)</span>
                          <button
                            type="button"
                            onClick={() => {
                              const matchIds = matched.map((q) => q.id || "").filter(Boolean);
                              const alreadySelectedAll = matchIds.every((id) => dbSelectedIds.includes(id));
                              if (alreadySelectedAll) {
                                setDbSelectedIds((prev) => prev.filter((id) => !matchIds.includes(id)));
                              } else {
                                setDbSelectedIds((prev) => {
                                  const next = [...prev];
                                  matchIds.forEach((id) => {
                                    if (!next.includes(id)) next.push(id);
                                  });
                                  return next;
                                });
                              }
                            }}
                            className="text-teal-400 hover:underline cursor-pointer"
                          >
                            সব সিলেক্ট করুন/বাতিল করুন
                          </button>
                        </div>

                        {matched.map((q) => {
                          const isExamAttached = selectedQuesIds.includes(q.id || "");
                          const isChecked = dbSelectedIds.includes(q.id || "");
                          return (
                            <div
                              key={q.id}
                              className={`flex items-start gap-2.5 py-1.5 px-2 hover:bg-slate-900/40 rounded transition-colors ${
                                isExamAttached ? "opacity-60 bg-teal-500/5" : ""
                              }`}
                            >
                              {!isExamAttached ? (
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setDbSelectedIds((prev) => prev.filter((id) => id !== q.id));
                                    } else {
                                      setDbSelectedIds((prev) => [...prev, q.id || ""]);
                                    }
                                  }}
                                  className="mt-1 cursor-pointer"
                                />
                              ) : (
                                <span className="text-[10px] bg-teal-500/10 text-teal-400 border border-teal-500/20 px-1 py-0.5 rounded shrink-0 mt-0.5">
                                  যুক্ত আছে
                                </span>
                              )}
                              <div className="flex-1 min-w-0" onClick={() => {
                                if (!isExamAttached) {
                                  if (isChecked) {
                                    setDbSelectedIds((prev) => prev.filter((id) => id !== q.id));
                                  } else {
                                    setDbSelectedIds((prev) => [...prev, q.id || ""]);
                                  }
                                }
                              }} style={{ cursor: !isExamAttached ? "pointer" : "default" }}>
                                <p className="text-xs text-slate-300 font-medium leading-relaxed">{q.question}</p>
                                <div className="flex gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                                  <span>ID: {q.id}</span>
                                  <span>| সাব: {subcategories.find(s=>s.id === q.subId)?.name || "N/A"}</span>
                                  <span>| ট্যাগ: {q.examTag || "N/A"}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </div>

              {dbSelectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleAddSelectedDbQuestions}
                  className="w-full py-2.5 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-lg text-xs cursor-pointer shadow flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  বাচাইকৃত {dbSelectedIds.length}টি প্রশ্ন লাইভ পরীক্ষায় যুক্ত করুন
                </button>
              )}
            </div>
          )}

          {/* TAB 3: AI AUTO-GENERATOR TAB */}
          {mcqPickTab === "ai" && (
            <div className="space-y-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">
                      প্রশ্নপত্র তৈরির কিওয়ার্ড বা নির্দিষ্ট বিষয়বস্তু (Topic) *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={aiTopic}
                        onChange={(e) => setAiTopic(e.target.value)}
                        placeholder="যেমন: বাংলাদেশের প্রাচীন ইতিহাস, English Prepositions"
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-teal-400 h-[38px]"
                      />
                      {pickSubId && (
                        <button
                          type="button"
                          onClick={() => {
                            const matchedName = subcategories.find((s) => s.id === pickSubId)?.name;
                            if (matchedName) setAiTopic(matchedName);
                          }}
                          className="bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 text-[10px] font-bold px-2 rounded-lg cursor-pointer shrink-0 transition-colors"
                        >
                          সাব-ক্যাপ কো-অর্ডিনেট
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">প্রশ্নের সংখ্যা</label>
                    <select
                      value={aiCount}
                      onChange={(e) => setAiCount(Number(e.target.value) || 5)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-teal-400 h-[38px]"
                    >
                      <option value="2">২ টি প্রশ্ন</option>
                      <option value="5">৫ টি প্রশ্ন</option>
                      <option value="10">১০ টি প্রশ্ন</option>
                      <option value="15">১৫ টি প্রশ্ন</option>
                      <option value="20">২০ টি প্রশ্ন</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">
                      টার্গেট সাব-ক্যাটাগরি (যেখানে প্রশ্নগুলো সেভ হবে) *
                    </label>
                    <select
                      value={aiSubId}
                      onChange={(e) => setAiSubId(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-teal-400 h-[38px]"
                    >
                      <option value="">সাব-ক্যাটাগরি নির্ধারণ করুন</option>
                      {subcategories.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateAiQuestions}
                    disabled={generatingAi}
                    className="h-[38px] bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold rounded-lg text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow"
                  >
                    {generatingAi ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        AI তৈরি করছে...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4.5 h-4.5 text-yellow-300 fill-yellow-300" />
                        Gemini AI দিয়ে প্রশ্ন জেনারেট করুন
                      </>
                    )}
                  </button>
                </div>
              </div>

              {generatingAi && (
                <div className="bg-slate-950/40 p-10 rounded-lg border border-slate-850/60 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
                  <div className="text-center space-y-1">
                    <p className="text-xs text-white font-bold">গেমিনি ৩.১ লাইট এআই মডেল দিয়ে প্রশ্ন তৈরি করা হচ্ছে...</p>
                    <p className="text-[10px] text-slate-500">এতে ১০ থেকে ২০ সেকেন্ড সময় নিতে পারে, অনুগ্রহ করে এই উইন্ডোতেই থাকুন।</p>
                  </div>
                </div>
              )}

              {/* Generated list for review */}
              {generatedAiQuests.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-[11px] text-slate-300">
                      জেনারেট হওয়া প্রশ্ন: <b className="text-teal-400">{generatedAiQuests.length}</b> টি | বাচাইকৃত: <b className="text-teal-400">{aiSelectedIndices.length}</b> টি
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (aiSelectedIndices.length === generatedAiQuests.length) {
                          setAiSelectedIndices([]);
                        } else {
                          setAiSelectedIndices(generatedAiQuests.map((_, i) => i));
                        }
                      }}
                      className="text-[11px] text-teal-400 hover:underline cursor-pointer"
                    >
                      {aiSelectedIndices.length === generatedAiQuests.length ? "সব আনসিলেক্ট করুন" : "সব সিলেক্ট করুন"}
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {generatedAiQuests.map((q, idx) => {
                      const isChecked = aiSelectedIndices.includes(idx);
                      return (
                        <div key={idx} className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-xs space-y-3 relative">
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setAiSelectedIndices((prev) => prev.filter((i) => i !== idx));
                                } else {
                                  setAiSelectedIndices((prev) => [...prev, idx]);
                                }
                              }}
                              className="mt-0.5 cursor-pointer"
                            />
                            <div className="flex-1">
                              <p className="text-slate-200 font-bold leading-relaxed">
                                <b>{idx + 1}.</b> {q.question}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-5 text-[11px] text-slate-400">
                            <div className={`p-1.5 rounded border ${q.correctAnswer === 1 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-bold" : "bg-slate-950/20 border-slate-850"}`}>
                              ক) {q.option1}
                            </div>
                            <div className={`p-1.5 rounded border ${q.correctAnswer === 2 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-bold" : "bg-slate-950/20 border-slate-850"}`}>
                              খ) {q.option2}
                            </div>
                            <div className={`p-1.5 rounded border ${q.correctAnswer === 3 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-bold" : "bg-slate-950/20 border-slate-850"}`}>
                              গ) {q.option3}
                            </div>
                            <div className={`p-1.5 rounded border ${q.correctAnswer === 4 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-bold" : "bg-slate-950/20 border-slate-850"}`}>
                              ঘ) {q.option4}
                            </div>
                          </div>

                          {q.explanation && (
                            <div className="bg-teal-500/[0.03] border border-teal-500/10 p-2 rounded text-[11px] leading-relaxed text-slate-400 pl-5">
                              <b>ব্যাখ্যা:</b> {q.explanation}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveAndAddGeneratedQuestions}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs cursor-pointer shadow"
                  >
                    <CheckSquare className="w-4 h-4" />
                    বাচাইকৃত {aiSelectedIndices.length}টি প্রশ্ন ডাটাবেজে সেভ এবং লাইভ পরীক্ষায় যুক্ত করুন
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-teal-500/40 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-teal-500/20"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> পরীক্ষা শিডিউল সংরক্ষণ করা হচ্ছে...
            </>
          ) : editingId ? (
            "লাইভ পরীক্ষার মেটাডাটা আপডেট করুন"
          ) : (
            "নতুন লাইভ পরীক্ষাটি পাবলিশ করুন"
          )}
        </button>
      </form>

      {/* 2. List of Configured Live Exams */}
      <div className="space-y-4">
        <h4 className="text-md font-bold text-white flex items-center gap-1.5 pt-4">
          <Layers className="w-5 h-5 text-teal-400" />
          আসন্ন ও মেকড লাইভ মডেল টেস্ট সমূহ ({exams.length})
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {exams.map((e) => (
            <div
              key={e.id}
              className="bg-slate-800/40 rounded-2xl p-5 border border-slate-700/50 hover:border-slate-600 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <h5 className="text-white font-semibold text-sm leading-relaxed select-all">{e.title}</h5>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded text-[10px] uppercase tracking-wide leading-none ${
                      e.status === "running"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : e.status === "upcoming"
                        ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        : "bg-slate-900 text-slate-500"
                    }`}
                  >
                    {e.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-slate-600" />
                    প্রশ্ন: {e.questionIds?.length || 0} টি
                  </span>
                  <span className="flex items-center gap-1">
                    <Timer className="w-3.5 h-3.5 text-slate-600" />
                    সময়: {e.duration || 30} মিনিট
                  </span>
                  <span className="flex items-center gap-1 col-span-2 truncate">
                    <Calendar className="w-3.5 h-3.5 text-slate-600" />
                    শুরু: {e.startTime ? new Date(e.startTime).toLocaleString("bn-BD") : "-"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-700/40">
                <button
                  onClick={() => handleLoadLeaderboard(e)}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded flex items-center gap-1 cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5 text-teal-400" /> ফলাফল
                </button>
                <button
                  onClick={() => triggerEditExam(e)}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded flex items-center gap-1 cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5 text-amber-500" /> এডিট
                </button>
                <button
                  onClick={() => e.id && handleDeleteExam(e.id)}
                  className="bg-slate-900 hover:bg-red-650 border border-slate-700 hover:border-red-500 text-slate-400 hover:text-white text-xs font-semibold px-2.5 py-1.5 rounded flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> ডিলিট
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Leaderboard Diagnostics Overlap Overlay */}
      {viewingExamId && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 relative shadow-2xl space-y-4 flex flex-col max-h-[85vh]">
            <button
              onClick={() => setViewingExamId(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-700 pb-3 flex items-center gap-2">
              <Award className="w-5.5 h-5.5 text-yellow-500 animate-bounce" />
              <div>
                <h4 className="text-white font-bold text-sm sm:text-md select-all leading-snug">
                  পরীক্ষা ফলাফল ও মেধা তালিকা (Leaderboard)
                </h4>
                <p className="text-slate-400 text-xs mt-0.5">{viewingExamTitle}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {loadingLeaderboard ? (
                <div className="flex justify-center items-center py-20 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
                  <span className="text-xs text-slate-400 font-medium">ফলাফল কম্পাইল করা হচ্ছে...</span>
                </div>
              ) : examLeaderboard.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs">
                  এই লাইভ মডেল টেস্টে এখনো কোনো পরীক্ষার্থী অংশগ্রহণ করেনি!
                </div>
              ) : (
                <div className="bg-slate-900/50 rounded-xl border border-slate-800 divide-y divide-slate-805">
                  <div className="grid grid-cols-12 p-3 bg-slate-950 rounded-t-xl text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    <div className="col-span-2">র‍্যাংক #</div>
                    <div className="col-span-4">স্টুডেন্ট ইমেইল</div>
                    <div className="col-span-2 text-center">সঠিক / ভুল</div>
                    <div className="col-span-4 text-right">নেগেটিভ স্কোর</div>
                  </div>

                  {examLeaderboard.map((res, index) => {
                    let medal = "";
                    if (index === 0) medal = "🥇 ১ম";
                    else if (index === 1) medal = "🥈 ২য়";
                    else if (index === 2) medal = "🥉 ৩য়";
                    else medal = `# ${index + 1}`;

                    return (
                      <div
                        key={res.id}
                        className="grid grid-cols-12 p-3 text-xs items-center hover:bg-slate-900/40 text-slate-300"
                      >
                        <div className="col-span-2 font-bold text-teal-400">{medal}</div>
                        <div className="col-span-4 select-all text-white font-medium truncate">
                          {res.email || res.userId}
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="text-emerald-400 font-bold">{res.correct || 0}</span>
                          {" / "}
                          <span className="text-red-400 font-bold">{res.wrong || 0}</span>
                        </div>
                        <div className="col-span-4 text-right text-teal-400 font-display font-bold">
                          {Number(res.score || 0).toFixed(2)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-705">
              <button
                onClick={() => setViewingExamId(null)}
                className="bg-slate-700 hover:bg-slate-650 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors"
              >
                বন্ধ করুণ
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
