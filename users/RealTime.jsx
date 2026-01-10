// ReactApp.jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';

function App() {
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ name: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [socket, setSocket] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  const [bulkProgress, setBulkProgress] = useState(null);

  useEffect(() => {
    // Connect to Socket.io server
    const socket = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:5433');
    setSocket(socket);

    // Request initial data
    socket.emit('get_initial_data');

    // Listen for initial data
    socket.on('initial_data', (data) => {
      setUsers(data);
    });

    // Listen for real-time updates
    socket.on('data_change', (data) => {
      console.log('Real-time update received:', data);
      addToActivityLog(data);
      
      if (data.table === 'users') {
        handleUserUpdate(data);
      }
    });

    // Listen for table-specific updates
    socket.on('table_update', (data) => {
      console.log('Table update:', data);
    });

    // Listen for bulk upload progress
    socket.on('bulk_upload_progress', (progress) => {
      setBulkProgress(progress);
    });

    // Subscribe to users table updates
    socket.emit('subscribe', 'users');

    // Fetch initial data via REST API as fallback
    fetchUsers();

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  const addToActivityLog = (data) => {
    const logEntry = {
      timestamp: new Date().toLocaleTimeString(),
      table: data.table,
      operation: data.operation,
      id: data.new?.id || data.old?.id,
      data: data
    };
    
    setActivityLog(prev => [logEntry, ...prev.slice(0, 9)]); // Keep last 10
  };

  const handleUserUpdate = (data) => {
    switch (data.operation) {
      case 'INSERT':
        setUsers(prev => [data.new, ...prev]);
        showNotification(`New user added: ${data.new.name}`);
        break;
      
      case 'UPDATE':
        setUsers(prev => 
          prev.map(user => 
            user.id === data.new.id ? data.new : user
          )
        );
        showNotification(`User updated: ${data.new.name}`);
        break;
      
      case 'DELETE':
        setUsers(prev => 
          prev.filter(user => user.id !== data.old.id)
        );
        showNotification(`User deleted: ${data.old.name}`);
        break;
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });

      const result = await response.json();
      
      if (result.success) {
        setNewUser({ name: '', email: '' });
        // The real-time update will come via socket.io
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Error creating user');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCreate = async () => {
    const fakeUsers = Array.from({ length: 10 }, (_, i) => ({
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`
    }));

    try {
      const response = await fetch('/api/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: fakeUsers })
      });

      const result = await response.json();
      console.log('Bulk create result:', result);
    } catch (error) {
      console.error('Error in bulk create:', error);
    }
  };

  const showNotification = (message) => {
    // Create a temporary notification
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 15px;
      border-radius: 5px;
      z-index: 1000;
      animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  };

  return (
    <div className="App">
      <h1>Real-time User Management</h1>
      
      {/* Connection Status */}
      <div className="status">
        <div className={`status-indicator ${socket?.connected ? 'connected' : 'disconnected'}`}>
          {socket?.connected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
        <div>Users online: {users.length}</div>
      </div>

      {/* Bulk Progress Indicator */}
      {bulkProgress && (
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${bulkProgress.percentage}%` }}
          >
            {bulkProgress.percentage}% ({bulkProgress.processed}/{bulkProgress.total})
          </div>
        </div>
      )}

      {/* Activity Log */}
      <div className="activity-log">
        <h3>Real-time Activity</h3>
        <div className="log-entries">
          {activityLog.map((log, index) => (
            <div key={index} className="log-entry">
              <span className="timestamp">{log.timestamp}</span>
              <span className={`operation ${log.operation}`}>
                {log.operation}
              </span>
              <span className="table">{log.table}</span>
              <span className="id">ID: {log.id}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Create User Form */}
      <div className="create-form">
        <h2>Add New User</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Name"
            value={newUser.name}
            onChange={(e) => setNewUser({...newUser, name: e.target.value})}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={newUser.email}
            onChange={(e) => setNewUser({...newUser, email: e.target.value})}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create User'}
          </button>
        </form>
        <button onClick={handleBulkCreate} style={{ marginTop: '10px' }}>
          Bulk Create 10 Users
        </button>
      </div>

      {/* Users List with Real-time Updates */}
      <div className="users-list">
        <h2>Users ({users.length})</h2>
        <div className="user-grid">
          {users.map(user => (
            <div key={user.id} className="user-card">
              <div className="user-header">
                <span className="user-name">{user.name}</span>
                <span className="live-badge">LIVE</span>
              </div>
              <div className="user-email">{user.email}</div>
              <div className="user-meta">
                <small>ID: {user.id}</small>
                <small>Created: {new Date(user.created_at).toLocaleString()}</small>
                {user.updated_at && (
                  <small>Updated: {new Date(user.updated_at).toLocaleString()}</small>
                )}
              </div>
              <div className="user-actions">
                <button onClick={() => updateUser(user.id)}>Edit</button>
                <button onClick={() => deleteUser(user.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Real-time Counter */}
      <div className="realtime-counter">
        <h3>Live Updates Counter</h3>
        <div className="counter">{activityLog.length}</div>
        <small>Total real-time events received</small>
      </div>
    </div>
  );
}

// CSS for the app
const styles = `
.App {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.status {
  position: fixed;
  top: 10px;
  right: 10px;
  background: white;
  padding: 10px;
  border-radius: 5px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.status-indicator.connected {
  color: green;
}

.status-indicator.disconnected {
  color: red;
}

.activity-log {
  background: #f5f5f5;
  padding: 15px;
  margin: 20px 0;
  border-radius: 5px;
  max-height: 200px;
  overflow-y: auto;
}

.log-entry {
  display: flex;
  gap: 10px;
  padding: 5px;
  border-bottom: 1px solid #ddd;
}

.log-entry .operation {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: bold;
}

.operation.INSERT {
  background: #d4edda;
  color: #155724;
}

.operation.UPDATE {
  background: #fff3cd;
  color: #856404;
}

.operation.DELETE {
  background: #f8d7da;
  color: #721c24;
}

.user-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.user-card {
  border: 1px solid #ddd;
  padding: 15px;
  border-radius: 8px;
  background: white;
  transition: all 0.3s ease;
}

.user-card:hover {
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.user-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.live-badge {
  background: #ff4757;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

.progress-bar {
  width: 100%;
  height: 30px;
  background: #f0f0f0;
  border-radius: 15px;
  overflow: hidden;
  margin: 20px 0;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #8BC34A);
  transition: width 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOut {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}
`;

// Add styles to document
const styleSheet = document.createElement("style");
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

export default App;



