import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit,
  Search,
  BookOpen,
  User,
  MapPin,
  ClipboardList,
  CheckCircle,
  AlertTriangle,
  X,
  Printer,
  SlidersHorizontal,
  ChevronDown,
  Loader2,
  FileSpreadsheet
} from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { ExamRoutine, Course } from "../types";

interface ExamRoutineManageProps {
  courses: Course[];
  triggerReload: () => void;
  isSandboxMode: boolean;
}

export default function ExamRoutineManage({
  courses,
  triggerReload,
  isSandboxMode
}: ExamRoutineManageProps) {
  // Collection States
  const [routines, setRoutines] = useState<ExamRoutine[]>([]);
  const [loading, setLoading] = useState(false);

  // Form toggles and states
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

  // Form Fields
  const [courseId, setCourseId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examTime, setExamTime] = useState("");
  const [duration, setDuration] = useState<number>(30);
  const [totalMarks, setTotalMarks] = useState<number>(50);
  const [syllabusTopic, setSyllabusTopic] = useState("");
  const [examType, setExamType] = useState("সাপ্তাহিক মডেল টেস্ট");
  const [roomNo, setRoomNo] = useState("অনলাইন মোবাইল অ্যাপ");
  const [instructor, setInstructor] = useState("");
  const [status, setStatus] = useState<"active" | "postponed" | "completed">("active");
  const [remarks, setRemarks] = useState("");

  // Filters State
  const [filterCourse, setFilterCourse] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Print Select States
  const [selectedForPrint, setSelectedForPrint] = useState<string[]>([]);

  // Load Routines
  const fetchRoutines = async () => {
    setLoading(true);
    if (isSandboxMode) {
      let local = localStorage.getItem("local_routines");
      if (!local) {
        const defaultRoutines: ExamRoutine[] = [
          {
            id: "routine-1",
            courseId: "course-1",
            subjectName: "বাংলা ব্যাকরণ ও সাহিত্য",
            examDate: "2026-06-25",
            examTime: "18:00",
            duration: 30,
            totalMarks: 50,
            syllabusTopic: "চর্যাপদ, মধ্যযুগ ও বাংলা বানানের নিয়ম",
            examType: "সাপ্তাহিক মডেল টেস্ট",
            roomNo: "অনলাইন মোবাইল অ্যাপ",
            instructor: "হাসান মাসুদ স্যার",
            status: "active",
            remarks: "সকল শিক্ষার্থীর জন্য প্রস্তুতিমূলক কুইজটি লাইভ অংশগ্রহণ বাধ্যতামূলক।"
          },
          {
            id: "routine-2",
            courseId: "course-1",
            subjectName: "English Grammar & Vocabulary",
            examDate: "2026-06-28",
            examTime: "20:00",
            duration: 20,
            totalMarks: 40,
            syllabusTopic: "Synonyms & Antonyms (A to E) & Subject-Verb Agreement",
            examType: "সাপ্তাহিক মডেল টেস্ট",
            roomNo: "অনলাইন মোবাইল অ্যাপ",
            instructor: "নাহিদ হাসান স্যার",
            status: "active",
            remarks: "নেগেটিভ মার্কিং ০.২৫ নম্বর প্রযোজ্য থাকবে।"
          },
          {
            id: "routine-3",
            courseId: "course-2",
            subjectName: "গণিত বেসিক সমাধান",
            examDate: "2026-06-22",
            examTime: "15:00",
            duration: 40,
            totalMarks: 30,
            syllabusTopic: "শতকরা, সুদকষা ও লাভ-ক্ষতি সংক্রান্ত সমস্যা",
            examType: "ডেইলি কুইজ টেস্ট",
            roomNo: "ডিজিটাল ক্লাসরুম ট্র্যাকার",
            instructor: "মশিউর রহমান স্যার",
            status: "completed",
            remarks: "পরীক্ষাটি ইতিপূর্বে সম্পন্ন হয়েছে এবং লিডারবোর্ড হালনাগাদ করা হয়েছে।"
          },
          {
            id: "routine-4",
            courseId: "course-1",
            subjectName: "বাংলাদেশ বিষয়াবলী",
            examDate: "2026-07-01",
            examTime: "11:00",
            duration: 60,
            totalMarks: 100,
            syllabusTopic: "প্রাচীন কাল থেকে ১৯৭১ মুক্তিযুদ্ধ এবং সংবিধানের গুরুত্বপূর্ণ অনুচ্ছেদ",
            examType: "মাসিক ফাইনাল টেস্ট",
            roomNo: "লাইভ মেগা সেন্টার",
            instructor: "বিসিএস এডমিন প্যানেল",
            status: "active",
            remarks: "ফুল সিলেবাস ১০০ নম্বরের পরীক্ষা নেওয়া হবে।"
          }
        ];
        localStorage.setItem("local_routines", JSON.stringify(defaultRoutines));
        local = JSON.stringify(defaultRoutines);
      }
      setRoutines(JSON.parse(local));
      setLoading(false);
      return;
    }

    try {
      const snap = await getDocs(collection(db, "exam_routines"));
      const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ExamRoutine));
      setRoutines(list);
    } catch (e) {
      console.warn("Firestore fetch failed, switching to fallback database.", e);
      // Fallback local
      const local = localStorage.getItem("local_routines") || "[]";
      setRoutines(JSON.parse(local));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutines();
  }, [isSandboxMode]);

  // Save or Edit Routine Handler
  const handleSaveRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return alert("অনুগ্রহ করে একটি কোর্স সিলেক্ট করুন!");
    if (!subjectName.trim()) return alert("অনুগ্রহ করে বিষয়ের নাম লিখুন!");
    if (!examDate) return alert("অনুগ্রহ করে পরীক্ষার তারিখ দিন!");
    if (!examTime) return alert("অনুগ্রহ করে পরীক্ষার সময় উল্লেখ করুন!");

    const payload: Omit<ExamRoutine, "id"> = {
      courseId,
      subjectName: subjectName.trim(),
      examDate,
      examTime,
      duration: Number(duration) || 30,
      totalMarks: Number(totalMarks) || 50,
      syllabusTopic: syllabusTopic.trim() || "সম্পূর্ণ সিলেবাস",
      examType: examType.trim() || "সাপ্তাহিক মডেল টেস্ট",
      roomNo: roomNo.trim() || "অনলাইন অ্যাপ",
      instructor: instructor.trim() || "এডমিন প্যানেল",
      status,
      remarks: remarks.trim()
    };

    setLoading(true);
    try {
      if (isSandboxMode) {
        const local = localStorage.getItem("local_routines") || "[]";
        const list = JSON.parse(local) as ExamRoutine[];

        if (editingId) {
          // Update
          const index = list.findIndex((r) => r.id === editingId);
          if (index !== -1) {
            list[index] = { ...list[index], ...payload };
          }
          localStorage.setItem("local_routines", JSON.stringify(list));
          alert("রুটিনটি সফলভাবে আপডেট করা হয়েছে!");
        } else {
          // Add new
          const newRoutine: ExamRoutine = {
            id: "routine-" + Date.now(),
            ...payload
          };
          list.push(newRoutine);
          localStorage.setItem("local_routines", JSON.stringify(list));
          alert("নতুন পরীক্ষার রুটিন সফলভাবে যুক্ত হয়েছে!");
        }
        setRoutines(list);
        resetForm();
      } else {
        // Firestore real save
        const savePayload = {
          ...payload,
          updatedAt: serverTimestamp()
        };

        if (editingId) {
          await updateDoc(doc(db, "exam_routines", editingId), savePayload);
          alert("রুটিনটি ডাটাবেজে সফলভাবে আপডেট করা হয়েছে!");
        } else {
          const docRef = await addDoc(collection(db, "exam_routines"), {
            ...savePayload,
            createdAt: serverTimestamp()
          });
        }
        await fetchRoutines();
        resetForm();
      }
      triggerReload();
    } catch (err: any) {
      alert("তথ্য সংরক্ষণ করতে সমস্যা হয়েছে: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Edit Trigger
  const handleEditInit = (r: ExamRoutine) => {
    setEditingId(r.id || null);
    setCourseId(r.courseId);
    setSubjectName(r.subjectName);
    setExamDate(r.examDate);
    setExamTime(r.examTime);
    setDuration(r.duration);
    setTotalMarks(r.totalMarks);
    setSyllabusTopic(r.syllabusTopic);
    setExamType(r.examType);
    setRoomNo(r.roomNo);
    setInstructor(r.instructor);
    setStatus(r.status);
    setRemarks(r.remarks);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Delete Handler
  const handleDeleteRoutine = (id: string) => {
    setConfirmConfig({
      title: "পরীক্ষার রুটিন মুছে ফেলার নিশ্চিতকরণ",
      description: "আপনি কি নিশ্চিতভাবে এই বিষয়ের পরীক্ষার রুটিন স্লটটি মুছে দিতে চান? এর ফলে সমস্ত শিক্ষার্থী পরীক্ষার সময়সূচী থেকে এই তথ্যটি আর দেখতে পাবে না।",
      onConfirm: async () => {
        setLoading(true);
        try {
          if (isSandboxMode) {
            const local = localStorage.getItem("local_routines") || "[]";
            let list = JSON.parse(local) as ExamRoutine[];
            list = list.filter((r) => r.id !== id);
            localStorage.setItem("local_routines", JSON.stringify(list));
            setRoutines(list);
            alert("রুটিনটি মুছে ফেলা হয়েছে!");
          } else {
            await deleteDoc(doc(db, "exam_routines", id));
            alert("রুটিনটি ক্লাউড ডাটাবেজ থেকে মুছে দেওয়া হয়েছে!");
            await fetchRoutines();
          }
          triggerReload();
        } catch (e: any) {
          alert("মুছে ফেলতে সমস্যা হয়েছে: " + e.message);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setCourseId("");
    setSubjectName("");
    setExamDate("");
    setExamTime("");
    setDuration(30);
    setTotalMarks(50);
    setSyllabusTopic("");
    setExamType("সাপ্তাহিক মডেল টেস্ট");
    setRoomNo("অনলাইন মোবাইল অ্যাপ");
    setInstructor("");
    setStatus("active");
    setRemarks("");
    setShowForm(false);
  };

  // Helper to resolve Course Title
  const getCourseTitle = (cId: string) => {
    const matched = courses.find((c) => c.id === cId);
    return matched ? matched.title : "সাধারণ বা উন্মুক্ত কোর্স";
  };

  // Printing selected ones beautifully
  const handlePrintRoutines = () => {
    if (selectedForPrint.length === 0) {
      return alert("অনুগ্রহ করে প্রিন্ট করার জন্য অন্তত একটি রুটিন নির্বাচন করুন অথবা বাম কোণায় সিলেক্ট অল করুন!");
    }

    const routinesToPrint = routines.filter((r) => selectedForPrint.includes(r.id || ""));

    const printWindow = window.open("", "_blank");
    if (!printWindow) return alert("পপআপ উইন্ডোটি ব্লকড অবস্থায় আছে, অনুগ্রহ করে অনুমতি দিন।");

    const tableRows = routinesToPrint
      .map((r) => {
        let statusBadge = "";
        if (r.status === "active") statusBadge = "<span style='color: #10B981;'>সক্রিয়</span>";
        else if (r.status === "postponed") statusBadge = "<span style='color: #EF4444;'>স্থগিত</span>";
        else statusBadge = "<span style='color: #6B7280;'>সম্পন্ন</span>";

        return `
          <tr>
            <td><strong>${getCourseTitle(r.courseId)}</strong></td>
            <td><strong>${r.subjectName}</strong><br/><small style="color: #4B5563;">${r.examType}</small></td>
            <td>📅 ${new Date(r.examDate).toLocaleDateString("bn-BD", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</td>
            <td>⏰ ${r.examTime}</td>
            <td>⚡ ${r.duration} মিঃ / 🎯 ${r.totalMarks} মান</td>
            <td>📖 ${r.syllabusTopic}</td>
            <td>📍 ${r.roomNo} <br/><small>👨‍🏫 ${r.instructor}</small></td>
            <td>${statusBadge}</td>
          </tr>
        `;
      })
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>পরীক্ষার রুটিন শিডিউল - MCQ HERO</title>
          <style>
            body { font-family: 'Inter', system-ui, -apple-system, sans-serif; padding: 40px; color: #1F2937; line-height: 1.5; }
            .header { text-align: center; border-bottom: 3px double #1F2937; padding-bottom: 20px; margin-bottom: 35px; }
            .header h1 { margin: 0; font-size: 28px; color: #111827; font-weight: 800; letter-spacing: 0.5px; }
            .header p { margin: 5px 0 0; font-size: 14px; color: #4B5563; font-weight: 500; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 40px; font-size: 12px; }
            th { background-color: #F3F4F6; color: #111827; border: 1px solid #D1D5DB; padding: 12px 10px; font-weight: 700; text-align: left; }
            td { border: 1px solid #E5E7EB; padding: 12px 10px; vertical-align: top; }
            tr:nth-child(even) { background-color: #F9FAFB; }
            .footer { margin-top: 60px; border-top: 1px solid #E5E7EB; padding-top: 15px; font-size: 11px; text-align: center; color: #9CA3AF; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>MCQ HERO • অফিসিয়াল পরীক্ষার সময়সূচী</h1>
            <p>রুটিন হালনাগাদের তারিখ: ${new Date().toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" })}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>কোর্স বা ব্যাচ</th>
                <th>বিষয় ও ধরণ</th>
                <th>পরীক্ষার তারিখ</th>
                <th>সময়</th>
                <th>সময়সীমা/পূর্ণমান</th>
                <th>সিলেবাস/টপিক</th>
                <th>ভেন্যু ও পরিদর্শক</th>
                <th>অবস্থা</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <div class="footer">
            © MCQ HERO. ALL RIGHTS RESERVED. এটি একটি অফিসিয়াল অটো-জেনারেটেড রুটিন সিঙ্ক শিডিউল।
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Helper to get formatted selected filter context
  const getSelectedFilterText = () => {
    const parts = [];
    if (filterCourse) {
      parts.push(getCourseTitle(filterCourse));
    } else {
      parts.push("সকল কোর্স");
    }
    if (filterType) {
      parts.push(filterType);
    }
    if (filterStatus) {
      const statusMap: Record<string, string> = {
        active: "আসন্ন ও সক্রিয়",
        postponed: "স্থগিত",
        completed: "সম্পন্ন"
      };
      parts.push(statusMap[filterStatus] || filterStatus);
    }
    return parts.join(" • ");
  };

  // Helper function to export ALL currently filtered routines as elegant Student PDF/Print Layout
  const handleExportAllFilteredPDF = () => {
    if (filteredList.length === 0) {
      return alert("অনুগ্রহ করে প্রথমে খুঁজুন অথবা নিশ্চিত করুন যে অন্তত একটি রুটিন তালিকায় দৃশ্যমান রয়েছে!");
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return alert("পপআপ উইন্ডোটি ব্লকড অবস্থায় আছে, অনুগ্রহ করে অনুমতি দিন।");

    const tableRows = filteredList
      .map((r) => {
        let statusBadge = "";
        if (r.status === "active") statusBadge = "<span style='color: #10B981; font-weight: bold;'>আসন্ন পরীক্ষা</span>";
        else if (r.status === "postponed") statusBadge = "<span style='color: #EF4444; font-weight: bold;'>স্থগিত</span>";
        else statusBadge = "<span style='color: #6B7280;'>সম্পন্ন</span>";

        const formattedDate = new Date(r.examDate).toLocaleDateString("bn-BD", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric"
        });

        return `
          <tr>
            <td style="font-weight: 600; color: #1E293B;">${getCourseTitle(r.courseId)}</td>
            <td>
              <strong style="font-size: 13px; color: #0F172A;">${r.subjectName}</strong><br/>
              <span style="display:inline-block; margin-top:4px; padding: 2px 6px; font-size:10px; font-weight:700; background-color:#F1F5F9; color:#475569; border-radius:4px;">${r.examType}</span>
            </td>
            <td>
              <div>📅 ${formattedDate}</div>
              <div style="margin-top: 4px; color: #475569;">⏰ সময়: <strong>${r.examTime}</strong></div>
            </td>
            <td>
              <div>⏱️ সময়সীমা: <strong>${r.duration} মিনিট</strong></div>
              <div style="margin-top: 4px; color: #0284C7;">🎯 পূর্ণমান: <strong>${r.totalMarks}</strong></div>
            </td>
            <td style="font-size: 11px; color: #334155; line-height: 1.4;">
              ${r.syllabusTopic || "সম্পূর্ণ সিলেবাস"}
              ${r.remarks ? `<div style="margin-top: 6px; padding-top: 4px; border-top: 1px dashed #E2E8F0; font-style: italic; color: #64748B;">📌 নোট: ${r.remarks}</div>` : ""}
            </td>
            <td style="font-size: 11px;">
              <div>📍 ${r.roomNo || "অনলাইন অ্যাপ"}</div>
              <div style="margin-top: 4px; color: #64748B;">👨‍🏫 পরিদর্শক: ${r.instructor || "-"}</div>
            </td>
            <td style="text-align: center;">${statusBadge}</td>
          </tr>
        `;
      })
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>পরীক্ষার রুটিন শিডিউল - MCQ HERO</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap');
            body { 
              font-family: 'Hind Siliguri', 'Inter', system-ui, -apple-system, sans-serif; 
              padding: 40px; 
              color: #1E293B; 
              line-height: 1.6;
              background-color: #FFFFFF;
            }
            .header-container {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 4px solid #0EA5E9;
              padding-bottom: 16px;
              margin-bottom: 30px;
            }
            .logo-section {
              text-align: left;
            }
            .logo-section h1 { 
              margin: 0; 
              font-size: 28px; 
              color: #0F172A; 
              font-weight: 800; 
              letter-spacing: -0.5px; 
            }
            .logo-section h1 span {
              color: #0EA5E9;
            }
            .logo-section p { 
              margin: 3px 0 0; 
              font-size: 13px; 
              color: #64748B; 
              font-weight: 500; 
            }
            .meta-section {
              text-align: right;
              font-size: 12px;
              color: #475569;
            }
            .meta-badge {
              display: inline-block;
              background-color: #F0F9FF;
              color: #0369A1;
              border: 1px solid #B9E6FE;
              padding: 4px 10px;
              border-radius: 9999px;
              font-weight: 700;
              font-size: 12px;
              margin-bottom: 5px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 30px; 
              font-size: 12px; 
            }
            th { 
              background-color: #0F172A; 
              color: #FFFFFF; 
              border: 1px solid #1E293B; 
              padding: 12px 10px; 
              font-weight: 700; 
              text-align: left; 
            }
            td { 
              border: 1px solid #E2E8F0; 
              padding: 12px 10px; 
              vertical-align: top; 
            }
            tr:nth-child(even) { 
              background-color: #F8FAFC; 
            }
            .notice-card {
              background-color: #F8FAFC;
              border-left: 4px solid #0EA5E9;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 35px;
              font-size: 12px;
              color: #334155;
            }
            .notice-card h4 {
              margin: 0 0 6px 0;
              color: #0F172A;
              font-size: 13px;
              font-weight: 700;
            }
            .notice-card ul {
              margin: 0;
              padding-left: 20px;
            }
            .notice-card li {
              margin-bottom: 4px;
            }
            .footer { 
              margin-top: 50px; 
              border-top: 1px solid #E2E8F0; 
              padding-top: 15px; 
              font-size: 11px; 
              text-align: center; 
              color: #94A3B8; 
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div class="logo-section">
              <h1>MCQ <span>HERO</span></h1>
              <p>পরীক্ষার অফিসিয়াল সময়সূচী ও রুটিন তালিকা</p>
            </div>
            <div class="meta-section">
              <div class="meta-badge">${getSelectedFilterText()}</div>
              <div>রুটিন প্রকাশের তারিখ: ${new Date().toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" })}</div>
            </div>
          </div>

          <div class="notice-card">
            <h4>💡 পরীক্ষার্থীদের জন্য গুরুত্বপূর্ণ নির্দেশিকা:</h4>
            <ul>
              <li>নির্ধারিত তারিখে উল্লেখিত সুনির্দিষ্ট সময় অনুযায়ী মোবাইল অ্যাপ অথবা ওয়েবসাইটে লাইভ পরীক্ষায় অংশ নিন।</li>
              <li>ভুল উত্তরের জন্য অফিশিয়াল নিয়ম অনুযায়ী নেগেটিভ মার্কিং হিসাব করা হবে।</li>
              <li>পরীক্ষা শেষ হওয়ার সাথে সাথে অটো-রেজাল্ট এবং মেরিট লিস্ট / লিডারবোর্ড ড্যাশবোর্ডে প্রকাশিত হবে।</li>
            </ul>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 15%;">কোর্স বা ব্যাচ</th>
                <th style="width: 25%;">পরীক্ষার বিষয় ও ধরণ</th>
                <th style="width: 18%;">তারিখ ও সময়</th>
                <th style="width: 12%;">সময় ও পূর্ণমান</th>
                <th style="width: 15%;">সিলেবাস বিস্তারিত</th>
                <th style="width: 10%;">ভেন্যু / মাধ্যম</th>
                <th style="width: 8%; text-align: center;">রুটিন অবস্থা</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <div class="footer">
            © MCQ HERO. ALL RIGHTS RESERVED. এটি অটো-জেনারেটেড অফিশিয়াল স্টুডেন্ট শিডিউল রুটিন ফাইল।
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Bulk print selection toggles
  const handleToggleSelectAll = () => {
    const list = getFilteredRoutines();
    const ids = list.map((r) => r.id || "");
    const allSelected = ids.every((id) => selectedForPrint.includes(id));
    if (allSelected) {
      // Remove all elements of current list from selectedForPrint
      setSelectedForPrint(selectedForPrint.filter((id) => !ids.includes(id)));
    } else {
      // Add all elements to selection
      const union = Array.from(new Set([...selectedForPrint, ...ids]));
      setSelectedForPrint(union);
    }
  };

  const handleToggleSelect = (id: string) => {
    if (selectedForPrint.includes(id)) {
      setSelectedForPrint(selectedForPrint.filter((i) => i !== id));
    } else {
      setSelectedForPrint([...selectedForPrint, id]);
    }
  };

  // Routine Filter logic
  const getFilteredRoutines = () => {
    return routines.filter((r) => {
      const matchCourse = filterCourse ? r.courseId === filterCourse : true;
      const matchType = filterType ? r.examType === filterType : true;
      const matchStatus = filterStatus ? r.status === filterStatus : true;
      const matchSearch = searchQuery
        ? r.subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.syllabusTopic.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.instructor.toLowerCase().includes(searchQuery.toLowerCase())
        : true;
      return matchCourse && matchType && matchStatus && matchSearch;
    });
  };

  const filteredList = getFilteredRoutines();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-md">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2 font-display">
            <Calendar className="w-6 h-6 text-teal-400" />
            পরীক্ষার রুটিন ড্যাশবোর্ড
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            বিভিন্ন ব্যাচের চলমান ও আসন্ন কুইজ, উইকলি ও ফাইনাল মূল্যায়নের সময়সূচী হালনাগাদ করুন
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportAllFilteredPDF}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer h-[42px] shadow-md shadow-emerald-600/15"
            title="বর্তমান ফিল্টার করা সম্পূর্ণ রুটিন ডাউনলোড করুন"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
            রুটিন PDF ডাউনলোড ({filteredList.length})
          </button>
          <button
            onClick={handlePrintRoutines}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-700/85 h-[42px]"
            title="নির্বাচিত স্লটগুলো প্রিন্ট করুন"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            নির্বাচিত প্রিন্ট (${selectedForPrint.length})
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-500/10 cursor-pointer h-[42px]"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? "ফর্ম বন্ধ করুন" : "নতুন রুটিন শিডিউল"}
          </button>
        </div>
      </div>

      {/* Routine Configuration Form Panel */}
      {showForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden animate-fade-in shadow-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl pointer-events-none" />
          <h3 className="text-md sm:text-lg font-extrabold text-white mb-6 flex items-center gap-2 pb-3 border-b border-slate-800">
            <ClipboardList className="w-5 h-5 text-teal-400" />
            {editingId ? "রুটিন শিডিউল সংশোধন করুন" : "নতুন পরীক্ষার রুটিন স্লট সংযুক্ত করুন"}
          </h3>

          <form onSubmit={handleSaveRoutine} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Course Selector */}
              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1.5">১. লক্ষ্য কোর্স সিলেক্ট করুন *</label>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-teal-400 h-[46px]"
                  required
                >
                  <option value="">নির্বাচন করুন...</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                  <option value="general">সাধারণ / সকলের জন্য উন্মুক্ত</option>
                </select>
              </div>

              {/* Subject Name */}
              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1.5">২. বিষয়ের নাম (Subject Name) *</label>
                <input
                  type="text"
                  placeholder="যেমন: বাংলা ব্যাকরণ ও চর্যাপদ"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-teal-400 h-[46px]"
                  required
                />
              </div>

              {/* Exam Duration and Total Marks */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-bold block mb-1.5">৩. সময় (মিঃ)</label>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-teal-400 h-[46px]"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-bold block mb-1.5">৪. পূর্ণমান (Marks)</label>
                  <input
                    type="number"
                    min="5"
                    max="500"
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-teal-400 h-[46px]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Exam Date */}
              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1.5">৫. পরীক্ষার তারিখ (Exam Date) *</label>
                <div className="relative">
                  <input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-teal-400 h-[46px]"
                    required
                  />
                </div>
              </div>

              {/* Exam Time */}
              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1.5">৬. পরীক্ষার সূচি/সময় (Exam Time) *</label>
                <input
                  type="text"
                  placeholder="যেমন: সন্ধ্যা ০৬:০০ টা বা 18:00"
                  value={examTime}
                  onChange={(e) => setExamTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-teal-400 h-[46px]"
                  required
                />
              </div>

              {/* Exam Venue / App Room */}
              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1.5">৭. পরীক্ষার মাধ্যম / কক্ষ নং</label>
                <input
                  type="text"
                  placeholder="যেমন: অনলাইন মোবাইল অ্যাপ"
                  value={roomNo}
                  onChange={(e) => setRoomNo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-teal-400 h-[46px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Exam Type selection */}
              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1.5">৮. মুল্যায়নের ধরণ (Exam Type)</label>
                <select
                  value={examType}
                  onChange={(e) => setExamType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-teal-400 h-[46px]"
                >
                  <option value="ডেইলি কুইজ টেস্ট">ডেইলি কুইজ টেস্ট</option>
                  <option value="সাপ্তাহিক মডেল টেস্ট">সাপ্তাহিক মডেল টেস্ট</option>
                  <option value="মাসিক ফাইনাল টেস্ট">মাসিক ফাইনাল টেস্ট</option>
                  <option value="মেগা স্পেশাল পরীক্ষা">মেগা স্পেশাল পরীক্ষা</option>
                  <option value="প্রিলিমিনারি প্র্যাকটিস">প্রিলিমিনারি প্র্যাকটিস</option>
                </select>
              </div>

              {/* Instructor */}
              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1.5">৯. পরিদর্শক / শিক্ষক (Instructor)</label>
                <input
                  type="text"
                  placeholder="যেমন: হাসান মাসুদ স্যার"
                  value={instructor}
                  onChange={(e) => setInstructor(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-teal-400 h-[46px]"
                />
              </div>

              {/* Status */}
              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1.5">১০. বর্তমান অবস্থা (Status)</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-teal-400 h-[46px]"
                >
                  <option value="active">সক্রিয় (Active)</option>
                  <option value="postponed">স্থগিত (Postponed)</option>
                  <option value="completed">সম্পন্ন (Completed)</option>
                </select>
              </div>
            </div>

            {/* Syllabus Details */}
            <div>
              <label className="text-xs text-slate-300 font-bold block mb-1.5">১১. সিলেবাস বিস্তারিত (Topics & Chapters)</label>
              <textarea
                rows={3}
                placeholder="সিলেবাসে অন্তর্ভুক্ত টপিকসমূহ এখানে সুন্দরভাবে লিখুন..."
                value={syllabusTopic}
                onChange={(e) => setSyllabusTopic(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-teal-400 resize-none"
              />
            </div>

            {/* Remarks */}
            <div>
              <label className="text-xs text-slate-300 font-bold block mb-1.5">১২. বিশেষ নির্দেশনাবলী বা রুটিন নোট (Remarks)</label>
              <input
                type="text"
                placeholder="যেমন: নেগেটিভ মার্ক ০.২৫ প্রযোজ্য, পরীক্ষা রাত ৯টা পর্যন্ত সক্রিয় থাকবে।"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-teal-400 h-[46px]"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-5 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer h-[46px]"
              >
                বাতিল করুন
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white px-8 py-3 rounded-xl text-xs font-bold transition-all hover:shadow-lg hover:shadow-teal-500/10 cursor-pointer h-[46px]"
              >
                {loading ? (
                  <div className="flex items-center gap-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    সংরক্ষণ হচ্ছে...
                  </div>
                ) : (
                  editingId ? "তথ্য আপডেট করুন" : "শিডিউল প্রকাশ করুন"
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Routine Filters with Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md">
        <div className="flex items-center gap-2 mb-4 text-xs font-bold text-slate-400">
          <SlidersHorizontal className="w-4 h-4 text-teal-400" />
          <span>রুটিন ফিল্টার ও দ্রুত অনুসন্ধান করুন</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Query search searchbox */}
          <div className="relative">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="বিষয়, টপিক বা শিক্ষক খোঁজেন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white outline-none focus:border-teal-400 h-[42px]"
            />
          </div>

          {/* Filter Course searchbox */}
          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-teal-400 h-[42px]"
          >
            <option value="">কোর্স ফিল্টার: অল (All Courses)</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
            <option value="general">সাধারণ কোর্সসমূহ</option>
          </select>

          {/* Filter Exam Type */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-teal-400 h-[42px]"
          >
            <option value="">ধরণের ফিল্টার: অল (All Type)</option>
            <option value="데일리 কুইজ টেস্ট">데일리 কুইজ টেস্ট</option>
            <option value="সাপ্তাহিক মডেল টেস্ট">সাপ্তাহিক মডেল টেস্ট</option>
            <option value="মাসিক ফাইনাল টেস্ট">মাসিক ফাইনাল টেস্ট</option>
            <option value="মেগা স্পেশাল পরীক্ষা">মেগা স্পেশাল পরীক্ষা</option>
            <option value="প্রিলিমিনারি প্র্যাকটিস">প্রিলিমিনারি প্র্যাকটিস</option>
          </select>

          {/* Filter Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-teal-400 h-[42px]"
          >
            <option value="">অবস্থার ফিল্টার: অল (All Status)</option>
            <option value="active">সক্রিয় (Active)</option>
            <option value="postponed">স্থগিত (Postponed)</option>
            <option value="completed">সম্পন্ন (Completed)</option>
          </select>
        </div>
      </div>

      {/* Routine Display Area / Table / Grid Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-teal-400 mb-2" />
          <span className="text-xs">পরীক্ষার সময়সূচী লোড করা হচ্ছে...</span>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="text-center bg-slate-900/40 border border-slate-850 rounded-3xl py-16 px-4">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-300 font-bold">কোন উপযুক্ত পরীক্ষার রুটিন মেলেনি!</p>
          <p className="text-xs text-slate-500 mt-1">অনুগ্রহ করে রুটিন ফিল্টার পরিবর্তন করুন অথবা নতুন রুটিন শিডিউল স্লট যুক্ত করুন।</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          {/* Card list header */}
          <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex justify-between items-center text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                onChange={handleToggleSelectAll}
                checked={
                  filteredList.length > 0 &&
                  filteredList.every((r) => selectedForPrint.includes(r.id || ""))
                }
                className="rounded border-slate-700 bg-slate-950 text-teal-500 focus:ring-teal-500 h-4 w-4"
              />
              <span className="font-bold">সব সিলেক্ট করুন (প্রিন্টের জন্য)</span>
            </div>
            <span>মোট {filteredList.length} টি সময়সূচী স্লট পাওয়া গেছে</span>
          </div>

          <div className="divide-y divide-slate-800">
            {filteredList.map((routine) => {
              const isSelected = selectedForPrint.includes(routine.id || "");
              return (
                <div
                  key={routine.id}
                  className={`p-6 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-850/50 ${
                    isSelected ? "bg-teal-500/5 border-l-4 border-l-teal-500" : ""
                  }`}
                >
                  {/* Left Column: Selector checkbox + Date/Time badges + Core Title */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className="pt-1.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(routine.id || "")}
                        className="rounded border-slate-700 bg-slate-950 text-teal-500 focus:ring-teal-500 h-4 w-4"
                      />
                    </div>

                    <div className="space-y-2 flex-grow">
                      {/* Badge metadata row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-slate-800 ring-1 ring-slate-700 text-slate-200 text-[10px] px-2 py-0.5 rounded-lg font-bold">
                          {getCourseTitle(routine.courseId)}
                        </span>
                        <span className="bg-teal-500/10 text-teal-300 ring-1 ring-teal-500/20 text-[10px] px-2 py-0.5 rounded-lg font-bold">
                          {routine.examType}
                        </span>
                        {routine.status === "active" && (
                          <span className="bg-emerald-500/15 text-emerald-400 text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                            আসন্ন পরীক্ষা
                          </span>
                        )}
                        {routine.status === "completed" && (
                          <span className="bg-slate-800 text-slate-400 text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                            সম্পন্ন (Ended)
                          </span>
                        )}
                        {routine.status === "postponed" && (
                          <span className="bg-rose-500/15 text-rose-400 text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            স্থগিত রুটিন
                          </span>
                        )}
                      </div>

                      {/* Main Routine Title block */}
                      <h4 className="text-md sm:text-lg font-extrabold text-white">
                        {routine.subjectName}
                      </h4>

                      {/* Schedule syllabus details */}
                      <p className="text-xs text-slate-400 leading-relaxed font-normal">
                        🎯 <span className="font-semibold text-slate-300">সিলেবাস:</span> {routine.syllabusTopic}
                      </p>

                      {/* Remarks display if exists */}
                      {routine.remarks && (
                        <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-850/80 text-[11px] text-slate-400 max-w-2xl leading-normal italic">
                          📌 {routine.remarks}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle Column: Details Grid for Date, Time, Venue, Instructor */}
                  <div className="grid grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-4 text-xs border-t border-b md:border-none border-slate-800/60 py-4 md:py-0">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-teal-400" />
                        <span className="font-bold">তারিখ ও সময়</span>
                      </div>
                      <p className="text-slate-200 font-bold pl-5 leading-none">
                        {new Date(routine.examDate).toLocaleDateString("bn-BD", { month: "short", day: "numeric" })}, {routine.examTime}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-teal-400" />
                        <span className="font-bold">সময় ও মান</span>
                      </div>
                      <p className="text-slate-200 font-bold pl-5 leading-none">
                        {routine.duration} মিঃ / {routine.totalMarks} নম্বর
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <MapPin className="w-3.5 h-3.5 text-teal-400" />
                        <span className="font-bold">পরীক্ষার কক্ষ</span>
                      </div>
                      <p className="text-slate-200 pl-5 leading-none font-medium truncate max-w-[130px]">
                        {routine.roomNo}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <User className="w-3.5 h-3.5 text-teal-400" />
                        <span className="font-bold">পরিচালক</span>
                      </div>
                      <p className="text-slate-200 pl-5 leading-none font-medium truncate max-w-[130px]">
                        {routine.instructor}
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Edit/Delete buttons */}
                  <div className="flex items-center gap-2 md:flex-col lg:flex-row justify-end">
                    <button
                      onClick={() => handleEditInit(routine)}
                      className="p-2 bg-slate-800 hover:bg-teal-500/20 text-slate-400 hover:text-teal-400 rounded-xl transition-all border border-slate-700/60 cursor-pointer text-xs flex items-center gap-1"
                      title="সম্পাদনা"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>সম্পাদনা</span>
                    </button>
                    <button
                      onClick={() => handleDeleteRoutine(routine.id || "")}
                      className="p-2 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition-all border border-slate-700/60 cursor-pointer text-xs flex items-center gap-1"
                      title="ডিলিট"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>মুছুন</span>
                    </button>
                  </div>
                </div>
              );
            })}
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
