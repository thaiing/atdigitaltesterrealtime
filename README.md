# TMS - Temperature Monitoring System

A web application for monitoring temperature and device health status in power stations, built with Angular 19 and Angular Material.

## Features

### Core Functionality
- **Real-time Temperature Monitoring** - Continuous automatic monitoring with trend charts
- **E-Map** - Interactive map showing thermal cameras and sensors with their status
- **Single Line Diagram** - Electrical system diagram with temperature overlays
- **Alert Management** - Active alerts, history, and threshold configuration
- **Reporting** - Generate reports by day, month, year with export capabilities

### Device Management
- Thermal camera configuration (PTZ and fixed cameras)
- Temperature sensor management (PT100, Thermocouple, IR)
- Support for Modbus RTU/TCP and IEC 60870-5-104 protocols

### User Interface
- Modern Material Design UI
- Responsive layout for desktop and mobile
- Role-based access control (Admin, Operator, Viewer)

## Technology Stack

- **Framework**: Angular 19 (Standalone Components)
- **UI Library**: Angular Material 19
- **Charts**: ng2-charts + Chart.js
- **State Management**: RxJS BehaviorSubject
- **Styling**: SCSS with CSS Variables

## Project Structure

```
src/app/
├── components/
│   ├── layout/           # Main layout, sidebar, header
│   ├── dialogs/          # Modal dialogs
│   ├── shared/           # Reusable components
│   └── logo/             # Logo component
├── pages/
│   ├── login/            # Authentication
│   ├── dashboard/        # Main dashboard
│   ├── e-map/            # Interactive device map
│   ├── single-line-diagram/
│   ├── alerts/           # Active alerts & history
│   ├── configuration/    # Device & system settings
│   ├── reports/          # Reporting module
│   └── account/          # User account settings
├── services/             # Data services with mock data
├── interfaces/           # TypeScript interfaces
├── guards/               # Route guards
└── app.routes.ts         # Application routing
```

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm 9+

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start
```

The application will be available at `http://localhost:4200`

### Default Credentials
- **Username**: admin
- **Password**: admin

## Backend Integration

This frontend is designed to work with OpenMUC + Felix backend. The services use mock data that can be replaced with actual API calls.

### API Endpoints (to be implemented)
- `/api/temperatures` - Temperature readings
- `/api/cameras` - Thermal camera management
- `/api/sensors` - Temperature sensor management
- `/api/alerts` - Alert management
- `/api/users` - User management

### Communication Protocols
- **Modbus TCP/RTU** - For temperature data collection
- **IEC 60870-5-104** - For SCADA integration

## Configuration

Application configuration is in `src/assets/config/app-config.json`:

```json
{
  "apiUrl": "/api",
  "wsUrl": "ws://localhost:8080/ws",
  "refreshInterval": 5000
}
```

## Building for Production

```bash
npm run build
```

Output will be in the `dist/tms-frontend` folder.

## License

Proprietary - AT Energy JSC

## Support

For technical support, contact: support@at-energy.vn


