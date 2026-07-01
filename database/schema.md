# Database Schema Design

## Entity-Relationship Diagram

```
Customers ──── Orders ──── OrderItems ──── Products
    │           │
    │           │
    └── Recordings  └── StatusHistory
                │
Cities/Mokeds ──┘
```

## Tables

### customers
- id (UUID, PK)
- phone_number (VARCHAR, unique)
- name_hebrew (VARCHAR)
- name_english (VARCHAR, nullable)
- city_id (UUID, FK)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### cities
- id (UUID, PK)
- name (VARCHAR)
- code (VARCHAR, unique)
- active (BOOLEAN)

### products
- id (UUID, PK)
- name (VARCHAR)
- description (TEXT)
- price (DECIMAL)
- category (VARCHAR)
- active (BOOLEAN)
- created_at (TIMESTAMP)

### orders
- id (UUID, PK)
- customer_id (UUID, FK)
- status (ENUM: pending, confirmed, processing, completed, cancelled)
- total_amount (DECIMAL)
- notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### order_items
- id (UUID, PK)
- order_id (UUID, FK)
- product_id (UUID, FK)
- quantity (INTEGER)
- unit_price (DECIMAL)

### recordings
- id (UUID, PK)
- customer_id (UUID, FK)
- audio_path (VARCHAR)
- type (ENUM: hebrew_name, english_name, order_confirmation)
- created_at (TIMESTAMP)

### status_history
- id (UUID, PK)
- order_id (UUID, FK)
- old_status (ENUM)
- new_status (ENUM)
- changed_by (VARCHAR)
- changed_at (TIMESTAMP)

### admin_users
- id (UUID, PK)
- username (VARCHAR, unique)
- password_hash (VARCHAR)
- role (ENUM: admin, manager)
- active (BOOLEAN)
- created_at (TIMESTAMP)

## Indexes
- customers.phone_number
- orders.customer_id, orders.status
- order_items.order_id
- recordings.customer_id

## Constraints
- Foreign key relationships with CASCADE delete where appropriate
- Check constraints for positive quantities and amounts
- Unique constraints on critical fields