# הוראות התקנה מפורטות - מה למלא ידנית

## 📋 רשימת הפעולות הנדרשות

### 1. התקנת תוכנות בסיסיות
- [ ] **Node.js 16+** - הורד מ-https://nodejs.org/ והתקן
  - הורד את גרסת ה-LTS (Recommended For Most Users)
  - לאחר ההורדה הרץ את קובץ ההתקנה (`.msi`)
  - וודא שסימנת את האפשרות `Add to PATH` במהלך ההתקנה
  - סגור את כל חלונות ה-Terminal/PowerShell פתוחים והחלף לחדש
  - **בדיקה**: פתח PowerShell חדש והרץ:
    - `node --version`
    - `npm --version`
  - אם יש בעיה ב-PATH, הרץ:
    - `$env:Path -split ';' | Select-String -Pattern 'nodejs'`
  - אם יש לך קובץ MSI מקומי: `msiexec.exe /i .\node-installer.msi /quiet /norestart`
- [ ] **PostgreSQL 12+** - הורד מ-https://www.postgresql.org/ והתקן
  - **אלטרנטיבה**: דרך Chocolatey: `choco install postgresql`
  - **בדיקה**: הרץ `psql --version`
- [ ] **Git** - אם לא מותקן, הורד מ-https://git-scm.com/

### 2. הגדרת חשבון Yemot Hamashiach
- [ ] **היכנס לחשבון Yemot**: https://www.call2all.co.il/ym/
- [ ] **וודא גישה ל-API**: צור קשר עם התמיכה אם צריך
- [ ] **קבל פרטי התחברות**:
  - שם משתמש: `___________`
  - סיסמה: `___________`

### 3. הגדרת Google Cloud Project
- [ ] **צור פרויקט חדש**: https://console.cloud.google.com/
- [ ] **הפעל Google Sheets API**:
  - חפש "Google Sheets API"
  - לחץ "Enable"
- [ ] **צור Service Account**:
  - APIs & Services → Credentials
  - Create Credentials → Service Account
  - שם: `yemot-system-service`
  - תיאור: `Service account for Yemot ordering system`
  - צור מפתח מסוג JSON
  - **הורד את הקובץ** והעבר אותו ל-`config/google-credentials.json`
  - **דוגמה לקובץ**: ראה `config/google-credentials-example.json`
- [ ] **צור גיליון Google Sheets**:
  - https://sheets.google.com/
  - צור גיליון חדש בשם "מערכת הזמנות ימות"
  - **שתף עם כתובת ה-Service Account** (מהקובץ credentials.json)
  - **העתק את מזהה הגיליון** מה-URL (החלק בין /d/ ל-/edit)

### 4. מילוי קובץ .env
ערוך את הקובץ `.env` עם הפרטים הבאים:

```env
# מסד נתונים PostgreSQL
DATABASE_URL=postgresql://[שם_משתמש]:[סיסמה]@localhost:5432/yemot_system

# Yemot API - מלא עם הפרטים האמיתיים שלך
YEMOT_USERNAME=[השם_משתמש_שלך_בימות]
YEMOT_PASSWORD=[הסיסמה_שלך_בימות]
YEMOT_SERVER=ym

# Google Sheets API
GOOGLE_SHEETS_CREDENTIALS_PATH=./config/google-credentials.json
GOOGLE_SHEETS_SPREADSHEET_ID=[מזהה_הגיליון_שלך]

# שרת
PORT=3000
NODE_ENV=development

# JWT (לשלב מאוחר יותר)
JWT_SECRET=[מחרוזת_אקראית_ארוכה]

# שאר ההגדרות יכולות להישאר כפי שהן
```

### 5. יצירת מסד נתונים
```bash
# התחבר ל-PostgreSQL:
psql -U postgres

# צור מסד נתונים:
CREATE DATABASE yemot_system;

# צא:
\q
```

### 6. הרצת המערכת
```bash
# התקנה אוטומטית (מומלץ):
# פתח PowerShell כ-Administrator והרץ:
.\setup.ps1

# או התקנה ידנית:
npm install

# הרץ מיגרציה:
npm run migrate

# הוסף נתוני דוגמה:
npm run seed

# הרץ בדיקת חיבור בסיסית:
npm run test:connection

# אם הכל עובד, הרץ את השרת:
npm start
```

## 🔍 בדיקות שצריך לעשות

### בדיקת חיבור ל-Yemot
1. הרץ: `npm run test:yemot`
2. אם מצליח - תראה הודעה על יצירת שלוחה
3. התקשר למספר השלוחה שנוצרה לבדיקה

### בדיקת Google Sheets
1. בדוק שהגיליון התמלא בנתונים
2. נסה לעדכן סטטוס דרך ה-API
3. וודא שהשינויים מסתנכרנים

### בדיקת API
```bash
# בדוק שרת פועל:
curl http://localhost:3000/health

# קבל סטטיסטיקות:
curl http://localhost:3000/api/stats
```

## 🚨 בעיות נפוצות ופתרונות

### "שם משתמש או סיסמא שגויים" ב-Yemot
- בדוק שוב את שם המשתמש והסיסמה
- וודא שיש לך גישה ל-API
- צור קשר עם תמיכת Yemot

### "The OAuth client was not found" ב-Google Sheets
- בדוק שקובץ credentials.json נמצא בנתיב הנכון
- וודא שהגיליון משותף עם ה-Service Account
- בדוק שמזהה הגיליון נכון

### "connect ECONNREFUSED" למסד נתונים
- בדוק ש-PostgreSQL פועל
- וודא שהפרטים ב-DATABASE_URL נכונים
- בדוק שמסד הנתונים yemot_system קיים

## 📞 קבלת עזרה

אם נתקעת:
1. בדוק את הלוגים ב-`logs/` folder
2. הרץ את `npm run test:yemot` לראות הודעות שגיאה מפורטות
3. צור קשר עם התמיכה של Yemot או Google

## ✅ אחרי שהכל עובד

כשתסיים את כל השלבים:
- [ ] המערכת תפעל מקומית
- [ ] תוכל ליצור הזמנות דרך ה-API
- [ ] השלוחות יווצרו אוטומטית ב-Yemot
- [ ] הנתונים יסתנכרנו עם Google Sheets
- [ ] יהיה לך בסיס מוכן לפיתוח ממשק המשתמש