'use client';

import { useState, useEffect } from 'react';
import { AspectRatio } from '@/types';
import { getAspectRatios } from '@/services/aspectRatios';
import styles from './AspectRatioSelector.module.css';

interface AspectRatioSelectorProps {
    selectedId?: string;
    defaultId?: string;
    onSelect: (ratio: AspectRatio) => void;
    label?: string;
    cols?: number | 'auto';
}

export default function AspectRatioSelector({
    selectedId,
    defaultId,
    onSelect,
    label = 'Select Aspect Ratio',
    cols = 'auto'
}: AspectRatioSelectorProps) {
    const [ratios, setRatios] = useState<AspectRatio[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadRatios = async () => {
            try {
                const data = await getAspectRatios();
                setRatios(data);

                // If no selectedId provided, look for defaultId or isDefault flag
                if (!selectedId && data.length > 0) {
                    const defaultRatio = (defaultId ? data.find(r => r.id === defaultId) : null) ||
                        data.find(r => r.isDefault) ||
                        data[0];
                    onSelect(defaultRatio);
                }
            } catch (error) {
                console.error('Failed to load aspect ratios for selector:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadRatios();
    }, []);

    const getIndicatorStyle = (value: string) => {
        const [w, h] = value.split(':').map(Number);
        if (isNaN(w) || isNaN(h)) return {};

        const maxSize = 20;
        const ratio = w / h;

        if (ratio > 1) {
            return { width: `${maxSize}px`, height: `${maxSize / ratio}px` };
        } else {
            return { width: `${maxSize * ratio}px`, height: `${maxSize}px` };
        }
    };

    if (isLoading) {
        return <div className={styles.loading}>Loading ratios...</div>;
    }

    return (
        <div
            className={styles.container}
            style={{ '--grid-cols': cols === 'auto' ? 'auto-fill' : `repeat(${cols}, 1fr)` } as React.CSSProperties}
        >
            <span className={styles.label}>{label}</span>
            <div className={styles.grid}>
                {ratios.map(ratio => (
                    <div
                        key={ratio.id}
                        className={`${styles.ratioCard} ${selectedId === ratio.id ? styles.selected : ''}`}
                        onClick={() => onSelect(ratio)}
                    >
                        <div
                            className={styles.visualIndicator}
                            style={getIndicatorStyle(ratio.value)}
                        />
                        <span className={styles.ratioName}>{ratio.name}</span>
                        <span className={styles.ratioValue}>{ratio.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
