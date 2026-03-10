# Shosal

A professional real-time chat application with user authentication, profile pictures, voice messaging, and photo sharing - styled like WhatsApp.

## Features

- ✅ User login with username
- ✅ Profile picture upload and display
- ✅ Real-time text messaging
- ✅ Voice message recording and playback
- ✅ Photo sharing
- ✅ Reply to messages (like WhatsApp)
- ✅ Delete your own messages
- ✅ Online users list with avatars
- ✅ Typing indicator
- ✅ Browser notifications when someone replies to you
- ✅ Join/leave notifications
- ✅ Message timestamps
- ✅ WhatsApp-style dark theme
- ✅ Mobile responsive

## Local Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser and navigate to `http://localhost:3000`

## Deploy to Render

### Option 1: Using render.yaml (Recommended)

1. Add your `app.png` icon to the `public` folder
2. Push this code to a GitHub repository
3. Go to [Render Dashboard](https://dashboard.render.com/)
4. Click "New" → "Blueprint"
5. Connect your GitHub repository
6. Render will automatically detect the `render.yaml` file and deploy

### Option 2: Manual Setup

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - Name: shosal
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Click "Create Web Service"

The app will be live at your Render URL (e.g., `https://shosal-xxxx.onrender.com`)

## Usage

1. Upload a profile picture (optional)
2. Enter a username on the login screen
3. Start chatting with other users
4. Click the microphone button to record and send voice messages
5. Click the photo button to send images
6. Click "Reply" on any message to quote it
7. See who's online in the sidebar with their profile pictures

## Technical Details

- Built with Node.js, Express, and Socket.IO
- Real-time WebSocket communication
- Web Audio API for voice recording
- Responsive design for mobile and desktop
- Profile pictures stored as base64 data URLs
- WhatsApp-inspired UI with dark theme

## Features Breakdown

### Messaging
- Send text messages in real-time
- Send photos (up to 5MB)
- Record and send voice messages
- Reply to any message
- Delete your own messages
- See typing indicators

### Notifications
- Browser notifications when someone replies to you
- Join/leave notifications
- Message timestamps

### User Experience
- Dark theme inspired by WhatsApp
- Profile pictures for all users
- Online users list
- Smooth animations
- Mobile responsive design
