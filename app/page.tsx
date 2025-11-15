import App from '../src/App';
import { AuthProvider } from '../src/contexts/AuthContext';

export default function Page() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
