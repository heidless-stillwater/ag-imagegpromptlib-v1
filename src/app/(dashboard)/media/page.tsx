'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MediaImage } from '@/types';
import { getMediaImages, deleteMediaImage, syncImagesFromVersions } from '@/services/media';
import MediaGallery from '@/components/media/MediaGallery';
import Button from '@/components/ui/Button';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import styles from './page.module.css';

export default function MediaPage() {
    const { user, isAdmin } = useAuth();
    const [images, setImages] = useState<MediaImage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [feedback, setFeedback] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        variant: 'info' | 'success' | 'danger';
    }>({
        isOpen: false,
        title: '',
        message: '',
        variant: 'info'
    });

    useEffect(() => {
        if (user) {
            loadImages();
        }
    }, [user]);

    const loadImages = async () => {
        setIsLoading(true);
        try {
            const data = await getMediaImages();
            setImages(data.sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            ));
        } catch (error) {
            console.error('Failed to load media images:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const success = await deleteMediaImage(id);
            if (success) {
                setImages(prev => prev.filter(img => img.id !== id));
            }
        } catch (error) {
            console.error('Failed to delete image:', error);
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const result = await syncImagesFromVersions();
            if (result.added > 0) {
                setFeedback({
                    isOpen: true,
                    title: 'Sync Complete',
                    message: `Successfully synced ${result.added} new images from your versions.`,
                    variant: 'success'
                });
                await loadImages();
            } else {
                setFeedback({
                    isOpen: true,
                    title: 'Sync Result',
                    message: 'All images are already in your library.',
                    variant: 'info'
                });
            }
        } catch (error) {
            console.error('Sync failed:', error);
            setFeedback({
                isOpen: true,
                title: 'Sync Failed',
                message: 'Failed to sync images. Please try again.',
                variant: 'danger'
            });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.titleSection}>
                    <h1 className={styles.title}>Media Library</h1>
                    <p className={styles.subtitle}>
                        {isAdmin ? 'All user images in the system' : 'All your generated and used images'}
                    </p>
                </div>
                <div className={styles.headerActions}>
                    <Button
                        variant="secondary"
                        onClick={handleSync}
                        isLoading={isSyncing}
                        title="Search versions for images not yet in library"
                    >
                        Sync from Versions
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className={styles.loading}>
                    <div className={styles.spinner} />
                    <p>Loading your media...</p>
                </div>
            ) : (
                <MediaGallery
                    images={images}
                    onDelete={handleDelete}
                    isAdminView={isAdmin}
                />
            )}

            <ConfirmationModal
                isOpen={feedback.isOpen}
                onClose={() => setFeedback(prev => ({ ...prev, isOpen: false }))}
                onConfirm={() => setFeedback(prev => ({ ...prev, isOpen: false }))}
                title={feedback.title}
                message={feedback.message}
                variant={feedback.variant}
                confirmLabel="Got It.."
                cancelLabel=""
            />
        </div>
    );
}
