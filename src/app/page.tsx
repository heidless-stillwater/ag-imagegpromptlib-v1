'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import styles from './page.module.css';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (role: 'admin' | 'member') => {
    setIsLoading(true);
    await login(role);
    router.push('/dashboard');
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
          <h2 className={styles.cardTitle}>Get Started</h2>
          <p className={styles.cardDescription}>
            Choose your role to explore the application
          </p>

          <div className={styles.roleButtons}>
            <button
              className={styles.roleCard}
              onClick={() => handleLogin('member')}
              disabled={isLoading}
            >
              <div className={styles.roleIcon}>👤</div>
              <div className={styles.roleInfo}>
                <h3>Member</h3>
                <p>Create and manage your own prompts</p>
              </div>
            </button>

            <button
              className={styles.roleCard}
              onClick={() => handleLogin('admin')}
              disabled={isLoading}
            >
              <div className={styles.roleIcon}>👑</div>
              <div className={styles.roleInfo}>
                <h3>Admin</h3>
                <p>Full access to all features and users</p>
              </div>
            </button>
          </div>

          <p className={styles.notice}>
            This is a demo with mock authentication. Data is stored locally in your browser.
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
