import type { SectionDef } from "./types";

// להוספת חלק חדש: מוסיפים שורה ל־SECTIONS, ומשייכים אליו נושאים ב־TOPIC_SECTION (נושא שלא שויך נכנס לחלק catchAll).
export const SECTIONS: SectionDef[] = [
  { id: "fusha", titleHe: "תרגול פוסחא כללי", icon: "📘", desc: "כל נושאי הדקדוק — أَنْ/لَنْ, جَزْم, لَا, إِنَّ, كَانَ, סביל, תמייז וחאל, בניינים, מצדרים, إضافة ועוד. עם טבלת כיסוי ותרגול מעורב.", kind: "topics", catchAll: true, mixed: true },
  { id: "dor", titleHe: "תרגול משיעורים עם דור", icon: "🗣️", desc: "מילים, ביטויים ופתגמים מהשיעורים עם דור — מסודר לפי תאריך השיעור.", kind: "topics", byLesson: true, emptyNote: "שיעורים הבאים עם דור יתווספו כאן לפי תאריך — שלחו לעוזר את החומר מהשיעור." },
  { id: "college", titleHe: "אוצר מילים מהמכללה", icon: "🎓", desc: "מילים, מילות יחס וקטעי קריאה משיעורי המכללה — מסודר לפי תאריך השיעור.", kind: "topics", byLesson: true, emptyNote: "שיעורים הבאים במכללה יתווספו כאן לפי תאריך — שלחו לעוזר את דפי השיעור." },
  { id: "reading", titleHe: "קריאה וניקוד", icon: "📖", desc: "קריאה נכונה של טקסט בלי ניקוד, והגייה וניקוד סופי (إِعْرَاب) בתרגול ייעודי.", kind: "topics" },
  { id: "words", titleHe: "המילים שלא ידעתי", icon: "🗂️", desc: "כל המילים שרשמתי בתיבות ״מילים שלא ידעתי״ בכל הנושאים — עם פירוש, כרטיסיות לשינון וייצוא.", kind: "words" },
];
export const TOPIC_SECTION: Record<string, string> = { "dor-vocab": "dor", "college-1": "college", "qiraa": "reading", "nikud": "reading" };
