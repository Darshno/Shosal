const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    maxHttpBufferSize: 50e6, // 50MB for voice and photo messages
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

app.use(express.static('public'));

// Fallback route for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const users = new Map();

io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    socket.on('login', (data) => {
        try {
            if (!data || !data.username) {
                console.error('Invalid login data');
                return;
            }

            const userData = {
                username: data.username,
                profilePic: data.profilePic || null
            };

            users.set(socket.id, userData);
            console.log(`User logged in: ${userData.username}`);

            socket.broadcast.emit('user-joined', userData);
            io.emit('users-update', Array.from(users.values()));
        } catch (error) {
            console.error('Error in login:', error);
        }
    });

    socket.on('chat-message', (data) => {
        try {
            const user = users.get(socket.id);
            if (!user) {
                console.error('User not found for socket:', socket.id);
                return;
            }

            io.emit('chat-message', {
                id: Date.now() + '_' + socket.id,
                socketId: socket.id,
                username: user.username,
                profilePic: user.profilePic,
                message: data.message,
                replyTo: data.replyTo || null,
                timestamp: new Date().toLocaleTimeString()
            });
        } catch (error) {
            console.error('Error in chat-message:', error);
        }
    });

    socket.on('photo-message', (data) => {
        try {
            const user = users.get(socket.id);
            if (!user) {
                console.error('User not found for socket:', socket.id);
                return;
            }

            io.emit('photo-message', {
                id: Date.now() + '_' + socket.id,
                socketId: socket.id,
                username: user.username,
                profilePic: user.profilePic,
                image: data.image,
                replyTo: data.replyTo || null,
                timestamp: new Date().toLocaleTimeString()
            });
        } catch (error) {
            console.error('Error in photo-message:', error);
        }
    });

    socket.on('voice-message', (data) => {
        try {
            const user = users.get(socket.id);
            if (!user) {
                console.error('User not found for socket:', socket.id);
                return;
            }

            io.emit('voice-message', {
                id: Date.now() + '_' + socket.id,
                socketId: socket.id,
                username: user.username,
                profilePic: user.profilePic,
                audio: data.audio,
                duration: data.duration,
                replyTo: data.replyTo || null,
                timestamp: new Date().toLocaleTimeString()
            });
        } catch (error) {
            console.error('Error in voice-message:', error);
        }
    });

    socket.on('delete-message', (data) => {
        try {
            const user = users.get(socket.id);
            if (!user) {
                console.error('User not found for socket:', socket.id);
                return;
            }

            io.emit('delete-message', {
                messageId: data.messageId,
                socketId: socket.id
            });
        } catch (error) {
            console.error('Error in delete-message:', error);
        }
    });

    socket.on('typing', (data) => {
        try {
            const user = users.get(socket.id);
            if (!user) return;

            socket.broadcast.emit('user-typing', {
                username: user.username,
                isTyping: data.isTyping
            });
        } catch (error) {
            console.error('Error in typing:', error);
        }
    });

    socket.on('disconnect', () => {
        try {
            const user = users.get(socket.id);
            if (user) {
                console.log(`User disconnected: ${user.username}`);
                users.delete(socket.id);
                socket.broadcast.emit('user-left', user.username);
                io.emit('users-update', Array.from(users.values()));
            }
        } catch (error) {
            console.error('Error in disconnect:', error);
        }
    });

    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
