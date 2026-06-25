# כניסה מהירה במסך הנעילה

## מה ייבנה

כפתור "כניסה מהירה" יופיע במסך הנעילה כאשר משתמש מחובר הגדיר קוד PIN. בלחיצה:
1. 4 הספרות של הקוד המוגדר ימולאו אוטומטית בתאי הקלט באנימציית הקלדה (כ-80ms בין ספרה לספרה).
2. בסיום המילוי תתבצע אימות אוטומטי מול השרת.
3. במידה והקוד תקין — המסך נסגר, ה-session מסומן כפתוח והמשתמש ממשיך ללוח הבקרה.

הכפתור יוצג **תמיד כשקוד פעיל** (גם אם המכשיר משותף — באחריות המשתמש; זו בקשה מפורשת).

## שינוי מודל הנתונים

עד עכשיו `app_security` שמר רק `pin_hash` + `pin_salt` (חד-כיווני) — לא ניתן לשחזר את הקוד. כדי לאפשר מילוי אוטומטי נוסיף עמודה `pin_plain TEXT` שתחזיק את 4 הספרות. הגישה מוגנת ע"י RLS קיים (קריאה רק לבעלי השורה דרך `auth.uid()`), ושרת-פונקציה ייעודית `getPinForAutofill()` שמחייבת `requireSupabaseAuth` ומחזירה את הקוד רק לבעליו.

- מיגרציה: `ALTER TABLE public.app_security ADD COLUMN pin_plain TEXT;`
- `setPin()` יעדכן גם את `pin_plain` בנוסף ל-hash+salt (ה-hash נשמר לתאימות אחורה ולאימות מהיר).
- `disablePin()` ינקה את `pin_plain` ל-NULL.

## שינויי קוד

### `src/lib/security.functions.ts`
- עדכון `setPin` לכתיבת `pin_plain`.
- עדכון `disablePin` לאיפוס `pin_plain`.
- פונקציה חדשה `getPinForAutofill` — `requireSupabaseAuth`, מחזירה `{ pin: string | null }` מהשורה של המשתמש המחובר.

### `src/components/pin-lock-screen.tsx`
- `useQuery(['security','autofillPin'])` שטוען את הקוד פעם אחת בכניסה למסך.
- אם `pin` קיים → להציג כפתור `<Button variant="outline">כניסה מהירה</Button>` עם אייקון `Zap` ו-`shadow-glow-amber`, מתחת לתאי ה-PIN.
- handler: מחזיק `isAutofilling`, רץ על 4 הספרות עם `setTimeout(80ms)`, מעדכן את state של התאים בכל צעד (אנימציית `animate-scale-in` על תא פעיל), ובסיום קורא ל-`verifyPin` הקיים. בהצלחה — מסמן `sessionStorage('pin_verified','1')` ומסיר את ה-overlay (כפי שעובד היום).
- בזמן האנימציה הכפתור והקלט disabled כדי למנוע double-trigger.

### Toolkit > אבטחה (`src/components/security-settings.tsx`)
- הסבר קצר תחת הגדרת הקוד: "כניסה מהירה פעילה — הקוד יוצג כפתור במסך הנעילה". ניתן לבטל ע"י השבתת הקוד.

## אבטחה
- `pin_plain` מוגן ע"י RLS — רק `auth.uid() = user_id` קורא/כותב.
- שרת-פונקציית האחזור מחייבת bearer token; אין endpoint ציבורי.
- ה-hash הקיים נשאר ומשמש כ-fallback ל-`verifyPin` (אם משתמש הקליד ידנית).
- אין log של ה-PIN, אין החזרה ב-error messages.

## מה לא נכלל
- אין שינוי לערכת הצבעים/לתפקוד שאר מסך הנעילה.
- אין שינוי לזרימת ה-onboarding של הקוד הראשוני.
