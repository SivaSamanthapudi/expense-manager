import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { GroupProvider } from './context/GroupContext';
import { ExpenseProvider } from './context/ExpenseContext';
import { ChatProvider } from './context/ChatContext';
import AppRoutes from './routes/AppRoutes';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GroupProvider>
          <ExpenseProvider>
            <ChatProvider>
              <AppRoutes />
            </ChatProvider>
          </ExpenseProvider>
        </GroupProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
 