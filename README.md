# TeamSketch 🎨

TeamSketch is a real-time collaborative whiteboarding web application. It allows users to create and join rooms where they can sketch ideas together, chat in real-time, and communicate via voice. The platform provides a seamless and interactive experience with a rich set of drawing tools and robust synchronization.

## 🌟 Features

- **Real-Time Collaborative Whiteboard**: Draw, sketch, and brainstorm with your team simultaneously using an interactive canvas built with Fabric.js and Socket.IO.
- **Room Management**: Create custom rooms or join existing rooms via room links.
- **Room Text Chat**: Integrated real-time messaging within each room, ensuring continuous communication.
- **Voice Chat**: Real-time room voice chat for in-depth team discussions.
- **Authentication**: Secure email/password login and Google OAuth integration using Passport.js and JWT.
- **Dark Mode Support**: Context-aware UI themes.
- **API Documentation**: Interactive Swagger UI included for backend API exploration.

---

## 💻 Tech Stack

### Frontend
- **Framework**: React 18, Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Canvas/Drawing Engine**: Fabric.js
- **Real-time Communication**: Socket.io-client
- **Animations**: Framer Motion

### Backend
- **Framework**: Node.js, Express.js
- **Language**: JavaScript
- **Database**: MongoDB (via Mongoose)
- **Real-time Engine**: Socket.IO
- **Caching & Pub/Sub**: Redis
- **Security & Auth**: Passport.js, JWT, bcryptjs

---

## 🛠 Prerequisites

Before running the application, ensure you have the following installed on your local machine:
- Node.js (v16.x or later recommended)
- MongoDB instance (Atlas or local)
- Redis server running locally or accessible remotely
- A Google Cloud Console project configured for OAuth (optional, but needed for Google Login)

---

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd TeamSketch
```

### 2. Backend Setup

Change into the backend directory:
```bash
cd backend
npm install
```

Create a `.env` file inside the `backend` directory (refer to `.env.example` if available) and add the following:
```env
PORT=5000
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=30d
MONGODB_URI=your_mongodb_connection_string

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Session Configuration
SESSION_SECRET=your_session_secret_here

# Client URL
FRONTEND_URL=http://localhost:5173

# Whiteboard specific setup
WHITEBOARD_PORT=4000

# Redis Configuration
REDIS_URL=redis://localhost:6379
```

### 3. Frontend Setup

Open a new terminal session and change into the frontend directory:
```bash
cd frontend
npm install
```

Create a `.env` file inside the `frontend` directory:
```env
# Whiteboard Socket Server URL
VITE_SOCKET_URL=http://localhost:4000

# API Base URL
VITE_API_URL=http://localhost:5000
```

---

## 🏃 Running the Application

The application requires running both the frontend and two backend servers (the main API and the Whiteboard synchronization server).

### Running the Backend
From the `backend` directory, run the main API server:
```bash
npm run dev
```

Open another terminal in the `backend` directory and start the Whiteboard Socket server:
```bash
npm run whiteboard:dev
```

*(Note: The `backend` package.json is configured to run `./src/app.js` and `./src/whiteboardServer.js` respectively).*

### Running the Frontend
From the `frontend` directory:
```bash
npm run dev
```

The app will now be available, typically at `http://localhost:5173` (or as configured by your Vite setup).

---

## 📚 API Documentation

TeamSketch includes built-in Swagger documentation for the backend API.
When the main backend server is running, the API documentation can be accessed at:
- **`http://localhost:5000/api-docs`**

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check out the issues page.

