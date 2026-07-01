# Yemot Hamashiach Phone Ordering System

## Requirements Analysis

### Core Features
- **IVR Order Flow**: Automated voice-guided ordering process
- **Customer Identification**: Phone number-based customer recognition
- **City/Moked Selection**: Location-based service selection
- **Product Quantity Collection**: Multi-product ordering with quantities
- **Personalized Name Recordings**: Hebrew name recording with optional English
- **Order Confirmation**: Voice confirmation of order details
- **Order Status Tracking**: Customer status inquiry capability
- **Google Sheets Integration**: Order data export to spreadsheets
- **Admin Management Panel**: Web-based administrative interface
- **Yemot Extension Generation**: Dynamic IVR extension creation
- **ext.ini Management**: Configuration file handling
- **Audio Handling**: Recording and playback management
- **Future API Integration**: Extensible API architecture

### System Separation
1. **IVR Layer**: Voice interaction and Yemot platform integration
2. **Business Logic**: Order processing, validation, and data management
3. **Admin Dashboard**: Administrative user interface
4. **Integrations**: External service connections (Google Sheets, APIs)

### Technical Considerations
- Hebrew language support (RTL)
- Audio file management
- Real-time IVR interactions
- Secure data handling
- Scalable architecture