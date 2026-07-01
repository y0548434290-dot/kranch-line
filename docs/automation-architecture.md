# ארכיטקטורת האוטומציה של Yemot Hamashiach

## סקירה כללית

המערכת תשתמש ב-API הרשמי של Yemot כדי לנהל שלוחות באופן אוטומטי, במקום browser automation. זה יאפשר אמינות גבוהה יותר ומהירות טובה יותר.

## רכיבי הארכיטקטורה

### 1. מודול YemotAPI (`src/ivr/yemot-api.js`)
- **תפקיד**: Wrapper סביב ספריית `yemot-api`
- **פונקציות**:
  - התחברות ל-Yemot
  - ניהול session
  - טיפול בשגיאות
  - logging

### 2. מודול ExtensionManager (`src/ivr/extension-manager.js`)
- **תפקיד**: יצירה וניהול שלוחות IVR
- **פונקציות**:
  - יצירת שלוחה חדשה
  - עדכון ext.ini
  - מחיקת שלוחה
  - קבלת מבנה שלוחות

### 3. מודול FileManager (`src/ivr/file-manager.js`)
- **תפקיד**: ניהול קבצים ב-Yemot
- **פונקציות**:
  - העלאת קבצי אודיו
  - העלאת קבצי טקסט
  - הורדת קבצים
  - ניהול מבנה תיקיות

### 4. מודול MenuManager (`src/ivr/menu-manager.js`)
- **תפקיד**: ניהול תפריטי IVR
- **פונקציות**:
  - יצירת תפריטים דינמיים
  - עדכון אפשרויות תפריט
  - ניהול תת-תפריטים
  - אינטגרציה עם בסיס הנתונים

### 5. מודול GoogleSheetsSync (`src/integrations/google-sheets-sync.js`)
- **תפקיד**: סנכרון עם Google Sheets
- **פונקציות**:
  - ייצוא הזמנות ל-Google Sheets
  - ייבוא נתונים מ-Google Sheets
  - עדכון סטטוסים
  - טיפול בקונפליקטים

### 6. מודול StatusSync (`src/integrations/status-sync.js`)
- **תפקיד**: סנכרון סטטוסים והזמנות
- **פונקציות**:
  - עדכון סטטוס הזמנה
  - סנכרון עם Yemot
  - התראות למנהלים
  - לוג היסטוריה

## זרימת עבודה

```
הזמנה חדשה → ExtensionManager יוצר שלוחה → FileManager מעלה קבצים → MenuManager מגדיר תפריט → StatusSync מעדכן סטטוס → GoogleSheetsSync מסנכרן
```

## תצורה

הגדרות ב-`.env`:
```
YEMOT_USERNAME=...
YEMOT_PASSWORD=...
YEMOT_SERVER=ym
GOOGLE_SHEETS_API_KEY=...
GOOGLE_SHEETS_SPREADSHEET_ID=...
```

## אבטחה

- הצפנת סיסמאות
- Token management
- Rate limiting
- Audit logging
- Error handling

## בדיקות

- Unit tests לכל מודול
- Integration tests עם Yemot API
- Mock tests ללא חיבור אמיתי
- End-to-end tests

## תרחישי שימוש

### יצירת שלוחה להזמנה
1. לקוח מזמין דרך האתר
2. ExtensionManager יוצר שלוחה חדשה
3. FileManager מעלה קבצי אודיו מותאמים אישית
4. MenuManager מגדיר תפריט הזמנה
5. StatusSync שולח התראה למנהל

### עדכון סטטוס הזמנה
1. מנהל משנה סטטוס במערכת
2. StatusSync מעדכן ב-Yemot
3. GoogleSheetsSync מסנכרן לגיליון

### סנכרון שבועי
1. Cron job מריץ סנכרון
2. GoogleSheetsSync מייבא הזמנות חדשות
3. ExtensionManager יוצר שלוחות חדשות
4. StatusSync מעדכן סטטוסים

## יתרונות השימוש ב-API

- **מהירות**: פעולות ישירות ללא UI
- **אמינות**: פחות שגיאות בהשוואה ל-browser automation
- **גמישות**: גישה לכל הפונקציות
- **תחזוקה**: קל יותר לעדכן
- **ביצועים**: פחות משאבי מערכת

## תוכנית יישום

1. **שלב 1**: התקנת yemot-api והגדרת YemotAPI wrapper
2. **שלב 2**: יישום ExtensionManager בסיסי
3. **שלב 3**: יישום FileManager
4. **שלב 4**: יישום MenuManager
5. **שלב 5**: יישום GoogleSheetsSync
6. **שלב 6**: יישום StatusSync
7. **שלב 7**: בדיקות ואינטגרציה
8. **שלב 8**: הפצה ותחזוקה