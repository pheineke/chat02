const socket = io();
        let userId = null;
        let currentRoom = null;

        function showRegister() {
            document.getElementById('login').style.display = 'none';
            document.getElementById('register').style.display = 'block';
        }

        function showLogin() {
            document.getElementById('register').style.display = 'none';
            document.getElementById('login').style.display = 'block';
        }

        function register() {
            const username = document.getElementById('reg-username').value;
            const password = document.getElementById('reg-password').value;
            fetch('/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            }).then(response => response.text())
              .then(data => alert(data));
        }

        function login() {
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            }).then(response => response.text())
              .then(data => {
                  if (data === 'Login successful') {
                      userId = username;
                      document.getElementById('login').style.display = 'none';
                      document.getElementById('register').style.display = 'none';
                      document.getElementById('chat').style.display = 'flex';
                      loadRooms();
                  } else {
                      alert(data);
                  }
              });
        }

        function createRoom() {
            const room = document.getElementById('room-input').value;
            if (room.trim() !== '') {
                socket.emit('create_room', room);
                document.getElementById('room-input').value = '';
            }
        }

        function joinRoom(room) {
            currentRoom = room;
            document.getElementById('messages').innerHTML = '';
            socket.emit('join_room', room);
        }

        function sendMessage() {
            const message = document.getElementById('message-input').value;
            if (message.trim() !== '' && currentRoom !== null) {
                socket.emit('new_message', { room: currentRoom, userId, message });
                document.getElementById('message-input').value = '';
            }
        }

        document.getElementById('message-input').addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                sendMessage();
            }
        });

        socket.on('new_message', (data) => {
            const messageElement = document.createElement('div');
            messageElement.className = 'message';
            messageElement.innerText = `${data.userId}: ${data.message}`;
            document.getElementById('messages').appendChild(messageElement);
        });

        socket.on('load_messages', (messages) => {
            const messagesContainer = document.getElementById('messages');
            messages.forEach(message => {
                const messageElement = document.createElement('div');
                messageElement.className = 'message';
                messageElement.innerText = `${message.user_id}: ${message.message}`;
                messagesContainer.appendChild(messageElement);
            });
        });

        socket.on('room_list', (rooms) => {
            const roomsContainer = document.getElementById('rooms');
            roomsContainer.innerHTML = ''; // Clear existing rooms
            rooms.forEach(room => {
                const roomElement = document.createElement('div');
                roomElement.className = 'room';
                roomElement.innerText = room;
                roomElement.onclick = () => joinRoom(room);
                roomsContainer.appendChild(roomElement);
            });
        });

        function loadRooms() {
            socket.emit('get_rooms');
        }