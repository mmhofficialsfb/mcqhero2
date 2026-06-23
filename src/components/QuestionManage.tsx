import React, { useState, useEffect } from "react";
import {
  PlusCircle,
  Upload,
  Search,
  Sparkles,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  CheckCircle,
  FileSpreadsheet,
  Image as ImageIcon,
  ChevronDown,
  Loader2,
  BookOpen,
  Filter,
  Settings,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { db, uploadToCloudinary } from "../lib/firebase";
import { resolveApiUrl } from "../lib/api";
import { Category, SubCategory, Question } from "../types";
import * as XLSX from "xlsx";
import { getUserDailyUsageCount, incrementUserDailyUsage } from "../lib/usageTracker";

interface QuestionManageProps {
  categories: Category[];
  subcategories: SubCategory[];
  questionsCount: number;
  triggerReload: () => void;
  adminRole: "admin" | "moderator";
  allowedCategories?: string[];
  isSandboxMode?: boolean;
  userProfile?: any;
  globalNotice?: any;
}

export default function QuestionManage({
  categories,
  subcategories,
  questionsCount,
  triggerReload,
  adminRole,
  allowedCategories = [],
  isSandboxMode = false,
  userProfile,
  globalNotice
}: QuestionManageProps) {
  // Restricted access calculation
  const isRestricted = adminRole === "moderator" && allowedCategories && allowedCategories.length > 0;

  const allowedCats = isRestricted
    ? categories.filter((c) => allowedCategories.includes(c.id || ""))
    : categories;

  const allowedCatIds = allowedCats.map((c) => c.id || "").filter(Boolean);

  const allowedSubcats = isRestricted
    ? subcategories.filter((s) => allowedCatIds.includes(s.parentId))
    : subcategories;

  const allowedSubcatIds = allowedSubcats.map((s) => s.id || "").filter(Boolean);

  // Tabs
  const [activeTab, setActiveTab] = useState<"manual" | "excel" | "ai" | "ai_converter" | "search">("manual");
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [subId, setSubId] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [opt1, setOpt1] = useState("");
  const [opt2, setOpt2] = useState("");
  const [opt3, setOpt3] = useState("");
  const [opt4, setOpt4] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState<number>(1);
  const [explanation, setExplanation] = useState("");
  const [explainImg, setExplainImg] = useState<File | null>(null);
  const [explainImgUrl, setExplainImgUrl] = useState("");
  const [access, setAccess] = useState<"free" | "premium">("free");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [examTag, setExamTag] = useState("");
  const [year, setYear] = useState("");

  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  // Bulk Excel State
  const [excelSubId, setExcelSubId] = useState("");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  // AI Question Gen State
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState<number>(5);
  const [aiSubId, setAiSubId] = useState("");
  const [aiAccess, setAiAccess] = useState<"free" | "premium">("free");
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [aiExamTag, setAiExamTag] = useState("AI-Gen");
  const [aiYear, setAiYear] = useState(new Date().getFullYear().toString());
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiGeneratedQuestions, setAiGeneratedQuestions] = useState<any[]>([]);

  // Daily Usage Tracking
  const [dailyUsageCount, setDailyUsageCount] = useState<number>(0);

  useEffect(() => {
    const loadUsage = async () => {
      if (userProfile?.uid) {
        const count = await getUserDailyUsageCount(userProfile.uid, isSandboxMode);
        setDailyUsageCount(count);
      }
    };
    loadUsage();
  }, [userProfile, isSandboxMode]);

  // AI Paste-to-MCQ Parser State
  const [pastedRawText, setPastedRawText] = useState("");
  const [convertingPaste, setConvertingPaste] = useState(false);
  const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);
  const [aiConvSubId, setAiConvSubId] = useState("");
  const [aiConvAccess, setAiConvAccess] = useState<"free" | "premium">("free");
  const [aiConvDifficulty, setAiConvDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [aiConvExamTag, setAiConvExamTag] = useState("AI-Parsed");
  const [aiConvYear, setAiConvYear] = useState(new Date().getFullYear().toString());

  // Search & Manage Questions State
  const [filterSubId, setFilterSubId] = useState("");
  const [filterAccess, setFilterAccess] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  const [searching, setSearching] = useState(false);

  // Reset form helper
  const resetForm = () => {
    setEditingId(null);
    setQuestionText("");
    setOpt1("");
    setOpt2("");
    setOpt3("");
    setOpt4("");
    setCorrectAnswer(1);
    setExplanation("");
    setExplainImg(null);
    setExplainImgUrl("");
    setAccess("free");
    setDifficulty("easy");
    setExamTag("");
    setYear("");
  };

  // Upload explanation image
  const handleImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setExplainImg(e.target.files[0]);
    }
  };

  // Save manual/edit question
  const saveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subId) {
      alert("অনুগ্রহ করে একটি সাব-ক্যাটাগরি নির্বাচন করুন");
      return;
    }
    if (!questionText.trim()) {
      alert("প্রশ্নের মূল টেক্সট লিখুন");
      return;
    }

    setSaving(true);
    try {
      let finalImgUrl = explainImgUrl;
      if (explainImg) {
        setUploadingImg(true);
        try {
          finalImgUrl = await uploadToCloudinary(explainImg);
        } catch (err) {
          console.error("Cloudinary Upload Error:", err);
          alert("ইমেজ আপলোড ব্যর্থ হয়েছে। সাধারণ টেক্সট সহ প্রসেস করা হচ্ছে।");
        }
        setUploadingImg(false);
      }

      const qData: Question = {
        subId,
        question: questionText.trim(),
        option1: opt1.trim() || "-",
        option2: opt2.trim() || "-",
        option3: opt3.trim() || "-",
        option4: opt4.trim() || "-",
        correctAnswer,
        explanation: explanation.trim(),
        explanationImg: finalImgUrl,
        access,
        difficulty,
        examTag: examTag.trim(),
        year: year.trim(),
        status: adminRole === "admin" ? "approved" : "draft",
      };

      if (isSandboxMode) {
        const stored = localStorage.getItem("local_questions") || "[]";
        const list = JSON.parse(stored) as Question[];
        if (editingId) {
          const index = list.findIndex((q) => q.id === editingId);
          if (index !== -1) {
            list[index] = { ...list[index], ...qData };
          }
          localStorage.setItem("local_questions", JSON.stringify(list));
          alert("প্রশ্নটি সফলভাবে আপডেট করা হয়েছে! (স্যান্ডবক্স মোড)");
        } else {
          const newQ = { ...qData, id: "q-" + Date.now() };
          list.push(newQ);
          localStorage.setItem("local_questions", JSON.stringify(list));
          alert("প্রশ্নটি সফলভাবে ডাটাবেজে ধারণ করা হয়েছে! (স্যান্ডবক্স মোড)");
        }
      } else {
        // Check Duplicates for new entries in Firestore
        if (!editingId) {
          const qSnap = await getDocs(
            query(collection(db, "questions"), where("question", "==", questionText.trim()))
          );
          if (qSnap.size > 0) {
            const proceed = window.confirm(
              "সতর্কবার্তা: একই লেখার আরেকটি প্রশ্ন ইতিপূর্বে ডাটাবেজে রেকর্ড করা হয়েছে! তাও কি আপনি এটি যুক্ত করতে চান?"
            );
            if (!proceed) {
              setSaving(false);
              return;
            }
          }
        }

        const firestoreData = {
          ...qData,
          updatedAt: serverTimestamp(),
        };

        if (editingId) {
          await updateDoc(doc(db, "questions", editingId), firestoreData);
          alert("প্রশ্নটি সফলভাবে আপডেট করা হয়েছে!");
        } else {
          (firestoreData as any).createdAt = serverTimestamp();
          await addDoc(collection(db, "questions"), firestoreData);
          alert("প্রশ্নটি সফলভাবে ডাটাবেজে ধারণ করা হয়েছে!");
        }
      }

      resetForm();
      triggerReload();
      // If we were on search/edit inside search tab, go back to look at them
      if (editingId) {
        setActiveTab("search");
        loadQuestions();
      }
    } catch (error: any) {
      console.error(error);
      alert("সংরক্ষণ ব্যর্থ হয়েছে: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Prepare edit (supports both option schemes seamlessly)
  const triggerEdit = (q: Question) => {
    setEditingId(q.id || null);
    setSubId(q.subId);
    setQuestionText(q.question);
    
    // Support dual schemas
    setOpt1(q.option1 || (q as any).optA || "");
    setOpt2(q.option2 || (q as any).optB || "");
    setOpt3(q.option3 || (q as any).optC || "");
    setOpt4(q.option4 || (q as any).optD || "");

    // Support dual correctAnswer / correct schemas
    let correctNum = q.correctAnswer;
    if (!correctNum && (q as any).correct) {
      const correctStr = String((q as any).correct).trim().toUpperCase();
      if (correctStr === "A" || correctStr === "1") correctNum = 1;
      else if (correctStr === "B" || correctStr === "2") correctNum = 2;
      else if (correctStr === "C" || correctStr === "3") correctNum = 3;
      else if (correctStr === "D" || correctStr === "4") correctNum = 4;
      else correctNum = 1;
    }
    setCorrectAnswer(correctNum || 1);

    setExplanation(q.explanation || "");
    setExplainImgUrl(q.explanationImg || "");
    setAccess(q.access || "free");
    setDifficulty(q.difficulty || "easy");
    setExamTag(q.examTag || "");
    setYear(q.year || "");
    setActiveTab("manual");
  };

  // Delete question
  const deleteQuestion = (id: string) => {
    if (!id) {
      alert("প্রশ্নের আইডি পাওয়া যায়নি!");
      return;
    }
    setConfirmConfig({
      title: "প্রশ্ন মুছে ফেলার নিশ্চিতকরণ",
      description: "আপনি কি নিশ্চিতভাবে এই প্রশ্নটি ডিলিট করতে চান? এই অপারেশনের পর প্রশ্নটি ডাটাবেজ থেকে চিরতরে মুছে যাবে এবং তা আর পুনরুদ্ধার করা সম্ভব হবে না।",
      onConfirm: async () => {
        // Optimistic UI update for instant visual feedback
        setFilteredQuestions((prev) => prev.filter((q) => q.id !== id && (q as any).uid !== id));
        
        try {
          if (isSandboxMode) {
            const stored = localStorage.getItem("local_questions") || "[]";
            let list = JSON.parse(stored) as Question[];
            // Assign IDs to elements mapping index if lacking, so filter matches correctly
            list = list.map((item: any, idx) => ({
              ...item,
              id: item.id || item.uid || `q-temp-${idx}`,
            }));
            const updated = list.filter((q) => q.id !== id && (q as any).uid !== id);
            localStorage.setItem("local_questions", JSON.stringify(updated));
            alert("ডিলিট সম্পন্ন হয়েছে! (স্যান্ডবক্স মোড)");
          } else {
            await deleteDoc(doc(db, "questions", id));
            alert("ডিলিট সম্পন্ন হয়েছে!");
          }
          loadQuestions();
          triggerReload();
        } catch (err: any) {
          alert("ব্যর্থ হয়েছে: " + err.message);
          // Revert optimistic UI on error
          loadQuestions();
        }
      }
    });
  };

  // Excel Upload Parser
  const handleExcelUpload = async () => {
    if (!excelFile) {
      alert("Excel ফাইল সিলেক্ট করুন");
      return;
    }
    if (!excelSubId) {
      alert("সাব-ক্যাটাগরি গ্রুপ নির্বাচন করুন");
      return;
    }

    setBulkSaving(true);
    setBulkStatus("ফাইল রিড করা হচ্ছে...");
    try {
      const data = await excelFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (rows.length === 0) {
        throw new Error("ফাইলটিতে কোনো ডাটা পাওয়া যায়নি");
      }

      setBulkStatus(`সর্বমোট ${rows.length}টি প্রশ্ন পাওয়া গেছে। আপলোড শুরু হচ্ছে...`);

      let successCount = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const question = row.question || row.Question || "";
        const option1 = row.option1 || row.Option1 || "";
        const option2 = row.option2 || row.Option2 || "";
        const option3 = row.option3 || row.Option3 || "";
        const option4 = row.option4 || row.Option4 || "";
        const correctVal = row.correctAnswer || row.CorrectAnswer || row.correct || row.answer || 1;
        const explanationVal = row.explanation || row.Explanation || "";
        const tagVal = row.examTag || row.tag || "";
        const yearVal = row.year || "";
        const difficultyVal = row.difficulty || "easy";
        const accessVal = row.access || "free";

        if (!question.trim()) continue;

        if (isSandboxMode) {
          const current = localStorage.getItem("local_questions") || "[]";
          const parsed = JSON.parse(current) as Question[];
          parsed.push({
            id: "q-" + Date.now() + "-" + i,
            subId: excelSubId,
            question: question.trim(),
            option1: String(option1).trim(),
            option2: String(option2).trim(),
            option3: String(option3).trim(),
            option4: String(option4).trim(),
            correctAnswer: Number(correctVal) || 1,
            explanation: String(explanationVal).trim(),
            explanationImg: "",
            access: accessVal === "premium" ? "premium" : "free",
            difficulty: ["easy", "medium", "hard"].includes(difficultyVal) ? difficultyVal : "easy",
            examTag: String(tagVal).trim(),
            year: String(yearVal).trim(),
            status: adminRole === "admin" ? "approved" : "draft",
          } as Question);
          localStorage.setItem("local_questions", JSON.stringify(parsed));
        } else {
          await addDoc(collection(db, "questions"), {
            subId: excelSubId,
            question: question.trim(),
            option1: String(option1).trim(),
            option2: String(option2).trim(),
            option3: String(option3).trim(),
            option4: String(option4).trim(),
            correctAnswer: Number(correctVal) || 1,
            explanation: String(explanationVal).trim(),
            explanationImg: "",
            access: accessVal === "premium" ? "premium" : "free",
            difficulty: ["easy", "medium", "hard"].includes(difficultyVal) ? difficultyVal : "easy",
            examTag: String(tagVal).trim(),
            year: String(yearVal).trim(),
            status: adminRole === "admin" ? "approved" : "draft",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        successCount++;
        setBulkStatus(`প্রসেস হচ্ছে: ${successCount}/${rows.length}`);
      }

      setBulkStatus(`সফলভাবে ${successCount}টি প্রশ্ন ডাটাবেজে যুক্ত করা হয়েছে!`);
      setExcelFile(null);
      triggerReload();
    } catch (err: any) {
      console.error(err);
      setBulkStatus("ত্রুটি: " + err.message);
    } finally {
      setBulkSaving(false);
    }
  };

  // AI Generation Trigger
  const generateAIQuestions = async () => {
    const limit = globalNotice?.dailyQuestionLimit !== undefined ? globalNotice.dailyQuestionLimit : 15;
    if (dailyUsageCount >= limit) {
      alert("আজকের জন্য আপনার প্রশ্ন লিমিট শেষ হয়েছে। অনুগ্রহ করে আগামীকাল চেষ্টা করুন।");
      return;
    }

    if (!aiTopic.trim()) {
      alert("দয়া করে যেকোনো একটি বিষয়/টপিক লিখুন (যেমন: 'নজরুলের কাব্যগ্রন্থ' বা 'চলতি লাভ ক্ষতি')");
      return;
    }
    if (!aiSubId) {
      alert("উৎপন্ন প্রশ্নগুলো যে সাব-ক্যাটাগরিতে সেভ করবেন তা সিলেক্ট করুন");
      return;
    }

    setGeneratingAI(true);
    setAiGeneratedQuestions([]);
    try {
      const resp = await fetch(resolveApiUrl("/api/gemini/generate-questions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: aiTopic, count: aiCount }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Generation crashed");

      // Increment user daily count on successful API call
      if (userProfile?.uid) {
        const newCount = await incrementUserDailyUsage(userProfile.uid, isSandboxMode);
        setDailyUsageCount(newCount);
      }

      if (data.questions && Array.isArray(data.questions)) {
        // Query database to prevent showing/saving raw duplicates
        const processedQuestions = [];
        let duplicateCount = 0;

        if (isSandboxMode) {
          const current = localStorage.getItem("local_questions") || "[]";
          const parsed = JSON.parse(current) as Question[];
          const questionTexts = new Set(parsed.map(q => (q.question || "").trim().toLowerCase()));

          for (const q of data.questions) {
            const qTextClean = (q.question || "").trim();
            if (!qTextClean) continue;

            if (!questionTexts.has(qTextClean.toLowerCase())) {
              processedQuestions.push(q);
            } else {
              duplicateCount++;
            }
          }
        } else {
          for (const q of data.questions) {
            const qTextClean = (q.question || "").trim();
            if (!qTextClean) continue;

            try {
              const qSnap = await getDocs(
                query(collection(db, "questions"), where("question", "==", qTextClean))
              );
              if (qSnap.size === 0) {
                processedQuestions.push(q);
              } else {
                duplicateCount++;
              }
            } catch (err) {
              console.warn("Firestore duplicate check failed for: ", qTextClean, err);
              // Gracefully fall back so the generation feature doesn't crash completely
              processedQuestions.push(q);
            }
          }
        }

        if (processedQuestions.length === 0) {
          alert("দুঃখিত! এআই দ্বারা জেনারেট করা সকল প্রশ্ন ইতিমধ্যে আপনার ডাটাবেজে বিদ্যমান রয়েছে। দয়া করে ভিন্ন সুনির্দিষ্ট কোনো টপিক দিয়ে আবার চেষ্টা করুন।");
        } else if (duplicateCount > 0) {
          alert(`সফলতা! জেনারেট করা প্রশ্নের মধ্যে ${duplicateCount}টি ডুপ্লিকেট প্রশ্ন ডাটাবেজে আগে থেকেই থাকায় সম্পূর্ণ বাদ দেওয়া হয়েছে এবং নতুন ${processedQuestions.length}টি অনন্য প্রশ্ন রিভিয়ু তালিকায় যোগ করা হয়েছে।`);
        } else {
          alert("সুন্দর! জেনারেট করা সবগুলো নতুন অনন্য প্রশ্ন রিভিয়ু তালিকায় যোগ করা হয়েছে।");
        }

        setAiGeneratedQuestions(processedQuestions);
      } else {
        throw new Error("Gemini returned invalid questions dataset shape");
      }
    } catch (e: any) {
      alert("AI জেনারেট ত্রুটি: " + e.message);
    } finally {
      setGeneratingAI(false);
    }
  };

  // Save generated question to DB individually or all
  const saveAIGeneratedSingle = async (q: any, index: number) => {
    try {
      const payload = {
        subId: aiSubId,
        question: q.question,
        option1: q.option1,
        option2: q.option2,
        option3: q.option3,
        option4: q.option4,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        explanationImg: "",
        access: aiAccess,
        difficulty: aiDifficulty,
        examTag: aiExamTag.trim() || "AI-Gen",
        year: aiYear.trim() || new Date().getFullYear().toString(),
        status: adminRole === "admin" ? "approved" : "draft",
      };

      if (isSandboxMode) {
        const current = localStorage.getItem("local_questions") || "[]";
        const parsed = JSON.parse(current) as Question[];
        parsed.push({ id: "q-" + Date.now(), ...payload } as Question);
        localStorage.setItem("local_questions", JSON.stringify(parsed));
        alert("প্রশ্নটি ডিরেক্ট সেভ করা হয়েছে! (স্যান্ডবক্স মোড)");
      } else {
        await addDoc(collection(db, "questions"), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        alert("প্রশ্নটি ডিরেক্ট সেভ করা হয়েছে!");
      }

      // Remove from generated array state
      setAiGeneratedQuestions((prev) => prev.filter((_, idx) => idx !== index));
      triggerReload();
    } catch (err: any) {
      alert("সেভ ব্যর্থ: " + err.message);
    }
  };

  const saveAllAIGenerated = async () => {
    if (aiGeneratedQuestions.length === 0) return;
    setGeneratingAI(true);
    let count = 0;
    try {
      if (isSandboxMode) {
        const current = localStorage.getItem("local_questions") || "[]";
        const parsed = JSON.parse(current) as Question[];
        for (const q of aiGeneratedQuestions) {
          parsed.push({
            id: "q-" + Date.now() + "-" + count,
            subId: aiSubId,
            question: q.question,
            option1: q.option1,
            option2: q.option2,
            option3: q.option3,
            option4: q.option4,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            explanationImg: "",
            access: aiAccess,
            difficulty: aiDifficulty,
            examTag: aiExamTag.trim() || "AI-Gen",
            year: aiYear.trim() || new Date().getFullYear().toString(),
            status: adminRole === "admin" ? "approved" : "draft",
          } as Question);
          count++;
        }
        localStorage.setItem("local_questions", JSON.stringify(parsed));
      } else {
        for (const q of aiGeneratedQuestions) {
          await addDoc(collection(db, "questions"), {
            subId: aiSubId,
            question: q.question,
            option1: q.option1,
            option2: q.option2,
            option3: q.option3,
            option4: q.option4,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            explanationImg: "",
            access: aiAccess,
            difficulty: aiDifficulty,
            examTag: aiExamTag.trim() || "AI-Gen",
            year: aiYear.trim() || new Date().getFullYear().toString(),
            status: adminRole === "admin" ? "approved" : "draft",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          count++;
        }
      }
      setAiGeneratedQuestions([]);
      triggerReload();
      alert(`সবগুলো (${count}টি) প্রশ্ন সফলভাবে ক্যাটাগরিতে সেভ হয়েছে!`);
    } catch (e: any) {
      alert("কিছু প্রশ্ন সেভ করার সময় ত্রুটি ঘটেছে: " + e.message);
    } finally {
      setGeneratingAI(false);
    }
  };

  // AI Paste MCQ Parser
  const parsePastedQuestionAI = async () => {
    const limit = globalNotice?.dailyQuestionLimit !== undefined ? globalNotice.dailyQuestionLimit : 15;
    if (dailyUsageCount >= limit) {
      alert("আজকের জন্য আপনার প্রশ্ন লিমিট শেষ হয়েছে। অনুগ্রহ করে আগামীকাল চেষ্টা করুন।");
      return;
    }

    if (!pastedRawText.trim()) {
      alert("দয়া করে প্রশ্ন, অপশন ও সঠিক উত্তর এক সাথে পেস্ট করুন।");
      return;
    }

    setConvertingPaste(true);
    setParsedQuestions([]);
    try {
      const resp = await fetch(resolveApiUrl("/api/gemini/parse-pasted-question"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: pastedRawText }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Parsing failed");

      // Increment user daily count on successful parsing API call
      if (userProfile?.uid) {
        const newCount = await incrementUserDailyUsage(userProfile.uid, isSandboxMode);
        setDailyUsageCount(newCount);
      }

      if (data.questions && Array.isArray(data.questions)) {
        const processedQuestions = [];
        let duplicateCount = 0;

        if (isSandboxMode) {
          const current = localStorage.getItem("local_questions") || "[]";
          const parsed = JSON.parse(current) as Question[];
          const questionTexts = new Set(parsed.map(q => (q.question || "").trim().toLowerCase()));

          for (const q of data.questions) {
            const qTextClean = (q.question || "").trim();
            if (!qTextClean) continue;

            if (!questionTexts.has(qTextClean.toLowerCase())) {
              processedQuestions.push(q);
            } else {
              duplicateCount++;
            }
          }
        } else {
          for (const q of data.questions) {
            const qTextClean = (q.question || "").trim();
            if (!qTextClean) continue;

            try {
              const qSnap = await getDocs(
                query(collection(db, "questions"), where("question", "==", qTextClean))
              );
              if (qSnap.size === 0) {
                processedQuestions.push(q);
              } else {
                duplicateCount++;
              }
            } catch (err) {
              console.warn("Firestore duplicate check failed for: ", qTextClean, err);
              processedQuestions.push(q);
            }
          }
        }

        if (processedQuestions.length === 0) {
          alert("দুঃখিত! পার্স করা প্রশ্নের সবগুলো ইতিমধ্যে আপনার ডাটাবেজে বিদ্যমান রয়েছে।");
        } else if (duplicateCount > 0) {
          alert(`সফলতা! পার্স করা প্রশ্নের মধ্যে ${duplicateCount}টি ডুপ্লিকেট প্রশ্ন ডাটাবেজে আগে থেকেই থাকায় সম্পূর্ণ বাদ দেওয়া হয়েছে এবং নতুন ${processedQuestions.length}টি MCQ প্রশ্ন রিভিয়ু তালিকায় যোগ করা হয়েছে।`);
        } else {
          alert("সফলতা! এআই সফলভাবে আপনার পেস্ট করা টেক্সট থেকে MCQ প্রশ্নটি পার্স অ্যান্ড অবজেক্টিফাই করেছে। নিচের তালিকায় চেক করুন।");
        }

        setParsedQuestions(processedQuestions);
      } else {
        throw new Error("Gemini returned invalid dataset shape for parser");
      }
    } catch (e: any) {
      alert("AI পার্সার ব্যর্থ হয়েছে: " + e.message);
    } finally {
      setConvertingPaste(false);
    }
  };

  const saveParsedSingle = async (q: any, index: number) => {
    if (!aiConvSubId) {
      alert("অনুগ্রহ করে একটি সাব-ক্যাটাগরি নির্বাচন করুন যেখানে প্রশ্নটি সেভ হবে।");
      return;
    }
    try {
      const payload = {
        subId: aiConvSubId,
        question: q.question,
        option1: q.option1,
        option2: q.option2,
        option3: q.option3,
        option4: q.option4,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        explanationImg: "",
        access: aiConvAccess,
        difficulty: aiConvDifficulty,
        examTag: aiConvExamTag.trim() || "AI-Parsed",
        year: aiConvYear.trim() || new Date().getFullYear().toString(),
        status: adminRole === "admin" ? "approved" : "draft",
      };

      if (isSandboxMode) {
        const current = localStorage.getItem("local_questions") || "[]";
        const parsed = JSON.parse(current) as Question[];
        parsed.push({ id: "q-" + Date.now(), ...payload } as Question);
        localStorage.setItem("local_questions", JSON.stringify(parsed));
        alert("প্রশ্নটি ডিরেক্ট সেভ করা হয়েছে! (স্যান্ডবক্স মোড)");
      } else {
        await addDoc(collection(db, "questions"), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        alert("প্রশ্নটি সফলভাবে ডাটাবেজে যুক্ত করা হয়েছে!");
      }

      setParsedQuestions((prev) => prev.filter((_, idx) => idx !== index));
      triggerReload();
    } catch (err: any) {
      alert("সেভ ব্যর্থ: " + err.message);
    }
  };

  const saveAllParsed = async () => {
    if (parsedQuestions.length === 0) return;
    if (!aiConvSubId) {
      alert("অনুগ্রহ করে একটি সাব-ক্যাটাগরি নির্বাচন করুন যেখানে সব প্রশ্ন সেভ হবে।");
      return;
    }
    setConvertingPaste(true);
    let count = 0;
    try {
      if (isSandboxMode) {
        const current = localStorage.getItem("local_questions") || "[]";
        const parsed = JSON.parse(current) as Question[];
        for (const q of parsedQuestions) {
          parsed.push({
            id: "q-" + Date.now() + "-" + count,
            subId: aiConvSubId,
            question: q.question,
            option1: q.option1,
            option2: q.option2,
            option3: q.option3,
            option4: q.option4,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            explanationImg: "",
            access: aiConvAccess,
            difficulty: aiConvDifficulty,
            examTag: aiConvExamTag.trim() || "AI-Parsed",
            year: aiConvYear.trim() || new Date().getFullYear().toString(),
            status: adminRole === "admin" ? "approved" : "draft",
          } as Question);
          count++;
        }
        localStorage.setItem("local_questions", JSON.stringify(parsed));
      } else {
        for (const q of parsedQuestions) {
          await addDoc(collection(db, "questions"), {
            subId: aiConvSubId,
            question: q.question,
            option1: q.option1,
            option2: q.option2,
            option3: q.option3,
            option4: q.option4,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            explanationImg: "",
            access: aiConvAccess,
            difficulty: aiConvDifficulty,
            examTag: aiConvExamTag.trim() || "AI-Parsed",
            year: aiConvYear.trim() || new Date().getFullYear().toString(),
            status: adminRole === "admin" ? "approved" : "draft",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          count++;
        }
      }
      alert(`সফলতা! সব মিলিয়ে ${count}টি অবজেক্টিভ প্রশ্ন সফলভাবে আপনার নির্ধারিত সাব-ক্যাটাগরিতে সংরক্ষণ করা হয়েছে।`);
      setParsedQuestions([]);
      setPastedRawText("");
      triggerReload();
    } catch (err: any) {
      alert("বাল্ক সেভ ব্যর্থ হয়েছে: " + err.message);
    } finally {
      setConvertingPaste(false);
    }
  };

  const updateParsedQuestionField = (index: number, field: string, value: any) => {
    setParsedQuestions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Load questions by customized filters
  const loadQuestions = async () => {
    setSearching(true);
    try {
      let list: Question[] = [];

      if (isSandboxMode) {
        // Read directly from offline memory
        const stored = localStorage.getItem("local_questions") || "[]";
        list = JSON.parse(stored) as Question[];
        list = list.map((item: any, idx) => ({
          ...item,
          id: item.id || item.uid || `q-temp-${idx}`,
        }));
      } else {
        let qRef = collection(db, "questions");
        const snaps = await getDocs(qRef);

        list = snaps.docs.map((doc) => {
          const data = doc.data();
          return {
            ...(data as any),
            id: doc.id,
          };
        });
      }

      setAllQuestions(list);
    } catch (err) {
      console.error(err);
      alert("প্রশ্ন লোড করতে ব্যর্থ হয়েছে!");
    } finally {
      setSearching(false);
    }
  };

  // Real-time filtering in-memory
  useEffect(() => {
    let list = [...allQuestions];

    if (filterSubId) {
      list = list.filter((q) => q.subId === filterSubId);
    }
    if (filterAccess) {
      list = list.filter((q) => q.access === filterAccess);
    }
    if (filterDifficulty) {
      list = list.filter((q) => q.difficulty === filterDifficulty);
    }
    if (filterYear.trim()) {
      list = list.filter((q) => q.year?.includes(filterYear.trim()));
    }
    if (filterTag.trim()) {
      list = list.filter((q) => q.examTag?.toLowerCase().includes(filterTag.trim().toLowerCase()));
    }
    if (searchQuery.trim()) {
      const queryNorm = searchQuery.trim().toLowerCase();
      list = list.filter(
        (q) =>
          q.question.toLowerCase().includes(queryNorm) ||
          q.explanation?.toLowerCase().includes(queryNorm)
      );
    }
    if (isRestricted) {
      list = list.filter((q) => allowedSubcatIds.includes(q.subId));
    }

    setFilteredQuestions(list.slice(0, 100)); // Limit to first 100 for performant rendering
  }, [allQuestions, searchQuery, filterSubId, filterAccess, filterDifficulty, filterYear, filterTag, isRestricted]);

  useEffect(() => {
    if (activeTab === "search") {
      loadQuestions();
    }
  }, [activeTab]);

  return (
    <div className="space-y-6">
      {/* Selector Navigation */}
      <div className="flex flex-wrap md:flex-nowrap border-b border-slate-700 bg-slate-800/40 p-1 rounded-xl gap-1">
        <button
          onClick={() => setActiveTab("manual")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-1 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
            activeTab === "manual" ? "bg-teal-500 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          ম্যানুয়াল সংযোগ
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-1 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
            activeTab === "ai" ? "bg-purple-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Sparkles className="w-4 h-4 animate-bounce" />
          AI অটো জেনারেটর
        </button>
        <button
          onClick={() => setActiveTab("ai_converter")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-1 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
            activeTab === "ai_converter" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Sparkles className="w-4 h-4 text-indigo-300" />
          AI পেস্ট-টু-MCQ
        </button>
        <button
          onClick={() => setActiveTab("excel")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-1 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
            activeTab === "excel" ? "bg-emerald-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          এক্সেল ড্রপলোড
        </button>
        <button
          onClick={() => setActiveTab("search")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-1 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
            activeTab === "search" ? "bg-slate-700 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Search className="w-4 h-4" />
          সার্চ ও ম্যানেজ ({questionsCount})
        </button>
      </div>

      {/* 1. Manual Entry State */}
      {activeTab === "manual" && (
        <form
          onSubmit={saveQuestion}
          className={`bg-slate-800/60 p-6 rounded-2xl border ${
            editingId ? "border-amber-500 bg-yellow-500/5" : "border-slate-700/50"
          } space-y-6 transition-colors`}
        >
          <div className="flex justify-between items-center border-b border-slate-700 pb-3">
            <h3 className="text-lg font-bold text-teal-400 flex items-center gap-2">
              <PlusCircle className="w-5 h-5" />
              {editingId ? "এডিট কোশ্চেন মডিফায়ার" : "ম্যানুয়াল নতুন প্রশ্ন এন্ট্রি"}
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-amber-500 hover:text-amber-400 flex items-center gap-1 text-xs font-semibold"
              >
                <X className="w-4 h-4" /> বাতিল করুন
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-300 text-xs font-semibold block mb-2">
                সাব-ক্যাটাগরি গ্রুপ *
              </label>
              <select
                value={subId}
                onChange={(e) => setSubId(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500 h-[44px]"
              >
                <option value="">নির্বাচন করুন</option>
                {allowedSubcats.map((sub) => {
                  const cat = allowedCats.find((c) => c.id === sub.parentId);
                  return (
                    <option key={sub.id} value={sub.id}>
                      {cat ? `[${cat.name}] ` : ""}
                      {sub.name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-2">মেম্বার অ্যাক্সেস</label>
                <select
                  value={access}
                  onChange={(e) => setAccess(e.target.value as "free" | "premium")}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500 h-[44px]"
                >
                  <option value="free">ফ্রি ইউজার</option>
                  <option value="premium">প্রিমিয়াম প্যাটার্ন</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 text-xs font-semibold block mb-2">কঠিনতার স্তর</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500 h-[44px]"
                >
                  <option value="easy">সহজ</option>
                  <option value="medium">মধ্যম</option>
                  <option value="hard">কঠিন</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="text-slate-300 text-xs font-semibold block mb-2">প্রশ্নের মূল টেক্সট (বাংলা) *</label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              required
              rows={3}
              placeholder="সম্পূর্ণ প্রশ্নের বিবরণ এখানে বিবৃত করুন..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm outline-none focus:border-teal-500 leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-400 text-xs font-semibold block mb-2">অপশন ১ *</label>
              <input
                type="text"
                value={opt1}
                required
                onChange={(e) => setOpt1(e.target.value)}
                placeholder="ক"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500 h-[44px]"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs font-semibold block mb-2">অপশন ২ *</label>
              <input
                type="text"
                value={opt2}
                required
                onChange={(e) => setOpt2(e.target.value)}
                placeholder="খ"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500 h-[44px]"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs font-semibold block mb-2">অপশন ৩ *</label>
              <input
                type="text"
                value={opt3}
                required
                onChange={(e) => setOpt3(e.target.value)}
                placeholder="গ"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500 h-[44px]"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs font-semibold block mb-2">অপশন ৪ *</label>
              <input
                type="text"
                value={opt4}
                required
                onChange={(e) => setOpt4(e.target.value)}
                placeholder="ঘ"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500 h-[44px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-slate-300 text-xs font-semibold block mb-2">সঠিক উত্তর মডিফাইয়ার (১-৪) *</label>
              <select
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(parseInt(e.target.value) || 1)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500 h-[44px]"
              >
                <option value={1}>ক (অপশন ১)</option>
                <option value={2}>খ (অপশন ২)</option>
                <option value={3}>গ (অপশন ৩)</option>
                <option value={4}>ঘ (অপশন ৪)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 text-xs font-semibold block mb-2">বিগত সাল / এক্সাম ট্যাগ</label>
              <input
                type="text"
                value={examTag}
                onChange={(e) => setExamTag(e.target.value)}
                placeholder="যেমন: ৪৪তম বিসিএস / ব্যাংক টেস্ট"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500 h-[44px]"
              />
            </div>

            <div>
              <label className="text-slate-300 text-xs font-semibold block mb-2">প্রশ্ন প্রকাশের বছর / সাল</label>
              <input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="যেমন: ২০২২"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-teal-500 h-[44px]"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-300 text-xs font-semibold block mb-2">ব্যাখ্যা / বিশ্লেষণমূলক টেক্সট</label>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={3}
              placeholder="অপশনটি কীভাবে সঠিক হলো তার বিস্তারিত আলোচনা করুন..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white text-sm outline-none focus:border-teal-500 leading-relaxed"
            />
          </div>

          <div>
            <label className="text-slate-300 text-xs font-semibold block mb-2 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-teal-400" />
              ব্যাখ্যায় ইমেজ বা ডায়াগ্রাম ফাইল সংযুক্ত করুন (ঐচ্ছিক)
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-900 p-3 rounded-lg border border-slate-700">
              <input
                type="file"
                accept="image/*"
                onChange={handleImgChange}
                className="text-xs text-slate-400 file:bg-slate-800 file:border-0 file:text-white file:px-4 file:py-1.5 file:rounded file:mr-2 file:cursor-pointer"
              />
              {explainImgUrl && (
                <div className="text-xs truncate text-teal-400 max-w-full">
                  বর্তমান ফাইল:{" "}
                  <a href={explainImgUrl} target="_blank" rel="noreferrer" className="underline">
                    লিংক দেখুন
                  </a>
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || uploadingImg}
            className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-teal-500/40 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-teal-500/20"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> সংরক্ষণ করা হচ্ছে...
              </>
            ) : editingId ? (
              "প্রশ্নটি ডাটাবেজে আপডেট করুন"
            ) : (
              "নতুন প্রশ্নটি ডাটাবেজে সাবমিট করুন"
            )}
          </button>
        </form>
      )}

      {/* 2. AI Question Generator State */}
      {activeTab === "ai" && (() => {
        const limitVal = globalNotice?.dailyQuestionLimit !== undefined ? globalNotice.dailyQuestionLimit : 15;
        const isLimitExceeded = dailyUsageCount >= limitVal;

        return (
          <div className="space-y-6">
            {/* Warning Banner / Counter */}
            {isLimitExceeded ? (
              <div className="bg-red-500/10 border border-red-500/25 p-4.5 rounded-2xl text-red-300 text-xs flex flex-row items-start gap-3 select-none animate-pulse">
                <div className="bg-red-500/20 text-red-400 p-2 rounded-xl text-lg font-bold">⚠️</div>
                <div className="flex-1">
                  <span className="font-bold block text-red-400 text-sm mb-0.5">আজকের জন্য আপনার প্রশ্ন লিমিট শেষ হয়েছে।</span>
                  <span className="leading-relaxed text-[11px]">দৈনিক প্রশ্ন লিমিট কোটা অতিক্রম হয়েছে। অনুগ্রহ করে আগামীকাল আবার চেষ্টা করুন। (দৈনিক সীমা: {limitVal} টি, আপনার ব্যবহৃত কাউন্ট: {dailyUsageCount} টি)</span>
                </div>
              </div>
            ) : (
              <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-xl text-purple-300 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-purple-400 animate-ping" />
                  <span>দৈনিক কোটেশন ট্র্যাকার: আপনি আজ <b>{dailyUsageCount}</b> টি জেনারেশন কোয়েরি সম্পন্ন করেছেন।</span>
                </div>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-mono font-bold">সীমা: {dailyUsageCount}/{limitVal}</span>
              </div>
            )}

            <div className={`bg-slate-800/60 p-6 rounded-2xl border border-purple-500/30 space-y-4 transition-all duration-300 ${isLimitExceeded ? "opacity-60 pointer-events-none" : ""}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  Gemini AI ইন্টেলিজেন্ট কোশ্চেন ক্রিয়েটর (বাংলা ভাষা)
                </h3>
              </div>

              {/* API Key Optimization Instruction Alert Box */}
              <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl text-amber-300 space-y-1.5 leading-relaxed text-[11.5px]">
                <span className="font-bold block text-xs flex items-center gap-1.5 text-amber-400 font-bangla">
                  🔑 এপিআই লিমিট শেষ হওয়া এড়াতে চান? (Save & Rotate API Keys)
                </span>
                <p className="font-bangla">
                  ১. <b>মেমোরি/টোকেন অপ্টিমাইজেশন:</b> আমরা জেনারেশন প্রম্পট অপ্টিমাইজ করেছি যেন অল্প টোকেন খরচ করে অল্প কথায় সঠিক প্রশ্ন তৈরি হয় (প্রতি রিকোয়েস্টের টোকেন সাইজ প্রায় <b>৫০% কমানো হয়েছে</b>)।
                </p>
                <p className="font-bangla">
                  ২. <b>একাধিক এপিআই কী রোটেশন:</b> লিমিট শেষ হওয়া চিরতরে সমাধান করতে অ্যাডমিন প্যানেলের <b>"সেটিংস ও নোটিশ (Bulletins & Settings)"</b> মেন্যুর ভেতর <b>"Gemini API Keys"</b> ট্যাবে গিয়ে ৪-৫টি সম্পূর্ণ ফ্রি ব্যাকআপ এপিআই কী এড করে রাখুন। কোনো কী লিমিট বা হারের মুখোমুখি হলে সিস্টেম স্বয়ংক্রিয়ভাবে পরবর্তী ব্যাকআপ কীতে সুইচ করে কাজ সচল রাখবে!
                </p>
              </div>

              <p className="text-slate-400 text-xs">
                আলাদা টাইপ করা ছাড়া সরাসরি Gemini কৃত্রিম বুদ্ধিমত্তা ব্রেইন ব্যবহার করে আপনার সিলেক্টকৃত টপিক ও বিষয়ের ওপর সুন্দর বাংলা সাধারণ জ্ঞান, ইতিহাস বা বিসিএস লেভেলের এমসিকিউ জেনারেট করে নিন।
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-slate-300 text-xs font-semibold block mb-2">টপিক বা সূচিপত্র</label>
                  <input
                    type="text"
                    disabled={isLimitExceeded}
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    placeholder={isLimitExceeded ? "আজকের কাজের সীমা সফলভাবে সমাপ্ত হয়েছে।" : "যেমন: সৌরজগত, মহাত্মা গান্ধী, বাংলাদেশের মুক্তিযুদ্ধ..."}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-purple-500 h-[44px]"
                  />
                </div>

                <div>
                  <label className="text-slate-300 text-xs font-semibold block mb-2 font-bangla">প্রশ্ন সংখ্যা (সর্বোচ্চ সীমা: ২০)</label>
                  <select
                    disabled={isLimitExceeded}
                    value={aiCount}
                    onChange={(e) => setAiCount(parseInt(e.target.value) || 5)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-purple-500 h-[44px]"
                  >
                    <option value={3}>৩ টি প্রশ্ন</option>
                    <option value={5}>৫ টি প্রশ্ন</option>
                    <option value={10}>১০ টি প্রশ্ন</option>
                    <option value={15}>১৫ টি প্রশ্ন</option>
                    <option value={20}>২০ টি প্রশ্ন (সর্বোচ্চ নিরাপদ সীমা)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 text-xs font-semibold block mb-2 font-bangla">যেখানে সেভ হবে (Sub-Category)</label>
                  <select
                    disabled={isLimitExceeded}
                    value={aiSubId}
                    onChange={(e) => setAiSubId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-purple-500 h-[44px]"
                  >
                    <option value="">নির্বাচন করুন</option>
                    {allowedSubcats.map((sub) => {
                      const cat = allowedCats.find((c) => c.id === sub.parentId);
                      return (
                        <option key={sub.id} value={sub.id}>
                          {cat ? `[${cat.name}] ` : ""}
                          {sub.name}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Added manual-equivalent fields for AI Question Gen */}
              <div className="border-t border-slate-700/60 pt-4 mt-2">
                <h4 className="text-slate-300 text-xs font-bold mb-3 flex items-center gap-1.5 font-bangla">
                  <Settings className="w-3.5 h-3.5 text-purple-400" />
                  উৎপন্ন প্রশ্নের মেটাডাটা充 কনফিগারেশন (ম্যানুয়াল ফিল্ডসমূহ)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-slate-400 text-[11px] font-semibold block mb-1.5 font-bangla">অ্যাক্সেস লেভেল</label>
                    <select
                      disabled={isLimitExceeded}
                      value={aiAccess}
                      onChange={(e) => setAiAccess(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-purple-500 h-[38px] cursor-pointer"
                    >
                      <option value="free">ফ্রি (Free)</option>
                      <option value="premium">প্রিমিয়াম (Premium)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] font-semibold block mb-1.5 font-bangla">কঠিনতার মাত্রা</label>
                    <select
                      disabled={isLimitExceeded}
                      value={aiDifficulty}
                      onChange={(e) => setAiDifficulty(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-purple-500 h-[38px] cursor-pointer"
                    >
                      <option value="easy">সহজ (Easy)</option>
                      <option value="medium">মাঝারি (Medium)</option>
                      <option value="hard">কঠিন (Hard)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] font-semibold block mb-1.5 font-bangla">পরীক্ষার ট্যাগ</label>
                    <input
                      type="text"
                      disabled={isLimitExceeded}
                      value={aiExamTag}
                      onChange={(e) => setAiExamTag(e.target.value)}
                      placeholder="যেমন: BCS 46th, Medical, Bank..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-purple-500 h-[38px]"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] font-semibold block mb-1.5 font-bangla font-bangla">প্রশ্নপত্র/সংস্করণ বছর</label>
                    <input
                      type="text"
                      disabled={isLimitExceeded}
                      value={aiYear}
                      onChange={(e) => setAiYear(e.target.value)}
                      placeholder="যেমন: 2026, 2025..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-purple-500 h-[38px]"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={generateAIQuestions}
                disabled={isLimitExceeded || generatingAI}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/40 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-purple-500/20"
              >
                {generatingAI ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Gemini AI বিষয়ভিত্তিক এমসিকিউ স্ক্রিপ্ট ড্রাফট করছে...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" /> এআই স্পার্কস সক্রিয় করুন
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })()}

      {/* AI generated list output */}
      {activeTab === "ai" && aiGeneratedQuestions.length > 0 && (
        <div className="bg-slate-800/80 rounded-2xl p-6 border border-purple-500/40 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-700 pb-4">
            <div>
              <h4 className="text-md font-bold text-white flex items-center gap-1.5 font-bangla">
                <CheckCircle className="w-5 h-5 text-purple-400" />
                উৎপন্ন এমসিকিউ খসড়া রিপোর্ট ({aiGeneratedQuestions.length})
              </h4>
              <p className="text-slate-400 text-xs mt-0.5 font-bangla">সবগুলো সেভ করার আগে রিভিয়ু করে নিন</p>
            </div>
            <button
              onClick={saveAllAIGenerated}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold text-sm px-4 py-2.5 rounded-lg transition-all cursor-pointer"
            >
              একসাথে সবগুলি সংরক্ষণ করুন
            </button>
          </div>

          <div className="space-y-6 max-h-[500px] overflow-y-auto pr-1 font-bangla">
            {aiGeneratedQuestions.map((q, idx) => (
              <div
                key={idx}
                className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/60 hover:border-purple-500/30 transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-4"
              >
                <div className="space-y-3 flex-1">
                  <p className="text-white text-sm font-semibold select-all">
                    {idx + 1}. {q.question}
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                    <div className={q.correctAnswer === 1 ? "text-emerald-400 font-bold" : ""}>
                      ১. (ক) {q.option1}
                    </div>
                    <div className={q.correctAnswer === 2 ? "text-emerald-400 font-bold" : ""}>
                      ২. (খ) {q.option2}
                    </div>
                    <div className={q.correctAnswer === 3 ? "text-emerald-400 font-bold" : ""}>
                      ৩. (গ) {q.option3}
                    </div>
                    <div className={q.correctAnswer === 4 ? "text-emerald-400 font-bold" : ""}>
                      ৪. (ঘ) {q.option4}
                    </div>
                  </div>
                  <div className="bg-slate-800/40 p-2.5 rounded text-xs border border-slate-800/40 select-all text-slate-300 leading-relaxed">
                    <b className="text-teal-400 font-medium">ব্যাখ্যা:</b> {q.explanation}
                  </div>
                </div>
                <button
                  onClick={() => saveAIGeneratedSingle(q, idx)}
                  className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-2 rounded-lg border border-slate-700 transition-colors self-end sm:self-start whitespace-nowrap cursor-pointer"
                >
                  শুধু এটি সেভ করুন
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2b. AI Paste-To-MCQ Converter */}
      {activeTab === "ai_converter" && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-slate-800/60 p-6 rounded-2xl border border-indigo-500/30 space-y-4">
            <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
              Gemini AI পেস্ট-টু-এমসিকিউ কনভার্টার
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed font-bangla">
              বই, পিডিএফ, বা যেকোনো ওয়েবসাইট থেকে প্রশ্ন, ৪টি অপশন, সঠিক উত্তর এবং ব্যাখ্যা একসাথে কপি করে নিচে পেস্ট করুন। কৃত্রিম বুদ্ধিমত্তা ব্রেইন ব্যবহার করে স্বয়ংক্রিয়ভাবে এটিকে পার্স করে ডেটাবেজে পোস্ট করার উপযুক্ত রূপ দেবে।
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Form Paste Area */}
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <label className="text-slate-300 text-xs font-semibold block mb-2 font-bangla">
                    প্রশ্নপত্র বা র টেক্সট এখানে পেস্ট করুন (Paste Raw Text here)
                  </label>
                  <textarea
                    value={pastedRawText}
                    onChange={(e) => setPastedRawText(e.target.value)}
                    placeholder={`পেস্ট করার উদাহরণ:

১. নিচের কোনটি গ্রিন হাউস গ্যাস নয়?
(ক) কার্বন ডাই অক্সাইড
(খ) সিএফসি
(গ) নাইট্রোজেন গ্যাস
(ঘ) মিথেন
উত্তর: গ (নাইট্রোজেন গ্যাস)
ব্যাখ্যা: জলবায়ুর বায়ুমণ্ডলে নাইট্রোজেন মূলত গ্রিনহাউস প্রতিক্রিয়া তৈরী করে না।`}
                    className="w-full bg-slate-950 border border-slate-750 rounded-xl p-4 text-xs font-mono text-white outline-none focus:border-indigo-500 min-h-[300px] leading-relaxed resize-y"
                  />
                </div>
              </div>

              {/* Right Settings Configuration Panel */}
              <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-850 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <h4 className="text-slate-300 text-xs font-bold flex items-center gap-1.5 font-bangla border-b border-slate-800 pb-2">
                    <Settings className="w-3.5 h-3.5 text-indigo-400" />
                    টার্গেট ক্যাটাগরি ও প্রশ্ন কনফিগারেশন
                  </h4>

                  <div>
                    <label className="text-slate-400 text-[11px] font-semibold block mb-1.5 font-bangla">কোথায় পোস্ট হবে (Sub-Category) *</label>
                    <select
                      value={aiConvSubId}
                      onChange={(e) => setAiConvSubId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-755 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-indigo-500 h-[38px] cursor-pointer"
                    >
                      <option value="">সাব-ক্যাটাগরি নির্বাচন করুন</option>
                      {allowedSubcats.map((sub) => {
                        const cat = allowedCats.find((c) => c.id === sub.parentId);
                        return (
                          <option key={sub.id} value={sub.id}>
                            {cat ? `[${cat.name}] ` : ""}
                            {sub.name}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] font-semibold block mb-1.5 font-bangla">অ্যাক্সেস লেভেল</label>
                    <select
                      value={aiConvAccess}
                      onChange={(e) => setAiConvAccess(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-755 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-indigo-500 h-[38px] cursor-pointer"
                    >
                      <option value="free">ফ্রি (Free)</option>
                      <option value="premium">প্রিমিয়াম (Premium)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] font-semibold block mb-1.5 font-bangla">কঠিনতার মাত্রা</label>
                    <select
                      value={aiConvDifficulty}
                      onChange={(e) => setAiConvDifficulty(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-755 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-indigo-500 h-[38px] cursor-pointer"
                    >
                      <option value="easy">সহজ (Easy)</option>
                      <option value="medium">মাঝারি (Medium)</option>
                      <option value="hard">কঠিন (Hard)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] font-semibold block mb-1.5 font-bangla">পরীক্ষার ট্যাগ</label>
                    <input
                      type="text"
                      value={aiConvExamTag}
                      onChange={(e) => setAiConvExamTag(e.target.value)}
                      placeholder="যেমন: BCS 46th, Medical, Bank..."
                      className="w-full bg-slate-950 border border-slate-755 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-indigo-500 h-[38px]"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] font-semibold block mb-1.5 font-bangla font-bangla">সংস্করণ বছর</label>
                    <input
                      type="text"
                      value={aiConvYear}
                      onChange={(e) => setAiConvYear(e.target.value)}
                      placeholder="যেমন: 2026, 2025..."
                      className="w-full bg-slate-950 border border-slate-755 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-indigo-500 h-[38px]"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-805 mt-2">
                  <button
                    onClick={parsePastedQuestionAI}
                    disabled={convertingPaste || !pastedRawText.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/30 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-indigo-500/20 text-xs font-bangla"
                  >
                    {convertingPaste ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> এআই পার্সিং সম্পন্ন হচ্ছে...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" /> টেক্সট থেকে MCQ কনভার্ট করুন
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Parsed Output / Interactive Draft Editor */}
          {parsedQuestions.length > 0 && (
            <div className="bg-slate-800/80 rounded-2xl p-6 border border-indigo-500/40 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-700 pb-4">
                <div>
                  <h4 className="text-md font-bold text-white flex items-center gap-2 font-bangla">
                    <CheckCircle className="w-5 h-5 text-indigo-400" />
                    পার্সকৃত এমসিকিউ ড্রাফট রিভিউ ও এডিটর ({parsedQuestions.length})
                  </h4>
                  <p className="text-slate-400 text-xs mt-0.5 font-bangla">সবগুলো সেভ করার আগে প্রশ্ন, অপশন, এবং সঠিক উত্তর চেক বা পরিবর্তন করে নিন</p>
                </div>
                <button
                  onClick={saveAllParsed}
                  disabled={convertingPaste || !aiConvSubId}
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:from-slate-700 disabled:to-slate-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-500/15 cursor-pointer font-bangla"
                >
                  একসাথে সবগুলি ডাটাবেজে পোস্ট করুন
                </button>
              </div>

              {!aiConvSubId && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs px-4 py-3 rounded-xl flex items-center gap-2 font-bangla">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <strong>গুরুত্বপূর্ণ:</strong> অনুগ্রহ করে ডানপাশের কনফিগারেশন থেকে সাব-ক্যাটাগরি গ্রুপ নির্বাচন করুন যেন প্রশ্নটি সঠিক টপিকসে ধারণ করা যায়।
                </div>
              )}

              <div className="space-y-6 max-h-[700px] overflow-y-auto pr-2">
                {parsedQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-5 bg-slate-900/60 border border-slate-750 rounded-xl space-y-4 hover:border-indigo-500/40 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 space-y-1">
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bangla">
                          {idx + 1} নং প্রশ্ন খসড়া
                        </span>
                        <div className="pt-1.5">
                          <label className="text-[10px] text-indigo-400 font-bold block mb-1 font-bangla">প্রশ্ন (Question Title):</label>
                          <textarea
                            value={q.question}
                            onChange={(e) => updateParsedQuestionField(idx, "question", e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-indigo-500 font-semibold"
                            rows={2}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setParsedQuestions((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer p-1"
                        title="তালিকাই থেকে বাদ দিন"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div>
                        <label className={`text-[10px] font-bold block mb-1 font-bangla ${q.correctAnswer === 1 ? "text-green-400" : "text-slate-400"}`}>
                          অপশন ১ {q.correctAnswer === 1 && "✓ (সลับভাবে সঠিক উত্তর)"}:
                        </label>
                        <input
                          type="text"
                          value={q.option1}
                          onChange={(e) => updateParsedQuestionField(idx, "option1", e.target.value)}
                          className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 ${
                            q.correctAnswer === 1 ? "border-green-500/50 bg-green-950/20 text-green-300 font-semibold" : "border-slate-800"
                          }`}
                        />
                      </div>

                      <div>
                        <label className={`text-[10px] font-bold block mb-1 font-bangla ${q.correctAnswer === 2 ? "text-green-400" : "text-slate-400"}`}>
                          অপশন ২ {q.correctAnswer === 2 && "✓ (সลับভাবে সঠিক উত্তর)"}:
                        </label>
                        <input
                          type="text"
                          value={q.option2}
                          onChange={(e) => updateParsedQuestionField(idx, "option2", e.target.value)}
                          className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 ${
                            q.correctAnswer === 2 ? "border-green-500/50 bg-green-950/20 text-green-300 font-semibold" : "border-slate-800"
                          }`}
                        />
                      </div>

                      <div>
                        <label className={`text-[10px] font-bold block mb-1 font-bangla ${q.correctAnswer === 3 ? "text-green-400" : "text-slate-400"}`}>
                          অপশন ৩ {q.correctAnswer === 3 && "✓ (সลับভাবে সঠিক উত্তর)"}:
                        </label>
                        <input
                          type="text"
                          value={q.option3}
                          onChange={(e) => updateParsedQuestionField(idx, "option3", e.target.value)}
                          className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 ${
                            q.correctAnswer === 3 ? "border-green-500/50 bg-green-950/20 text-green-300 font-semibold" : "border-slate-800"
                          }`}
                        />
                      </div>

                      <div>
                        <label className={`text-[10px] font-bold block mb-1 font-bangla ${q.correctAnswer === 4 ? "text-green-400" : "text-slate-400"}`}>
                          অপশন ৪ {q.correctAnswer === 4 && "✓ (সลับভাবে সঠিক উত্তর)"}:
                        </label>
                        <input
                          type="text"
                          value={q.option4}
                          onChange={(e) => updateParsedQuestionField(idx, "option4", e.target.value)}
                          className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 ${
                            q.correctAnswer === 4 ? "border-green-500/50 bg-green-950/20 text-green-300 font-semibold" : "border-slate-800"
                          }`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1 font-bangla">
                          সঠিক উত্তর সূচক (Correct Option Index):
                        </label>
                        <select
                          value={q.correctAnswer}
                          onChange={(e) => updateParsedQuestionField(idx, "correctAnswer", parseInt(e.target.value) || 1)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 h-[38px] cursor-pointer font-bangla"
                        >
                          <option value={1}>অপশন ১</option>
                          <option value={2}>অপশন ২</option>
                          <option value={3}>অপশন ৩</option>
                          <option value={4}>অপশন ৪</option>
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="text-[10px] text-slate-400 font-bold block mb-1 font-bangla">ব্যাখ্যা (Bengali Explanation):</label>
                        <textarea
                          value={q.explanation}
                          onChange={(e) => updateParsedQuestionField(idx, "explanation", e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-indigo-500"
                          rows={2}
                          placeholder="ব্যাখ্যা বা সমাধানের সংক্ষিপ্ত বিবরণ..."
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-800/60">
                      <button
                        onClick={() => saveParsedSingle(q, idx)}
                        disabled={convertingPaste || !aiConvSubId}
                        className="bg-indigo-600/25 hover:bg-indigo-600 text-indigo-305 hover:text-white disabled:bg-slate-800 disabled:text-slate-500 text-xs font-semibold px-4 py-2 rounded-lg border border-indigo-500/20 hover:border-transparent transition-all cursor-pointer font-bangla"
                      >
                        শুধুমাত্র এই প্রশ্নটি পোস্ট করুন
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Bulk Upload State */}
      {activeTab === "excel" && (
        <div className="bg-slate-800/60 p-6 rounded-2xl border border-slate-700/50 space-y-6">
          <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            এক্সেল শিট বাল্ক প্রশ্ন আপলোডার
          </h3>
          <p className="text-slate-400 text-xs leading-relaxed">
            এক্সেল শিটের মাধ্যমে কলাম আকারে শত শত প্রশ্ন এক সেকেন্ডেই আপলোড করুণ। ফাইলের ১ম শীটের রো গুলোর হেডার যথাক্রমে{" "}
            <code className="text-emerald-300 font-mono bg-slate-900 px-1 py-0.5 rounded">question</code>,{" "}
            <code className="text-emerald-300 font-mono bg-slate-900 px-1 py-0.5 rounded">option1</code>,{" "}
            <code className="text-emerald-300 font-mono bg-slate-900 px-1 py-0.5 rounded">option2</code>,{" "}
            <code className="text-emerald-300 font-mono bg-slate-900 px-1 py-0.5 rounded">option3</code>,{" "}
            <code className="text-emerald-300 font-mono bg-slate-900 px-1 py-0.5 rounded">option4</code>,{" "}
            <code className="text-emerald-300 font-mono bg-slate-900 px-1 py-0.5 rounded">correctAnswer</code> (ক্রমিক সংখ্যা ১ থেকে ৪), এবং{" "}
            <code className="text-emerald-300 font-mono bg-slate-900 px-1 py-0.5 rounded">explanation</code> (ব্যাখ্যা) হতে হবে।
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-slate-300 text-xs font-semibold block mb-2">
                কোর্স বা সাব-ক্যাটাগরি গ্রুপ নির্বাচন করুন
              </label>
              <select
                value={excelSubId}
                onChange={(e) => setExcelSubId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-emerald-500 h-[44px]"
              >
                <option value="">নির্বাচন করুন</option>
                {allowedSubcats.map((sub) => {
                  const cat = allowedCats.find((c) => c.id === sub.parentId);
                  return (
                    <option key={sub.id} value={sub.id}>
                      {cat ? `[${cat.name}] ` : ""}
                      {sub.name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="text-slate-300 text-xs font-semibold block mb-2">এক্সেল পাইপলাইন ফাইল নির্বাচন করুন</label>
              <div className="flex items-center bg-slate-900 p-2 rounded-lg border border-slate-700">
                <input
                  type="file"
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onChange={(e) => setExcelFile(e.target.files ? e.target.files[0] : null)}
                  className="text-xs text-slate-400 file:bg-slate-800 file:border-0 file:text-white file:px-4 file:py-1.5 file:rounded file:mr-2 file:cursor-pointer"
                />
              </div>
            </div>
          </div>

          {bulkStatus && (
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs text-emerald-400 font-mono">
              {bulkStatus}
            </div>
          )}

          <button
            onClick={handleExcelUpload}
            disabled={bulkSaving || !excelFile || !excelSubId}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/40 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-emerald-500/20"
          >
            {bulkSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> শিট আপলোড হচ্ছে...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" /> প্রশ্নাবলী বাল্ক আপলোড নিশ্চিত করুন
              </>
            )}
          </button>
        </div>
      )}

      {/* 4. Search & Manage Questions State */}
      {activeTab === "search" && (
        <div className="space-y-4">
          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/50 space-y-4">
            <h4 className="text-md font-bold text-white flex items-center gap-2">
              <Filter className="w-5 h-5 text-teal-400" />
              সার্চ ফিল্টারিং কনসোল
            </h4>

            {/* Core Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              <select
                value={filterSubId}
                onChange={(e) => setFilterSubId(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-teal-500 h-[38px]"
              >
                <option value="">সকল সাব-ক্যাটাগরি</option>
                {allowedSubcats.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>

              <select
                value={filterAccess}
                onChange={(e) => setFilterAccess(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-teal-500 h-[38px]"
              >
                <option value="">সকল অ্যাক্সেস</option>
                <option value="free">ফ্রি</option>
                <option value="premium">প্রিমিয়াম</option>
              </select>

              <select
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-teal-500 h-[38px]"
              >
                <option value="">সকল লেভেল</option>
                <option value="easy">সহজ</option>
                <option value="medium">মধ্যম</option>
                <option value="hard">কঠিন</option>
              </select>

              <input
                type="text"
                placeholder="বছর (যেমন: ২০২২)"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-teal-500 h-[38px]"
              />

              <input
                type="text"
                placeholder="ট্যাগ (যেমন: BCS)"
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-teal-500 h-[38px]"
              />
            </div>

            {/* Keyword search and reload */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="প্রশ্নের কিওয়ার্ড বা বাক্য লিখে সরাসরি ম্যাচ করুন..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadQuestions()}
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white outline-none focus:border-teal-500 h-[40px]"
                />
              </div>

              <button
                onClick={loadQuestions}
                disabled={searching}
                className="bg-slate-700 hover:bg-slate-650 active:bg-slate-800 disabled:opacity-50 text-white font-semibold text-sm px-5 h-[40px] rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                title="ডাটাবেজ থেকে সর্বশেষ প্রশ্নগুলো রিফ্রেশ করুন"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                রিলোড
              </button>
            </div>
          </div>

          {/* Results table */}
          {searching ? (
            <div className="text-center py-24 bg-slate-800/20 rounded-2xl border border-slate-700/50 flex flex-col justify-center items-center">
              <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
              <p className="text-slate-400 text-xs mt-3 font-medium">প্রশ্নাবলী সন্ধান করা হচ্ছে...</p>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="text-center py-16 bg-slate-800/20 rounded-2xl border border-slate-700/50">
              <AlertCircle className="w-7 h-7 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">কোনো প্রশ্ন পাওয়া যায়নি। অন্য কিছু দিয়ে ফিল্টার করুন।</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-slate-400 font-semibold px-2">
                ফিল্ট্রিকরণ মেলানো হয়েছে (সর্বোচ্চ ১০০টি দেখানো হচ্ছে)
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {filteredQuestions.map((q) => (
                  <div
                    key={q.id}
                    className="bg-slate-800/40 p-4 border border-slate-700/55 rounded-xl hover:border-slate-600 transition-all flex flex-col md:flex-row justify-between items-start gap-4 group"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="bg-slate-900 border border-slate-700 text-[10px] text-slate-300 px-2 py-0.5 rounded font-mono">
                          ID: {q.id}
                        </span>
                        <span className="bg-teal-500/10 text-teal-400 text-[10px] px-2 py-0.5 rounded font-semibold leading-none">
                          {q.access === "premium" ? "Premium" : "Free"}
                        </span>
                        <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-0.5 rounded font-semibold leading-none capitalize">
                          {q.difficulty}
                        </span>
                        {q.examTag && (
                          <span className="bg-orange-500/10 text-orange-400 text-[10px] px-2 py-0.5 rounded font-semibold leading-none">
                            {q.examTag}
                          </span>
                        )}
                        {q.year && (
                          <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded font-semibold leading-none">
                            {q.year}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold select-all text-white leading-relaxed">
                        {q.question}
                      </p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs select-all text-slate-400">
                        <div className={(q.correctAnswer === 1 || String((q as any).correct).trim().toUpperCase() === "A" || String((q as any).correct).trim() === "1") ? "text-emerald-400 font-bold" : ""}>
                          ১) {q.option1 || (q as any).optA || "—"}
                        </div>
                        <div className={(q.correctAnswer === 2 || String((q as any).correct).trim().toUpperCase() === "B" || String((q as any).correct).trim() === "2") ? "text-emerald-400 font-bold" : ""}>
                          ২) {q.option2 || (q as any).optB || "—"}
                        </div>
                        <div className={(q.correctAnswer === 3 || String((q as any).correct).trim().toUpperCase() === "C" || String((q as any).correct).trim() === "3") ? "text-emerald-400 font-bold" : ""}>
                          ৩) {q.option3 || (q as any).optC || "—"}
                        </div>
                        <div className={(q.correctAnswer === 4 || String((q as any).correct).trim().toUpperCase() === "D" || String((q as any).correct).trim() === "4") ? "text-emerald-400 font-bold" : ""}>
                          ঘ) {q.option4 || (q as any).optD || "—"}
                        </div>
                      </div>
                      {q.explanation && (
                        <p className="text-[11px] bg-slate-900/50 p-2 rounded text-slate-400 leading-relaxed border border-slate-850">
                          <b className="text-teal-400 font-medium">ব্যাখ্যা:</b> {q.explanation}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 self-end md:self-start opacity-90 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => triggerEdit(q)}
                        className="bg-slate-700/65 hover:bg-amber-500 hover:text-white p-2 rounded-lg text-slate-300 transition-colors cursor-pointer"
                        title="এডিট করুণ"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          const targetId = q.id || (q as any).uid;
                          if (targetId) deleteQuestion(targetId);
                        }}
                        className="bg-slate-700/65 hover:bg-red-600 hover:text-white p-2 rounded-lg text-slate-300 transition-colors cursor-pointer"
                        title="ডিলিট করুণ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors animate-pulse-subtle"
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
