import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  Download, 
  BookOpen, 
  HelpCircle, 
  Clock, 
  MessageSquare, 
  RefreshCw, 
  Layers, 
  Check, 
  Search,
  Eye,
  Award,
  FileText
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Question, Category, SubCategory } from "../types";

// Vector MCQ HERO Official Logo for infinite crisp scalability at 1080x1350 resolution
function McqHeroLogo({ className = "w-16 h-16" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer Golden/Yellow double ring */}
      <circle cx="60" cy="60" r="54" fill="#03011c" stroke="#FFC107" strokeWidth="4.5" />
      <circle cx="60" cy="60" r="48" fill="url(#heroLogoNavy)" stroke="#1565FF" strokeWidth="1" />
      
      {/* Open Book Graphics */}
      <path d="M38 48C45 44 55 45 60 48C65 45 75 44 82 48V78C75 74 65 75 60 78C55 75 45 74 38 78V48Z" fill="white" stroke="#0A2F6B" strokeWidth="1.5" />
      <path d="M60 48V78" stroke="#1565FF" strokeWidth="2" />
      
      {/* Heavy tick representation */}
      <path d="M52 52L58 58L68 44" stroke="#FFC107" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      
      {/* Branding Typography */}
      <text x="60" y="93" textAnchor="middle" fill="white" fontSize="13" fontWeight="900" fontFamily='"Inter", sans-serif' letterSpacing="0.5">MCQ</text>
      <text x="60" y="106" textAnchor="middle" fill="#FFC107" fontSize="14" fontWeight="900" fontFamily='"Inter", sans-serif' letterSpacing="1">HERO</text>
      
      {/* Star decal in Hero */}
      <polygon points="88,99 90,103 94,103 91,106 92,110 88,108 84,110 85,106 82,103 86,103" fill="#FFC107" />
      
      <defs>
        <radialGradient id="heroLogoNavy" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" transform="translate(60 60) rotate(90) scale(48)">
          <stop offset="0%" stopColor="#1565FF" />
          <stop offset="100%" stopColor="#0A2F6B" />
        </radialGradient>
      </defs>
    </svg>
  );
}

interface QuizPosterGeneratorProps {
  categories: Category[];
  subcategories: SubCategory[];
  questions: Question[];
  triggerReload: () => void;
  isSandboxMode: boolean;
}

export default function QuizPosterGenerator({
  categories,
  subcategories,
  questions,
  triggerReload,
  isSandboxMode
}: QuizPosterGeneratorProps) {
  // Navigation & Filtering
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedSubchainId, setSelectedSubchainId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Selection states
  const [activePreviewQ, setActivePreviewQ] = useState<Question | null>(null);

  // Filtered lists
  const filteredSubcategories = selectedCategoryId
    ? subcategories.filter((s) => s.parentId === selectedCategoryId)
    : subcategories;

  const currentSubcategoryQuestions = questions.filter((q) => {
    if (selectedSubchainId) {
      return q.subId === selectedSubchainId;
    }
    // If no subcategory is selected, but category is selected, collect all questions from subcategories of this category
    if (selectedCategoryId) {
      const allowedSubs = subcategories.filter((s) => s.parentId === selectedCategoryId).map((s) => s.id);
      return allowedSubs.includes(q.subId);
    }
    return true;
  });

  const searchedQuestions = currentSubcategoryQuestions.filter((q) => {
    if (searchQuery.trim()) {
      const text = q.question.toLowerCase();
      const query = searchQuery.toLowerCase();
      return text.includes(query);
    }
    return true;
  });

  // Track subcategory selector change to update active question
  useEffect(() => {
    if (searchedQuestions.length > 0) {
      setActivePreviewQ(searchedQuestions[0]);
    } else {
      setActivePreviewQ(null);
    }
  }, [selectedSubchainId, selectedCategoryId]);

  // Find subcategory name for topic title display on poster
  const matchedSubcategory = subcategories.find((s) => s.id === (activePreviewQ?.subId || selectedSubchainId));
  const subcategoryName = matchedSubcategory ? matchedSubcategory.name : "সাধারণ জ্ঞান";

  // Calculate automated Challenge Index based on selected question sequence within that subcategory
  const questionIndex = activePreviewQ ? currentSubcategoryQuestions.findIndex((q) => q.id === activePreviewQ.id) + 1 : 1;
  const challengeNoText = String(questionIndex).padStart(3, "0");

  // Download Action states
  const [downloadProgress, setDownloadProgress] = useState<string | null>(null);
  const captureRef = useRef<HTMLDivElement | null>(null);

  // Dynamic Typography sizes depending on Length to prevent Bengali Text overflow
  const getQuestionFontSize = (text: string) => {
    const len = text.length;
    if (len > 150) return "text-2xl leading-relaxed";
    if (len > 100) return "text-3xl leading-relaxed";
    if (len > 60) return "text-4xl leading-relaxed";
    return "text-[42px] leading-snug";
  };

  const getOptionFontSize = (text1: string, text2: string, text3: string, text4: string) => {
    const maxLen = Math.max(text1.length, text2.length, text3.length, text4.length);
    if (maxLen > 30) return "text-base";
    if (maxLen > 20) return "text-lg";
    return "text-xl";
  };

  // Capture utility returning high resolution canvas
  const createCaptureCanvas = async (): Promise<HTMLCanvasElement | null> => {
    const element = captureRef.current;
    if (!element) {
      alert("পোস্টার রেন্ডার লোডিং সমস্যা। অনুগ্রহ করে আবার চেষ্টা করুন।");
      return null;
    }
    
    // Smooth rendering pause
    await new Promise((resolve) => setTimeout(resolve, 150));

    try {
      const canvas = await html2canvas(element, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#030e21",
        scale: 1, // Strict 1080x1350 resolution export
        width: 1080,
        height: 1350,
        windowWidth: 1080,
        windowHeight: 1350,
        logging: false,
      });
      return canvas;
    } catch (err: any) {
      console.error("Canvas export failed: ", err);
      alert("কনভার্ট করার সময় ত্রুটি ঘটেছে: " + err.message);
      return null;
    }
  };

  // Download Actions
  const handleDownloadPNG = async () => {
    if (!activePreviewQ) return;
    setDownloadProgress("PNG");
    const canvas = await createCaptureCanvas();
    if (canvas) {
      const image = canvas.toDataURL("image/png", 1.0);
      const link = document.createElement("a");
      link.href = image;
      link.download = `MCQ_HERO_DAILY_QUIZ_#${challengeNoText}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    setDownloadProgress(null);
  };

  const handleDownloadJPG = async () => {
    if (!activePreviewQ) return;
    setDownloadProgress("JPG");
    const canvas = await createCaptureCanvas();
    if (canvas) {
      const image = canvas.toDataURL("image/jpeg", 0.95);
      const link = document.createElement("a");
      link.href = image;
      link.download = `MCQ_HERO_DAILY_QUIZ_#${challengeNoText}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    setDownloadProgress(null);
  };

  const handleDownloadPDF = async () => {
    if (!activePreviewQ) return;
    setDownloadProgress("PDF");
    const canvas = await createCaptureCanvas();
    if (canvas) {
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [1080, 1350]
      });
      pdf.addImage(imgData, "JPEG", 0, 0, 1080, 1350, undefined, "FAST");
      pdf.save(`MCQ_HERO_DAILY_QUIZ_#${challengeNoText}.pdf`);
    }
    setDownloadProgress(null);
  };

  // Safe fallback text rendering support
  const cleanOptionText = (val: any) => {
    if (!val) return "---";
    return String(val).trim();
  };

  return (
    <div className="space-y-6">
      {/* Visual Admin Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-[#0a2f6b] to-indigo-950 border border-teal-500/30 p-6 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-1 z-10">
          <span className="bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full inline-flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
            AUTOMATIC EXPORTER ENGINE
          </span>
          <h1 className="text-2xl font-extrabold text-white font-sans tracking-tight">
            🎨 Quiz Poster Generator
          </h1>
          <p className="text-slate-300 text-xs font-bangla max-w-2xl">
            পোস্টার জেনারেশন এখন সম্পূর্ণ স্বয়ংক্রিয়! অ্যাডমিন শুধু ক্যাটাগরি, সাব-ক্যাটাগরি ও প্রশ্ন সিলেক্ট করবেন। <span className="text-amber-400 font-semibold">MCQ HERO</span> এর অফিশিয়াল ব্রান্ডিং এ Facebook-এর জন্য হাই-রেজোলিউশন ১০৮০×১৩৫০ সাইজের ইমেজ স্বয়ংক্রিয়ভাবে তৈরি হবে।
          </p>
        </div>
      </div>

      {/* Main Column Grid layout split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Interactive Selection Control Column */}
        <div className="lg:col-span-5 space-y-5">
          
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-teal-400 flex items-center gap-2 font-bangla">
              <Layers className="w-4 h-4 text-teal-400" />
              কুইজ পোস্টার কন্ট্রোল প্যানেল
            </h2>

            {/* Category selection */}
            <div>
              <label className="text-slate-300 text-[11px] font-bold block mb-1.5 font-bangla">
                ১. ক্যাটাগরি সিলেক্ট করুন (Category)
              </label>
              <select
                value={selectedCategoryId}
                onChange={(e) => {
                  setSelectedCategoryId(e.target.value);
                  setSelectedSubchainId(""); // clear sub
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-slate-200 text-xs outline-none focus:border-teal-500 font-sans"
              >
                <option value="">সকল ক্যাটাগরি</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Subcategory selection dropdown */}
            <div>
              <label className="text-slate-300 text-[11px] font-bold block mb-1.5 font-bangla">
                ২. সাব-ক্যাটাগরি সিলেক্ট করুন (Sub Category)
              </label>
              <select
                value={selectedSubchainId}
                disabled={!selectedCategoryId}
                onChange={(e) => setSelectedSubchainId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-slate-200 text-xs outline-none focus:border-teal-500 font-sans disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">সকল সাব-ক্যাটাগরি</option>
                {filteredSubcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
            </div>

            {/* Question Filter search query input */}
            <div className="relative pt-1">
              <label className="text-slate-300 text-[11px] font-bold block mb-1.5 font-bangla">
                প্রশ্ন সার্চ করুন (Search Question)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="প্রশ্ন লিখে ফিল্টার করুন..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-slate-200 text-xs outline-none focus:border-teal-500 h-[38px] font-bangla"
                />
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>
            </div>
          </div>

          {/* Question selection listing scrollbox */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-xl space-y-3">
            <span className="text-slate-400 text-xs font-bold block pb-1.5 border-b border-slate-800 font-bangla">
              ৩. ফিল্টারকৃত প্রশ্নের তালিকা ({searchedQuestions.length} টি)
            </span>

            <div className="h-[430px] overflow-y-auto space-y-2 pr-1">
              {searchedQuestions.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-center space-y-2 text-slate-500">
                  <HelpCircle className="w-8 h-8 text-slate-700" />
                  <span className="text-[11px] font-bangla">কোনো প্রশ্ন পাওয়া যায়নি। অন্য সাব-ক্যাটাগরি সিলেক্ট করুন।</span>
                </div>
              ) : (
                searchedQuestions.map((q, idx) => {
                  const subIdx = currentSubcategoryQuestions.findIndex((item) => item.id === q.id) + 1;
                  const isActive = activePreviewQ?.id === q.id;

                  return (
                    <div
                      key={q.id || idx}
                      onClick={() => setActivePreviewQ(q)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer relative group ${
                        isActive 
                          ? "bg-slate-800/80 border-[#1565FF] shadow-lg shadow-blue-500/5 text-white" 
                          : "bg-slate-950/40 border-slate-800/70 hover:bg-slate-850/60 text-slate-300"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className={`h-5 w-5 rounded-full shrink-0 text-[10px] font-bold flex items-center justify-center ${isActive ? 'bg-[#1565FF] text-white' : 'bg-slate-800 text-slate-400'}`}>
                          {subIdx}
                        </span>
                        <div className="space-y-1">
                          <p className="text-[11.5px] leading-relaxed font-bangla font-medium">
                            {q.question}
                          </p>
                          <div className="flex items-center gap-2 pt-0.5 text-[9px] font-sans text-slate-400 font-bold uppercase">
                            <span className="bg-slate-950/55 px-1.5 py-0.5 rounded text-amber-500">Ans Option: {q.correctAnswer}</span>
                            {q.examTag && <span className="bg-slate-950/55 px-1.5 py-0.5 rounded text-teal-400 font-bangla">#{q.examTag}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Exporter Rendering Display Column */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Action Download Buttons Toolbar */}
          <div className="bg-slate-900 border border-slate-800 p-4.5 rounded-2xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-left">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide block">CURRENT STATUS</span>
              <span className="text-[12px] font-bold text-white font-bangla">
                {activePreviewQ ? `প্রশ্ন নং ${questionIndex} নির্বাচন করা হয়েছে` : "কোনো প্রশ্ন নির্বাচিত নেই"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleDownloadPNG}
                disabled={!activePreviewQ || downloadProgress !== null}
                className="bg-[#0A2F6B] hover:bg-blue-800 text-white font-extrabold text-[11px] py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 h-10 flex-1 sm:flex-none cursor-pointer disabled:opacity-50"
              >
                {downloadProgress === "PNG" ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    তৈরি হচ্ছে...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Download PNG
                  </>
                )}
              </button>

              <button
                onClick={handleDownloadJPG}
                disabled={!activePreviewQ || downloadProgress !== null}
                className="bg-[#1565FF] hover:bg-blue-600 text-white font-extrabold text-[11px] py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 h-10 flex-1 sm:flex-none cursor-pointer disabled:opacity-50"
              >
                {downloadProgress === "JPG" ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    তৈরি হচ্ছে...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Download JPG
                  </>
                )}
              </button>

              <button
                onClick={handleDownloadPDF}
                disabled={!activePreviewQ || downloadProgress !== null}
                className="bg-rose-650 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[11px] py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 h-10 flex-1 sm:flex-none cursor-pointer disabled:opacity-50"
              >
                {downloadProgress === "PDF" ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    তৈরি হচ্ছে...
                  </>
                ) : (
                  <>
                    <FileText className="w-3.5 h-3.5" />
                    Download PDF
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-slate-950/40 p-4 border border-slate-900 rounded-2xl">
            {/* Aspect Scale Frame representing 1080x1350 perfectly downsized using absolute CSS ratios inside standard container */}
            {activePreviewQ ? (
              <div className="space-y-4">
                
                {/* Visual container showcasing styled layout representing the true design output */}
                <div className="border border-slate-800 rounded-[32px] overflow-hidden shadow-2xl relative w-full aspect-[1080/1350] max-w-[440px] mx-auto bg-[#03011c] text-white flex flex-col justify-between p-7 font-sans select-none">
                  
                  {/* Subtle Grid backdrop */}
                  <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ 
                    backgroundImage: `radial-gradient(ellipse at top right, #1565FF 0%, transparent 65%), 
                                      radial-gradient(circle at 10% 25%, #0A2F6B 0%, transparent 65%)`
                  }} />

                  {/* Top Left logo positioning, completely absolute */}
                  <div className="absolute left-6 top-6 z-30 flex items-center gap-2">
                    <McqHeroLogo className="w-12 h-12" />
                  </div>

                  {/* Decorative Stars */}
                  <div className="absolute right-6 top-7 text-yellow-400 select-none opacity-90 space-y-1.5 flex flex-col items-end">
                    <div className="w-6 h-1 bg-yellow-400 rotate-[25deg] rounded-full translate-x-1" />
                    <div className="w-8 h-1 bg-yellow-400 rotate-[-10deg] rounded-full" />
                    <div className="w-5 h-1 bg-yellow-400 rotate-[45deg] rounded-full" />
                  </div>

                  {/* Header Banner Block containing DAILY QUIZ */}
                  <div className="flex flex-col items-center mt-3 relative z-10 w-full pl-12">
                    {/* Top yellow teaser banner */}
                    <div className="bg-[#FFC107] text-[#0A2F6B] px-4 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider mb-2.5 shadow-md flex items-center gap-1 border border-yellow-300 font-sans">
                      <Award className="w-3 h-3 shrink-0" />
                      <span>প্রতিদিন শিখুন, নিজেকে প্রস্তুত করুন</span>
                    </div>

                    {/* Blue daily quiz header banner */}
                    <div className="w-full relative px-2">
                      <div className="bg-gradient-to-r from-[#0A2F6B] via-[#0D3F8D] to-[#0A2F6B] border border-blue-500/40 py-2.5 px-4 rounded-xl flex flex-col items-center relative shadow-lg">
                        <h2 style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }} className="text-xl font-black text-white tracking-widest font-sans uppercase">
                          DAILY <span className="text-[#FFC107]">QUIZ</span>
                        </h2>
                      </div>

                      {/* Small overlay challenge badge */}
                      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 z-20">
                        <span className="bg-blue-600 border border-blue-400 text-white font-mono text-[8px] font-extrabold py-0.5 px-3 rounded-full shadow tracking-wider uppercase">
                          CHALLENGE #{challengeNoText}
                        </span>
                      </div>
                    </div>

                    {/* Subject field pill */}
                    <div className="mt-4">
                      <div className="bg-[#0c2452] border border-blue-500/20 rounded-full py-0.5 px-3.5 flex items-center gap-1.5 shadow-inner">
                        <span className="bg-[#1565FF] p-1 rounded-full text-white">
                          <BookOpen className="w-2.5 h-2.5" />
                        </span>
                        <span className="text-[8.5px] font-bold text-blue-300 font-bangla">বিষয়:</span>
                        <span className="text-[9.5px] font-black text-white font-bangla">{subcategoryName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Core Question Bengali Card block */}
                  <div className="bg-white text-slate-950 p-4.5 rounded-[24px] mx-1 relative z-10 shadow-xl border-2 border-white">
                    {/* Question text block */}
                    <div className="flex items-start gap-2.5 mb-3 border-b border-dashed border-slate-200 pb-3">
                      <span className="bg-[#0A2F6B] text-white font-black text-[9.5px] py-0.5 px-2.5 rounded-full flex items-center gap-0.5 shrink-0 shadow">
                        <span className="text-[#FFC107]">?</span> প্রশ্ন:
                      </span>
                      <span className="text-[13.5px] font-black text-slate-900 leading-relaxed font-bangla">
                        {activePreviewQ.question}
                      </span>
                    </div>

                    {/* Clean 2-column response options grid layout */}
                    <div className="grid grid-cols-2 gap-2.5 mt-1">
                      {/* Option A */}
                      <div className="bg-slate-50 border border-slate-200 min-h-[36px] rounded-xl flex items-center p-2 shadow-sm">
                        <span className="bg-[#0A2F6B] text-white font-bold h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px]">A</span>
                        <span className="pl-2 font-bold text-[10.5px] text-slate-800 font-bangla leading-snug">{cleanOptionText(activePreviewQ.option1)}</span>
                      </div>

                      {/* Option B */}
                      <div className="bg-slate-50 border border-slate-200 min-h-[36px] rounded-xl flex items-center p-2 shadow-sm">
                        <span className="bg-[#0A2F6B] text-white font-bold h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px]">B</span>
                        <span className="pl-2 font-bold text-[10.5px] text-slate-800 font-bangla leading-snug">{cleanOptionText(activePreviewQ.option2)}</span>
                      </div>

                      {/* Option C */}
                      <div className="bg-slate-50 border border-slate-200 min-h-[36px] rounded-xl flex items-center p-2 shadow-sm">
                        <span className="bg-[#0A2F6B] text-white font-bold h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px]">C</span>
                        <span className="pl-2 font-bold text-[10.5px] text-slate-800 font-bangla leading-snug">{cleanOptionText(activePreviewQ.option3)}</span>
                      </div>

                      {/* Option D */}
                      <div className="bg-slate-50 border border-slate-200 min-h-[36px] rounded-xl flex items-center p-2 shadow-sm">
                        <span className="bg-[#0A2F6B] text-white font-bold h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px]">D</span>
                        <span className="pl-2 font-bold text-[10.5px] text-slate-800 font-bangla leading-snug">{cleanOptionText(activePreviewQ.option4)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Comment & Schedule Bottom block */}
                  <div className="bg-[#091b36] border border-blue-500/15 py-2 px-3 mx-1 rounded-xl grid grid-cols-2 gap-2 relative z-10">
                    <div className="flex items-center gap-2 border-r border-blue-500/20 pr-1">
                      <span className="bg-[#1565FF] p-1 rounded-lg shrink-0 text-white">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </span>
                      <div className="flex flex-col text-left">
                        <span className="text-[9px] font-black text-[#FFC107] font-bangla leading-none mb-0.5">আপনার উত্তর কমেন্ট করুন</span>
                        <span className="text-[8px] font-bold text-slate-300 font-bangla leading-none">শুধু লিখুন: A / B / C / D</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pl-1">
                      <span className="bg-[#1565FF] p-1 rounded-lg shrink-0 text-white">
                        <Clock className="w-3.5 h-3.5" />
                      </span>
                      <div className="flex flex-col text-left">
                        <span className="text-[9px] font-bold text-slate-200 font-bangla leading-none mb-0.5">সঠিক উত্তর ও ব্যাখ্যা প্রকাশ করা হবে</span>
                        <span className="text-[8px] font-black text-[#FFC107] font-bangla leading-none">আজ রাত ৯:০০ টায়।</span>
                      </div>
                    </div>
                  </div>

                  {/* Solid corporate footer strip layout with brand logos and social icons layout */}
                  <div className="border-t border-slate-900 bg-[#020112] py-2 px-3 -mx-7 -mb-7 flex items-center justify-between text-[8px] text-slate-400">
                    <div className="flex items-center gap-1 shrink-0 font-bangla">
                      <span className="text-[#FFC107]">🏆</span>
                      <span className="text-slate-450 text-[7.5px]">প্রতিদিন কুইজ খেলুন, জ্ঞানের সাথে এগিয়ে চলুন</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[7.5px] font-medium font-bangla text-slate-550">শেয়ার করুন:</span>
                      <div className="flex gap-1">
                        <div className="w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[7px] font-bold font-sans">f</div>
                        <div className="w-3.5 h-3.5 rounded-full bg-sky-500 text-white flex items-center justify-center text-[7px] font-bold font-sans">t</div>
                        <div className="w-3.5 h-3.5 rounded-full bg-green-500 text-white flex items-center justify-center text-[7px] font-bold font-sans">w</div>
                        <div className="w-3.5 h-3.5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[7px] font-sans">i</div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Additional Explanation Preview Notes below image preview */}
                <div className="bg-slate-900 border border-slate-800 p-4.5 rounded-2xl text-xs space-y-1.5 font-bangla text-slate-350">
                  <span className="text-teal-400 font-black block flex items-center gap-1 text-[11px] uppercase">
                    💡 কুইজের সঠিক উত্তর ও ব্যাখ্যা নোট
                  </span>
                  <p className="text-slate-200">
                    • <b>সঠিক অপশন:</b> Option {activePreviewQ.correctAnswer === 1 ? "A" : activePreviewQ.correctAnswer === 2 ? "B" : activePreviewQ.correctAnswer === 3 ? "C" : "D"}
                  </p>
                  {activePreviewQ.explanation && (
                    <p className="text-slate-400 italic">
                      • <b>ব্যাখ্যা:</b> {activePreviewQ.explanation}
                    </p>
                  )}
                </div>

              </div>
            ) : (
              <div className="bg-slate-900/40 border border-slate-800 border-dashed rounded-3xl p-10 text-center h-[340px] flex flex-col items-center justify-center text-slate-500">
                <HelpCircle className="w-10 h-10 mb-2 text-slate-700 animate-pulse" />
                <p className="text-xs font-bangla text-slate-400 max-w-sm leading-relaxed">
                  কুইজ পোস্টার তৈরি করতে প্রথমে একটি ক্যাটাগরি, সাব-ক্যাটাগরি ও প্রশ্ন সিলেক্ট করুন। নির্বাচিত প্রশ্নের তথ্য নিয়ে ব্যানারটি সম্পূর্ণরূপে স্বয়ংক্রিয়ভাবে জেনারেট হবে।
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 
        PIXEL-PRECISE ULTRA-RESOLUTION HIGH DEFINITION CAPTURE TARGET CANVAS
        Hidden totally off-screen, formatted at strict 1080px by 1350px viewport size with no browser zooms.
        Perfect for professional production, prints, and crisp facebook posts.
      */}
      {activePreviewQ && (
        <div style={{ position: "absolute", left: "-9999px", top: "-9999px", width: "1080px", height: "1350px", overflow: "hidden" }}>
          <div 
            ref={captureRef}
            style={{ width: "1080px", height: "1350px" }}
            className="bg-[#03011c] text-white flex flex-col justify-between p-11 font-sans select-none relative"
          >
            {/* Gradient Backgrounds */}
            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ 
              backgroundImage: `radial-gradient(ellipse at top right, #1565FF 0%, transparent 68%), 
                                radial-gradient(circle at 10% 25%, #0A2F6B 0%, transparent 68%)`
            }} />

            {/* Retro dotted grid panel design at high res */}
            <div className="absolute left-10 top-60 text-blue-500/20 grid grid-cols-5 gap-3 pointer-events-none select-none">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="w-2.5 h-2.5 rounded-full bg-[#1565FF]" />
              ))}
            </div>

            {/* Top Left logo positioning, completely absolute */}
            <div className="absolute left-10 top-10 z-30 flex items-center gap-3">
              <McqHeroLogo className="w-24 h-24" />
            </div>

            {/* Giant Yellow Accent Deco Shapes */}
            <div className="absolute right-10 top-11 text-[#FFC107] select-none opacity-95 space-y-3 flex flex-col items-end">
              <div className="w-16 h-2 bg-[#FFC107] rotate-[25deg] rounded-full translate-x-2" />
              <div className="w-20 h-2 bg-[#FFC107] rotate-[-10deg] rounded-full" />
              <div className="w-12 h-2 bg-[#FFC107] rotate-[45deg] rounded-full" />
            </div>

            {/* Header Slogan Elements & Banner, offset to the right because logo is top-left */}
            <div className="flex flex-col items-center mt-7 relative z-10 w-full pl-36">
              {/* Daily quiz banner pill */}
              <div className="bg-[#FFC107] text-[#0A2F6B] px-10 py-1.5 rounded-full font-black text-xs uppercase tracking-widest mb-4 shadow-lg flex items-center gap-2 border-2 border-yellow-300 font-sans">
                <Award className="w-4.5 h-4.5 shrink-0" />
                <span className="text-[13px]">প্রতিদিন শিখুন, নিজেকে প্রস্তুত করুন</span>
              </div>

              {/* Huge Blue header banner block */}
              <div className="w-full relative px-6">
                <div className="bg-gradient-to-r from-[#0A2F6B] via-[#0D3F8D] to-[#0A2F6B] border-2 border-blue-500/50 py-5 px-10 rounded-2xl flex flex-col items-center relative shadow-2xl">
                  {/* Inner text shadows for look */}
                  <h2 style={{ textShadow: "0px 4px 8px rgba(0,0,0,0.6)" }} className="text-4xl font-extrabold text-white tracking-widest font-sans uppercase">
                    DAILY <span className="text-[#FFC107]">QUIZ</span>
                  </h2>
                </div>

                {/* Challenge badge indicator bottom overlay */}
                <div className="absolute -bottom-4.5 left-1/2 transform -translate-x-1/2 z-20">
                  <span className="bg-blue-600 border-2 border-blue-400 text-white font-mono text-[13px] font-black py-1.5 px-8 rounded-full shadow-xl tracking-widest uppercase">
                    CHALLENGE #{challengeNoText}
                  </span>
                </div>
              </div>

              {/* Subject topic indicators pill */}
              <div className="mt-10">
                <div className="bg-[#0c2452] border-2 border-blue-500/20 rounded-full py-1.5 px-8 flex items-center gap-2.5 shadow-inner">
                  <span className="bg-[#1565FF] p-2 rounded-full text-white">
                    <BookOpen className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-black text-blue-300 font-bangla uppercase">বিষয়:</span>
                  <span className="text-sm font-black text-white font-bangla">{subcategoryName}</span>
                </div>
              </div>
            </div>

            {/* Center Rounded Bengali Question Card */}
            <div className="bg-white text-slate-950 p-10 rounded-[36px] mx-2 my-2 relative z-10 shadow-2xl border-4 border-white">
              
              {/* Question label text layout with customizable Font-size shrink for longer text */}
              <div className="flex items-start gap-4 mb-7 border-b border-dashed border-slate-200 pb-6">
                <span className="bg-[#0A2F6B] text-white font-black text-xs py-1 px-4 rounded-full flex items-center gap-1 shrink-0 shadow">
                  <span className="text-[#FFC107]">?</span> প্রশ্ন:
                </span>
                <span className={`font-black text-slate-900 leading-relaxed font-bangla ${getQuestionFontSize(activePreviewQ.question)}`}>
                  {activePreviewQ.question}
                </span>
              </div>

              {/* Responsive Options grid block, option text scales down dynamically */}
              <div className="grid grid-cols-2 gap-5 mt-3">
                {/* Option A */}
                <div className="bg-slate-50 border-2 border-slate-200 min-h-[55px] rounded-2xl flex items-center p-3 px-4 shadow-sm">
                  <span className="bg-[#0A2F6B] text-white font-black h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-sm shadow-inner">A</span>
                  <span className={`pl-4 font-black text-slate-800 font-bangla leading-snug ${getOptionFontSize(activePreviewQ.option1 || '', activePreviewQ.option2 || '', activePreviewQ.option3 || '', activePreviewQ.option4 || '')}`}>
                    {cleanOptionText(activePreviewQ.option1)}
                  </span>
                </div>

                {/* Option B */}
                <div className="bg-slate-50 border-2 border-slate-200 min-h-[55px] rounded-2xl flex items-center p-3 px-4 shadow-sm">
                  <span className="bg-[#0A2F6B] text-white font-black h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-sm shadow-inner">B</span>
                  <span className={`pl-4 font-black text-slate-800 font-bangla leading-snug ${getOptionFontSize(activePreviewQ.option1 || '', activePreviewQ.option2 || '', activePreviewQ.option3 || '', activePreviewQ.option4 || '')}`}>
                    {cleanOptionText(activePreviewQ.option2)}
                  </span>
                </div>

                {/* Option C */}
                <div className="bg-slate-50 border-2 border-slate-200 min-h-[55px] rounded-2xl flex items-center p-3 px-4 shadow-sm">
                  <span className="bg-[#0A2F6B] text-white font-black h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-sm shadow-inner">C</span>
                  <span className={`pl-4 font-black text-slate-800 font-bangla leading-snug ${getOptionFontSize(activePreviewQ.option1 || '', activePreviewQ.option2 || '', activePreviewQ.option3 || '', activePreviewQ.option4 || '')}`}>
                    {cleanOptionText(activePreviewQ.option3)}
                  </span>
                </div>

                {/* Option D */}
                <div className="bg-slate-50 border-2 border-slate-200 min-h-[55px] rounded-2xl flex items-center p-3 px-4 shadow-sm">
                  <span className="bg-[#0A2F6B] text-white font-black h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-sm shadow-inner">D</span>
                  <span className={`pl-4 font-black text-slate-800 font-bangla leading-snug ${getOptionFontSize(activePreviewQ.option1 || '', activePreviewQ.option2 || '', activePreviewQ.option3 || '', activePreviewQ.option4 || '')}`}>
                    {cleanOptionText(activePreviewQ.option4)}
                  </span>
                </div>
              </div>

            </div>

            {/* Bottom bar guidance and timetings details layout */}
            <div className="bg-[#091b36] border-2 border-blue-500/15 p-5 mx-2 rounded-2xl grid grid-cols-2 gap-5 relative z-10">
              {/* Left Comment guidance column */}
              <div className="flex items-center gap-4 border-r-2 border-blue-500/20 pr-2">
                <span className="bg-[#1565FF] p-3 rounded-xl shrink-0 text-white shadow-md">
                  <MessageSquare className="w-6 h-6" />
                </span>
                <div className="flex flex-col text-left">
                  <span className="text-[13px] font-black text-[#FFC107] font-bangla leading-snug mb-0.5">আপনার উত্তর কমেন্ট করুন</span>
                  <span className="text-[11.5px] font-bold text-slate-300 font-bangla leading-snug">শুধু লিখুন: A / B / C / D</span>
                </div>
              </div>

              {/* Right Answers release schedule timing column */}
              <div className="flex items-center gap-4 pl-2">
                <span className="bg-[#1565FF] p-3 rounded-xl shrink-0 text-white shadow-md">
                  <Clock className="w-6 h-6" />
                </span>
                <div className="flex flex-col text-left">
                  <span className="text-[13px] font-bold text-slate-200 font-bangla leading-snug mb-0.5">সঠিক উত্তর ও ব্যাখ্যা প্রকাশ করা হবে</span>
                  <span className="text-[11.5px] font-black text-[#FFC107] font-bangla leading-snug">আজ রাত ৯:০০ টায়।</span>
                </div>
              </div>
            </div>

            {/* Footer containing logo and social icons layout */}
            <div className="border-t border-slate-900 bg-[#020112] py-4.5 px-6 -mx-11 -mb-11 flex items-center justify-between text-slate-400">
              <div className="flex items-center gap-1.5 shrink-0 font-bangla">
                <span className="text-[#FFC107] text-sm">🏆</span>
                <span className="text-slate-400 text-xs font-bold">প্রতিদিন কুইজ খেলুন, জ্ঞানের সাথে এগিয়ে চলুন</span>
              </div>

              <div className="font-display font-extrabold text-xs text-white tracking-widest flex items-center gap-1 bg-slate-950/40 px-3 py-1 rounded-md shrink-0">
                <span className="text-yellow-405 text-[#FFC107] font-sans">MCQ</span> HERO
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <span className="text-[11px] font-bold font-bangla text-slate-500 mr-1.5">শেয়ার করুন:</span>
                <div className="flex gap-2">
                  <div className="w-6.5 h-6.5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold font-sans">f</div>
                  <div className="w-6.5 h-6.5 rounded-full bg-sky-500 text-white flex items-center justify-center text-[10px] font-bold font-sans">t</div>
                  <div className="w-6.5 h-6.5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-bold font-sans">w</div>
                  <div className="w-6.5 h-6.5 rounded-full bg-indigo-505 bg-indigo-550 bg-indigo-500 text-white flex items-center justify-center text-[10px] font-sans">i</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
