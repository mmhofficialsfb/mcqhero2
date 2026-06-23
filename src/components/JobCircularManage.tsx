import React, { useState, useEffect } from "react";
import {
  Briefcase,
  Calendar,
  Layers,
  FileText,
  Image as ImageIcon,
  Trash2,
  Upload,
  Plus,
  Loader2,
  ExternalLink,
  Search,
  Eye,
  AlertTriangle,
  X,
  Pencil
} from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { db, uploadToCloudinary } from "../lib/firebase";
import { JobCircular } from "../types";

interface JobCircularManageProps {
  triggerReload: () => void;
  isSandboxMode?: boolean;
}

export default function JobCircularManage({ triggerReload, isSandboxMode = false }: JobCircularManageProps) {
  const [circulars, setCirculars] = useState<JobCircular[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Form states
  const [title, setTitle] = useState("");
  const [vacancies, setVacancies] = useState("");
  const [deadline, setDeadline] = useState("");
  
  // Files states
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  
  // Final URLs
  const [pdfUrl, setPdfUrl] = useState("");
  const [imgUrl, setImgUrl] = useState("");

  // Preview Modal
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [previewPdf, setPreviewPdf] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);

  // Load Job Circulars
  const loadCirculars = async () => {
    setLoading(true);
    try {
      if (isSandboxMode) {
        const local = localStorage.getItem("local_job_circulars") || "[]";
        setCirculars(JSON.parse(local));
      } else {
        const querySnapshot = await getDocs(collection(db, "job_circulars"));
        const list: JobCircular[] = [];
        querySnapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as JobCircular);
        });
        // Sort by timestamp if available or descending id
        list.sort((a, b) => {
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
        });
        setCirculars(list);
      }
    } catch (err) {
      console.error("Error loading job circulars:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCirculars();
  }, [isSandboxMode]);

  // Handle PDF Upload to Cloudinary
  const handlePdfUpload = async (file: File) => {
    setUploadingPdf(true);
    try {
      const url = await uploadToCloudinary(file);
      setPdfUrl(url);
      setPdfFile(file);
    } catch (err: any) {
      alert("পিডিএফ আপলোড ব্যর্থ হয়েছে: " + err.message);
    } finally {
      setUploadingPdf(false);
    }
  };

  // Handle Image Upload to Cloudinary
  const handleImgUpload = async (file: File) => {
    setUploadingImg(true);
    try {
      const url = await uploadToCloudinary(file);
      setImgUrl(url);
      setImgFile(file);
    } catch (err: any) {
      alert("ছবি আপলোড ব্যর্থ হয়েছে: " + err.message);
    } finally {
      setUploadingImg(false);
    }
  };

  // Start editing a circular
  const handleStartEdit = (c: JobCircular) => {
    if (!c.id) return;
    setEditingId(c.id);
    setTitle(c.title);
    setVacancies(c.vacancies);
    setDeadline(c.deadline);
    setPdfUrl(c.pdfUrl || "");
    setImgUrl(c.imgUrl || "");
    setPdfFile(null);
    setImgFile(null);
    // Smooth scroll to the form top
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingId(null);
    setTitle("");
    setVacancies("");
    setDeadline("");
    setPdfUrl("");
    setImgUrl("");
    setPdfFile(null);
    setImgFile(null);
  };

  // Add or Update Job Circular
  const handleAddCircular = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !vacancies.trim() || !deadline.trim()) {
      alert("অনুগ্রহ করে টাইটেল, পোস্ট সংখ্যা এবং লাস্ট ডেট পূরণ করুন।");
      return;
    }

    try {
      if (editingId) {
        // Edit mode
        if (isSandboxMode) {
          const current = localStorage.getItem("local_job_circulars") || "[]";
          const parsed = JSON.parse(current) as JobCircular[];
          const index = parsed.findIndex((c) => c.id === editingId);
          if (index !== -1) {
            parsed[index] = {
              ...parsed[index],
              title: title.trim(),
              vacancies: vacancies.trim(),
              deadline: deadline.trim(),
              pdfUrl: pdfUrl || undefined,
              imgUrl: imgUrl || undefined,
            };
            localStorage.setItem("local_job_circulars", JSON.stringify(parsed));
          }
          alert("জব সার্কুলার সফলভাবে আপডেট করা হয়েছে (স্যান্ডবক্স)!");
        } else {
          const docRef = doc(db, "job_circulars", editingId);
          await updateDoc(docRef, {
            title: title.trim(),
            vacancies: vacancies.trim(),
            deadline: deadline.trim(),
            pdfUrl: pdfUrl || undefined,
            imgUrl: imgUrl || undefined,
          });
          alert("জব সার্কুলার সফলভাবে ক্লাউড ডাটাবেজে আপডেট করা হয়েছে!");
        }
        setEditingId(null);
      } else {
        // Add mode
        const newCircular: Omit<JobCircular, "id"> = {
          title: title.trim(),
          vacancies: vacancies.trim(),
          deadline: deadline.trim(),
          pdfUrl: pdfUrl || undefined,
          imgUrl: imgUrl || undefined,
          createdAt: isSandboxMode ? new Date().toISOString() : serverTimestamp()
        };

        if (isSandboxMode) {
          const current = localStorage.getItem("local_job_circulars") || "[]";
          const parsed = JSON.parse(current) as JobCircular[];
          const added = { id: "circ-" + Date.now(), ...newCircular };
          parsed.unshift(added);
          localStorage.setItem("local_job_circulars", JSON.stringify(parsed));
          alert("জব সার্কুলার স্যান্ডবক্স মেমরিতে সফলভাবে সংরক্ষিত হয়েছে!");
        } else {
          await addDoc(collection(db, "job_circulars"), newCircular);
          alert("জব সার্কুলার সফলভাবে ক্লাউড ডাটাবেজে যুক্ত করা হয়েছে!");
        }
      }

      // Reset form fields
      setTitle("");
      setVacancies("");
      setDeadline("");
      setPdfFile(null);
      setImgFile(null);
      setPdfUrl("");
      setImgUrl("");

      loadCirculars();
      triggerReload();
    } catch (err: any) {
      alert("সার্কুলার সংরক্ষণ করতে সমস্যা হয়েছে: " + err.message);
    }
  };

  // Delete Job Circular
  const handleDeleteCircular = async (id: string) => {
    if (!window.confirm("আপনি কি নিশ্চিতভাবে এই জব সার্কুলারটি ডিলিট করতে চান?")) {
      return;
    }

    try {
      if (isSandboxMode) {
        const current = localStorage.getItem("local_job_circulars") || "[]";
        let parsed = JSON.parse(current) as JobCircular[];
        parsed = parsed.filter((c) => c.id !== id);
        localStorage.setItem("local_job_circulars", JSON.stringify(parsed));
        alert("সফলভাবে ডিলিট করা হয়েছে (স্যান্ডবক্স)!");
      } else {
        await deleteDoc(doc(db, "job_circulars", id));
        alert("সফলভাবে ডিলিট করা হয়েছে!");
      }
      loadCirculars();
      triggerReload();
    } catch (err: any) {
      alert("ডিলিট করতে সমস্যা হয়েছে: " + err.message);
    }
  };

  const filteredCirculars = circulars.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.vacancies.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Welcome Title Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 border border-teal-500/25 p-6 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-1.5 z-10">
          <span className="bg-teal-500/10 text-teal-400 border border-teal-500/30 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full inline-flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-teal-400" />
            JOB RECRUITMENT SYSTEMS
          </span>
          <h1 className="text-2xl font-extrabold text-white font-sans tracking-tight">
            💼 Job Circular (জব সার্কুলার ম্যানেজার)
          </h1>
          <p className="text-slate-300 text-xs max-w-2xl font-bangla">
            নতুন সরকারি-বেসরকারি নিয়োগ বিজ্ঞপ্তি এবং জব সার্কুলার যোগ করুন। এখানে বিজ্ঞপ্তিটির টাইটেল, মোট পোস্ট সংখ্যা, আবেদনের শেষ তারিখ, সার্কুলার পিডিএফ ফাইল ও নোটিশ ইমেজ আপলোড দিতে পারবেন।
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Create Form */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-md space-y-4">
          <h2 className="text-sm font-bold text-teal-400 flex items-center justify-between font-bangla pb-2 border-b border-slate-850">
            <span className="flex items-center gap-2">
              {editingId ? <Pencil className="w-4 h-4 text-teal-400 animate-pulse" /> : <Plus className="w-4 h-4 text-teal-400" />}
              {editingId ? "জব সার্কুলার সংশোধন করুন" : "নতুন সার্কুলার যুক্ত করুন"}
            </span>
            {editingId && (
              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                EDIT MODE
              </span>
            )}
          </h2>

          <form onSubmit={handleAddCircular} className="space-y-4">
            {/* Title */}
            <div>
              <label className="text-slate-300 text-[11px] font-bold block mb-1.5 font-bangla">
                পদ বা বিজ্ঞপ্তির টাইটেল (Title) *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="যেমন: ৪০তম বিসিএস ক্যাডার নিয়োগ সার্কুলার"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 text-xs outline-none focus:border-teal-500 font-bangla"
              />
            </div>

            {/* Vacancies Count & Deadline Side-by-Side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 text-[11px] font-bold block mb-1.5 font-bangla">
                  মোট পোস্ট সংখ্যা (Vacancies) *
                </label>
                <input
                  type="text"
                  required
                  value={vacancies}
                  onChange={(e) => setVacancies(e.target.value)}
                  placeholder="যেমন: ১৯০৭ জন বা নির্দিষ্ট নয়"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 text-xs outline-none focus:border-teal-500 font-bangla"
                />
              </div>

              <div>
                <label className="text-slate-300 text-[11px] font-bold block mb-1.5 font-bangla">
                  আবেদন এর শেষ তারিখ (Deadline) *
                </label>
                <input
                  type="text"
                  required
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  placeholder="যেমন: ৩১ জুলাই, ২০২৬"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 text-xs outline-none focus:border-teal-500 font-bangla"
                />
              </div>
            </div>

            {/* PDF Circular Upload Option */}
            <div className="border border-slate-800/80 rounded-xl p-3.5 bg-slate-950/40 space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-slate-300 text-[11px] font-bold block font-bangla">
                  সার্কুলার এর পিডিএফ ফাইল (PDF Upload)
                </label>
                {pdfUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setPdfUrl("");
                      setPdfFile(null);
                    }}
                    className="text-red-400 hover:text-red-300 text-[10px] font-bold font-bangla cursor-pointer"
                  >
                    রিমুভ করুন
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <label className="bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 hover:text-white rounded-lg px-3 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  পিডিএফ চুজ করুন
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handlePdfUpload(e.target.files[0]);
                      }
                    }}
                  />
                </label>
                <span className="text-slate-400 text-[10px] uppercase font-mono max-w-[200px] truncate">
                  {pdfFile ? pdfFile.name : (pdfUrl ? "আপলোড করা ফাইল পাওয়া গেছে" : "কোনো পিডিএফ সিলেক্ট করা নেই")}
                </span>
              </div>
              {uploadingPdf && (
                <div className="flex items-center gap-1.5 text-xs text-amber-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>ক্লাউড সার্ভারে পিডিএফ আপলোড করা হচ্ছে...</span>
                </div>
              )}
              {pdfUrl && (
                <div className="flex items-center gap-1.5 text-[10px] text-green-400 font-bold">
                  <span>✓ পিডিএফ আপলোড সম্পন্ন হয়েছে!</span>
                </div>
              )}
            </div>

            {/* Image Notice Upload Option */}
            <div className="border border-slate-800/80 rounded-xl p-3.5 bg-slate-950/40 space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-slate-300 text-[11px] font-bold block font-bangla">
                  সার্কুলার এর ছবি বা ব্যানার (Image Upload)
                </label>
                {imgUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setImgUrl("");
                      setImgFile(null);
                    }}
                    className="text-red-400 hover:text-red-300 text-[10px] font-bold font-bangla cursor-pointer"
                  >
                    রিমুভ করুন
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <label className="bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 hover:text-white rounded-lg px-3 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  ছবি চুজ করুন
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleImgUpload(e.target.files[0]);
                      }
                    }}
                  />
                </label>
                <span className="text-slate-400 text-[10px] uppercase font-mono max-w-[200px] truncate">
                  {imgFile ? imgFile.name : (imgUrl ? "আপলোড করা ইমেজ পাওয়া গেছে" : "কোনো ছবি সিলেক্ট করা নেই")}
                </span>
              </div>
              {uploadingImg && (
                <div className="flex items-center gap-1.5 text-xs text-amber-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>সার্ভারে ছবি আপলোড করা হচ্ছে...</span>
                </div>
              )}
              {imgUrl && (
                <div className="flex items-center gap-2 mt-2">
                  <img
                    src={imgUrl}
                    alt="Preview"
                    className="w-16 h-16 rounded-md object-cover border border-slate-700 shadow-inner"
                  />
                  <span className="text-green-400 text-[10px] font-bold">✓ ছবি আপলোড সফল!</span>
                </div>
              )}
            </div>

            {/* Submit & Cancel Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="submit"
                disabled={uploadingPdf || uploadingImg}
                className="flex-1 bg-teal-500 hover:bg-teal-600 disabled:opacity-55 disabled:cursor-not-allowed text-slate-950 font-black tracking-wide text-xs py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {editingId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4 font-bold" />}
                {editingId ? "হালনাগাদ করুন (Update)" : "সংরক্ষণ করুন (Save Job Circular)"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-750 text-slate-300 font-bold text-xs py-3 px-4 rounded-xl transition-all cursor-pointer"
                >
                  বাতিল করুন
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Right Side: Circular Listings Grid and Search list */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-3">
            <span className="text-slate-200 text-xs font-bold font-bangla">
              নিযুক্ত সার্কুলার তালিকা ({filteredCirculars.length} টি)
            </span>

            <div className="relative w-full md:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="টাইটেল দিয়ে খুঁজুন..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-slate-200 text-xs outline-none focus:border-teal-500 h-[34px] font-bangla"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            </div>
          </div>

          {/* Loader */}
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-1 text-teal-400" />
              <span className="text-xs font-bangla">সার্কুলার ডাটা লোড হচ্ছে...</span>
            </div>
          ) : filteredCirculars.length === 0 ? (
            <div className="border border-slate-800 rounded-2xl p-12 text-center h-[340px] flex flex-col items-center justify-center text-slate-500 bg-slate-900/10">
              <Briefcase className="w-12 h-12 mb-2 text-slate-800 animate-pulse" />
              <span className="text-xs font-bangla text-slate-400 max-w-sm leading-relaxed">
                কোনো সার্কুলার এখনো যুক্ত করা হয়নি অথবা সার্চ করা কোয়েরির সাথে মিল পাওয়া যায়নি। নতুন সার্কুলার যোগ করতে বামপাশের ফর্ম ব্যবহার করুন।
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCirculars.map((c) => (
                <div
                  key={c.id}
                  className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:bg-slate-850/30 transition-all relative group shadow-sm"
                >
                  {/* Action Buttons (Edit & Delete) */}
                  <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 z-10">
                    <button
                      onClick={() => handleStartEdit(c)}
                      className="bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 p-1.5 rounded-lg border border-teal-500/15 cursor-pointer transition-colors"
                      title="সম্পাদনা করুন"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => c.id && handleDeleteCircular(c.id)}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-1.5 rounded-lg border border-red-500/15 cursor-pointer transition-colors"
                      title="ডিলিট করুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {/* Header Icon & Title */}
                    <div className="flex items-start gap-2.5 pr-14">
                      <span className="bg-[#1565FF]/10 text-[#1565FF] p-2 rounded-xl mt-0.5">
                        <Briefcase className="w-4 h-4" />
                      </span>
                      <h3 className="text-slate-200 text-xs font-bold leading-relaxed font-bangla">
                        {c.title}
                      </h3>
                    </div>

                    {/* Metadata indicators */}
                    <div className="grid grid-cols-2 gap-2 text-[10.5px] font-bangla border-t border-b border-slate-850 py-2 bg-slate-950/20 rounded-lg px-2 text-slate-300">
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">পোস্ট সংখ্যা</span>
                        <span className="font-extrabold text-amber-500">{c.vacancies}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">আবেদনের শেষ তারিখ</span>
                        <span className="font-extrabold text-teal-400">{c.deadline}</span>
                      </div>
                    </div>

                    {/* Uploded PDF & Image link tags */}
                    <div className="flex flex-wrap items-center gap-2.5 pt-1.5">
                      {c.pdfUrl ? (
                        <a
                          href={c.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 text-[10px] min-h-[30px] font-semibold py-1 px-2.5 rounded-lg flex items-center gap-1 shrink-0"
                        >
                          <FileText className="w-3 h-3" />
                          <span>সার্কুলার PDF</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-600 font-bangla italic">কোনো পিডিএফ ফাইল নেই</span>
                      )}

                      {c.imgUrl ? (
                        <button
                          onClick={() => setPreviewImg(c.imgUrl || null)}
                          className="bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 text-blue-400 text-[10px] min-h-[30px] font-semibold py-1 px-2.5 rounded-lg flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <ImageIcon className="w-3 h-3" />
                          <span>সার্কুলার ছবি</span>
                          <Eye className="w-2.5 h-2.5" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-600 font-bangla italic">কোনো সার্কুলার ছবি নেই</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Image Preview Modal overlay */}
      {previewImg && (
        <div className="fixed inset-0 z-[990] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 max-w-lg w-full relative space-y-4">
            <button
              onClick={() => setPreviewImg(null)}
              className="absolute top-4 right-4 bg-slate-950 p-1.5 border border-slate-800 text-slate-400 hover:text-white rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-slate-200 text-xs font-bold leading-normal font-bangla pr-8">
              সার্কুলার ছবি প্রিভিউ
            </h3>
            <div className="overflow-hidden rounded-2xl border border-slate-800 max-h-[480px] bg-slate-950 flex items-center justify-center">
              <img
                src={previewImg}
                alt="Job Circular Preview"
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div className="flex justify-end pt-1">
              <a
                href={previewImg}
                target="_blank"
                rel="noreferrer"
                className="bg-slate-800 hover:bg-slate-750 text-white hover:text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5"
              >
                <span>আসল সাইজে দেখুন (Open Details)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal overlay */}
      {previewPdf && (
        <div className="fixed inset-0 z-[990] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-3xl w-full relative space-y-4 shadow-2xl">
            <button
              onClick={() => setPreviewPdf(null)}
              className="absolute top-4 right-4 bg-slate-950 p-1.5 border border-slate-800 text-slate-400 hover:text-white rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-slate-200 text-xs font-bold leading-normal font-bangla pr-8 flex items-center gap-2">
              <FileText className="w-4 h-4 text-red-500" />
              সার্কুলার পিডিএফ প্রিভিউ
            </h3>
            
            <div className="overflow-hidden rounded-2xl border border-slate-800 h-[500px] bg-slate-950">
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewPdf)}&embedded=true`}
                className="w-full h-full border-0"
                title="PDF Viewer"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-1">
              <p className="text-[10px] text-slate-500 font-bangla leading-tight">
                * পিডিএফ ঠিকমতো লোড না হলে নিচের লিংকে ক্লিক করে সরাসরি ওপেন/ডাউনলোড করুন।
              </p>
              <div className="flex items-center gap-2 select-none">
                <a
                  href={previewPdf}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-slate-800 hover:bg-slate-750 text-white hover:text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <span>সরাসরি দেখুন (Direct Open)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
