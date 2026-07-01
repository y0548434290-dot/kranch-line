# הוראות התקנה - שרת api_link

המסמך הזה מסביר איך להפעיל את שרת ההזמנות, לחבר אותו ל-Google Sheets, ולחבר אותו לימות המשיח.

---

## שלב 1: יצירת Service Account ב-Google Cloud (פעם אחת)

זה השלב היחיד שדורש פעולה ידנית. ייקח ~5 דקות.

### א. כניסה ל-Google Cloud Console
1. נכנסי ל-https://console.cloud.google.com/ עם המייל `k0779709807@gmail.com`
2. אם זו פעם ראשונה - יבקש לאשר תנאים, פשוט אשרי

### ב. יצירת פרויקט חדש
1. לחצי על תפריט הפרויקטים למעלה (ליד הלוגו של Google Cloud)
2. "פרויקט חדש" / "NEW PROJECT"
3. שם: `kranch-orders` (או כל שם אחר)
4. צרי וחכי שיווצר

### ג. הפעלת Sheets API
1. בתפריט השמאלי: "APIs & Services" → "Library"
2. חיפוש: `Google Sheets API`
3. לחצי על "Enable"

### ד. יצירת Service Account
1. בתפריט השמאלי: "APIs & Services" → "Credentials"
2. "Create credentials" → "Service account"
3. שם: `yemot-orders-bot`
4. לחצי "Create and Continue"
5. בשלב Role: בחרי "Editor" (או "Sheets API" → "Editor")
6. "Done"

### ה. יצירת מפתח JSON
1. ברשימת Service Accounts לחצי על החשבון שיצרת
2. לשונית "Keys"
3. "Add key" → "Create new key" → JSON → Create
4. הקובץ ירד למחשב

### ו. שמירת המפתח בפרויקט
1. צרי תיקייה `config/` בפרויקט (אם לא קיימת)
2. שמרי את הקובץ שירד בשם **בדיוק:** `google-credentials.json`
3. הנתיב המלא: `c:\vscode\yemot-system\config\google-credentials.json`

---

## שלב 2: יצירת גליון Google Sheets

1. נכנסי ל-https://sheets.google.com עם `k0779709807@gmail.com`
2. צרי גיליון חדש בשם **"הזמנות קראנץ"** (או כל שם)
3. שני את שם הגיליון הראשון (לשונית למטה) ל-**"הזמנות"** (בעברית, בדיוק כך)
4. **חשוב!** שתפי את הגיליון עם ה-Service Account:
   - לחצי "Share" / "שיתוף" למעלה מימין
   - בשדה האימייל הדביקי את כתובת ה-Service Account (נראית כמו `yemot-orders-bot@kranch-orders.iam.gserviceaccount.com` - תמצאי אותה בקובץ JSON, בשדה `client_email`)
   - הרשאה: **Editor** / **עורך**
   - לחצי "Send"
5. מה-URL של הגיליון, העתיקי את ה-Sheet ID:
   - URL נראה כך: `https://docs.google.com/spreadsheets/d/SHEET_ID_PO_HERE/edit`
   - הפיסקה באמצע (`SHEET_ID_PO_HERE`) זה ה-ID

---

## שלב 3: עדכון .env

ערכי את `.env` בפרויקט והכניסי את שני הערכים האלה:

```
GOOGLE_SHEETS_CREDENTIALS_PATH=./config/google-credentials.json
GOOGLE_SHEETS_SPREADSHEET_ID=<ה-ID שהעתקת מה-URL של הגיליון>
```

---

## שלב 4: הפעלת השרת

```bash
node src/api-link/server.js
```

אם הכל תקין, תראי:
```
✓ שרת api_link פועל בפורט 3001
  Google Sheets: מחובר
```

ובגיליון יופיעו אוטומטית שורת הכותרות.

---

## שלב 5: חשיפת השרת לאינטרנט (ngrok)

ימות המשיח צריך לגשת לשרת מהאינטרנט, אז במחשב המקומי משתמשים ב-ngrok:

### התקנה
1. הורידי מ-https://ngrok.com/download
2. הירשמי שם וקבלי authtoken
3. הרץ פעם אחת: `ngrok config add-authtoken <THE_TOKEN>`

### הפעלה
בטרמינל נפרד (השרת ממשיך לרוץ ברקע):
```bash
ngrok http 3001
```

תראי משהו כזה:
```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:3001
```

**העתיקי את הכתובת `https://abc123.ngrok-free.app`** - זו הכתובת שימות תפנה אליה.

---

## שלב 6: עדכון השלוחה בימות

קובץ `ivr_build/0/3/1/ext.ini` יוחלף ל-`type=api` שמפנה לשרת.

ה-URL יהיה: `https://abc123.ngrok-free.app/yemot/order` (החליפי `abc123` בשלך)

נצטרך להעלות את ext.ini המעודכן לימות (יש סקריפט שעושה זאת).

---

## ⚠️ הערות חשובות

1. **כתובת ngrok חדשה בכל הפעלה** (בגרסה החינמית). בייצור נצטרך פתרון יציב (Vercel/Render).
2. **השרת חייב לרוץ** כדי שהשיחות יעבדו. אם השרת נופל, אין הזמנות.
3. **קבצי הקלטה** (שם בעברית, באנגלית) - יישמרו בימות כקבצי .wav. השדות בגליון יחזיקו את הנתיב.

## בדיקות

- בריאות השרת: `http://localhost:3001/health`
- לוגים: בטרמינל של השרת
