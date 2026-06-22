import React, { useState, useEffect } from "react";
import {
  Image as ImageIcon,
  FileText,
  Upload,
  BookOpen,
  Trash2,
  Lock,
  Globe,
  Loader2,
  AlertTriangle,
  BookMarked
} from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "firebase/firestore";
import { db, uploadToCloudinary } from "../lib/firebase";

interface Banner {
  id: string;
  url: string;
}

interface PdfResource {
  id: string;
  title: string;
  url: string;
  access: "free" | "premium";
}

interface BookletResource {
  id: string;
  title: string;
  subject?: string;
  url: string;
  access: "free" | "premium";
}

interface ResourceManageProps {
  triggerReload: () => void;
  isSandboxMode?: boolean;
}

export default function ResourceManage({ triggerReload, isSandboxMode = false }: ResourceManageProps) {
  // Banners
  const [banners, setBanners] = useState<Banner[]>([]);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // PDFs
  const [pdfs, setPdfs] = useState<PdfResource[]>([]);
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfAccess, setPdfAccess] = useState<"free" | "premium">("free");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // Booklets
  const [booklets, setBooklets] = useState<BookletResource[]>([]);
  const [bookletTitle, setBookletTitle] = useState("");
  const [bookletSubject, setBookletSubject] = useState("");
  const [bookletAccess, setBookletAccess] = useState<"free" | "premium">("free");
  const [bookletFile, setBookletFile] = useState<File | null>(null);
  const [uploadingBooklet, setUploadingBooklet] = useState(false);

  // Load all resource data
  const loadResources = async () => {
    try {
      if (isSandboxMode) {
        const localBanners = localStorage.getItem("local_banners") || "[]";
        setBanners(JSON.parse(localBanners));

        const localRes = localStorage.getItem("local_resources") || "[]";
        setPdfs(JSON.parse(localRes));

        const localBooklets = localStorage.getItem("local_booklets") || "[]";
        setBooklets(JSON.parse(localBooklets));
      } else {
        const bSnap = await getDocs(collection(db, "banners"));
        setBanners(bSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Banner)));

        const rSnap = await getDocs(collection(db, "resources"));
        setPdfs(
          rSnap.docs.map(
            (doc) => ({ id: doc.id, title: doc.data().title || "", url: doc.data().url || "", access: doc.data().access || "free" } as PdfResource)
          )
        );

        const bkSnap = await getDocs(collection(db, "booklets"));
        setBooklets(
          bkSnap.docs.map(
            (doc) => ({
              id: doc.id,
              title: doc.data().title || "",
              subject: doc.data().subject || "",
              url: doc.data().url || "",
              access: doc.data().access || "free"
            } as BookletResource)
          )
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadResources();
  }, [isSandboxMode]);

  const handleUploadBanner = async () => {
    if (!bannerFile) return alert("প্রথমে ফাইল নির্বাচন করুন");
    setUploadingBanner(true);
    try {
      const url = await uploadToCloudinary(bannerFile);
      
      if (isSandboxMode) {
        const current = localStorage.getItem("local_banners") || "[]";
        const parsed = JSON.parse(current) as Banner[];
        parsed.push({ id: "banner-" + Date.now(), url });
        localStorage.setItem("local_banners", JSON.stringify(parsed));
        alert("ব্যানার স্যান্ডবক্স মেমরিতে সফলভাবে আপলোড করা হয়েছে!");
      } else {
        await addDoc(collection(db, "banners"), {
          url,
          createdAt: serverTimestamp()
        });
        alert("ব্যানার ক্লাউড সারভিসে সফলভাবে আপলোড করা হয়েছে!");
      }
      setBannerFile(null);
      loadResources();
      triggerReload();
    } catch (e: any) {
      alert("ব্যানার আপলোড ব্যর্থ হয়েছে: " + e.message);
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleUploadPdf = async () => {
    if (!pdfFile) return alert("পিডিএফ ফাইল নির্বাচন করুন");
    if (!pdfTitle.trim()) return alert("ফাইলটির একটি নাম/টাইটেল প্রদান করুন");
    setUploadingPdf(true);
    try {
      const url = await uploadToCloudinary(pdfFile);

      if (isSandboxMode) {
        const current = localStorage.getItem("local_resources") || "[]";
        const parsed = JSON.parse(current) as PdfResource[];
        parsed.push({ id: "res-" + Date.now(), title: pdfTitle.trim(), url, access: pdfAccess });
        localStorage.setItem("local_resources", JSON.stringify(parsed));
        alert("পিডিএফ লেকচার ফাইলটি স্যান্ডবক্স মেমরিতে সফলভাবে সেভ করা হয়েছে!");
      } else {
        await addDoc(collection(db, "resources"), {
          title: pdfTitle.trim(),
          url,
          access: pdfAccess,
          createdAt: serverTimestamp()
        });
        alert("পিডিএফ লেকচার ফাইলটি সফলভাবে সেভ করা হয়েছে!");
      }
      setPdfFile(null);
      setPdfTitle("");
      loadResources();
      triggerReload();
    } catch (e: any) {
      alert("ডকুমেন্ট আপলোড ব্যর্থ হয়েছে: " + e.message);
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleUploadBooklet = async () => {
    if (!bookletFile) return alert("পিডিএফ ফাইল নির্বাচন করুন");
    if (!bookletTitle.trim()) return alert("বুকলেটটির একটি নাম/টাইটেল প্রদান করুন");
    setUploadingBooklet(true);
    try {
      const url = await uploadToCloudinary(bookletFile);

      if (isSandboxMode) {
        const current = localStorage.getItem("local_booklets") || "[]";
        const parsed = JSON.parse(current) as BookletResource[];
        parsed.push({
          id: "bk-" + Date.now(),
          title: bookletTitle.trim(),
          subject: bookletSubject.trim(),
          url,
          access: bookletAccess
        });
        localStorage.setItem("local_booklets", JSON.stringify(parsed));
        alert("পিডিএফ বুকলেটটি স্যান্ডবক্স মেমরিতে সফলভাবে সেভ করা হয়েছে!");
      } else {
        await addDoc(collection(db, "booklets"), {
          title: bookletTitle.trim(),
          subject: bookletSubject.trim(),
          url,
          access: bookletAccess,
          createdAt: serverTimestamp()
        });
        alert("পিডিএফ বুকলেটটি সফলভাবে সেভ করা হয়েছে!");
      }
      setBookletFile(null);
      setBookletTitle("");
      setBookletSubject("");
      loadResources();
      triggerReload();
    } catch (e: any) {
      alert("বুকলেট আপলোড ব্যর্থ হয়েছে: " + e.message);
    } finally {
      setUploadingBooklet(false);
    }
  };

  const handleDeleteResource = (col: "banners" | "resources" | "booklets", id: string) => {
    setConfirmConfig({
      title: col === "banners" ? "ব্যানার মুছে ফেলার নিশ্চিতকরণ" : col === "resources" ? "পিডিএফ রিসোর্স মুছে ফেলার নিশ্চিতকরণ" : "পিডিএফ বুকলেট মুছে ফেলার নিশ্চিতকরণ",
      description: `আপনি কি নিশ্চিতভাবে এই ${col === "banners" ? "ব্যানারটি" : col === "resources" ? "পিডিএফ ফাইলটি" : "বুকলেট ফাইলটি"} ডাটাবেজ থেকে মুছে ফেলতে চান? একবার মুছে ফেললে এটি আর পুনরুদ্ধার করা যাবে না।`,
      onConfirm: async () => {
        try {
          if (isSandboxMode) {
            if (col === "banners") {
              const current = localStorage.getItem("local_banners") || "[]";
              const parsed = JSON.parse(current) as Banner[];
              const updated = parsed.filter((b) => b.id !== id);
              localStorage.setItem("local_banners", JSON.stringify(updated));
            } else if (col === "resources") {
              const current = localStorage.getItem("local_resources") || "[]";
              const parsed = JSON.parse(current) as PdfResource[];
              const updated = parsed.filter((r) => r.id !== id);
              localStorage.setItem("local_resources", JSON.stringify(updated));
            } else {
              const current = localStorage.getItem("local_booklets") || "[]";
              const parsed = JSON.parse(current) as BookletResource[];
              const updated = parsed.filter((b) => b.id !== id);
              localStorage.setItem("local_booklets", JSON.stringify(updated));
            }
            alert("সফলভাবে ডিলিট করা হয়েছে! (স্যান্ডবক্স মোড)");
          } else {
            await deleteDoc(doc(db, col, id));
            alert("সফলভাবে ডিলিট করা হয়েছে!");
          }
          loadResources();
          triggerReload();
        } catch (err: any) {
          alert("ডিলিট ব্যর্থ: " + err.message);
        }
      }
    });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* 1. Banners Panel */}
      <div className="bg-slate-800/60 p-6 rounded-2xl border border-slate-700/50 flex flex-col justify-between space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-teal-400 flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            হোম ব্যানার ও স্লাইডারস (Slider Banners)
          </h3>
          <p className="text-slate-400 text-xs leading-relaxed">
            শিক্ষার্থী অ্যাপে স্লাইডার অংশে প্রদর্শিত হওয়ার জন্য আকর্ষণীয় বিজ্ঞাপনী বা নোটিশ ব্যানার ইমেজ ফাইল আপলোড করুন।
          </p>

          <div className="flex items-center gap-4 bg-slate-900 p-3 rounded-xl border border-slate-700">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setBannerFile(e.target.files ? e.target.files[0] : null)}
              className="text-xs text-slate-400 file:bg-slate-800 file:border-0 file:text-white file:px-4 file:py-1.5 file:rounded file:mr-2 file:cursor-pointer"
            />
          </div>
        </div>

        <button
          onClick={handleUploadBanner}
          disabled={uploadingBanner || !bannerFile}
          className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-teal-500/40 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-teal-500/20"
        >
          {uploadingBanner ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> আপলোড হচ্ছে...
            </>
          ) : (
            <>
              <Upload className="w-4.5 h-4.5" /> নতুন ব্যানার ক্লাউডে যুক্ত করুন
            </>
          )}
        </button>

        {/* Existing Banner Slider List */}
        <div className="border-t border-slate-700/40 pt-4 space-y-3 flex-1 overflow-y-auto max-h-[220px]">
          <span className="text-slate-400 text-xs font-bold block mb-2">সক্রিয় ব্যানার সমূহ</span>
          {banners.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-8">কোনো ব্যানার ইমেজ আপলোড করা হয়নি</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {banners.map((b) => (
                <div
                  key={b.id}
                  className="relative rounded-lg overflow-hidden group border border-slate-700/50 h-24"
                >
                  <img src={b.url} alt="Slider" className="w-full h-full object-cover" />
                  <button
                    onClick={() => handleDeleteResource("banners", b.id)}
                    className="absolute top-2 right-2 bg-red-650/80 hover:bg-red-650 p-1.5 rounded-md text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-md"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. Lecture PDFs Panel */}
      <div className="bg-slate-800/60 p-6 rounded-2xl border border-slate-700/50 flex flex-col justify-between space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-teal-400 flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            পিডিএফ লেকচার শীট / প্রশ্নপত্র ম্যানেজার
          </h3>
          <p className="text-slate-400 text-xs leading-relaxed">
            যেকোনো ক্লাস টপিক বা পূর্ণাঙ্গ বিগত প্রশ্নের উত্তর সংবলিত পিডিএফ ফাইল শিক্ষার্থীদের পড়ার জন্য সরাসরি আপলোড করুণ।
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-300 text-xs font-semibold block mb-1.5">লেকচার ট্রপিক শিরোনাম</label>
              <input
                type="text"
                placeholder="যেমন: বাংলা সাহিত্যের ইতিহাস পিডিএফ"
                value={pdfTitle}
                onChange={(e) => setPdfTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-teal-500 h-[38px]"
              />
            </div>

            <div>
              <label className="text-slate-300 text-xs font-semibold block mb-1.5">লেকচার পিডিএফ অ্যাক্সেস</label>
              <select
                value={pdfAccess}
                onChange={(e) => setPdfAccess(e.target.value as "free" | "premium")}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-teal-500 h-[38px]"
              >
                <option value="free">ফ্রি (সকল ইউজার)</option>
                <option value="premium">প্রিমিয়াম ইউজার কেবল</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-900 p-3 rounded-xl border border-slate-700">
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setPdfFile(e.target.files ? e.target.files[0] : null)}
              className="text-xs text-slate-400 file:bg-slate-800 file:border-0 file:text-white file:px-4 file:py-1.5 file:rounded file:mr-2 file:cursor-pointer"
            />
          </div>
        </div>

        <button
          onClick={handleUploadPdf}
          disabled={uploadingPdf || !pdfFile || !pdfTitle.trim()}
          className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-teal-500/40 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-teal-500/20"
        >
          {uploadingPdf ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> ক্লাউড সকেট সেভ হচ্ছে...
            </>
          ) : (
            <>
              <Upload className="w-4.5 h-4.5" /> পিডিএফ স্লেটে আপলোড নিশ্চিত করুন
            </>
          )}
        </button>

        {/* Existing PDFs list */}
        <div className="border-t border-slate-700/40 pt-4 space-y-3 flex-1 overflow-y-auto max-h-[220px]">
          <span className="text-slate-400 text-xs font-bold block mb-2">সংরক্ষিত পিডিএফ রিসোর্স ({pdfs.length}টি)</span>
          {pdfs.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-8">কোনো পিডিএফ ডাটা ট্রাকে নেই</p>
          ) : (
            <div className="space-y-1.5 pr-1">
              {pdfs.map((p) => (
                <div
                  key={p.id}
                  className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 flex justify-between items-center text-xs"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate select-all">{p.title}</p>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <a href={p.url} target="_blank" rel="noreferrer" className="underline hover:text-teal-400">
                          ফাইল লিংক
                        </a>
                        |
                        {p.access === "premium" ? (
                          <span className="text-amber-500 flex items-center gap-0.5 font-semibold">
                            <Lock className="w-2.5 h-2.5" /> Premium
                          </span>
                        ) : (
                          <span className="text-slate-400 flex items-center gap-0.5">
                            <Globe className="w-2.5 h-2.5" /> Free
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteResource("resources", p.id)}
                    className="text-red-500 hover:bg-red-500/10 p-1.5 rounded transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. PDF Booklets Panel */}
      <div className="bg-slate-800/60 p-6 rounded-2xl border border-slate-700/50 flex flex-col justify-between space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-teal-400 flex items-center gap-2">
            <BookMarked className="w-5 h-5" />
            PDF বুকলেট ম্যানেজার (PDF Booklet)
          </h3>
          <p className="text-slate-400 text-xs leading-relaxed">
            স্মার্টফোন বা ইউজার অ্যাপে "PDF বুকলেট" স্ক্রিনে শিক্ষার্থীদের পড়া বা অফলাইন ডাউনলোডের জন্য বুকলেট ও স্টাডি গাইড আপলোড করুন।
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-300 text-xs font-semibold block mb-1.5">বুকলেট শিরোনাম / টাইটেল</label>
              <input
                type="text"
                placeholder="যেমন: BCS প্রিলি গণিত সমাধান"
                value={bookletTitle}
                onChange={(e) => setBookletTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-teal-500 h-[38px]"
              />
            </div>

            <div>
              <label className="text-slate-300 text-xs font-semibold block mb-1.5">বিষয় / বিবরণ</label>
              <input
                type="text"
                placeholder="যেমন: ১০ম - ৪৫তম গণিত প্রস্তুতি"
                value={bookletSubject}
                onChange={(e) => setBookletSubject(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-teal-500 h-[38px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-slate-300 text-xs font-semibold block mb-1.5">বুকলেট অ্যাক্সেস মডেল</label>
              <select
                value={bookletAccess}
                onChange={(e) => setBookletAccess(e.target.value as "free" | "premium")}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-teal-500 h-[38px]"
              >
                <option value="free">ফ্রি (সকল শিক্ষার্থী)</option>
                <option value="premium">প্রিমিয়াম বুকলেট কেবল</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-900 p-3 rounded-xl border border-slate-700">
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setBookletFile(e.target.files ? e.target.files[0] : null)}
              className="text-xs text-slate-400 file:bg-slate-800 file:border-0 file:text-white file:px-4 file:py-1.5 file:rounded file:mr-2 file:cursor-pointer"
            />
          </div>
        </div>

        <button
          onClick={handleUploadBooklet}
          disabled={uploadingBooklet || !bookletFile || !bookletTitle.trim()}
          className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-teal-500/40 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-teal-500/20"
        >
          {uploadingBooklet ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> বুট করে ফাইল আপলোড হচ্ছে...
            </>
          ) : (
            <>
              <Upload className="w-4.5 h-4.5" /> বুকলেট আপলোড করুন
            </>
          )}
        </button>

        {/* Existing Booklets List */}
        <div className="border-t border-slate-700/40 pt-4 space-y-3 flex-1 overflow-y-auto max-h-[220px]">
          <span className="text-slate-400 text-xs font-bold block mb-2">সংরক্ষিত পিডিএফ বুকলেট ({booklets.length}টি)</span>
          {booklets.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-8">কোনো পিডিএফ বুকলেট এখনও আপলোড করা হয়নি</p>
          ) : (
            <div className="space-y-1.5 pr-1">
              {booklets.map((b) => (
                <div
                  key={b.id}
                  className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 flex justify-between items-center text-xs"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <BookMarked className="w-5 h-5 text-amber-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate select-all">{b.title}</p>
                      {b.subject && <p className="text-[10px] text-slate-400 truncate mt-0.5">{b.subject}</p>}
                      <span className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <a href={b.url} target="_blank" rel="noreferrer" className="underline hover:text-teal-400">
                          ফাইল লিংক
                        </a>
                        |
                        {b.access === "premium" ? (
                          <span className="text-amber-500 flex items-center gap-0.5 font-semibold">
                            <Lock className="w-2.5 h-2.5" /> Premium
                          </span>
                        ) : (
                          <span className="text-slate-400 flex items-center gap-0.5">
                            <Globe className="w-2.5 h-2.5" /> Free
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteResource("booklets", b.id)}
                    className="text-red-500 hover:bg-red-500/10 p-1.5 rounded transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
