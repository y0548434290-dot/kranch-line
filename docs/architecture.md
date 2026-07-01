# System Architecture

## Recommended Architecture

### Technology Stack
- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL (structured data) + Redis (caching/session)
- **Frontend**: React.js with Material-UI
- **IVR Integration**: Yemot API/SDK
- **Authentication**: JWT with role-based access
- **File Storage**: Local filesystem for audio + cloud storage option
- **Deployment**: Docker containers

### Layered Architecture

```
┌─────────────────┐
│   Admin UI      │ ← React SPA
│   (Dashboard)   │
└─────────────────┘
         │
┌─────────────────┐
│   REST API      │ ← Express.js
│   (Business)    │
└─────────────────┘
         │
┌─────────────────┐
│   IVR Layer     │ ← Yemot Integration
│   (Voice)       │
└─────────────────┘
         │
┌─────────────────┐
│   Integrations  │ ← Google Sheets, APIs
│   (External)    │
└─────────────────┘
         │
┌─────────────────┐
│   Database      │ ← PostgreSQL
│   (Persistence) │
└─────────────────┘
```

### Key Design Principles
- **Separation of Concerns**: Clear boundaries between layers
- **Modular Design**: Independent, testable components
- **Scalability**: Horizontal scaling capability
- **Security**: Input validation, authentication, authorization
- **Maintainability**: Clean code, documentation, testing
- **Hebrew/RTL Support**: Proper text handling and UI direction

### Data Flow
1. Customer calls IVR number
2. Yemot routes to our extension
3. IVR layer handles voice interaction
4. Business logic processes requests
5. Data stored in database
6. Admin dashboard displays/manages data
7. Integrations sync external systems