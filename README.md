# GT06 Comprehensive Protocol Decoder

A complete, custom-built GT06 protocol decoder and GPS tracking server with SQLite3 database storage and REST API interface.

## 🌟 Features

### 🔧 Custom GT06 Protocol Decoder
- **Raw Implementation**: Built from scratch based on GT06 Traccar documentation
- **Comprehensive Protocol Support**: Handles 30+ GT06 protocol types including:
  - Login packets (0x01)
  - GPS positioning data (0x10, 0x11, 0x12, 0x22)
  - Status information (0x13)
  - Alarm data (0x16)
  - WiFi positioning (0x30)
  - ICCID information (0x69)
  - And many more...

### 💾 Database Storage
- **SQLite3 Integration**: Stores all decoded data with proper relational schema
- **Structured Tables**: Separate tables for packets, GPS data, LBS data, status info, alarms, WiFi data
- **Session Tracking**: Monitors device connections and sessions
- **Performance Optimized**: Includes indexes for fast queries

### 🌐 REST API
- **Comprehensive Endpoints**: 13+ API endpoints for data access
- **Filtering & Pagination**: Query data with various filters
- **Multiple Export Formats**: JSON, CSV, XML export support
- **GeoJSON Support**: GPS data in GeoJSON format for mapping
- **Real-time Stats**: Live server and client statistics

### 🚀 Advanced Features
- **Dual Server Architecture**: TCP server for GT06 devices + HTTP API server
- **Client Session Management**: Track connections, heartbeats, and statistics
- **Automatic Response Generation**: Sends acknowledgments to devices when required
- **Graceful Shutdown**: Proper cleanup of connections and resources
- **Error Handling**: Comprehensive error handling and logging
- **Production Ready**: Includes security headers, CORS, and proper middleware

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Basic understanding of GPS tracking protocols

## 🚀 Quick Start

### 1. Clone and Install
```bash
# Clone the repository
cd TCP_Server

# Install dependencies
npm install
```

### 2. Start the Server
```bash
# Start the complete system
npm start

# Or for development with auto-reload
npm run dev
```

### 3. Access the Services

**TCP Server (GT06 Devices):**
- Host: `84.247.131.246`
- Port: `5000`

**API Server:**
- URL: `http://localhost:3000`
- Documentation: `http://localhost:3000/api/docs`
- Health Check: `http://localhost:3000/api/health`

## 📊 API Endpoints

### Core Data Access
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/packets` | Get all packets with pagination and filtering |
| GET | `/api/packets/:id` | Get specific packet by ID |
| GET | `/api/gps` | Get GPS tracking data |
| GET | `/api/gps/geojson` | Get GPS data in GeoJSON format |

### Device Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices` | Get list of all devices |
| GET | `/api/devices/:terminalId/stats` | Get device statistics |
| GET | `/api/sessions` | Get active device sessions |

### Analytics & Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Get dashboard overview |
| GET | `/api/alarms` | Get alarm data |
| GET | `/api/export/:format` | Export data (json/csv/xml) |
| GET | `/api/search` | Search packets |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/docs` | API documentation |
| GET | `/stats` | Real-time server statistics |

## 🔍 API Usage Examples

### Get Recent Packets
```bash
curl "http://localhost:3000/api/packets?limit=10&page=1"
```

### Get GPS Data for Specific Device
```bash
curl "http://localhost:3000/api/gps?terminalId=ABC123&limit=50"
```

### Get GPS Data in GeoJSON Format
```bash
curl "http://localhost:3000/api/gps/geojson?terminalId=ABC123"
```

### Export Data as CSV
```bash
curl "http://localhost:3000/api/export/csv?dataType=gps&terminalId=ABC123"
```

### Get Device Statistics
```bash
curl "http://localhost:3000/api/devices/ABC123/stats"
```

## 🗄️ Database Schema

### Main Tables
- **packets**: Core packet information
- **gps_data**: GPS positioning data
- **lbs_data**: LBS/Cell tower data
- **status_info**: Device status information
- **alarm_data**: Alarm and alert data
- **wifi_data**: WiFi positioning data
- **wifi_access_points**: WiFi access point details
- **device_sessions**: Client session tracking

### Key Relationships
- Packets → GPS Data (1:1)
- Packets → LBS Data (1:1)
- Packets → Status Info (1:1)
- WiFi Data → Access Points (1:N)

## 🔧 Configuration

### Server Configuration
Edit `server.js` to modify:
```javascript
const TCP_HOST = '84.247.131.246';  // GT06 TCP server host
const TCP_PORT = 5000;               // GT06 TCP server port
const API_PORT = 3000;               // API server port
```

### Database Configuration
The SQLite database is automatically created as `gt06_data.db`. To use a different path:
```javascript
const database = new GT06Database('./custom_path.db');
```

## 📈 Monitoring & Logging

### Real-time Statistics
Access live server stats at: `http://localhost:3000/stats`

### Console Logging
The server provides detailed console logging with emoji indicators:
- 🚀 System initialization
- 📱 Client connections
- 📨 Data reception
- 📦 Packet processing
- 💾 Database operations
- ❌ Errors and warnings

### Example Console Output
```
🚀 Initializing GT06 Comprehensive Protocol Decoder...
💾 Connected to SQLite database
📡 TCP Server listening on 84.247.131.246:5000
🌐 API Server listening on http://localhost:3000
📱 Client connected: 192.168.1.100:45231
📦 Packet 1 stored: { protocol: 'LOGIN', terminalId: 'ABC123DEF456' }
```

## 🔌 GT06 Protocol Support

### Supported Protocol Types
| Code | Name | Description |
|------|------|-------------|
| 0x01 | LOGIN | Device login/authentication |
| 0x10 | GPS_LBS_STATUS | GPS + LBS positioning |
| 0x11 | GPS_LBS_ALARM | GPS + LBS with alarm |
| 0x12 | GPS_LBS_STATUS_2 | Extended GPS + LBS |
| 0x13 | STATUS_INFO | Device status information |
| 0x16 | ALARM_DATA | Alarm and alert data |
| 0x19 | GPS_LBS_EXTEND | Extended GPS data |
| 0x1A | GPS_LBS_DATA | GPS LBS data packet |
| 0x30 | WIFI_POSITIONING | WiFi positioning data |
| 0x69 | ICCID_INFO | SIM card information |

### Decoded Data Fields
- **GPS Data**: Latitude, longitude, speed, course, satellites, accuracy
- **LBS Data**: MCC, MNC, LAC, Cell ID
- **Status**: Battery, charging, ACC, defense mode, signal strength
- **Alarms**: Emergency, overspeed, shock, geofence, etc.
- **WiFi**: Access point MAC addresses and signal strength

## 🛠️ Development

### File Structure
```
TCP_Server/
├── server.js           # Main server application
├── gt06_decoder.js     # Custom GT06 protocol decoder
├── database.js         # SQLite3 database management
├── api_routes.js       # Express API routes
├── package.json        # Dependencies and scripts
├── README.md          # Documentation
└── gt06_data.db       # SQLite database (auto-created)
```

### Adding New Protocol Types
1. Add protocol code to `PROTOCOL_NUMBERS` in `gt06_decoder.js`
2. Create decoder method (e.g., `decodeCustomProtocol`)
3. Add case to `decodePacket` switch statement
4. Update database schema if needed

### Testing
```bash
# Send test GT06 packet (requires netcat or similar tool)
echo "787811010123456789012345000D0A" | xxd -r -p | nc 84.247.131.246 5000
```

## 🚦 Production Deployment

### Security Considerations
- The server includes Helmet.js for security headers
- CORS is enabled for API access
- Consider adding authentication for production API access
- Use environment variables for sensitive configuration

### Performance Optimization
- Database indexes are automatically created
- Connection pooling for high-traffic scenarios
- Consider using PM2 for process management in production

### Monitoring
- Health check endpoint for load balancers
- Real-time statistics for monitoring dashboards
- Structured logging for external log aggregation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

ISC License

## 🆘 Support

For issues and questions:
1. Check the API documentation at `/api/docs`
2. Review console logs for error details
3. Verify GT06 device configuration
4. Test with health check endpoint

## 🔄 Version History

### v1.0.0
- Initial release with comprehensive GT06 support
- SQLite3 database integration
- REST API with 13+ endpoints
- Real-time monitoring and statistics
- Production-ready architecture

---

**Built with ❤️ for the GPS tracking community** 