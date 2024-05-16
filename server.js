const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const db = new sqlite3.Database(':memory:');

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve the index.html file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

db.serialize(() => {
  db.run('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password TEXT)');
  db.run('CREATE TABLE messages (id INTEGER PRIMARY KEY, room TEXT, user_id INTEGER, message TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)');
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 8);
  db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function (err) {
    if (err) return res.status(500).send('Error registering user');
    res.status(200).send('User registered successfully');
  });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err || !user) return res.status(400).send('User not found');
    const passwordIsValid = bcrypt.compareSync(password, user.password);
    if (!passwordIsValid) return res.status(401).send('Invalid password');
    res.status(200).send('Login successful');
  });
});

io.on('connection', (socket) => {
  socket.on('join_room', (room) => {
    socket.join(room);
    db.all('SELECT * FROM messages WHERE room = ?', [room], (err, rows) => {
      if (err) throw err;
      socket.emit('load_messages', rows);
    });
  });

  socket.on('new_message', (data) => {
    db.run('INSERT INTO messages (room, user_id, message) VALUES (?, ?, ?)', [data.room, data.userId, data.message]);
    io.to(data.room).emit('new_message', data);
  });
});

server.listen(3000, () => {
  console.log('Server is running on port 3000');
});
