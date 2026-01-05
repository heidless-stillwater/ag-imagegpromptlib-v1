'use client';

import { useState } from 'react';
import styles from './StarRating.module.css';

interface StarRatingProps {
    value: number;
    onChange?: (value: number) => void;
    readonly?: boolean;
    size?: 'sm' | 'md' | 'lg';
    showValue?: boolean;
    count?: number;
}

export default function StarRating({
    value,
    onChange,
    readonly = false,
    size = 'md',
    showValue = false,
    count,
}: StarRatingProps) {
    const [hoverValue, setHoverValue] = useState<number | null>(null);

    const displayValue = hoverValue !== null ? hoverValue : value;

    return (
        <div className={`${styles.container} ${styles[size]}`}>
            <div
                className={`${styles.stars} ${readonly ? styles.readonly : ''}`}
                onMouseLeave={() => !readonly && setHoverValue(null)}
            >
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        className={`${styles.star} ${star <= displayValue ? styles.filled : ''}`}
                        onClick={() => !readonly && onChange?.(star)}
                        onMouseEnter={() => !readonly && setHoverValue(star)}
                        disabled={readonly}
                        aria-label={`Rate ${star} stars`}
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                    </button>
                ))}
            </div>

            {(showValue || count !== undefined) && (
                <div className={styles.info}>
                    {showValue && <span className={styles.value}>{value.toFixed(1)}</span>}
                    {count !== undefined && <span className={styles.count}>({count})</span>}
                </div>
            )}
        </div>
    );
}
