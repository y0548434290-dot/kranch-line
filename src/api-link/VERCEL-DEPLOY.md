# פריסת api-link ל-Vercel

המטרה כאן היא לפרוס את שרת ה-API הקיים ל-Vercel בלי לשנות את מבנה הקו ובלי לשנות את ה-flow של ימות.

## מה כבר מוכן בפרויקט

- האפליקציה המשותפת נמצאת ב-`src/api-link/app.js`
- הרצה מקומית נשארת דרך `src/api-link/server.js`
- כניסה ל-Vercel נעשית דרך `api/index.js`
- `vercel.json` כבר מוגדר עם `maxDuration` של 15 שניות

## env vars נדרשים ב-Vercel

יש להגדיר ב-Project Settings -> Environment Variables:

- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SHEETS_CLIENT_EMAIL`
- `GOOGLE_SHEETS_PRIVATE_KEY`

אופציונלי:

- `RESEND_API_KEY`
- `ORDER_EMAIL_FROM`

לא נדרש ב-Vercel:

- `GOOGLE_SHEETS_CREDENTIALS_PATH`
- `API_LINK_PORT`

## איך למלא את GOOGLE_SHEETS_PRIVATE_KEY

יש להדביק את המפתח הפרטי המלא של Service Account.

אם Vercel שומר את הערך כשורה אחת, אפשר להדביק אותו עם `\n` בין השורות. הקוד כבר מנרמל את זה אוטומטית.

## תהליך פריסה מומלץ

1. להתחבר ל-Vercel עם אותו פרויקט קיים
2. לייבא את הריפו/התיקייה
3. להגדיר את env vars
4. לבצע Deploy
5. לאמת:
   - `/health`
   - `/yemot/order`
   - `/yemot/status`
6. רק אחרי אימות, לעדכן את `API_PUBLIC_URL`
7. להעלות שוב את:
   - `ivr_build/0/3/1/ext.ini`
   - `ivr_build/0/5/ext.ini`

## כתובות צפויות אחרי פריסה

- `https://<vercel-domain>/health`
- `https://<vercel-domain>/yemot/order`
- `https://<vercel-domain>/yemot/status`

אין צורך להוסיף `/api/index` לכתובת, כי `vercel.json` כבר מבצע rewrite.

## המלצות יציבות

- להשאיר `Cache-Control: no-store` ל-`/health`
- לא להשתמש ב-caching על `order` או `status`
- לא להפעיל `setInterval` ב-Vercel
- לא לשמור state קבוע על הדיסק ב-Vercel

## הערה על סנכרון מיילים

בפריסה ל-Vercel, סנכרון המיילים המחזורי כבוי בכוונה.

שליחת מייל על הזמנה חדשה עדיין יכולה לעבוד, אם מוגדרים:

- `RESEND_API_KEY`
- `ORDER_EMAIL_FROM`

## אחרי שהפריסה תקינה

יש לעדכן את `.env` המקומי:

- `API_PUBLIC_URL=https://<vercel-domain>`

ואז להריץ את סקריפט ההעלאה הקיים:

- `node upload-api-ext.js`

זה כל מה שצריך כדי להעביר את שלוחות ה-`type=api` לכתובת היציבה של Vercel, בלי לשנות שום מבנה בקו.
