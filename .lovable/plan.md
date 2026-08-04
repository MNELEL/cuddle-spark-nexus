# Circuit Breaker ל-AI Gateway

מטרה: למנוע round-trip מיותר ל-Lovable AI Gateway כשידוע שהמכסה אזלה או שאין קרדיטים/מפתח. סוגר את הפער האחרון ב-MERGE_MEMORY.md 1.2 ו-docs/lms-gap-analysis.md 9.

## היקף

קובץ אחד בלבד: `src/lib/ai-gateway.server.ts`. אף אחד מ-16 הקוראים (ai-grades, ai-certificate, ai-assistant, ai-exam, ai-exam-generator, ai-pedagogical, ai-poll, ai-weekly-summary, bulletin-sync, bulletins, ingest, lessons, parent-emails, seating-wizard, teacher-style, teaching-resources, embeddings.server) לא משתנה — החתימות והחוזים נשארים זהים בדיוק.

## מבנה ה-state (משותף, ברמת המודול)

state יחיד שמשמש את שתי הפונקציות, כי שתיהן פוגעות באותה מכסה:

```text
type BreakerState =
  | { kind: "closed" }                          // פעיל, מותר לקרוא
  | { kind: "open"; reason: "rate_limited" | "no_credits" | "no_key";
      message: string; until: number }          // חלון זמן לניסיון הבא
```

- משתנה מודול `let breaker: BreakerState = { kind: "closed" }`.
- `message` נשמר כדי לזרוק בדיוק את אותה הודעה בעברית שהמשתמש רואה היום.
- in-memory, per-instance, מתאפס ב-restart — כמוסכם, בלי DB.

## ערכי timeout

| סיבה | מקור | חלון | התאוששות |
|---|---|---|---|
| `rate_limited` | 429 | 60 שניות | אוטומטית בסוף החלון |
| `no_credits` | 402 | 5 דקות | probe יחיד בסוף החלון |
| `no_key` | LOVABLE_API_KEY חסר | 5 דקות | probe יחיד בסוף החלון |

402 ומפתח חסר אינם מתאוששים לבד, אך חלון של 5 דקות מונע היתקעות לנצח אחרי שהמשתמש מוסיף קרדיטים — בסוף החלון מותרת קריאה אחת; אם היא נכשלת שוב באותה סיבה, החלון מתחדש.

## התנהגות

1. תחילת כל קריאה: אם ה-breaker פתוח והחלון עוד בתוקף —
   - `callLovableAI`: `throw new Error(message)` מיידית, בלי fetch (חוזה throwing נשמר).
   - `callLovableAIEmbeddings`: `console.error` קצר ו-`return null` מיידית (חוזה non-throwing נשמר).
2. תגובה 200: `breaker = { kind: "closed" }` — איפוס מלא, לשתי הפונקציות.
3. 429 → פתיחת breaker עם `rate_limited` + 60 שניות, ואז אותה זריקה / `null` כמו היום.
4. 402 → פתיחת breaker עם `no_credits`, ואז אותה זריקה / `null` כמו היום.
5. מפתח חסר → רישום `no_key`; `callLovableAI` זורק "חסר LOVABLE_API_KEY" כמו היום, `callLovableAIEmbeddings` מחזיר `null` כמו היום.
6. שגיאות אחרות (5xx, 400, שגיאת רשת) אינן פותחות את ה-breaker — הן נקודתיות ולא מעידות על מכסה. התנהגות זהה להיום.

## לוגים

`console.warn("[AI Breaker] open", reason)` בפתיחה ו-`console.info("[AI Breaker] closed")` באיפוס — לאיתור מהיר בלוגי השרת, בלי לחשוף מפתחות.

## בסיום

עדכון `MERGE_MEMORY.md` 1.2 ו-`docs/lms-gap-analysis.md` 9 לסטטוס מיושם.
