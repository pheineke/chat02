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

const db = new sqlite3.Database('chat.db'); // Verwende eine echte Datenbankdatei statt ':memory:'

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, password TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, room TEXT, user_id TEXT, message TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY, name TEXT)');
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], (err) => {
    if (err) {
      res.status(500).send('Error registering user');
    } else {
      res.send('Registration successful');
    }
  });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      res.status(500).send('Error logging in');
    } else if (user && bcrypt.compareSync(password, user.password)) {
      res.send('Login successful');
    } else {
      res.send('Invalid username or password');
    }
  });
});

io.on('connection', (socket) => {
  socket.on('create_room', (room) => {
    db.run('INSERT INTO rooms (name) VALUES (?)', [room], (err) => {
      if (err) {
        console.error('Error creating room:', err);
      } else {
        getRooms().then((rooms) => {
          io.emit('room_list', rooms);
        });
      }
    });
  });

  socket.on('get_rooms', () => {
    getRooms().then((rooms) => {
      io.emit('room_list', rooms);
    });
  });

  socket.on('join_room', (room) => {
    socket.join(room);
    db.all('SELECT * FROM messages WHERE room = ?', [room], (err, messages) => {
      if (!err) {
        socket.emit('load_messages', messages);
      }
    });
  });

  socket.on('new_message', ({ room, userId, message }) => {
    db.run('INSERT INTO messages (room, user_id, message) VALUES (?, ?, ?)', [room, userId, message], () => {
      io.to(room).emit('new_message', { userId, message });
    });
  });

  socket.on('delete_room', (room) => {
    db.run('DELETE FROM rooms WHERE name = ?', [room], () => {
      db.run('DELETE FROM messages WHERE room = ?', [room], () => {
        getRooms().then((rooms) => {
          io.emit('room_list', rooms);
        });
      });
    });
  });
});

function getRooms() {
  return new Promise((resolve, reject) => {
    db.all('SELECT name FROM rooms', (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows.map(row => row.name));
      }
    });
  });
}

// Exportfunktion für die Chats
app.get('/export_chat/:room', (req, res) => {
  const room = req.params.room;
  db.all('SELECT * FROM messages WHERE room = ?', [room], (err, messages) => {
    if (err) {
      res.status(500).send('Error exporting chat');
    } else {
      res.json(messages);
    }
  });
});

server.listen(3000, () => {
  console.log('Server is listening on port 3000');
});
