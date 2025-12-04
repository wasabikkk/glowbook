# Facial Booking System - Frontend

This is the frontend application for the Facial Booking System, deployed on GitHub Pages.

## 🚀 Live Site

Visit: `https://YOUR_USERNAME.github.io/facial-booking-frontend/`

(Replace `YOUR_USERNAME` with your GitHub username)

## 📋 Setup Instructions

### For Development

1. Open the project folder
2. Serve using a local server (e.g., Live Server in VS Code, or Python's `http.server`)
3. The frontend will automatically connect to `http://127.0.0.1:8000/api` when running locally

### For Production

1. Update `js/api.js` - Replace `'https://yourdomain.com/api'` with your actual backend domain
2. Push to GitHub
3. Enable GitHub Pages in repository settings

## 🔧 Configuration

### API Base URL

The API base URL is automatically detected based on the hostname:
- **Local development**: Uses `http://127.0.0.1:8000/api`
- **GitHub Pages**: Uses the URL specified in `js/api.js` (update line 8)

To change the production API URL, edit `js/api.js`:

```javascript
// Line 8 - Replace with your Hostinger domain
return 'https://your-actual-domain.com/api';
```

## 📁 Project Structure

```
facial-booking-frontend/
├── index.html              # Landing page
├── login.html              # Login page
├── register.html           # Registration page
├── profile.html            # User profile page
├── client-dashboard.html   # Client dashboard
├── aesthetician-dashboard.html  # Aesthetician dashboard
├── admin-dashboard.html    # Admin dashboard
├── css/
│   └── styles.css          # Main stylesheet
└── js/
    ├── api.js              # API configuration and functions
    ├── auth.js             # Authentication helpers
    ├── client-dashboard.js # Client dashboard logic
    ├── aesthetician-dashboard.js # Aesthetician dashboard logic
    └── admin-dashboard.js  # Admin dashboard logic
```

## 🔐 Authentication

The application uses Bearer token authentication. Tokens are stored in `localStorage` and automatically included in API requests.

## 🌐 CORS

Make sure your backend CORS configuration allows requests from your GitHub Pages URL. See the main deployment guide for details.

## 📝 License

This project is part of the Facial Booking System.

