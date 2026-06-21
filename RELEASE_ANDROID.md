# הוצאת ClassAlign Studio ל-Google Play

TanStack Start רץ SSR, אז עבור עטיפת Capacitor אנו אורזים את ה-build הסטטי של הצד-לקוח (`dist/client`).
השלבים הבאים מבוצעים **במחשב המקומי שלך** עם Android Studio מותקן.

## דרישות מקדימות
- Node 20+ / Bun
- Android Studio + JDK 17
- חשבון Google Play Console פעיל

## 1. שכפל מ-GitHub
```bash
git clone <your-repo-url> classalign && cd classalign
bun install
```

## 2. בנה את הצד-לקוח
```bash
bun run build
# צריך לייצר dist/client עם index.html ונכסים סטטיים
```

## 3. אתחל את פלטפורמת Android
```bash
bun add -D @capacitor/cli
bun add @capacitor/core @capacitor/android
npx cap add android
npx cap sync android
```

## 4. אייקונים ו-Splash
שים icon-1024.png ב-`resources/` והרץ:
```bash
npx @capacitor/assets generate --android
npx cap sync android
```

## 5. פתח ב-Android Studio
```bash
npx cap open android
```
- צור Signing Config חדש (`release.keystore`) דרך Build → Generate Signed Bundle.
- שמור את הסיסמה וה-keystore במקום בטוח.

## 6. צור Android App Bundle (AAB)
Build → Build Bundle(s) / APK(s) → Build Bundle.
הקובץ יישמר ב-`android/app/build/outputs/bundle/release/`.

## 7. העלאה ל-Play Console
- מלא לפי `STORE_LISTING.md`.
- Privacy URL → `/privacy`, Support URL → `/support`.
- מלא Data Safety והעלה screenshots (טלפון + טאבלט).

## טיפים
- ל-live-reload בפיתוח: בטל הערה ל-`server.url` ב-`capacitor.config.ts` ו-`npx cap sync`.
- בשינוי אייקון/splash הרץ שוב `npx @capacitor/assets generate --android && npx cap sync android`.