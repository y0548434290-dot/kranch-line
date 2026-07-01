const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('../env-loader');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

/**
 * סקריפט מיגרציה למסד הנתונים
 * יוצר את כל הטבלאות הנדרשות
 */
async function migrate() {
    try {
        console.log('מתחיל מיגרציה...');

        // יצירת טבלת ערים
        await pool.query(`
            CREATE TABLE IF NOT EXISTS cities (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                code VARCHAR(10) UNIQUE,
                active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('טבלת cities נוצרה');

        // יצירת טבלת לקוחות
        await pool.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                phone VARCHAR(20) UNIQUE NOT NULL,
                name_hebrew VARCHAR(255),
                name_english VARCHAR(255),
                city_id UUID REFERENCES cities(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('טבלת customers נוצרה');

        // יצירת טבלת מוצרים
        await pool.query(`
            CREATE TABLE IF NOT EXISTS products (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                price DECIMAL(10,2) NOT NULL DEFAULT 0,
                category VARCHAR(100),
                active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('טבלת products נוצרה');

        // יצירת טבלת הזמנות
        await pool.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                customer_id UUID REFERENCES customers(id) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                total_amount DECIMAL(10,2) DEFAULT 0,
                notes TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('טבלת orders נוצרה');

        // יצירת טבלת פריטי הזמנה
        await pool.query(`
            CREATE TABLE IF NOT EXISTS order_items (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                order_id UUID REFERENCES orders(id) NOT NULL,
                product_id UUID REFERENCES products(id) NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1,
                unit_price DECIMAL(10,2) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('טבלת order_items נוצרה');

        // יצירת טבלת הקלטות
        await pool.query(`
            CREATE TABLE IF NOT EXISTS recordings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                customer_id UUID REFERENCES customers(id),
                audio_path VARCHAR(500),
                type VARCHAR(50), -- hebrew_name, english_name, order_confirmation
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('טבלת recordings נוצרה');

        // יצירת טבלת היסטוריית סטטוסים
        await pool.query(`
            CREATE TABLE IF NOT EXISTS status_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                order_id UUID REFERENCES orders(id) NOT NULL,
                old_status VARCHAR(50),
                new_status VARCHAR(50) NOT NULL,
                changed_by VARCHAR(255),
                changed_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('טבלת status_history נוצרה');

        // יצירת טבלת מנהלי מערכת
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                username VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'admin',
                active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('טבלת admin_users נוצרה');

        // יצירת אינדקסים
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_recordings_customer_id ON recordings(customer_id);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_status_history_order_id ON status_history(order_id);`);

        console.log('אינדקסים נוצרו');

        // יצירת טריגרים לעדכון updated_at
        await pool.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);

        await pool.query(`
            CREATE TRIGGER update_customers_updated_at
                BEFORE UPDATE ON customers
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        `);

        await pool.query(`
            CREATE TRIGGER update_orders_updated_at
                BEFORE UPDATE ON orders
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        `);

        console.log('טריגרים נוצרו');

        console.log('מיגרציה הושלמה בהצלחה!');
    } catch (error) {
        console.error('שגיאה במיגרציה:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

// הרצת המיגרציה
if (require.main === module) {
    migrate().catch(console.error);
}

module.exports = migrate;