import React from 'react';
import styles from './Avatar.module.css';

interface AvatarProps {
    url?: string;
    displayName: string;
    bgColor?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    style?: React.CSSProperties;
}

const Avatar: React.FC<AvatarProps> = ({
    url,
    displayName,
    bgColor,
    size = 'md',
    className = '',
    style = {}
}) => {
    const background = bgColor || 'var(--gradient-primary)';
    const initials = displayName ? displayName.charAt(0).toUpperCase() : '?';

    return (
        <div
            className={`${styles.avatar} ${styles[size]} ${className}`}
            style={{
                background: background === 'transparent' ? 'transparent' : background,
                border: background === 'transparent' ? '2px dashed var(--color-border)' : undefined,
                ...style
            }}
        >
            {url ? (
                <img src={url} alt={displayName} className={styles.image} />
            ) : (
                <span className={styles.initials}>{initials}</span>
            )}
        </div>
    );
};

export default Avatar;
