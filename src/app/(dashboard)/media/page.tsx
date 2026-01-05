'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MediaImage } from '@/types';
import { getMediaImages, deleteMediaImage, syncImagesFromVersions } from '@/services/media';
import MediaGallery from '@/components/media/MediaGallery';
import Button from '@/components/ui/Button';
import styles from './page.module.css';

export default function MediaPage() {
    const { user, isAdmin } = useAuth();
    const [images, setImages] = useState<MediaImage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);

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
                alert(`Successfully synced ${result.added} new images from your versions.`);
                await loadImages();
            } else {
                alert('All images are already in your library.');
            }
        } catch (error) {
            console.error('Sync failed:', error);
            alert('Failed to sync images. Please try again.');
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
        </div>
    );
}
