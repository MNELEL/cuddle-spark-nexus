
## דוח ממצאים (בדיקה בלבד — לא נערך קוד)

### 1. טבלת `grades` והצגה בתעודה
עמודות בפועל:
`id, class_id, student_id, subject (text), value (numeric), max_value (numeric), date, notes, created_at`.
אין עמודת `period` ואין ציון מילולי מאוחסן — הכל מספרי.

איך התעודה מציגה ציון מילולי כרגע (`_authenticated.certificates.$classId.tsx`):
- `getCertificateData` (ב-`src/lib/certificates.functions.ts`) מושך grades בטווח `from..to` לפי `class_id`.
- `computeStudentRow` מקבץ לפי `subject`, סוכם `value/max_value`, מחשב אחוז, וממפה דרך `labelForPercent()` (ב-`src/lib/pdf/certificate-pdf.ts`) לתווית מ-`GRADE_LABELS` (מצוין/טוב מאוד/כמעט טוב מאוד/טוב/כמעט טוב/להשתדל יותר). ההערה בשורה היא `"{אחוז}%"`.
- המורה יכול לערוך ידנית בטבלה (`patchSubject`), כולל שינוי ה-label ל-`GradeLabel` אחר, ולהוסיף/למחוק מקצועות. השינויים חיים ב-state בלבד — לא נשמרים ל-DB.
- טווחי תקופה (חצי-שנתי/שליש/שנתי/מותאם) מחושבים ב-`periodRange()` בקליינט; אין entity "period" בסכימה.

### 2. `behavior_points`, `discipline_events`, `attendance`
- `behavior_points`: `id, class_id, student_id, category (text), points (int), note, date, created_at`.
- `discipline_events`: `id, class_id, student_id, type, category, severity (int), description, date, parents_notified (bool), created_at`. **לא נצרך היום** ב-`getCertificateData`.
- `attendance`: `id, class_id, student_id, date, status (text: present/absent/late), notes, created_at`. כן נצרך בתעודה — מוצג כספירה של present/absent/late.

חישוב "הליכות" בתעודה: סכימת `points` פשוטה עם ספי `>=10 / >=0 / >=-5 / else` → אחת מ-`BEHAVIOR_LABELS` (ראוי לשבח/נאות/בינוני/טעון שיפור). אותה תווית מועתקת גם ל-diligence ול-manners כברירת מחדל — המורה יכול לשנות ידנית לכל תחום.

### 3. הערות teacherNote / principalNote
לא נשמרות בשום entity — קיימות כשדות state בקליינט בלבד:
- ב-`StudentRow` (בתוך `certificates.$classId.tsx`): `teacherNote: string`, `principalNote: string`, מאותחלים ל-`""` ב-`computeStudentRow`.
- נערכים בכרטיס התלמיד (`StudentCertCard`) ומוזרמים ל-`buildCertificatePdfBlob({ teacherNote, principalNote })`.
- OCR תעודה (`analyzeCertificatePhoto`) יכול למלא אותם אוטומטית מתמונה, אך שוב — רק ב-state הרינדור, נעלם בריענון עמוד. אין טבלת `certificates` או `certificate_notes` בסכימה.

### 4. תשתית קריאה ל-Lovable AI Gateway
כן — קיימת ומאוחדת ב-`src/lib/ai-gateway.server.ts`:
- `callLovableAI({ messages, jsonResponse?, model? })` — chat/completions, ברירת מחדל `google/gemini-2.5-flash`, טיפול ב-429/402, מחזיר `choices[0].message.content`.
- `callLovableAIEmbeddings(text, model?)` — embeddings, מחזיר `null` בכשל.

דפוסים לשכפול (server functions עטופים ב-`createServerFn` + `requireSupabaseAuth` + Zod `inputValidator`):
- `src/lib/ai-certificate.functions.ts` — OCR תעודה (multimodal image+text, `jsonResponse: true`, סניטציה מלאה של הפלט).
- `src/lib/teaching-resources.functions.ts` — `generateResourceWithAI` (כולל `source_resource_id` להקשר).
- `src/lib/ai-grades.functions.ts`, `src/lib/ai-exam.functions.ts`, `src/lib/ai-assistant.functions.ts` — דוגמאות טקסטואליות ו-JSON.

### מסקנה מהירה לתכנון הבא
- כדי לשמור הערות/תעודות בין רינדורים דרושה טבלה חדשה (למשל `certificates` או `certificate_notes` עם `student_id + period_key`).
- כדי לתמוך ב"תקופה" (חצי/שליש/שנתי) בציונים עצמם — או להישאר עם חלון תאריכים (הגישה הנוכחית), או להוסיף `period` ל-`grades`.
- הצעות AI להערות מורה/הנהלה ולניתוח שבועי — אפשר לממש בקלות ב-server function חדש שמשתמש ב-`callLovableAI` על סמך grades/behavior/attendance/discipline_events של התלמיד בטווח.

מוכן להמשיך לתוכנית בנייה כשתאשר את הכיוון (איפה לשמור הערות, האם להוסיף `period` ל-grades, ומה בדיוק להזין ל-AI).
