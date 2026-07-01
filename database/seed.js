const { Pool } = require('pg');
require('../env-loader');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

/**
 * סקריפט seed למסד הנתונים
 * יוצר נתוני דוגמה
 */
async function seed() {
    try {
        console.log('מתחיל seed...');

        // הוספת ערים
        const cities = [
            { name: 'ירושלים', code: 'jerusalem' },
            { name: 'תל אביב', code: 'tel_aviv' },
            { name: 'חיפה', code: 'haifa' },
            { name: 'באר שבע', code: 'beer_sheva' },
            { name: 'רחובות', code: 'rehovot' }
        ];

        for (const city of cities) {
            await pool.query(`
                INSERT INTO cities (name, code)
                VALUES ($1, $2)
                ON CONFLICT (code) DO NOTHING
            `, [city.name, city.code]);
        }
        console.log('ערים נוספו');

        // הוספת מוצרים
        const products = [
            { name: 'חלה', description: 'חלה טרייה', price: 25.00, category: 'מאפים' },
            { name: 'קוגל', description: 'קוגל תפוחי אדמה', price: 30.00, category: 'מנות עיקריות' },
            { name: 'צימעס', description: 'צימעס מתוק', price: 20.00, category: 'תוספות' },
            { name: 'גפילטע פיש', description: 'דג מבושל', price: 35.00, category: 'מנות עיקריות' },
            { name: 'צ׳ולנט', description: 'צ׳ולנט מסורתי', price: 40.00, category: 'מנות עיקריות' },
            { name: 'קומפוט', description: 'קומפוט פירות', price: 15.00, category: 'שתייה' }
        ];

        for (const product of products) {
            await pool.query(`
                INSERT INTO products (name, description, price, category)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT DO NOTHING
            `, [product.name, product.description, product.price, product.category]);
        }
        console.log('מוצרים נוספו');

        // הוספת מנהל מערכת
        const bcrypt = require('bcryptjs');
        const adminPassword = await bcrypt.hash('admin123', 10);

        await pool.query(`
            INSERT INTO admin_users (username, password_hash, role)
            VALUES ($1, $2, $3)
            ON CONFLICT (username) DO NOTHING
        `, ['admin', adminPassword, 'admin']);
        console.log('מנהל מערכת נוסף');

        // הוספת לקוחות לדוגמה
        const customers = [
            { phone: '0501234567', name_hebrew: 'דוד כהן', city_code: 'jerusalem' },
            { phone: '0527654321', name_hebrew: 'שרה לוי', city_code: 'tel_aviv' },
            { phone: '0549876543', name_hebrew: 'משה רוזן', city_code: 'haifa' }
        ];

        for (const customer of customers) {
            // קבלת מזהה עיר
            const cityResult = await pool.query('SELECT id FROM cities WHERE code = $1', [customer.city_code]);
            const cityId = cityResult.rows[0]?.id;

            await pool.query(`
                INSERT INTO customers (phone, name_hebrew, city_id)
                VALUES ($1, $2, $3)
                ON CONFLICT (phone) DO NOTHING
            `, [customer.phone, customer.name_hebrew, cityId]);
        }
        console.log('לקוחות נוספו');

        console.log('Seed הושלם בהצלחה!');
    } catch (error) {
        console.error('שגיאה ב-seed:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

// הרצת ה-seed
if (require.main === module) {
    seed().catch(console.error);
}

module.exports = seed;