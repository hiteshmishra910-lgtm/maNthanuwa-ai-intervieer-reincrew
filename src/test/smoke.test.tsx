import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../../App';

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isSignedIn: false, isLoaded: true, getToken: vi.fn() }),
  useUser: () => ({ user: null }),
  useClerk: () => ({ signOut: vi.fn() }),
  SignIn: () => <div>Sign In</div>,
}));

describe('application smoke test', () => {
  it('renders the app shell without crashing', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.min-h-screen')).toBeInTheDocument();
  });
});
