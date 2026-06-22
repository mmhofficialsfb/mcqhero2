import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function getUserDailyUsageCount(userId: string, isSandbox: boolean): Promise<number> {
  if (!userId) return 0;
  const today = getTodayString();
  const localKey = `local_daily_usage_${userId}_${today}`;

  if (isSandbox) {
    const val = localStorage.getItem(localKey);
    return val ? parseInt(val) : 0;
  }

  try {
    const docRef = doc(db, "user_daily_usage", `${userId}_${today}`);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return typeof data?.count === "number" ? data.count : (typeof data?.daily_count === "number" ? data.daily_count : 0);
    }
  } catch (err) {
    console.warn("Firestore getUserDailyUsageCount failed, falling back to localState:", err);
  }

  // Fallback to local storage if Firestore throws permission or offline errors
  const val = localStorage.getItem(localKey);
  return val ? parseInt(val) : 0;
}

export async function incrementUserDailyUsage(userId: string, isSandbox: boolean): Promise<number> {
  if (!userId) return 0;
  const today = getTodayString();
  const localKey = `local_daily_usage_${userId}_${today}`;

  // Get current count first
  let count = await getUserDailyUsageCount(userId, isSandbox);
  count += 1;

  // Sync to localStorage
  localStorage.setItem(localKey, String(count));

  if (!isSandbox) {
    try {
      const docRef = doc(db, "user_daily_usage", `${userId}_${today}`);
      await setDoc(docRef, {
        userId,
        date: today,
        count: count,
        daily_count: count,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error("Firestore incrementUserDailyUsage failed to save:", err);
    }
  }

  return count;
}
