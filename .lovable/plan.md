# חומרים דומים בספרייה — שדרוג ל-similarity מבוסס chunks

## מה כבר קיים בקוד (נבדק)
- `getSimilarResources` ב-`src/lib/library-extras.functions.ts` — כבר מחזירה top-N דומים לחומר נתון, אבל **על בסיס `teaching_resources.embedding` בלבד** דרך ה-RPC `match_resources`, ואם אין embedding היא מייצרת אחד בזמן ריצה מהכותרת/תקציר/טקסט.
- רכיב `SimilarResources` (`src/components/similar-resources.tsx`) כבר מוצג בעמוד `/resources/$resourceId` (שורה 297).
- `resource_chunks` מאונדקס ב-HNSW cosine על `embedding` (`resource_chunks_embedding_idx`), וגם `teaching_resources.embedding` מאונדקס. **לא נדרש אינדקס חדש.**
- ה-RPC `match_resource_chunks` קיים אך ללא סינון owner — ב-`askLibrary` הוא נסמך על RLS.

## מצב הנתונים בפועל
67 חומרים, מהם 7 עם embedding ברמת מסמך; 3 chunks בלבד, על 3 חומרים. כלומר היום ה-similarity מכסה חלק קטן מהספרייה — הפער האמיתי הוא כיסוי אינדוקס, לא רק האלגוריתם.

## מה נבנה
1. **RPC חדש `match_similar_resources(p_resource_id, p_owner, p_match_count)`** (SECURITY DEFINER, `search_path=public`, מאמת ש-`p_owner = auth.uid()`):
   - מחשב מרכז (centroid) של ה-chunks של החומר: `avg(embedding)` → `vector`.
   - משווה מול centroid של chunks של חומרים אחרים של אותו owner (`group by resource_id`) עם `OPERATOR(extensions.<=>)`, מחזיר `resource_id, similarity`, ללא ה-resource עצמו.
   - GRANT EXECUTE ל-`authenticated` בלבד.
2. **`findSimilarResources` ב-`library-extras.functions.ts`** (`requireSupabaseAuth`), קלט `{ id, limit 1..12 }`, פלט זהה ל-`SimilarResource` הקיים:
   - שלב א׳: RPC ה-chunks (הכי מדויק).
   - שלב ב׳ (fallback): הלוגיקה הקיימת של `match_resources` על embedding המסמך.
   - שלב ג׳: fallback לא-סמנטי — חומרים של אותו owner באותו `subject`/`resource_type` או עם תגיות משותפות, מסומנים בציון דמיון נמוך.
   - סינון סף מינימלי (למשל ‎0.2‎) כדי לא להציג "דומים" רועשים.
   `getSimilarResources` תישאר כ-alias דק לאחור.
3. **UI**
   - `SimilarResources` תעבור לקרוא ל-`findSimilarResources`, ותקבל prop `variant` (`card` | `compact`).
   - הרכיב יוצג גם ב-`ResourceViewerDialog` בתוך `/resources` (גרסה compact, בתחתית הדיאלוג), בנוסף לעמוד הפריט הקיים.
   - מצב ריק ידידותי: "עדיין אין חומרים דומים — ככל שתעלה עוד חומרים ההמלצות ישתפרו", עם רמז כשלחומר עצמו אין טקסט מאונדקס ("הפעל אינדוקס/OCR כדי לקבל המלצות").
4. **כיסוי אינדוקס** — כפתור/פעולה "אנדקס חומר לחיפוש" בכרטיס החומר שמפעילה את `indexResourceChunks` הקיים על `original_text`, כדי לסגור את הפער של 3 מתוך 67.

## Edge cases
- אין chunks ואין embedding → fallback מטא-דאטה, ואם גם זה ריק → הרכיב לא מוצג.
- `original_text` קצר מדי (< ~200 תווים) → לא נשלח ל-embedding, נופלים ל-fallback.
- חומר נמחק בין השאילתות → מסננים מזהים שלא חזרו מ-`teaching_resources`, בלי לזרוק שגיאה.
- כפילויות מ-hash זהה → אם `content_hash` זהה, מציגים אחד ומסמנים "עותק זהה".
- כשל ב-Gateway (מפסק זרם / 402) → מחזירים `[]` בשקט, בלי לשבור את העמוד.

## פרטים טכניים
- מיגרציה אחת: פונקציית RPC + GRANT (אין טבלה חדשה, אין אינדקס חדש).
- אין קריאות AI חדשות בנתיב הקריאה כשיש chunks — ההשוואה כולה ב-Postgres.
- בדיקה: וידוא שהחומר עצמו לא מופיע בתוצאות ושחומר של owner אחר לא דולף.
