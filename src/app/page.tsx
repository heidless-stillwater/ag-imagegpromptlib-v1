'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import styles from './page.module.css';

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithGoogle, register } = useAuth();

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (isLoginMode) {
        await login(formData.email, formData.password);
      } else {
        if (!formData.displayName) {
          setError('Display name is required');
          setIsLoading(false);
          return;
        }
        await register(formData.email, formData.password, formData.displayName);
      }
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      await loginWithGoogle();
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Google login error:', err);
      setError(err.message || 'Google login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.background}>
        <div className={styles.gradient1} />
        <div className={styles.gradient2} />
      </div>

      <main className={styles.main}>
        <div className={styles.hero}>
          <div className={styles.logoLarge}>🎨</div>
          <h1 className={styles.title}>PromptVault</h1>
          <p className={styles.subtitle}>
            Your AI Image Prompt Library
          </p>
          <p className={styles.description}>
            Manage prompts, track versions, generate images, and share with the community.
          </p>
        </div>

        <div className={styles.loginCard}>
          <h2 className={styles.cardTitle}>{isLoginMode ? 'Welcome Back' : 'Create Account'}</h2>
          <p className={styles.cardDescription}>
            {isLoginMode ? 'Sign in to access your prompts' : 'Join the community and start creating'}
          </p>

          <form onSubmit={handleSubmit} className={styles.authForm}>
            {!isLoginMode && (
              <div className={styles.formField}>
                <label htmlFor="displayName">Display Name</label>
                <input
                  type="text"
                  id="displayName"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleInputChange}
                  className={styles.input}
                  placeholder="Your Name"
                  required={!isLoginMode}
                />
              </div>
            )}
            <div className={styles.formField}>
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="name@example.com"
                required
              />
            </div>
            <div className={styles.formField}>
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="••••••••"
                required
              />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <Button type="submit" isLoading={isLoading}>
              {isLoginMode ? 'Sign In' : 'Sign Up'}
            </Button>
          </form>

          <div className={styles.divider}>or</div>

          <div className={styles.socialButtons}>
            <button
              type="button"
              className={styles.googleButton}
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className={styles.googleIcon} />
              Continue with Google
            </button>
          </div>

          <div className={styles.toggleAuth}>
            {isLoginMode ? "Don't have an account?" : "Already have an account?"}
            <button type="button" onClick={() => setIsLoginMode(!isLoginMode)}>
              {isLoginMode ? 'Sign Up' : 'Sign In'}
            </button>
          </div>

          <p className={styles.notice}>
            Data is securely stored in Firebase Cloud.
          </p>
        </div>

        <div className={styles.features}>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>📝</span>
            <h3>Prompt Versioning</h3>
            <p>Track all variations of your prompts</p>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>🖼️</span>
            <h3>Image Generation</h3>
            <p>Generate images with Gemini AI</p>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>🔗</span>
            <h3>Social Sharing</h3>
            <p>Share prompts with other users</p>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>⭐</span>
            <h3>Rating System</h3>
            <p>Rate and discover top prompts</p>
          </div>
        </div>
      </main>
    </div>
  );
}
