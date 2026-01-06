'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MediaImage, PromptSet } from '@/types';
import { getMediaImages, deleteMediaImage, deleteMediaImages, syncImagesFromVersions } from '@/services/media';
import { getPromptSets } from '@/services/promptSets';
import { downloadFilesSequentially } from '@/utils/download';
import MediaGallery from '@/components/media/MediaGallery';
import Button from '@/components/ui/Button';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import styles from './page.module.css';

export default function MediaPage() {
    const { user, isAdmin } = useAuth();
    const [images, setImages] = useState<MediaImage[]>([]);
    const [promptSets, setPromptSets] = useState<PromptSet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'grouped'>('grid');
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
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [fetchedImages, fetchedSets] = await Promise.all([
                getMediaImages(),
                getPromptSets()
            ]);
            setImages(fetchedImages.sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            ));
            setPromptSets(fetchedSets);
        } catch (error) {
            console.error('Error fetching media:', error);
            setFeedback({
                isOpen: true,
                title: 'Loading Error',
                message: 'Failed to load media library',
                variant: 'danger'
            });
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
                await fetchData();
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

    const handleDownload = async (ids?: string[]) => {
        const imagesToDownload = ids
            ? images.filter(img => ids.includes(img.id))
            : images;

        if (imagesToDownload.length === 0) return;

        setIsDownloading(true);
        try {
            const files = imagesToDownload.map(img => ({
                url: img.url,
                filename: `prompt-image-${img.id.slice(0, 8)}.png` // Assuming PNG/image format
            }));

            await downloadFilesSequentially(files, (current, total) => {
                // Optional: Update UI with progress if needed
                console.log(`Downloading ${current}/${total}`);
            });

            setFeedback({
                isOpen: true,
                title: 'Download Complete',
                message: `Successfully downloaded ${files.length} images.`,
                variant: 'success'
            });
        } catch (error) {
            console.error('Download failed:', error);
            setFeedback({
                isOpen: true,
                title: 'Download Failed',
                message: 'Failed to download some images. Please try again.',
                variant: 'danger'
            });
        } finally {
            setIsDownloading(false);
        }
    };

    const groupedImages = useMemo(() => {
        if (viewMode !== 'grouped') return undefined;

        const groups: Record<string, MediaImage[]> = {};
        const untitledImages: MediaImage[] = [];

        images.forEach(img => {
            if (img.promptSetId) {
                if (!groups[img.promptSetId]) groups[img.promptSetId] = [];
                groups[img.promptSetId].push(img);
            } else {
                untitledImages.push(img);
            }
        });

        const result = Object.entries(groups).map(([setId, imgs]) => {
            const set = promptSets.find(s => s.id === setId);
            return {
                title: set?.title || 'Unknown Prompt Set',
                images: imgs,
                latest: Math.max(...imgs.map(i => new Date(i.createdAt).getTime()))
            };
        });

        if (untitledImages.length > 0) {
            result.push({
                title: 'Ungrouped',
                images: untitledImages,
                latest: 0
            });
        }

        return result.sort((a, b) => b.latest - a.latest);
    }, [images, promptSets, viewMode]);

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
                    <div className={styles.viewToggle} style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px', marginRight: '16px' }}>
                        <Button
                            size="sm"
                            variant={viewMode === 'grid' ? 'primary' : 'ghost'}
                            onClick={() => setViewMode('grid')}
                            title="Grid View"
                        >
                            Grid
                        </Button>
                        <Button
                            size="sm"
                            variant={viewMode === 'grouped' ? 'primary' : 'ghost'}
                            onClick={() => setViewMode('grouped')}
                            title="Group by Prompt"
                        >
                            Groups
                        </Button>
                    </div>

                    <Button
                        variant="secondary"
                        onClick={handleSync}
                        isLoading={isSyncing}
                        title="Search versions for images not yet in library"
                    >
                        Sync
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => handleDownload()} // Download all
                        isLoading={isDownloading}
                        disabled={images.length === 0}
                        title="Download all images"
                    >
                        Download All
                    </Button>
                </div>
            </div>


            {
                isLoading ? (
                    <div className={styles.loading}>
                        <div className={styles.spinner} />
                        <p>Loading your media...</p>
                    </div>
                ) : (
                    <MediaGallery
                        images={images}
                        onDelete={handleDelete}
                        onDownload={handleDownload}
                        isAdminView={isAdmin}
                        groups={groupedImages}
                    />
                )
            }

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
        </div >
    );
}
