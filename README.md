# פורטל תרגול ערבית – פוסחא

אתר סטטי לתרגול ערבית ספרותית (פוסחא). 28 נושאים, 368 שאלות תרגול ו־146 שאלות קריאה יושבים בקבצי נתונים נפרדים, והממשק נשמר בדפדפן.

האתר המפורסם: <https://taltunik.github.io/arabic-portal/>

אחרי מיזוג ל־`main` צריך פעם אחת בגיטהאב: **Settings → Pages → Build and deployment → Source: GitHub Actions**. בלי זה ה־workflow לא מפרסם את האתר. ה־workflow (`.github/workflows/pages.yml`) רץ על כל דחיפה ל־`main`, בונה עם Vite (נתיב בסיס `/arabic-portal/`) ומעלה ל־Pages.

## הרצה מקומית

```bash
npm install
npm run dev
```

השרת המקומי נפתח תחת `/arabic-portal/` (אותו נתיב כמו ב־Pages). לבדיקת הבילד:

```bash
npm run build
npm run preview
```

`npm run verify` משווה את קבצי הנתונים למקור (`scripts/fixtures/portal-canvas.tsx`): ספירת נושאים ושאלות, זהות מזהים, ושוויון טקסט מול המודול המקורי. `npm run build` מריץ את הבדיקה לפני הבילד.

## מבנה

| נתיב | תפקיד |
| --- | --- |
| `src/App.tsx` | מסכי הפורטל: בית, סבב, קריאה, סיכום, מילים |
| `src/shim/canvas.tsx` | רכיבי הממשק שהקנבס המקורי ייבא מ־`grok/canvas` |
| `src/data/index.ts` | אינדקס הנושאים, ועיבוד הטעינה (סדר תשובות בנושאים המקוריים, חיבור כללי הקריאה) |
| `src/data/topics/` | קובץ אחד לכל נושא |
| `src/data/build.ts` | עוזרי בניית שאלות: `mq`, `pa`, `pb`, `pm`, `rq`, `rs`, `cs` |
| `src/data/sections.ts` | חמשת החלקים, ושיוך נושא לחלק |
| `src/data/lessons.ts` | שיעורים לפי תאריך (דור, מכללה) |
| `src/data/more.ts` | הסבר מורחב לפי מזהה שאלה |
| `src/data/read-blocks.ts`, `end-blocks.ts`, `end-tables.ts` | כללי הקריאה והניקוד של נושאים 26–27 |
| `CONTENT_GUIDE.md` | סכמת הנתונים |

הממשק בעברית, `lang="he"` ו־`dir="rtl"`. הגופנים שנטענים עם האתר הם Noto Naskh Arabic לערבית המנוקדת ו־Noto Sans Hebrew לעברית. Amiri ו־Rubik נשארים בשרשרת הגופן כגיבוי אם הם מותקנים במחשב. ערכת בהירה היא ברירת המחדל; ערכה כהה נכנסת לפי `prefers-color-scheme`.

## איך מוסיפים נושא

1. מעתיקים קובץ קיים מ־`src/data/topics/` אל קובץ חדש, למשל `src/data/topics/29-example.ts`.
2. משנים `id`, `num`, `titleHe`, ואת השאלות. המלל נשמר כפי שנכתב — בלי ניסוח מחדש של חומר קיים.
3. ב־`src/data/index.ts` מוסיפים שורת `import` ושורה במערך `TOPICS`. הסדר במערך הוא סדר המקור; המספר `num` קובע את המיון במסך.
4. אם הנושא לא שייך לחלק «תרגול פוסחא כללי» (החלק שקולט כל נושא שלא שויך), מוסיפים אותו ל־`TOPIC_SECTION` ב־`src/data/sections.ts`.
5. מריצים `npm run verify` ואז `npm run dev`.

שאלה רגילה נבנית עם `mq` (ראו `CONTENT_GUIDE.md`). הסבר ארוך שמופיע אחרי תשובה יושב ב־`src/data/more.ts` תחת אותו `id`.

## איך מוסיפים שיעור

שיעור הוא נושא שמשויך לחלק «לפי שיעור» (דור או מכללה):

1. יוצרים קובץ נושא כמו למעלה, עם `num` פנוי.
2. ב־`src/data/sections.ts` משייכים את המזהה, למשל `"dor-vocab-2": "dor"` או `"college-2": "college"`.
3. ב־`src/data/lessons.ts` מוסיפים שורה: `topicId`, `section` (`dor` או `college`), `date` בפורמט `DD.MM.YYYY`, `teacher`, `titleHe`.
4. השיעורים מוצגים מהחדש לישן לפי התאריך.

חלק חדש בפורטל: שורה ב־`SECTIONS`, ושיוך נושאים ב־`TOPIC_SECTION`. נושא בלי שיוך נכנס לחלק שמסומן `catchAll`.

## שמירה בדפדפן

- התקדמות: `fuskha-portal-progress-v1`
- מילים שלא ידעתי: `fuskha-portal-words-v1`

קוד הגיבוי במסך («גיבוי / העברה בין מכשירים») הוא JSON עם `v: 2`, `progress` ו־`words`. קוד ישן שמכיל רק את מפת ההתקדמות עדיין נטען. הסיכום בסוף סבב הוא טקסט שאפשר לסמן ולהעתיק; ברשימת המילים יש גם כפתור «העתק את כל הרשימה».
