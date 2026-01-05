'use client';

import { useState, useEffect } from 'react';
import { PromptSet, Category } from '@/types';
import { getAverageRating } from '@/services/ratings';
import { getCategoryById } from '@/services/categories';
import StarRating from '@/components/ratings/StarRating';
import styles from './PromptSetCard.module.css';

interface PromptSetCardProps {
    promptSet: PromptSet;
    onView: (id: string) => void;
    onEdit?: (id: string) => void;
    onDelete?: (id: string) => void;
    onShare?: (id: string) => void;
    showActions?: boolean;
}

export default function PromptSetCard({
    promptSet,
    onView,
    onEdit,
    onDelete,
    onShare,
    showActions = true,
}: PromptSetCardProps) {
    const [rating, setRating] = useState({ average: 0, count: 0 });
    const [category, setCategory] = useState<Category | null>(null);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    useEffect(() => {
        const loadMetadata = async () => {
            const [avgRating, cat] = await Promise.all([
                getAverageRating(promptSet.id),
                promptSet.categoryId ? getCategoryById(promptSet.categoryId) : Promise.resolve(null)
            ]);
            setRating(avgRating);
            setCategory(cat);
        };
        loadMetadata();
    }, [promptSet.id, promptSet.categoryId]);

    const handleAction = async (e: React.MouseEvent, action: string, callback?: (id: string) => Promise<void> | void) => {
        e.stopPropagation();
        if (!callback) return;

        setLoadingAction(action);
        try {
            await callback(promptSet.id);
        } catch (error) {
            console.error(`Error performing ${action}:`, error);
        } finally {
            // Only clear loading state if component is still mounted/valid
            // For navigation actions (view/edit), the component might unmount, which is fine
            setLoadingAction(null);
        }
    };

    const previewImage = promptSet.versions.find(v => v.imageUrl)?.imageUrl;

    return (
        <div className={styles.card} onClick={(e) => handleAction(e, 'view', onView)}>
            <div className={styles.imageContainer}>
                {previewImage ? (
                    <img
                        src={previewImage}
                        alt={promptSet.title}
                        className={styles.image}
                    />
                ) : (
                    <div className={styles.placeholder}>
                        <span className={styles.placeholderIcon}>🖼️</span>
                        <span className={styles.placeholderText}>No Image</span>
                    </div>
                )}
                {category && (
                    <span className={styles.category}>{category.name}</span>
                )}
            </div>

            <div className={styles.content}>
                <h3 className={styles.title}>{promptSet.title}</h3>

                {promptSet.description && (
                    <p className={styles.description}>{promptSet.description}</p>
                )}

                <div className={styles.meta}>
                    <span className={styles.versions}>
                        {promptSet.versions.length} version{promptSet.versions.length !== 1 ? 's' : ''}
                    </span>

                    <StarRating
                        value={rating.average}
                        readonly
                        size="sm"
                        count={rating.count}
                    />
                </div>

                {showActions && (
                    <div className={styles.actions} onClick={e => e.stopPropagation()}>
                        {onEdit && (
                            <button
                                className={styles.actionBtn}
                                onClick={(e) => handleAction(e, 'edit', onEdit)}
                                title="Edit"
                                disabled={!!loadingAction}
                            >
                                {loadingAction === 'edit' ? (
                                    <div className={styles.spinner} />
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                )}
                            </button>
                        )}
                        {onShare && (
                            <button
                                className={styles.actionBtn}
                                onClick={(e) => handleAction(e, 'share', onShare)}
                                title="Share"
                                disabled={!!loadingAction}
                            >
                                {loadingAction === 'share' ? (
                                    <div className={styles.spinner} />
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="18" cy="5" r="3" />
                                        <circle cx="6" cy="12" r="3" />
                                        <circle cx="18" cy="19" r="3" />
                                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                                    </svg>
                                )}
                            </button>
                        )}
                        {onDelete && (
                            <button
                                className={`${styles.actionBtn} ${styles.deleteBtn}`}
                                onClick={(e) => handleAction(e, 'delete', onDelete)}
                                title="Delete"
                                disabled={!!loadingAction}
                            >
                                {loadingAction === 'delete' ? (
                                    <div className={styles.spinner} />
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                )}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
