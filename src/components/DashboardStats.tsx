import React from "react";
import {
  LayoutDashboard,
  Folder,
  FolderOpen,
  HelpCircle,
  FileText,
  Users,
  Award,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  History,
  TrendingDown
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { UserProfile } from "../types";

interface DashboardStatsProps {
  catsCount: number;
  subsCount: number;
  quesCount: number;
  recentCount: number;
  users: UserProfile[];
  pendingCount: number;
  approvedCount: number;
  examCount: number;
  highestScore: number;
  averageScore: number;
  userProfile?: UserProfile | null;
}

export default function DashboardStats({
  catsCount,
  subsCount,
  quesCount,
  recentCount,
  users,
  pendingCount,
  approvedCount,
  examCount,
  highestScore,
  averageScore
}: DashboardStatsProps) {
  const premiumUsers = users.filter((u) => u.role === "premium");
  const bannedCount = users.filter((u) => u.banned).length;

  // Find premium users expiring in the next 7 days
  const now = new Date();
  const expiringSoonList = users.filter((u) => {
    if (u.role === "premium" && u.premiumExpiry) {
      const expiry = new Date(u.premiumExpiry);
      const diffTime = expiry.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7;
    }
    return false;
  });

  // Dynamic projection / analytic data
  const chartData = [
    { name: "জা:", revenue: 12000, attempts: 85 },
    { name: "ফে:", revenue: 19000, attempts: 140 },
    { name: "মা:", revenue: 32000, attempts: 210 },
    { name: "এ:", revenue: 51000, attempts: 380 },
    { name: "মে:", revenue: 68000, attempts: 540 },
    { name: "জু:", revenue: 95000, attempts: 720 },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Dynamic Summary Bento-Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Groups */}
        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 hover:border-teal-500/50 transition-all group hover:-translate-y-1 duration-300">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm font-medium">ক্যাটাগরি গ্রুপ</span>
            <span className="p-2.5 bg-teal-500/10 text-teal-400 rounded-xl group-hover:scale-110 transition-transform">
              <Folder className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-bold text-white font-display">{catsCount}</h3>
            <p className="text-slate-500 text-xs mt-1">সর্বমোট পরীক্ষার গ্রুপ</p>
          </div>
        </div>

        {/* Total Subs */}
        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 hover:border-emerald-500/50 transition-all group hover:-translate-y-1 duration-300">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm font-medium">সাব-ক্যাটাগরি</span>
            <span className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl group-hover:scale-110 transition-transform">
              <FolderOpen className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-bold text-white font-display">{subsCount}</h3>
            <p className="text-slate-500 text-xs mt-1">নির্দিষ্ট পড়ার বিষয়সমূহ</p>
          </div>
        </div>

        {/* Total Questions */}
        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 hover:border-orange-500/50 transition-all group hover:-translate-y-1 duration-300">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm font-medium">মোট প্রশ্নোত্তর</span>
            <span className="p-2.5 bg-orange-500/10 text-orange-400 rounded-xl group-hover:scale-110 transition-transform">
              <HelpCircle className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-bold text-white font-display">{quesCount}</h3>
            <p className="text-slate-500 text-xs mt-1">সংরক্ষিত MCQ প্রশ্নাবলী</p>
          </div>
        </div>

        {/* Bulletins Count */}
        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 hover:border-purple-500/50 transition-all group hover:-translate-y-1 duration-300">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm font-medium">নিউজ নোটিশ</span>
            <span className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl group-hover:scale-110 transition-transform">
              <FileText className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-bold text-white font-display">{recentCount}</h3>
            <p className="text-slate-500 text-xs mt-1">লাইভ নোটিশ ও বুলেটিন</p>
          </div>
        </div>

        {/* Registered Users */}
        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 hover:border-indigo-500/50 transition-all group hover:-translate-y-1 duration-300">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm font-medium">মোট শিক্ষার্থী</span>
            <span className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-bold text-white font-display">{users.length}</h3>
            <p className="text-slate-500 text-xs mt-1">নিবন্ধিত মোট ব্যবহারকারী</p>
          </div>
        </div>

        {/* Premium Users */}
        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 hover:border-yellow-500/50 transition-all group hover:-translate-y-1 duration-300">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm font-medium">প্রিমিয়াম গ্রাহক</span>
            <span className="p-2.5 bg-yellow-500/10 text-yellow-400 rounded-xl group-hover:scale-110 transition-transform">
              <Award className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-bold text-white font-display">{premiumUsers.length}</h3>
            <p className="text-slate-500 text-xs mt-1">সক্রিয় প্রিমিয়াম মেম্বার</p>
          </div>
        </div>

        {/* Pending Payments */}
        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 hover:border-red-500/50 transition-all group hover:-translate-y-1 duration-300">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm font-medium font-sans">পেন্ডিং পেমেন্ট</span>
            <span className="p-2.5 bg-red-500/10 text-red-400 rounded-xl group-hover:scale-110 transition-transform">
              <DollarSign className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-bold text-white font-display">{pendingCount}</h3>
            <p className="text-slate-500 text-xs mt-1">অনুমোদনের অপেক্ষায় আছে</p>
          </div>
        </div>

        {/* Approved Payments */}
        <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 hover:border-emerald-400/55 transition-all group hover:-translate-y-1 duration-300">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm font-medium">অনুমোদিত পেমেন্ট</span>
            <span className="p-2.5 bg-emerald-500/10 text-emerald-300 rounded-xl group-hover:scale-110 transition-transform">
              <TrendingUp className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-bold text-white font-display">{approvedCount}</h3>
            <p className="text-slate-500 text-xs mt-1">মোট অনুমোদিত গ্রাহক ফি</p>
          </div>
        </div>
      </div>

      {/* Primary Analytics Trio */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Exam statistics dashboard details */}
        <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-bold text-teal-400">পরীক্ষার সার্বিক মেট্রি</h4>
            <History className="w-5 h-5 text-slate-500" />
          </div>
          <div className="space-y-6">
            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-xs block">মোট অংশগ্রহণ (পরীক্ষা নেওয়া হয়েছে)</span>
              <span className="text-2xl font-bold text-white font-display mt-1 block">{examCount} বার</span>
            </div>
            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-xs block">সর্বোচ্চ স্কোর</span>
              <span className="text-2xl font-bold text-amber-400 font-display mt-1 block">{highestScore}</span>
            </div>
            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-xs block">গড় স্কোর (Average Points)</span>
              <span className="text-2xl font-bold text-teal-300 font-display mt-1 block">{averageScore}</span>
            </div>
          </div>
        </div>

        {/* Premium Expiration Alert list */}
        <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-500 animate-pulse" />
            <h4 className="text-md font-bold text-yellow-500">⚠ প্রিমিয়ামের মেয়াদ শেষ সতর্কবার্তা</h4>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[280px] bg-slate-900/30 p-2 rounded-xl border border-slate-800/50 space-y-3">
            {expiringSoonList.length === 0 ? (
              <div className="text-center text-slate-500 py-16 text-sm">
                আসন্ন ৭ দিনের মধ্যে মেয়াদ শেষ হওয়ার মতো কোনো প্রিমিয়াম ব্যবহারকারী নেই।
              </div>
            ) : (
              expiringSoonList.map((u) => {
                const expiry = u.premiumExpiry ? new Date(u.premiumExpiry) : null;
                const daysLeft = expiry
                  ? Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  : 0;

                return (
                  <div
                    key={u.id || u.uid}
                    className="p-3 bg-yellow-500/10 border-l-4 border-yellow-500 rounded-r-lg flex justify-between items-center"
                  >
                    <div>
                      <p className="text-white text-xs font-semibold select-all">{u.email}</p>
                      <span className="text-slate-400 text-[10px]">
                        প্যাকেজ: {u.premiumPlan || "কাস্টম"}
                      </span>
                    </div>
                    <span className="text-yellow-400 text-xs font-bold leading-none bg-yellow-400/10 px-2 py-1 rounded">
                      {daysLeft === 0 ? "আজ শেষ" : `${daysLeft} দিন বাকী`}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Banned counter */}
        <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-bold text-red-400">নিরাপত্তা ও সিস্টেম অডিট</h4>
            <AlertTriangle className="w-5 h-5 text-slate-500" />
          </div>
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 text-center flex-1 flex flex-col justify-center items-center">
            <span className="text-[52px] font-bold text-red-500 font-display leading-none">
              {bannedCount}
            </span>
            <span className="text-slate-300 font-semibold text-sm mt-3">ডিজেবল্ড / ব্যানড ইউজারসমূহ</span>
            <p className="text-slate-500 text-xs mt-2 max-w-xs leading-relaxed">
              সিস্টেম সিকিউরিটি পলিসি লঙ্ঘন বা স্প্যামিং এর দায়ে সাময়িক ও স্থায়ীভাবে বাতিলকৃত শিক্ষার্থীর
              সংখ্যা।
            </p>
          </div>
        </div>
      </div>

      {/* Revenue projection report */}
      <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-6 border border-slate-700/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h4 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-teal-400" />
              প্রজেকশন ও স্টুডেন্ট পরীক্ষা ট্রেন্ড (Recharts Analysis)
            </h4>
            <p className="text-slate-500 text-xs mt-1">বিগত ৬ মাসের আনুমানিক স্ট্যাটিস্টিক রির্পোট</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-teal-500 rounded-full" />
              <span className="text-slate-300">পেমেন্ট কালেকশন (BDT)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-emerald-400 rounded-full" />
              <span className="text-slate-300">পরীক্ষায় অংশগ্রহণ (শতক)</span>
            </div>
          </div>
        </div>

        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorAttempts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  borderColor: "#475569",
                  borderRadius: "8px",
                  color: "#f1f5f9",
                  fontSize: "12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#14b8a6"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
              <Area
                type="monotone"
                dataKey="attempts"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorAttempts)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
