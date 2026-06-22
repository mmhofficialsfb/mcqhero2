import React, { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Question, Category, SubCategory } from "../types";
import {
  BookOpen,
  Search,
  Filter,
  CheckCircle,
  Plus,
  Minus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Printer,
  Presentation,
  X,
  Play,
  RotateCcw,
  Eye,
  EyeOff,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Palette,
  Type,
  Loader2
} from "lucide-react";

interface SmartboardGeneratorProps {
  categories: Category[];
  subcategories: SubCategory[];
  triggerReload: () => void;
}

export default function SmartboardGenerator({
  categories,
  subcategories,
  triggerReload
}: SmartboardGeneratorProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSub, setSelectedSub] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("");
  const [selectedYear, setSelectedYear] = useState("");

  // Slide / PDF Styles Configuration
  const [slideTitle, setSlideTitle] = useState("আজকের স্মার্ট ক্লাস স্লাইড");
  const [slideFooter, setSlideFooter] = useState("MCQ HERO - স্মার্ট ক্লাস প্রেজেন্টেশন");
  const [fontSize, setFontSize] = useState<"normal" | "large" | "xlarge">("large");
  const [slideTheme, setSlideTheme] = useState<"green" | "dark" | "light" | "indigo" | "sunset" | "ocean" | "royal" | "vintage" | "smartboard">("smartboard");
  const [showAnswerInit, setShowAnswerInit] = useState(false);
  const [showExplanationInit, setShowExplanationInit] = useState(false);

  // Presenter Modal state
  const [isPresenting, setIsPresenting] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [revealAnswer, setRevealAnswer] = useState(false);
  const [revealExplanation, setRevealExplanation] = useState(false);

  // PDF Export state variables
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfProgressText, setPdfProgressText] = useState("");
  const [pdfRenderedPercent, setPdfRenderedPercent] = useState(0);

  // Load questions
  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      try {
        // Try live database first
        const qSnap = await getDocs(query(collection(db, "questions"), orderBy("createdAt", "desc")));
        const list: Question[] = [];
        qSnap.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Question);
        });

        // Fallback to sandbox if empty and saved in localStorage
        if (list.length === 0) {
          const stored = localStorage.getItem("local_questions");
          if (stored) {
            setQuestions(JSON.parse(stored));
          }
        } else {
          setQuestions(list);
        }
      } catch (err) {
        console.warn("Firestore fetch failed, checking localStorage sandbox database...", err);
        const stored = localStorage.getItem("local_questions");
        if (stored) {
          setQuestions(JSON.parse(stored));
        }
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, []);

  // Sync subcategories filter
  const subsOfCategory = selectedCategory
    ? subcategories.filter((s) => s.parentId === selectedCategory)
    : subcategories;

  // Filtered list
  const filteredQuestions = questions.filter((q) => {
    // 1. Approved status only or let everything pass for sandbox
    if (q.status === "draft") return false;

    // 2. Query match
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      const matchText = (q.question + " " + q.option1 + " " + q.option2 + " " + q.option3 + " " + q.option4 + " " + (q.examTag || "")).toLowerCase();
      if (!matchText.includes(term)) return false;
    }

    // 3. Category match (by checking if q.subId belongs to selected parentCategory)
    if (selectedCategory) {
      const allowedSubsIds = subcategories
        .filter((s) => s.parentId === selectedCategory)
        .map((s) => s.id);
      if (!allowedSubsIds.includes(q.subId)) return false;
    }

    // 4. Sub category match
    if (selectedSub && q.subId !== selectedSub) return false;

    // 5. Difficulty match
    if (selectedDifficulty && q.difficulty !== selectedDifficulty) return false;

    // 6. Year match
    if (selectedYear && q.year !== selectedYear) return false;

    return true;
  });

  // Unique years for filtering
  const availableYears = Array.from(new Set(questions.map((q) => q.year).filter(Boolean)));

  // Toggle selection helper
  const handleToggleSelect = (q: Question) => {
    const isAlreadySelected = selectedQuestions.some((item) => item.id === q.id || (item.question === q.question && item.subId === q.subId));
    if (isAlreadySelected) {
      setSelectedQuestions(selectedQuestions.filter((item) => !(item.id === q.id || (item.question === q.question && item.subId === q.subId))));
    } else {
      setSelectedQuestions([...selectedQuestions, q]);
    }
  };

  // Bulk selector
  const handleSelectAllFiltered = () => {
    const fresh = filteredQuestions.filter(
      (fq) => !selectedQuestions.some((s) => s.id === fq.id || (s.question === fq.question && s.subId === fq.subId))
    );
    setSelectedQuestions([...selectedQuestions, ...fresh]);
  };

  const handleClearSelected = () => {
    setSelectedQuestions([]);
  };

  // Move questions in queue
  const moveQuestion = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === selectedQuestions.length - 1) return;

    const updated = [...selectedQuestions];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setSelectedQuestions(updated);
  };

  // PDF Page-by-Page Printable trigger
  const handleTriggerPrint = () => {
    if (selectedQuestions.length === 0) {
      return alert("দয়া করে প্রথমে স্লাইড তৈরির জন্য প্রশ্ন সিলেক্ট করুন!");
    }

    // Temporarily apply printable container
    window.print();
  };

  // Direct Mobile 40" x 22.5" PDF Compiler & Downloader
  const handleDownloadPdfDirectly = async () => {
    if (selectedQuestions.length === 0) {
      return alert("দয়া করে প্রথমে স্লাইড সেশনের জন্য প্রশ্ন সিলেক্ট করুন!");
    }

    setIsGeneratingPdf(true);
    setPdfProgressText("পিডিএফ জেনারেটর ইঞ্জিন বুটআপ করা হচ্ছে...");
    setPdfRenderedPercent(2);

    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "in",
        format: [40, 22.5]
      });

      const totalSlides = selectedQuestions.length;

      // Helper to safely escape HTML string
      const escapeHtml = (text: string | number | undefined | null): string => {
        if (text === undefined || text === null) return "";
        return text
          .toString()
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      };

      for (let i = -1; i < totalSlides; i++) {
        const q = i >= 0 ? selectedQuestions[i] : null;
        const progressPercent = Math.round(((i + 2) / (totalSlides + 1)) * 100);
        setPdfRenderedPercent(progressPercent);

        if (i === -1) {
          setPdfProgressText("প্রথম পাতা (কভার স্লাইড) রেন্ডার করা হচ্ছে...");
        } else {
          setPdfProgressText(`স্লাইড ${i + 1} অফ ${totalSlides} রেন্ডার করা হচ্ছে...`);
        }

        // Generate Slide HTML
        const isGreen = slideTheme === "green";
        const isDark = slideTheme === "dark";
        const isIndigo = slideTheme === "indigo";
        const isLight = slideTheme === "light";
        const isSunset = slideTheme === "sunset";
        const isOcean = slideTheme === "ocean";
        const isRoyal = slideTheme === "royal";
        const isVintage = slideTheme === "vintage";
        const isSmartboard = slideTheme === "smartboard";

        let bgColor = "#0D2C22";
        let textColor = "#FFFBEB";
        let titleColor = "#2DD4BF";
        let cardBorder = "rgba(255, 255, 255, 0.1)";
        let cardBg = "rgba(255, 255, 255, 0.03)";
        let qColor = "#FFFFFF";

        if (isLight) {
          bgColor = "#FCFAEF";
          textColor = "#1E293B";
          titleColor = "#0F172A";
          cardBorder = "#CBD5E1";
          cardBg = "#FFFDF9";
          qColor = "#0F172A";
        } else if (isSmartboard) {
          bgColor = "#e2ecf5";
          textColor = "#1e293b";
          titleColor = "#1e3a8a";
          cardBorder = "#cbd5e1";
          cardBg = "#ffffff";
          qColor = "#0f172a";
        } else if (isDark) {
          bgColor = "#090D16";
          textColor = "#F1F5F9";
          titleColor = "#38BDF8";
          cardBorder = "rgba(255, 255, 255, 0.1)";
          cardBg = "rgba(255, 255, 255, 0.03)";
          qColor = "#FFFFFF";
        } else if (isIndigo) {
          bgColor = "#1E1B4B";
          textColor = "#EEF2F6";
          titleColor = "#C084FC";
          cardBorder = "rgba(255, 255, 255, 0.1)";
          cardBg = "rgba(255, 255, 255, 0.03)";
          qColor = "#FFFFFF";
        } else if (isSunset) {
          bgColor = "#4c0519";
          textColor = "#FFE4E6";
          titleColor = "#F43F5E";
          cardBorder = "rgba(255, 255, 255, 0.12)";
          cardBg = "rgba(255, 255, 255, 0.04)";
          qColor = "#FFFFFF";
        } else if (isOcean) {
          bgColor = "#042f2e";
          textColor = "#CCFBF1";
          titleColor = "#2DD4BF";
          cardBorder = "rgba(255, 255, 255, 0.1)";
          cardBg = "rgba(255, 255, 255, 0.03)";
          qColor = "#FFFFFF";
        } else if (isRoyal) {
          bgColor = "#172554";
          textColor = "#DBEAFE";
          titleColor = "#60A5FA";
          cardBorder = "rgba(255, 255, 255, 0.1)";
          cardBg = "rgba(255, 255, 255, 0.03)";
          qColor = "#FFFFFF";
        } else if (isVintage) {
          bgColor = "#F4EBE1";
          textColor = "#2F2117";
          titleColor = "#78350F";
          cardBorder = "#E3D4C1";
          cardBg = "#FDFBF7";
          qColor = "#1F1209";
        }

        let slideHtml = "";

        if (i === -1) {
          // COVER/TITLE PAGE WITH AI GENERATED THUMBNAIL
          const seed = encodeURIComponent(slideTitle);
          const thumbUrl = `https://picsum.photos/seed/${seed}/800/450?blur=1`;
          
          slideHtml = `
            <div style="
              width: 1920px;
              height: 1080px;
              padding: 95px 130px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              box-sizing: border-box;
              background-color: ${bgColor};
              color: ${textColor};
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              text-align: left;
             border-radius: 0;
            ">
              <!-- Header Brand (Cover Page) -->
              <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 5px solid ${isLight || isVintage ? cardBorder : "rgba(255, 255, 255, 0.15)"};
                padding-bottom: 30px;
              ">
                <span style="font-size: 32px; font-weight: 800; color: ${titleColor}; letter-spacing: 1.5px; text-transform: uppercase;">
                  MCQ HERO • SMARTBOARD CLASS
                </span>
                <span style="font-size: 22px; font-weight: bold; opacity: 0.8; color: ${textColor};">
                  ${new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>

              <!-- Main Hero Banner Card Area (No Page/Slide Numbers here!) -->
              <div style="
                flex-grow: 1;
                display: flex;
                align-items: center;
                gap: 80px;
                margin-top: 50px;
                margin-bottom: 50px;
              ">
                <!-- Left Details -->
                <div style="width: 50%; display: flex; flex-direction: column; justify-content: center; gap: 30px;">
                  <span style="
                    background-color: ${isLight ? "rgba(13, 148, 136, 0.1)" : "rgba(45, 212, 191, 0.1)"};
                    color: ${titleColor};
                    padding: 10px 25px;
                    border-radius: 99px;
                    font-size: 20px;
                    font-weight: 800;
                    display: inline-block;
                    align-self: flex-start;
                    letter-spacing: 1px;
                  ">
                    ✨ AI GENERATED SMART SLIDE
                  </span>
                  
                  <h1 style="
                    font-size: 60px;
                    font-weight: 900;
                    line-height: 1.35;
                    margin: 0;
                    color: ${qColor};
                    letter-spacing: -0.5px;
                  ">
                    ${escapeHtml(slideTitle)}
                  </h1>

                  <p style="font-size: 24px; opacity: 0.8; line-height: 1.6; margin: 0; color: ${textColor};">
                    এই স্লাইড সংকলনে আপনার ক্লাসের জন্য বাছাইকৃত অত্যন্ত গুরুত্বপূর্ণ প্রস্তুতিমূলক কুইজ ও সমাধান সংযুক্ত রয়েছে। স্মার্ট ইলেকট্রনিক বোর্ডে সহজে উপস্থাপনের জন্য এটি ডিজাইন করা হয়েছে।
                  </p>

                  <div style="
                    display: grid;
                    grid-template-cols: 1fr 1fr;
                    gap: 20px;
                    margin-top: 15px;
                  ">
                    <div style="background-color: ${cardBg}; border: 3px solid ${cardBorder}; padding: 20px 30px; border-radius: 20px;">
                      <span style="font-size: 16px; opacity: 0.6; display: block; margin-bottom: 5px; color: ${textColor};">মোট স্লাইড সংখ্যা</span>
                      <strong style="font-size: 28px; color: ${titleColor};">${totalSlides} টি স্লাইড</strong>
                    </div>
                    <div style="background-color: ${cardBg}; border: 3px solid ${cardBorder}; padding: 20px 30px; border-radius: 20px;">
                      <span style="font-size: 16px; opacity: 0.6; display: block; margin-bottom: 5px; color: ${textColor};">প্রেজেন্টার প্লাটফর্ম</span>
                      <strong style="font-size: 28px; color: ${titleColor};">স্মার্টবোর্ড ১৬:৯</strong>
                    </div>
                  </div>
                </div>

                <!-- Right Artwork Thumbnail (Generated dynamically / AI theme layout) -->
                <div style="
                  width: 50%;
                  height: 480px;
                  border-radius: 36px;
                  border: 8px solid ${isLight || isVintage ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)"};
                  overflow: hidden;
                  position: relative;
                ">
                  <img src="${thumbUrl}" style="
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    border-radius: 28px;
                  " />
                  
                  <!-- AI HUD overlay styling to emphasize 'AI generated' feel -->
                  <div style="
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: linear-gradient(to top, rgba(0,0,0,0.85), transparent);
                    padding: 40px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                  ">
                    <div style="color: #FFFFFF; text-align: left;">
                      <span style="font-size: 14px; opacity: 0.7; display: block; text-transform: uppercase; letter-spacing: 2px;">AI Render Engine</span>
                      <span style="font-size: 22px; font-weight: bold; color: #2DD4BF;">Concept Fluid Dynamic Art</span>
                    </div>
                    <div style="
                      background-color: rgba(45, 212, 191, 0.2);
                      border: 2px solid #2DD4BF;
                      color: #2DD4BF;
                      border-radius: 12px;
                      padding: 6px 15px;
                      font-size: 14px;
                      font-weight: 800;
                      text-transform: uppercase;
                    ">
                      Generated
                    </div>
                  </div>
                </div>
              </div>

              <!-- Footer (Cover slide: completely clean, no page numbers) -->
              <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-top: 3px solid ${isLight || isVintage ? cardBorder : "rgba(255, 255, 255, 0.1)"};
                padding-top: 30px;
              ">
                <span style="font-size: 18px; font-weight: bold; opacity: 0.5; color: ${textColor};">
                  © MCQ HERO. ALL RIGHTS RESERVED.
                </span>
                <span style="font-size: 18px; font-weight: bold; opacity: 0.5; color: ${textColor};">
                  PREMIUM TEACHER RESOURCE
                </span>
              </div>
            </div>
          `;
        } else if (q) {
          // Build individual Option elements with ক, খ, গ, ঘ
          let optionsHtml = "";
          const optionsList = [q.option1, q.option2, q.option3, q.option4];
          const bengaliLabels = ["ক", "খ", "গ", "ঘ"];

          for (let oIdx = 0; oIdx < 4; oIdx++) {
            const option = optionsList[oIdx];
            const isCorrect = q.correctAnswer === (oIdx + 1);
            const shouldHighlight = showAnswerInit && isCorrect;

            if (slideTheme === "smartboard") {
              optionsHtml += `
                <div style="
                  position: relative;
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  padding: 10px 25px;
                  border-radius: 9999px;
                  border: 4px solid ${shouldHighlight ? "#22c55e" : "#1e40af"};
                  background: ${shouldHighlight ? "linear-gradient(90deg, #1e3a8a 0%, #15803d 100%)" : "linear-gradient(180deg, #132147 0%, #1e4090 100%)"};
                  box-shadow: 
                    0 6px 12px rgba(0, 0, 0, 0.25),
                    inset 0 1px 3px rgba(255, 255, 255, 0.15);
                  min-height: 85px;
                  box-sizing: border-box;
                  color: #ffffff;
                ">
                  <div style="display: flex; align-items: center; gap: 18px;">
                    <div style="
                      width: 58px;
                      height: 58px;
                      border-radius: 50%;
                      border: 3px solid #ffffff;
                      background-color: ${shouldHighlight ? "#22c55e" : "rgba(255, 255, 255, 0.15)"};
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 28px;
                      font-weight: 900;
                      color: #ffffff;
                      flex-shrink: 0;
                    ">
                      (${bengaliLabels[oIdx]})
                    </div>
                    <div style="
                      font-size: 34px; 
                      font-weight: 700; 
                      color: #ffffff;
                      text-shadow: 0 1px 2px rgba(0,0,0,0.4);
                    ">
                      ${escapeHtml(option)}
                    </div>
                  </div>

                  ${shouldHighlight ? `
                    <div style="display: flex; align-items: center; gap: 12px; margin-right: 15px;">
                      <div style="
                        width: 44px;
                        height: 44px;
                        border-radius: 50%;
                        background-color: #22c55e;
                        border: 3px solid #ffffff;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #ffffff;
                        font-size: 28px;
                        font-weight: bold;
                      ">
                        ✔
                      </div>

                      <div style="
                        position: absolute;
                        right: -30px;
                        top: 50%;
                        transform: translateY(-50%);
                        background-color: #15803d;
                        border: 2px solid #22c55e;
                        color: #ffffff;
                        font-size: 16px;
                        font-weight: 800;
                        padding: 6px 12px;
                        border-radius: 8px 0 0 8px;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        box-shadow: -3px 4px 8px rgba(0,0,0,0.3);
                        z-index: 10;
                      ">
                        <span>সঠিক উত্তর</span>
                        <span style="font-size:12px;">▶</span>
                      </div>
                    </div>
                  ` : ""}
                </div>
              `;
            } else {
              const opBorder = shouldHighlight ? "#10B981" : cardBorder;
              const opBg = shouldHighlight
                ? (isLight ? "#ECFDF5" : "rgba(16, 185, 129, 0.12)")
                : cardBg;
              const opTextColor = shouldHighlight
                ? (isLight ? "#047857" : "#34D399")
                : "inherit";
              const bubbleBg = shouldHighlight ? "#10B981" : "rgba(0, 0, 0, 0.1)";
              const bubbleColor = shouldHighlight ? "#FFFFFF" : "inherit";

              optionsHtml += `
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 15px;
                  padding: 12px 20px;
                  border-radius: 12px;
                  border: 4px solid ${opBorder};
                  background-color: ${opBg};
                  color: ${opTextColor};
                  min-height: 70px;
                  box-sizing: border-box;
                  text-align: left;
                ">
                  <div style="
                    width: 76px;
                    height: 76px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 46px;
                    font-weight: 900;
                    border: 3px solid currentColor;
                    background-color: ${bubbleBg};
                    color: ${bubbleColor};
                    flex-shrink: 0;
                    line-height: 1;
                    text-align: center;
                    box-sizing: border-box;
                  ">
                    ${bengaliLabels[oIdx]}
                  </div>
                  <div style="font-size: 46px; font-weight: 600; line-height: 1.45;">${escapeHtml(option)}</div>
                </div>
              `;
            }
          }

          // Build explanation element if needed
          let explanationHtml = "";
          if (showExplanationInit && q.explanation) {
            const expBg = isLight ? "#F0FDFA" : "rgba(255, 255, 255, 0.04)";
            const expBorder = isLight ? "#99F6E4" : "rgba(45, 212, 191, 0.2)";
            explanationHtml = `
              <div style="
                background-color: ${expBg};
                border: 4px solid ${expBorder};
                border-radius: 24px;
                padding: 30px 45px;
                margin-top: 35px;
                box-sizing: border-box;
                text-align: left;
              ">
                <span style="font-size: 24px; font-weight: bold; color: #2DD4BF; display: block; margin-bottom: 8px;">💡 সমাধান বিবরণ:</span>
                <p style="font-size: 20px; line-height: 1.6; margin: 0; color: inherit; opacity: 0.95;">${escapeHtml(q.explanation)}</p>
              </div>
            `;
          }

               if (isSmartboard) {
            slideHtml = `
              <div style="
                width: 1920px;
                height: 1080px;
                padding: 40px 50px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                box-sizing: border-box;
                background-color: #e2ecf5;
                background-image: 
                  linear-gradient(rgba(0, 102, 204, 0.08) 1.5px, transparent 1px),
                  linear-gradient(90deg, rgba(0, 102, 204, 0.08) 1.5px, transparent 1px);
                background-size: 32px 32px;
                font-family: 'Inter', system-ui, -apple-system, sans-serif;
                text-align: left;
                border-radius: 0;
                position: relative;
                overflow: hidden;
              ">
                <!-- Top Header: Metallic Banner (from screenshot) -->
                <div style="
                  width: 100%;
                  height: 75px;
                  background: linear-gradient(180deg, #2a333f 0%, #151a21 100%);
                  border: 3px solid #cca44a;
                  border-bottom: 5px solid #a37c2d;
                  border-radius: 14px;
                  box-shadow: 0 6px 15px rgba(0, 0, 0, 0.3);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  position: relative;
                ">
                  <!-- decorative trims -->
                  <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 60px; background: linear-gradient(90deg, #a37c2d, transparent); opacity: 0.3;"></div>
                  <div style="position: absolute; right: 0; top: 0; bottom: 0; width: 60px; background: linear-gradient(-90deg, #a37c2d, transparent); opacity: 0.3;"></div>
                  
                  <span style="
                    font-size: 32px; 
                    font-weight: 800; 
                    color: #ffffff; 
                    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
                    letter-spacing: 1px;
                  ">
                    ${escapeHtml(slideTitle)}
                  </span>
                </div>

                <!-- Centered Question Box: Double gold border bracketed (from screenshot) -->
                <div style="
                  margin: 20px auto 0 auto;
                  width: 90%;
                  background: linear-gradient(180deg, #0f2d5e 0%, #05183a 100%);
                  border: 4px double #cca44a;
                  border-radius: 20px;
                  padding: 24px 35px;
                  box-shadow: 0 8px 20px rgba(0,0,0,0.35), inset 0 0 10px rgba(255,255,255,0.15);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  text-align: center;
                ">
                  <h1 style="
                    font-size: 38px;
                    font-weight: 800;
                    line-height: 1.45;
                    margin: 0;
                    color: #ffffff;
                    text-shadow: 0 2px 3px rgba(0,0,0,0.7);
                  ">
                    প্রশ্ন ${i + 1}. ${escapeHtml(q.question)}
                  </h1>
                </div>

                <!-- Main Body: grid split whiteboard and options list -->
                <div style="
                  flex-grow: 1;
                  display: flex;
                  flex-direction: row;
                  gap: 36px;
                  margin-top: 25px;
                  align-items: stretch;
                  box-sizing: border-box;
                  min-height: 520px;
                ">
                  <!-- Left side: White practice board (with grid math lines) -->
                  <div style="
                    flex: 1.15;
                    background-color: #f8fafc;
                    border: 4px solid #a0aec0;
                    border-radius: 16px;
                    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
                    background-image: 
                      linear-gradient(rgba(0, 102, 204, 0.05) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(0, 102, 204, 0.05) 1px, transparent 1px);
                    background-size: 26px 26px;
                    position: relative;
                    box-sizing: border-box;
                    padding: 24px;
                  ">
                    <span style="
                      position: absolute;
                      bottom: 15px;
                      left: 15px;
                      font-size: 11px;
                      color: #a0aec0;
                      font-weight: bold;
                      letter-spacing: 1px;
                    ">
                      📐 WRITING CANVAS (GRID)
                    </span>
                    <span style="
                      position: absolute;
                      top: 15px;
                      right: 15px;
                      font-size: 11px;
                      color: #cbd5e1;
                      font-weight: bold;
                    ">
                      RESOLVED
                    </span>
                  </div>

                  <!-- Right side: vertical capsules list -->
                  <div style="
                    width: 32%;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    gap: 16px;
                    box-sizing: border-box;
                  ">
                    ${optionsHtml}
                  </div>
                </div>

                ${explanationHtml ? `
                  <div style="margin-top: 15px; box-sizing: border-box;">
                    ${explanationHtml}
                  </div>
                ` : ""}

                <!-- Footer style (from screenshot but elegant branding) -->
                <div style="
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  border-top: 2px solid rgba(0,0,0,0.06);
                  padding-top: 15px;
                  margin-top: 15px;
                ">
                  <span style="font-size: 18px; font-weight: bold; color: #4a5568;">
                    ${escapeHtml(slideFooter)}
                  </span>
                  <span style="font-size: 18px; font-weight: bold; color: #a0aec0;">
                    SMARTBOARD COMPATIBLE • ১৬:৯
                  </span>
                </div>
              </div>
            `;
          } else {
            slideHtml = `
              <div style="
                width: 1920px;
                height: 1080px;
                padding: 85px 120px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                box-sizing: border-box;
                background-color: ${bgColor};
                color: ${textColor};
                font-family: 'Inter', system-ui, -apple-system, sans-serif;
                text-align: left;
                border-radius: 0;
              ">
                <!-- Header (Empty header spacer, no text displayed) -->
                <div style="
                  border-bottom: 5px solid ${isLight || isVintage ? cardBorder : "rgba(255, 255, 255, 0.15)"};
                  padding-bottom: 30px;
                  margin-bottom: 30px;
                ">
                </div>

                <!-- Split: Left Question and Writing canvas, Right 4 MCQ options. (Ample blank slate on left!) -->
                <div style="
                  flex-grow: 1;
                  display: flex;
                  flex-direction: row;
                  gap: 50px;
                  align-items: stretch;
                  justify-content: space-between;
                  min-height: 520px;
                  box-sizing: border-box;
                ">
                  <!-- Left Space: question on top, extremely spacious empty workspace block below for writing on interactive board -->
                  <div style="
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    gap: 25px;
                    box-sizing: border-box;
                    text-align: left;
                  ">
                    <!-- Colorful background shape wrapper for question -->
                    <div style="
                      background-color: ${isLight || isVintage ? "rgba(217, 119, 6, 0.08)" : "rgba(45, 212, 191, 0.12)"};
                      border-left: 12px solid ${isLight || isVintage ? "#D97706" : "#2DD4BF"};
                      padding: 30px 45px;
                      border-radius: 0 24px 24px 0;
                      box-sizing: border-box;
                    ">
                      <h1 style="
                        font-size: 46px;
                        font-weight: 800;
                        line-height: 1.45;
                        margin: 0;
                        color: ${isLight || isVintage ? "#2F2117" : "#FFFFFF"};
                      ">
                        ${i + 1}. ${escapeHtml(q.question)}
                      </h1>
                    </div>

                    <!-- Board writing space for smartboards/markers (Completely blank plain space) -->
                    <div style="
                      flex-grow: 1;
                      min-height: 280px;
                      box-sizing: border-box;
                    ">
                    </div>
                  </div>

                  <!-- Right Space: options vertically stacked (occupies 28% width) -->
                  <div style="
                    width: 28%;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    gap: 16px;
                    box-sizing: border-box;
                  ">
                    ${optionsHtml}
                  </div>
                </div>

                ${explanationHtml ? `
                  <div style="margin-top: 20px; box-sizing: border-box;">
                    ${explanationHtml}
                  </div>
                ` : ""}

                <!-- Footer with dynamic footer text (No page numbering digits!) -->
                <div style="
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  border-top: 3px solid ${isLight || isVintage ? cardBorder : "rgba(255, 255, 255, 0.1)"};
                  padding-top: 30px;
                  margin-top: 30px;
                ">
                  <span style="font-size: 20px; font-weight: bold; opacity: 0.6; letter-spacing: 0.5px;">
                    ${escapeHtml(slideFooter)}
                  </span>
                  <span style="font-size: 20px; font-weight: bold; opacity: 0.6;">
                    PREMIUM QUALITY EDUCATION
                  </span>
                </div>
              </div>
            `;
          }
        }

        // Create temporary offscreen workspace DOM nodes
        const tempContainer = document.createElement("div");
        tempContainer.style.position = "fixed";
        tempContainer.style.left = "-9999px";
        tempContainer.style.top = "-9999px";
        tempContainer.style.width = "1920px";
        tempContainer.style.height = "1080px";
        tempContainer.style.overflow = "hidden";
        tempContainer.style.zIndex = "-100";
        tempContainer.innerHTML = slideHtml;
        document.body.appendChild(tempContainer);

        // Capture with scale: 2 for super-sharp 4K smartboard scale quality
        const canvas = await html2canvas(tempContainer, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: bgColor
        });

        // Cleanup
        document.body.removeChild(tempContainer);

        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        doc.addImage(imgData, "JPEG", 0, 0, 40, 22.5, undefined, "FAST");

        if (i < totalSlides - 1) {
          doc.addPage([40, 22.5], "landscape");
        }
      }

      setPdfProgressText("পিডিএফ কমপাইল সম্পূর্ণ! ডাউনলোড ফাইল শুরু হচ্ছে...");
      const fileName = `${slideTitle.trim().replace(/\s+/g, "_") || "Smartboard"}_Slide_40x22.5in.pdf`;
      doc.save(fileName);

    } catch (err: any) {
      console.error(err);
      alert("দুঃখিত, মোবাইল পিডিএফ ডাউনলোড এ কোনো ইন্টারনাল সমস্যা হয়েছে: " + err.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Get active slide font style
  const getFontClass = () => {
    switch (fontSize) {
      case "normal":
        return "text-lg sm:text-xl";
      case "large":
        return "text-xl sm:text-2xl md:text-3xl";
      case "xlarge":
        return "text-2xl sm:text-4xl md:text-5xl";
    }
  };

  const getOptionFontClass = () => {
    return getFontClass();
  };

  const getBubbleSizeClass = () => {
    switch (fontSize) {
      case "normal":
        return "w-9 h-9 sm:w-11 sm:h-11";
      case "large":
        return "w-11 h-11 sm:w-14 sm:h-14 md:w-16 md:h-16";
      case "xlarge":
        return "w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24";
    }
  };

  // Get slide board background theme classes
  const getThemeClass = (isPrint = false) => {
    if (isPrint) return "bg-white text-black font-sans";
    
    switch (slideTheme) {
      case "green":
        return "bg-radial-green text-[#fffae0] font-sans";
      case "dark":
        return "bg-slate-900 border-slate-800 text-slate-100 font-sans";
      case "light":
        return "bg-amber-50/70 border-amber-150 text-slate-900 font-sans";
      case "indigo":
        return "bg-gradient-to-br from-indigo-950 to-purple-950 border-indigo-900 text-teal-100 font-sans";
      case "sunset":
        return "bg-gradient-to-br from-[#4c0519] via-[#881337] to-[#8c1c40] border-[#9f1239]/40 text-rose-100 font-sans shadow-rose-950/40";
      case "ocean":
        return "bg-gradient-to-br from-[#042f2e] via-[#115e59] to-[#0f172a] border-[#14b8a6]/20 text-cyan-100 font-sans shadow-slate-950/40";
      case "royal":
        return "bg-gradient-to-br from-[#172554] via-[#1e3a8a] to-[#312e81] border-[#3b82f6]/20 text-blue-100 font-sans shadow-blue-950/40";
      case "vintage":
        return "bg-[#F4EBE1] border-[#E3D4C1] text-[#2F2117] font-sans shadow-amber-950/10";
      case "smartboard":
        return "bg-[#e2ecf5] border-slate-300 text-slate-800 font-sans shadow-sm";
    }
  };

  // Keyboard Navigation for smartboard presentations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPresenting) return;
      if (e.key === "ArrowRight" || e.key === "Enter") {
        if (currentSlideIndex < selectedQuestions.length - 1) {
          setCurrentSlideIndex((prev) => prev + 1);
          setRevealAnswer(showAnswerInit);
          setRevealExplanation(showExplanationInit);
        }
      } else if (e.key === "ArrowLeft") {
        if (currentSlideIndex > 0) {
          setCurrentSlideIndex((prev) => prev - 1);
          setRevealAnswer(showAnswerInit);
          setRevealExplanation(showExplanationInit);
        }
      } else if (e.key === "Escape") {
        setIsPresenting(false);
      } else if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        setRevealAnswer((r) => !r);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPresenting, currentSlideIndex, selectedQuestions, showAnswerInit, showExplanationInit]);

  const startPresentation = () => {
    if (selectedQuestions.length === 0) {
      return alert("দয়া করে প্রথমে স্লাইড সেশনের জন্য প্রশ্ন সিলেক্ট করুন!");
    }
    setRevealAnswer(showAnswerInit);
    setRevealExplanation(showExplanationInit);
    setCurrentSlideIndex(0);
    setIsPresenting(true);
  };

  return (
    <div className="space-y-6">
      {/* Dynamic inline styles for Printable Slide Breakouts */}
      <style>{`
        @media print {
          @page {
            size: 40in 22.5in;
            margin: 0;
          }
          html, body {
            width: 40in !important;
            height: 22.5in !important;
            margin: 0 !important;
            padding: 0 !important;
            background-color: #FFFFFF !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide standard non-print UI */
          header, aside, main > div > *:not(.printable-slides), .no-print {
            display: none !important;
          }
          .printable-slides {
            display: block !important;
            width: 40in !important;
            height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-slide-page {
            page-break-after: always !important;
            break-after: page !important;
            width: 40in !important;
            height: 22.5in !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            padding: 100px 140px !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            background-color: ${
              slideTheme === "green"
                ? "#0D2C22"
                : slideTheme === "dark"
                ? "#090D16"
                : slideTheme === "indigo"
                ? "#120B34"
                : "#FCFAEF"
            } !important;
            color: ${
              slideTheme === "light" ? "#1E293B" : "#FFFBEB"
            } !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* High-res type hierarchy inside printed output for 40in smartboard scale */
          .print-header-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 5px solid ${
              slideTheme === "light" ? "#E2DCC8" : "rgba(255, 255, 255, 0.15)"
            };
            padding-bottom: 40px;
            margin-bottom: 60px;
          }
          .print-title {
            font-size: 52px !important;
            font-weight: 800 !important;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: ${slideTheme === "light" ? "#0F172A" : "#2DD4BF"} !important;
          }
          .print-meta-badge {
            font-size: 34px !important;
            font-weight: bold !important;
            border: 3px solid currentColor;
            padding: 10px 24px;
            border-radius: 12px;
            opacity: 0.9;
          }
          .print-question {
            font-size: 82px !important;
            line-height: 1.45 !important;
            font-weight: 800 !important;
            margin-bottom: 80px;
            color: ${slideTheme === "light" ? "#0F172A" : "#FFFFFF"} !important;
          }
          .print-options-grid {
            display: grid;
            grid-template-cols: 1fr 1fr;
            gap: 40px;
            margin-bottom: 60px;
          }
          .print-option-card {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 16px 20px !important;
            border-radius: 12px !important;
            border: 4px solid ${
              slideTheme === "light" ? "#CBD5E1" : "rgba(255, 255, 255, 0.1)"
            } !important;
            background-color: ${
              slideTheme === "light"
                ? "#FFFDF9"
                : "rgba(255, 255, 255, 0.03)"
            } !important;
            font-size: 82px !important;
            font-weight: 600 !important;
            line-height: 1.4 !important;
          }
          .print-option-card-correct {
            border: 5px solid #10B981 !important;
            background-color: ${
              slideTheme === "light" ? "#ECFDF5" : "rgba(16, 185, 129, 0.12)"
            } !important;
            color: ${slideTheme === "light" ? "#047857" : "#34D399"} !important;
            font-weight: 800 !important;
          }
          .print-number-bubble {
            width: 135px;
            height: 135px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 82px !important;
            font-weight: 900;
            border: 4px solid currentColor;
            background-color: rgba(0, 0, 0, 0.1);
            flex-shrink: 0;
            line-height: 1;
            text-align: center;
            box-sizing: border-box;
          }
          .print-number-bubble-correct {
            background-color: #10B981 !important;
            border-color: #10B981 !important;
            color: white !important;
          }
          .print-explanation-box {
            background-color: ${
              slideTheme === "light"
                ? "#F0FDFA"
                : "rgba(255, 255, 255, 0.04)"
            } !important;
            border: 4px solid ${
              slideTheme === "light" ? "#99F6E4" : "rgba(45, 212, 191, 0.2)"
            } !important;
            border-radius: 24px;
            padding: 40px 50px;
            margin-top: 40px;
          }
          .print-explanation-title {
            font-size: 38px !important;
            font-weight: bold;
            color: #2DD4BF !important;
            display: block;
            margin-bottom: 12px;
          }
          .print-explanation-text {
            font-size: 34px !important;
            line-height: 1.55 !important;
            color: inherit;
            opacity: 0.95;
          }
          .print-footer {
            border-t: 4px solid ${
              slideTheme === "light" ? "#E2DCC8" : "rgba(255, 255, 255, 0.1)"
            };
            padding-top: 35px;
            margin-top: auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 28px !important;
            font-weight: bold;
            letter-spacing: 2px;
            opacity: 0.7;
          }
        }
      `}</style>

      {/* Header Panel metadata */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div className="space-y-1">
            <span className="bg-teal-500/10 text-teal-400 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-teal-500/20">
              SMARTBOARD CLASSROOM MODULE
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white font-display">
              স্মার্টবোর্ড স্লাইড ও পিডিএফ প্রস্তুতকারক
            </h2>
            <p className="text-xs text-slate-400">
              আপনার প্রশ্ন ব্যাংক থেকে নির্দিষ্ট টপিকের প্রশ্ন সিলেক্ট করে স্মার্টবোর্ড ক্লাস নেওয়ার চমৎকার মাল্টিমিডিয়া স্লাইডার এবং প্রতি পাতায় একটি করে প্রশ্ন সংবলিত প্রিন্ট-রেডি পিডিএফ তৈরি করুন।
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={startPresentation}
              disabled={selectedQuestions.length === 0}
              className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs px-4 py-3 rounded-xl flex items-center gap-2 shadow-lg transition-all cursor-pointer h-[46px]"
            >
              <Presentation className="w-4 h-4 animate-pulse" />
              স্মার্টবোর্ডে প্রেজেন্ট করুন (Full Screen)
            </button>
            <button
              onClick={handleTriggerPrint}
              disabled={selectedQuestions.length === 0}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs px-4 py-3 rounded-xl flex items-center gap-2 transition-all cursor-pointer h-[46px]"
            >
              <Printer className="w-4 h-4 text-purple-400" />
              প্রিন্ট / উইন্ডো পিডিএফ
            </button>
            <button
              onClick={handleDownloadPdfDirectly}
              disabled={selectedQuestions.length === 0 || isGeneratingPdf}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs px-4 py-3 rounded-xl flex items-center gap-2 shadow-xl transition-all cursor-pointer h-[46px]"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-purple-200" />
                  তৈরি হচ্ছে ({pdfRenderedPercent}%)
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  সরাসরি পিডিএফ ডাউনলোড করুন (মোবাইল)
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* PDF Download and Page Guidelines Callout */}
      <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl space-y-4 no-print text-sm">
        <div className="flex items-center gap-2 text-teal-400 font-extrabold font-display">
          <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
          চলুন জেনে নেই কিভাবে ৪০″ x ২২.৫″ ফুল-স্ক্রিন রেজুলেশনের সুন্দর পিডিএফ ডাউনলোড এবং ব্রাউজার সেটিংস কনফিগার করবেন:
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="text-teal-400 font-bold block text-xs">১. ব্রাউজার প্রিন্ট উইন্ডো</span>
            <p className="text-slate-400 text-xs leading-relaxed">
              ডান পাশের <span className="text-white font-semibold">"পিডিএফ ডাউনলোড"</span> বাটনে ক্লিক করুন অথবা কীবোর্ড থেকে <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono text-white">Ctrl + P</kbd> বা <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono text-white">Cmd + P</kbd> চাপুন।
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="text-teal-400 font-bold block text-xs">২. ডেস্টিনেশন ও লেআউট</span>
            <p className="text-slate-400 text-xs leading-relaxed">
              প্রিন্ট উইন্ডো ওপেন হলে Destination হিসেবে <span className="text-teal-300 font-semibold">"Save as PDF"</span> সিলেক্ট করুন। Layout এ অবশ্যই <span className="text-teal-300 font-semibold">"Landscape"</span> সিলেক্ট করবেন।
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="text-teal-400 font-bold block text-xs">৩. মার্জিন এবং হেডার</span>
            <p className="text-slate-400 text-xs leading-relaxed">
              সেটিংসের <span className="text-white font-semibold">"Margins"</span> অপশনে <span className="text-red-400 font-semibold">"None"</span> সিলেক্ট করুন। <span className="text-white font-semibold">"Headers and footers"</span> অপশনের টিক চিহ্নটি উঠিয়ে দিন।
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="text-teal-400 font-bold block text-xs">৪. ব্যাকগ্রাউন্ড কালার (গুরুত্বপূর্ণ!)</span>
            <p className="text-slate-400 text-xs leading-relaxed">
              প্রিন্ট সেটিংস থেকে <span className="text-purple-300 font-bold">"Background graphics"</span> অপশনটিতে অবশ্যই <span className="text-emerald-400">টিক (Checked)</span> দিবেন যাতে গ্রীনবোর্ডের বোর্ড-কালার পিডিএফে থাকে।
            </p>
          </div>
        </div>
        <div className="p-3.5 bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs rounded-xl leading-relaxed">
          📐 <strong className="text-white">নিখুঁত পেজ রেশিও:</strong> আমাদের অ্যাপ্লিকেশনে আধুনিক সিএসএস মিডিয়া কোয়েরি সেট করা আছে যা পিডিএফের প্রতি পাতাকে সম্পূর্ণ স্বয়ংক্রিয়ভাবে <strong className="text-white select-all">৪০ ইঞ্চি চওড়া এবং ২২.৫ ইঞ্চি লম্বা (১৬:৯ আল্ট্রা-উইড গোল্ডেন রেশিও)</strong> তে সেভ করে দেয়। এটি বড় স্মার্টবোর্ড বা মাল্টিমিডিয়া স্ক্রিনে একদম প্রফেশনাল দেখাবে।
        </div>
      </div>

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
        {/* Left selection list and filter panel */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 space-y-4">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-1.5 font-display">
              <Filter className="w-4 h-4 text-teal-400" />
              প্রশ্ন ব্যাংক সার্চ ফিল্টার করুন
            </h3>

            {/* Selection filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">ক্যাটাগরি</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setSelectedSub("");
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white outline-none focus:border-teal-400 h-[36px] cursor-pointer"
                >
                  <option value="">সকল ক্যাটাগরি</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">সাব-ক্যাটাগরি</label>
                <select
                  value={selectedSub}
                  onChange={(e) => setSelectedSub(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white outline-none focus:border-teal-400 h-[36px] cursor-pointer"
                >
                  <option value="">সকল সাব-ক্যাটাগরি</option>
                  {subsOfCategory.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">কঠিনতার মাত্রা</label>
                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white outline-none focus:border-teal-400 h-[36px] cursor-pointer"
                >
                  <option value="">সকল মাত্রা</option>
                  <option value="easy">সহজ (Easy)</option>
                  <option value="medium">মাঝারি (Medium)</option>
                  <option value="hard">কঠিন (Hard)</option>
                </select>
              </div>
            </div>

            {/* Custom Input search tags */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="প্রশ্নপত্র অথবা নির্দিষ্ট কীওয়ার্ড লিখে সার্চ করুন..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-teal-400 h-[36px]"
                />
              </div>

              {searchQuery || selectedCategory || selectedSub || selectedDifficulty ? (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("");
                    setSelectedSub("");
                    setSelectedDifficulty("");
                    setSelectedYear("");
                  }}
                  className="px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer h-[36px] transition-colors"
                >
                  রিসেট
                </button>
              ) : null}
            </div>
          </div>

          {/* List of matched questions */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
              <span className="text-slate-300 text-xs font-semibold">
                প্রাপ্ত ফলাফলে মোট: <span className="text-teal-400 font-bold">{filteredQuestions.length}</span> টি প্রশ্ন
              </span>
              {filteredQuestions.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="text-teal-400 hover:text-teal-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  সবগুলো সিলেক্ট করুন
                </button>
              )}
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
                <span className="text-xs text-slate-400">প্রশ্ন ব্যাংক লোড হচ্ছে...</span>
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-1">
                <p className="text-xs">কোনো অনুমোদিত প্রশ্ন খুঁজে পাওয়া যায়নি।</p>
                <p className="text-[10px] text-slate-600">ভিন্ন কোনো ফিল্টার দিয়ে অথবা অন্য ক্যাটাগরিতে চেষ্টা করুন।</p>
              </div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {filteredQuestions.map((q, idx) => {
                  const isAdded = selectedQuestions.some(
                    (s) => s.id === q.id || (s.question === q.question && s.subId === q.subId)
                  );
                  return (
                    <div
                      key={q.id || idx}
                      onClick={() => handleToggleSelect(q)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                        isAdded
                          ? "bg-teal-500/10 border-teal-500/40 text-teal-100"
                          : "bg-slate-950/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-750"
                      }`}
                    >
                      <div className="pt-0.5">
                        <div
                          className={`w-[18px] h-[18px] rounded-md flex items-center justify-center border transition-all ${
                            isAdded
                              ? "bg-teal-500 border-teal-400 text-white"
                              : "border-slate-700 bg-slate-900"
                          }`}
                        >
                          {isAdded && <CheckCircle className="w-3.5 h-3.5" />}
                        </div>
                      </div>

                      <div className="flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="bg-slate-800 text-slate-300 text-[9px] font-bold px-1.5 py-0.5 rounded">
                            {categories.find(c => c.id === subcategories.find(s => s.id === q.subId)?.parentId)?.name || "N/A"}
                          </span>
                          <span className="bg-slate-900 text-slate-400 text-[9px] px-1.5 py-0.5 rounded border border-slate-800">
                            {subcategories.find((s) => s.id === q.subId)?.name || "N/A"}
                          </span>
                          {q.examTag && (
                            <span className="text-teal-400 text-[10px] font-mono">
                              #{q.examTag}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-200 font-semibold leading-relaxed">
                          {q.question}
                        </p>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-slate-400 pt-1 pointer-events-none">
                          <span className={q.correctAnswer === 1 ? "text-teal-400 font-bold" : ""}>ক) {q.option1}</span>
                          <span className={q.correctAnswer === 2 ? "text-teal-400 font-bold" : ""}>খ) {q.option2}</span>
                          <span className={q.correctAnswer === 3 ? "text-teal-400 font-bold" : ""}>গ) {q.option3}</span>
                          <span className={q.correctAnswer === 4 ? "text-teal-400 font-bold" : ""}>ঘ) {q.option4}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Preview and Setup slides list */}
        <div className="lg:col-span-5 space-y-4">
          {/* Slide Layout Settings tab */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-1.5 font-display">
              <Palette className="w-4 h-4 text-purple-400" />
              স্মার্ট স্লাইড ও প্রিন্ট ডিজাইন সিটং
            </h3>

            <div>
              <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">স্লাইড হেডার টাইটেল</label>
              <input
                type="text"
                value={slideTitle}
                onChange={(e) => setSlideTitle(e.target.value)}
                placeholder="যেমন: আজকের কুইজ প্রতিযোগিতা"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-teal-400 h-[36px]"
              />
            </div>

            <div>
              <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">ডায়নামিক ফুটার টেক্সট</label>
              <input
                type="text"
                value={slideFooter}
                onChange={(e) => setSlideFooter(e.target.value)}
                placeholder="যেমন: MCQ HERO - স্মার্ট ক্লাস প্রেজেন্টেশন"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-teal-400 h-[36px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">স্মার্টবোর্ড থিম</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => setSlideTheme("green")}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all truncate ${
                      slideTheme === "green"
                        ? "bg-teal-500/20 text-teal-400 border-teal-500"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    🟢 ক্লাসিক গ্রীন
                  </button>
                  <button
                    onClick={() => setSlideTheme("dark")}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all truncate ${
                      slideTheme === "dark"
                        ? "bg-slate-850 text-white border-slate-600"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    ⚫ সুক্ষ ডার্ক
                  </button>
                  <button
                    onClick={() => setSlideTheme("indigo")}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all truncate ${
                      slideTheme === "indigo"
                        ? "bg-indigo-500/20 text-indigo-400 border-indigo-500"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    🔵 ইডিগো কুইজ
                  </button>
                  <button
                    onClick={() => setSlideTheme("light")}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all truncate ${
                      slideTheme === "light"
                        ? "bg-amber-500/10 text-amber-600 border-amber-500"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    ⚪ রেট্রো হোয়াইট
                  </button>
                  <button
                    onClick={() => setSlideTheme("sunset")}
                    className={`px-1.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all truncate ${
                      slideTheme === "sunset"
                        ? "bg-rose-500/20 text-rose-400 border-rose-500"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    🟠 সানসেট রেড
                  </button>
                  <button
                    onClick={() => setSlideTheme("smartboard")}
                    className={`px-1.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all truncate ${
                      slideTheme === "smartboard"
                        ? "bg-[#1d4ed8]/20 text-[#1d4ed8] border-blue-500 font-extrabold"
                        : "bg-slate-905 text-slate-300 border-slate-800 hover:text-white"
                    }`}
                  >
                    🌟 স্মার্টবোর্ড খাতা
                  </button>
                  <button
                    onClick={() => setSlideTheme("ocean")}
                    className={`px-1.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all truncate ${
                      slideTheme === "ocean"
                        ? "bg-[#0f766e]/20 text-[#2dd4bf] border-[#0f766e]"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    🐳 ওশেন টিল
                  </button>
                  <button
                    onClick={() => setSlideTheme("royal")}
                    className={`px-1.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all truncate ${
                      slideTheme === "royal"
                        ? "bg-[#1d4ed8]/20 text-[#60a5fa] border-[#1d4ed8]"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    👑 রয়েল ব্লু
                  </button>
                  <button
                    onClick={() => setSlideTheme("vintage")}
                    className={`px-1.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all truncate ${
                      slideTheme === "vintage"
                        ? "bg-[#854d0e]/20 text-[#d97706] border-[#854d0e]"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    📜 ভিন্টেজ পেপার
                  </button>
                </div>
              </div>

              <div>
                <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">ফন্ট সাইজ (প্রেজেন্টার)</label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => setFontSize("normal")}
                    className={`px-1 py-2 rounded-lg text-[10px] font-bold border transition-all ${
                      fontSize === "normal"
                        ? "bg-slate-800 text-white border-slate-600"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    ঝকঝকে
                  </button>
                  <button
                    onClick={() => setFontSize("large")}
                    className={`px-1 py-2 rounded-lg text-[10px] font-bold border transition-all ${
                      fontSize === "large"
                        ? "bg-slate-800 text-white border-slate-600"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    বড় (L)
                  </button>
                  <button
                    onClick={() => setFontSize("xlarge")}
                    className={`px-1 py-2 rounded-lg text-[10px] font-bold border transition-all ${
                      fontSize === "xlarge"
                        ? "bg-slate-800 text-white border-slate-600"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    বিশাল (XL)
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800/60">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">প্রারম্ভিকভাবে সঠিক উত্তর শো করা</span>
                <input
                  type="checkbox"
                  checked={showAnswerInit}
                  onChange={(e) => setShowAnswerInit(e.target.checked)}
                  className="w-4 h-4 cursor-pointer accent-teal-500"
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">প্রারম্ভিকভাবে ব্যখ্যা শো করা</span>
                <input
                  type="checkbox"
                  checked={showExplanationInit}
                  onChange={(e) => setShowExplanationInit(e.target.checked)}
                  className="w-4 h-4 cursor-pointer accent-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Selected questions slider manager */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-bold text-white font-display">ক্লাস স্লাইডের ক্রমতালিকা</span>
              </div>
              <span className="bg-purple-500/10 text-purple-400 text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-purple-500/20">
                {selectedQuestions.length} টি স্লাইড
              </span>
            </div>

            {selectedQuestions.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <div className="inline-flex h-9 w-9 bg-slate-950 border border-slate-800 text-slate-400 rounded-xl items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <p className="text-xs">বামে প্রশ্ন ব্যাংকের পাশে সিলেক্ট বক্সে ক্লিক করে ক্লাস স্লাইডে যোগ করুন।</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {selectedQuestions.map((q, idx) => (
                  <div
                    key={q.id || idx}
                    className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between gap-2.5 hover:border-slate-700 transition-all group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="h-6 w-6 bg-slate-900 border border-slate-800 rounded-lg text-[10px] text-slate-400 font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <p className="text-xs text-slate-200 truncate font-semibold">
                        {q.question}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-all shrink-0">
                      <button
                        title="উপরে নিন"
                        onClick={() => moveQuestion(idx, "up")}
                        disabled={idx === 0}
                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="নিচে নিন"
                        onClick={() => moveQuestion(idx, "down")}
                        disabled={idx === selectedQuestions.length - 1}
                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="বাদ দিন"
                        onClick={() => handleToggleSelect(q)}
                        className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={handleClearSelected}
                  className="w-full text-slate-500 hover:text-red-400 text-[10px] font-bold text-center py-2 border border-dashed border-slate-800 rounded-xl hover:border-red-500/20 hover:bg-red-500/5 cursor-pointer transition-colors"
                >
                  সবগুলো স্লাইড ক্লিয়ার করুন
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Non-printed full-screen classroom slider presenter */}
      {isPresenting && selectedQuestions.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col no-print animate-fade-in select-none">
          {/* Slider presentation bar */}
          <header className="h-[64px] bg-slate-950 border-b border-slate-900 px-6 flex justify-between items-center text-slate-100">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-teal-500/15 text-teal-400 rounded-lg flex items-center justify-center border border-teal-500/20">
                <Presentation className="w-4 h-4" />
              </div>
              <div className="leading-tight">
                <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">SMARTBOARD CLASS</span>
                <h1 className="text-sm font-extrabold text-white font-display truncate max-w-sm sm:max-w-md">
                  {slideTitle}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg text-[10px] text-slate-400">
                <span className="px-1.5 py-0.5 font-bold">← / →</span> বাটন দিয়ে স্লাইড ও <span className="px-1.5 py-0.5 font-bold">Space</span> দিয়ে উত্তর দেখুন
              </div>
              <button
                onClick={() => setIsPresenting(false)}
                className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-red-600/20 hover:border-red-500/30 text-slate-400 hover:text-red-400 transition-all cursor-pointer"
                title="বন্ধ করুন"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Core Interactive Presentation slide deck */}
          <div className="flex-1 overflow-hidden flex flex-col justify-center items-center p-6 relative">
            <div className={`w-full max-w-5xl rounded-3xl p-8 sm:p-12 md:p-16 border shadow-2xl relative transition-all duration-300 min-h-[440px] flex flex-col justify-between ${getThemeClass()}`}>
              {/* Question metadata (Empty header spacer, no text displayed) */}
              <div className="flex justify-between items-center pb-4 border-b border-white/10 mb-6 min-h-[16px]">
              </div>

              {/* Question and Options Columns (Split left space and right options) */}
              <div className="my-auto flex flex-col md:flex-row gap-8 items-stretch flex-grow py-4">
                {/* Left side: Question prompt + Ample empty workspace for boards/markers */}
                <div className="flex-1 flex flex-col justify-between gap-6 text-left">
                  {/* Question with robust elegant background shape */}
                  <div className={`p-6 rounded-2xl border-l-[10px] ${
                    slideTheme === "light" || slideTheme === "vintage"
                      ? "bg-amber-100/80 border-amber-500 text-amber-950 shadow-sm"
                      : "bg-teal-500/10 border-teal-400 text-teal-50 shadow-lg"
                  } w-full`}>
                    <h2 className={`font-bold leading-normal font-display ${getFontClass()} !text-inherit`}>
                      {selectedQuestions[currentSlideIndex].question}
                    </h2>
                  </div>

                  {/* Clean completely empty writing space */}
                  <div className="flex-grow min-h-[240px]" />
                </div>

                {/* Right side: 4 Options stacked vertically (occupies 28% width) */}
                <div className="w-full md:w-[28%] flex flex-col justify-center gap-1.5">
                  {[
                    selectedQuestions[currentSlideIndex].option1,
                    selectedQuestions[currentSlideIndex].option2,
                    selectedQuestions[currentSlideIndex].option3,
                    selectedQuestions[currentSlideIndex].option4
                  ].map((option, oIdx) => {
                    const isCorrect = selectedQuestions[currentSlideIndex].correctAnswer === (oIdx + 1);
                    const bengaliLabels = ["ক", "খ", "গ", "ঘ"];
                    return (
                      <div
                        key={oIdx}
                        onClick={() => {
                          if (revealAnswer) {
                            setRevealAnswer(false);
                          } else {
                            setRevealAnswer(true);
                          }
                        }}
                        className={`py-1.5 px-2.5 sm:py-2 sm:px-3 rounded-lg border transition-all cursor-pointer relative overflow-hidden group flex items-center gap-3 text-left ${
                          revealAnswer && isCorrect
                            ? "bg-emerald-500/20 border-emerald-400 text-emerald-200 font-bold"
                            : "bg-white/5 border-white/10 hover:bg-white/10 text-inherit"
                        } ${getOptionFontClass()}`}
                      >
                        <div className={`${getBubbleSizeClass()} ${getOptionFontClass()} rounded-full flex items-center justify-center shrink-0 border font-extrabold transition-colors leading-none text-center ${
                          revealAnswer && isCorrect
                            ? "bg-emerald-500 border-emerald-400 text-white"
                            : "border-white/20 bg-black/20"
                        }`}>
                          {bengaliLabels[oIdx]}
                        </div>
                        <span className="select-all leading-relaxed">{option}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Explanation & toggle tray */}
              <div className="pt-6 border-t border-white/10 mt-8 flex flex-col gap-4">
                {/* Interactions row */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setRevealAnswer((r) => !r)}
                      className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                        revealAnswer
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                      }`}
                    >
                      {revealAnswer ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {revealAnswer ? "সঠিক উত্তর হাইড করুন" : "সঠিক উত্তর দেখুন"}
                    </button>
                    {selectedQuestions[currentSlideIndex].explanation && (
                      <button
                        onClick={() => setRevealExplanation((e) => !e)}
                        className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                          revealExplanation
                            ? "bg-teal-600 text-white"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                        }`}
                      >
                        {revealExplanation ? <EyeOff className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                        {revealExplanation ? "ব্যাখ্যা হাইড করুন" : "বিস্তারিত ব্যাখ্যা দেখুন"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-text explanation reveals */}
                {revealExplanation && selectedQuestions[currentSlideIndex].explanation && (
                  <div className="p-5 bg-white/5 border border-white/10 rounded-2xl animate-fade-in text-xs sm:text-sm leading-relaxed space-y-2 select-all max-h-[140px] overflow-y-auto">
                    <span className="font-bold text-teal-400 block font-display">💡 সমাধান / বিস্তারিত ব্যাখ্যা:</span>
                    <p className="text-inherit opacity-90 font-medium">
                      {selectedQuestions[currentSlideIndex].explanation}
                    </p>
                  </div>
                )}

                {/* Subtle Dynamic Footer Text Row (Perfect for Smartboard screen branding!) */}
                <div className="flex justify-between items-center text-[10px] opacity-40 pt-3 border-t border-white/5 mt-2 font-display">
                  <span>{slideFooter}</span>
                  <span>PREMIUM CLASS PRESENTATION</span>
                </div>
              </div>
            </div>

            {/* Float slide controller bottom navigation */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-slate-950/80 border border-slate-900 rounded-full flex items-center gap-6 shadow-2xl backdrop-blur-md text-slate-200">
              <button
                disabled={currentSlideIndex === 0}
                onClick={() => {
                  setCurrentSlideIndex((prev) => prev - 1);
                  setRevealAnswer(showAnswerInit);
                  setRevealExplanation(showExplanationInit);
                }}
                className="p-1.5 hover:bg-slate-900 rounded-full disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                title="পূর্ববর্তী প্রশ্ন"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <span className="text-xs font-bold font-mono tracking-wider w-24 text-center">
                {currentSlideIndex + 1} / {selectedQuestions.length}
              </span>

              <button
                disabled={currentSlideIndex === selectedQuestions.length - 1}
                onClick={() => {
                  setCurrentSlideIndex((prev) => prev + 1);
                  setRevealAnswer(showAnswerInit);
                  setRevealExplanation(showExplanationInit);
                }}
                className="p-1.5 hover:bg-slate-900 rounded-full disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                title="পরবর্তী প্রশ্ন"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable pages rendered ONLY to PDF generator via @media print bounds */}
      {selectedQuestions.length > 0 && (
        <div className="hidden printable-slides">
          {/* 1. COVER SLIDE IN PRINT OUT */}
          <div
            className="print-slide-page"
            style={{
              fontFamily: "Inter, system-ui, sans-serif"
            }}
          >
            <div className="print-header-bar">
              <span className="print-title">MCQ HERO • SMARTBOARD CLASS</span>
              <span className="print-meta-badge">কভার পেজ</span>
            </div>
            <div className="my-auto grid grid-cols-2 gap-10 items-center">
              <div className="space-y-6 text-left">
                <span className="inline-block px-3 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 text-xs font-bold rounded-full">
                  ✨ AI GENERATED SMART SLIDE
                </span>
                <h1 className="text-4xl font-black text-white leading-tight">
                  {slideTitle}
                </h1>
                <p className="text-slate-300 text-sm leading-relaxed">
                  এই স্লাইড সংকলনে আপনার ক্লাসের জন্য বাছাইকৃত অত্যন্ত গুরুত্বপূর্ণ প্রস্তুতিমূলক কুইজ ও সমাধান সংযুক্ত রয়েছে। স্মার্ট ইলেকট্রনিক বোর্ডে সহজে উপস্থাপনের জন্য এটি ডিজাইন করা হয়েছে।
                </p>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <span className="text-slate-400 block mb-1">মোট স্লাইড সংখ্যা</span>
                    <strong className="text-base text-teal-400">{selectedQuestions.length} টি স্লাইড</strong>
                  </div>
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <span className="text-slate-400 block mb-1">প্রেজেন্টার প্লাটফর্ম</span>
                    <strong className="text-base text-teal-400">স্মার্টবোর্ড ১৬:৯</strong>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 overflow-hidden relative shadow-xl">
                <img
                  src={`https://picsum.photos/seed/${encodeURIComponent(slideTitle)}/800/450?blur=1`}
                  alt="AI Generated Thumbnail"
                  className="w-full h-auto object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 flex justify-between items-end">
                  <div className="text-left">
                    <span className="text-[10px] text-slate-400 block">AI Render Engine</span>
                    <span className="text-xs font-bold text-teal-400">Concept Fluid Dynamic Art</span>
                  </div>
                  <span className="px-2 py-0.5 bg-teal-500/20 text-teal-400 border border-teal-500/20 text-[10px] font-extrabold rounded">Generated</span>
                </div>
              </div>
            </div>
            <div className="print-footer">
              <span>© MCQ HERO. ALL RIGHTS RESERVED.</span>
              <span>PREMIUM TEACHER RESOURCE</span>
            </div>
          </div>

          {/* 2. QUESTION SLIDES */}
          {selectedQuestions.map((q, qIndex) => (
            <div
              key={q.id || qIndex}
              className="print-slide-page flex flex-col justify-between"
              style={{
                fontFamily: "Inter, system-ui, sans-serif"
              }}
            >
              {/* Slidenote header top right/left (Empty, no text) */}
              <div className="print-header-bar min-h-[50px]">
              </div>

              {/* Main Content Split: Left column is question + wide whiteboard, Right column is the 4 Options stacked vertically */}
              <div className="my-auto flex flex-row gap-12 items-stretch justify-between min-h-[520px] w-full">
                {/* Left region: Question and large blank board frame */}
                <div className="flex-1 flex flex-col justify-between gap-6 text-left">
                  {/* Colorful background shape wrapper for question in print mode */}
                  <div className={`p-8 rounded-r-3xl border-l-[12px] w-full ${
                    slideTheme === "light" || slideTheme === "vintage"
                      ? "bg-[#D97706]/10 border-[#D97706] text-[#2F2117] shadow-sm"
                      : "bg-teal-500/10 border-teal-400 text-white shadow-lg"
                  }`} style={{
                    color: slideTheme === "light" || slideTheme === "vintage" ? "#2F2117" : "#FFFFFF"
                  }}>
                    <h1 className="print-question !m-0 !text-inherit">
                      {qIndex + 1}. {q.question}
                    </h1>
                  </div>

                  {/* Empty chalkboard space styled for printing (Completely blank and plain) */}
                  <div className="flex-1 min-h-[280px]" />
                </div>

                {/* Right region: Options list stacked vertically (occupies 28% width) */}
                <div className="w-[28%] flex flex-col justify-center gap-2">
                  {[q.option1, q.option2, q.option3, q.option4].map((option, oIdx) => {
                    const isCorrect = q.correctAnswer === (oIdx + 1);
                    const showCorrectHighlight = showAnswerInit && isCorrect;
                    const bengaliLabels = ["ক", "খ", "গ", "ঘ"];
                    return (
                      <div
                        key={oIdx}
                        className={`print-option-card !w-full !flex-row !text-left ${
                          showCorrectHighlight ? "print-option-card-correct" : ""
                        }`}
                      >
                        <div className={`print-number-bubble shrink-0 ${
                          showCorrectHighlight ? "print-number-bubble-correct" : ""
                        }`}>
                          {bengaliLabels[oIdx]}
                        </div>
                        <span className="leading-tight">{option}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Explanation section if existed and selected */}
              {showExplanationInit && q.explanation && (
                <div className="print-explanation-box text-left mt-4">
                  <span className="print-explanation-title">💡 সমাধান বিবরণ:</span>
                  <p className="print-explanation-text">
                    {q.explanation}
                  </p>
                </div>
              )}

              {/* Footer pagination info */}
              <div className="print-footer">
                <span>{slideFooter}</span>
                <span>PREMIUM QUALITY EDUCATION</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dynamic PDF Export Progress Overlay (Perfect for Mobile UX) */}
      {isGeneratingPdf && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-sm sm:max-w-md w-full text-center space-y-6 shadow-2xl animate-fade-in no-print">
            <div className="flex justify-center">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 bg-teal-500/10 rounded-full blur-xl animate-pulse" />
                <div className="w-16 h-16 rounded-full border-4 border-slate-800 border-t-teal-400 animate-spin flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-teal-400 animate-pulse" />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-base sm:text-lg font-extrabold text-white">উচ্চ মানের পিডিএফ ক্লাস স্লাইড তৈরি হচ্ছে</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                আপনার স্মার্টবোর্ডের জন্য নিখুঁত (৪০″ x ২২.৫″) সাইজের স্লাইডগুলো এক এক করে প্রসেস করা হচ্ছে। অনুগ্রহ করে ক্ষণিকের জন্য অপেক্ষা করুন...
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5 text-left">
              <div className="flex justify-between text-[11px] font-bold text-slate-300">
                <span className="text-teal-400 shrink-0">{pdfProgressText}</span>
                <span>{pdfRenderedPercent}%</span>
              </div>
              <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-teal-400 to-indigo-500 h-full transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${pdfRenderedPercent}%` }}
                />
              </div>
            </div>

            <p className="text-[10px] text-slate-500 italic">
              *মোবাইলে রেন্ডারিং মেমরির সুরক্ষার্থে ১টি করে পেজ জেনারেট হচ্ছে। ফাইলটি সেভ হতে ২০-৩০ সেকেন্ড সময় লাগতে পারে।
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
