'use client';

import { useState } from 'react';
import { MediaImage } from '@/types';
import Button from '@/components/ui/Button';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import styles from './MediaGallery.module.css';

interface MediaGalleryProps {
    images: MediaImage[];
    onDelete: (id: string) => void;
    isAdminView?: boolean;
}

export default function MediaGallery({ images, onDelete, isAdminView = false }: MediaGalleryProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<{
        isOpen: boolean;
        ids: string[];
    }>({
        isOpen: false,
        ids: []
    });

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = () => {
        setConfirmDelete({
            isOpen: true,
            ids: selectedIds
        });
    };

    const confirmDeleteAction = () => {
        confirmDelete.ids.forEach(id => onDelete(id));
        if (confirmDelete.ids.length > 1) {
            setSelectedIds([]);
            setIsSelectionMode(false);
        }
        setConfirmDelete({ isOpen: false, ids: [] });
    };

    if (images.length === 0) {
        return (
            <div className={styles.empty}>
                <span className={styles.emptyIcon}>🖼️</span>
                <h3>No images in your library</h3>
                <p>Generated images from your prompt versions will automatically appear here.</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.actions}>
                <div className={styles.selectionInfo}>
                    {isSelectionMode ? (
                        <>
                            <span>{selectedIds.length} selected</span>
                            <Button size="sm" variant="secondary" onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }}>
                                Cancel
                            </Button>
                            <Button size="sm" variant="danger" onClick={handleBulkDelete} disabled={selectedIds.length === 0}>
                                Delete Selected
                            </Button>
                        </>
                    ) : (
                        <Button size="sm" variant="secondary" onClick={() => setIsSelectionMode(true)}>
                            Select Images
                        </Button>
                    )}
                </div>
            </div>

            <div className={styles.grid}>
                {images.map(image => (
                    <div
                        key={image.id}
                        className={`${styles.card} ${selectedIds.includes(image.id) ? styles.selected : ''}`}
                        onClick={() => isSelectionMode && toggleSelect(image.id)}
                    >
                        <div className={styles.imageWrapper}>
                            <img src={image.url} alt="Media" className={styles.image} />

                            {!isSelectionMode && (
                                <button
                                    className={styles.deleteBtn}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDelete({
                                            isOpen: true,
                                            ids: [image.id]
                                        });
                                    }}
                                    title="Delete from library"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                </button>
                            )}

                            {isSelectionMode && (
                                <div className={styles.checkbox}>
                                    {selectedIds.includes(image.id) && <span>✓</span>}
                                </div>
                            )}
                        </div>

                        <div className={styles.meta}>
                            <span className={styles.date}>
                                {new Date(image.createdAt).toLocaleDateString()}
                            </span>
                            {isAdminView && (
                                <span className={styles.userBadge}>User ID: {image.userId.slice(0, 8)}...</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <ConfirmationModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, ids: [] })}
                onConfirm={confirmDeleteAction}
                title="Delete Media"
                message={confirmDelete.ids.length > 1
                    ? `Are you sure you want to delete ${confirmDelete.ids.length} images from your library?`
                    : 'Are you sure you want to delete this image from your library?'
                }
                variant="danger"
                confirmLabel="Delete"
            />
        </div>
    );
}
