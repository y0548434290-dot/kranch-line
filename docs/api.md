# API Structure

## REST API Design

### Base URL
`https://api.yemot-system.com/v1`

### Authentication
- JWT Bearer tokens for admin endpoints
- API key for IVR integrations

### Endpoints

#### Customers
- `GET /customers` - List customers (admin)
- `GET /customers/{id}` - Get customer details
- `POST /customers` - Create customer
- `PUT /customers/{id}` - Update customer
- `DELETE /customers/{id}` - Delete customer

#### Orders
- `GET /orders` - List orders (admin)
- `GET /orders/{id}` - Get order details
- `POST /orders` - Create order (IVR)
- `PUT /orders/{id}/status` - Update order status
- `GET /orders/status/{phone}` - Check order status (IVR)

#### Products
- `GET /products` - List products
- `GET /products/{id}` - Get product details
- `POST /products` - Create product (admin)
- `PUT /products/{id}` - Update product
- `DELETE /products/{id}` - Delete product

#### Cities/Mokeds
- `GET /cities` - List cities
- `GET /cities/{id}` - Get city details
- `POST /cities` - Create city (admin)
- `PUT /cities/{id}` - Update city
- `DELETE /cities/{id}` - Delete city

#### Recordings
- `GET /recordings/{customer_id}` - Get customer recordings
- `POST /recordings` - Upload recording (IVR)
- `GET /recordings/audio/{id}` - Stream audio file

#### Admin
- `POST /auth/login` - Admin login
- `GET /admin/dashboard` - Dashboard data
- `GET /admin/reports` - Generate reports

#### Integrations
- `POST /integrations/sheets/sync` - Sync to Google Sheets
- `GET /integrations/sheets/status` - Check sync status

### Response Format
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message",
  "pagination": { ... } // for list endpoints
}
```

### Error Handling
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

### Rate Limiting
- 100 requests/minute for public endpoints
- 1000 requests/minute for authenticated admin endpoints
- Unlimited for IVR endpoints (internal)