# Yemot Hamashiach Phone Ordering System

מערכת הזמנות טלפונית עם אינטגרציה ל-Yemot Hamashiach.

## סקירה כללית

מערכת מקיפה להזמנות טלפוניות עם אינטגרציה ל-IVR של Yemot Hamashiach, כוללת ניהול לקוחות, מוצרים, הזמנות וסנכרון עם Google Sheets.

## ארכיטקטורה

המערכת מחולקת לארבע שכבות עיקריות:
- **שכבת IVR**: טיפול באינטראקציות קוליות דרך פלטפורמת Yemot
- **שכבת לוגיקה עסקית**: לוגיקת יישום ליבה ועיבוד נתונים
- **לוח בקרה למנהל**: ממשק אינטרנט למנהלים
- **שכבת אינטגרציות**: חיבורים לשירותים חיצוניים

## טכנולוגיות

- **Backend**: Node.js, Express.js
- **מסד נתונים**: PostgreSQL
- **Frontend**: React.js
- **IVR**: אינטגרציית Yemot API
- **פריסה**: Docker

## מבנה הפרויקט

```
yemot-system/
├── src/
│   ├── ivr/              # מודולי IVR
│   │   ├── yemot-api-wrapper.js
│   │   ├── extension-manager.js
│   │   ├── file-manager.js
│   │   └── menu-manager.js
│   ├── integrations/     # אינטגרציות
│   │   ├── google-sheets-sync.js
│   │   └── status-sync.js
│   ├── business/         # לוגיקה עסקית
│   ├── admin/            # ממשק מנהל
│   └── yemot-system.js   # מודול ראשי
├── public/               # קבצים סטטיים, קבצי אודיו
├── config/               # קבצי תצורה
├── database/             # מסד נתונים
│   ├── migrate.js
│   └── seed.js
├── logs/                 # לוגים
├── uploads/              # קבצים שהועלו
└── docs/                 # תיעוד
```

## תכונות עיקריות

- זרימת הזמנות IVR אוטומטית
- זיהוי וניהול לקוחות
- תמיכה בריבוי מוקדים/ערים
- קטלוג מוצרים עם בחירת כמויות
- הקלטות שמות מותאמות אישית בעברית/אנגלית
- אישור הזמנות ומעקב סטטוסים
- אינטגרציה עם Google Sheets
- לוח בקרה מקיף למנהלים
- יצירת שלוחות Yemot דינמית
- ניהול קבצי אודיו

## התקנה

למדריך התקנה מלא ומפורט ראה **[INSTALL.md](INSTALL.md)**

### דרישות מקדימות
- Node.js 16+ (מומלץ LTS)
- PostgreSQL 12+
- חשבון Yemot Hamashiach עם גישה ל-API
- פרויקט Google Cloud עם Google Sheets API מופעל

### שלבי התקנה מפורטים

#### 1. התקנת Node.js
```bash
# הורד והתקן מ-https://nodejs.org/
# או דרך Chocolatey:
choco install nodejs-lts

# או דרך winget:
winget install OpenJS.NodeJS.LTS

# בדוק התקנה:
node --version
npm --version
```

#### 2. התקנת PostgreSQL
```bash
# הורד והתקן מ-https://www.postgresql.org/
# או דרך Chocolatey:
choco install postgresql

# צור מסד נתונים:
createdb yemot_system
```

#### 3. שכפול והתקנה
```bash
git clone <repository-url>
cd yemot-system
npm install
```

#### 4. הגדרת מסד נתונים
```bash
# הרץ מיגרציה:
npm run migrate

# הוסף נתוני דוגמה:
npm run seed
```

#### 5. הגדרת Yemot Hamashiach
1. **היכנס לחשבון Yemot** בכתובת: https://www.call2all.co.il/ym/
2. **וודא שיש לך גישה ל-API** (צור קשר עם התמיכה אם צריך)
3. **קבל שם משתמש וסיסמה** ל-API
4. **מלא ב-.env**:
   ```
   YEMOT_USERNAME=השם_משתמש_שלך
   YEMOT_PASSWORD=הסיסמה_שלך
   ```

#### 6. הגדרת Google Sheets API
1. **צור פרויקט חדש** ב-Google Cloud Console: https://console.cloud.google.com/
2. **הפעל Google Sheets API**:
   - חפש "Google Sheets API"
   - לחץ "Enable"
3. **צור Service Account**:
   - APIs & Services → Credentials
   - Create Credentials → Service Account
   - מלא שם ותיאור
   - צור מפתח JSON והורד את הקובץ
4. **העבר את הקובץ** לתיקיית `config/` וקרא לו `google-credentials.json`
5. **צור גיליון Google Sheets חדש**:
   - https://sheets.google.com/
   - שתף את הגיליון עם כתובת ה-Service Account (מהקובץ credentials.json)
   - העתק את מזהה הגיליון מה-URL (החלק בין /d/ ל-/edit)
6. **מלא ב-.env**:
   ```
   GOOGLE_SHEETS_SPREADSHEET_ID=מזהה_הגיליון
   ```

#### 7. הגדרת משתני סביבה
```bash
cp .env.example .env
# ערוך את .env עם הפרטים האמיתיים שלך
```

#### 8. הפעלת השרת
```bash
npm start
```

#### 9. בדיקת התקנה
```bash
# בדוק שרת פועל:
curl http://localhost:3000/health

# בדוק סטטיסטיקות:
curl http://localhost:3000/api/stats
```

### פתרון בעיות נפוצות

#### שגיאת חיבור ל-PostgreSQL
```bash
# בדוק ש-PostgreSQL פועל:
pg_isready -h localhost -p 5432

# אם לא, התחל את השירות:
sudo systemctl start postgresql  # Linux
# או דרך Services ב-Windows
```

#### שגיאת חיבור ל-Yemot
- וודא ששם המשתמש והסיסמה נכונים
- בדוק שיש גישה ל-API
- נסה להתחבר ידנית דרך הדפדפן

#### שגיאת Google Sheets
- בדוק שקובץ credentials.json נמצא בנתיב הנכון
- וודא שהגיליון משותף עם ה-Service Account
- בדוק שמזהה הגיליון נכון

## שימוש

### API Endpoints

#### הזמנות
- `POST /api/orders` - יצירת הזמנה חדשה
- `PUT /api/orders/:id/status` - עדכון סטטוס הזמנה
- `GET /api/orders/:id/status` - קבלת סטטוס הזמנה

#### לקוחות
- `POST /api/customers` - יצירת לקוח חדש

#### סנכרון
- `POST /api/sync` - סנכרון מלא עם Google Sheets
- `GET /api/stats` - סטטיסטיקות המערכת

## תיעוד

- [ארכיטקטורת האוטומציה](docs/automation-architecture.md)
- [סכימת מסד נתונים](database/schema.md)
- [מבנה API](docs/api.md)
- [אינטגרציית Yemot](docs/yemot-integration.md)
- [תוכנית פיתוח](docs/development-phases.md)