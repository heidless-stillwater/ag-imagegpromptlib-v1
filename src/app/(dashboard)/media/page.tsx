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
import RestoreConflictModal from '@/components/media/RestoreConflictModal';
import { exportMediaZip, restoreMediaFromZip, Resolution } from '@/services/zip';
import styles from './page.module.css';

export default function MediaPage() {
    const { user, isAdmin } = useAuth();
    const [images, setImages] = useState<MediaImage[]>([]);
    const [promptSets, setPromptSets] = useState<PromptSet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'grouped'>('grid');

    // Selection state
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Conflict resolution state
    const [conflict, setConflict] = useState<{
        filename: string;
        previewUrl?: string;
        resolve: (res: Resolution) => void;
    } | null>(null);
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

    // Confirmation state
    const [confirmation, setConfirmation] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        variant: 'info' | 'success' | 'danger';
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
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
                setSelectedIds(prev => prev.filter(i => i !== id));
            }
        } catch (error) {
            console.error('Failed to delete image:', error);
        }
    };

    const handleBulkDelete = () => {
        if (selectedIds.length === 0) return;

        setConfirmation({
            isOpen: true,
            title: 'Delete Selected Media',
            message: `Are you sure you want to delete ${selectedIds.length} images from your library?`,
            variant: 'danger',
            onConfirm: async () => {
                try {
                    const success = await deleteMediaImages(selectedIds);
                    if (success) {
                        setImages(prev => prev.filter(img => !selectedIds.includes(img.id)));
                        setSelectedIds([]);
                        setIsSelectionMode(false);
                        setFeedback({
                            isOpen: true,
                            title: 'Deleted',
                            message: 'Successfully removed selected images.',
                            variant: 'success'
                        });
                    }
                } catch (error) {
                    console.error('Bulk delete failed:', error);
                } finally {
                    setConfirmation(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    const handleDownloadSelectedZip = async () => {
        const selectedImages = images.filter(img => selectedIds.includes(img.id));
        if (selectedImages.length === 0) return;

        setIsDownloading(true);
        try {
            const blob = await exportMediaZip(selectedImages);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `media-selection-${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setFeedback({
                isOpen: true,
                title: 'Download Ready',
                message: `Successfully archived ${selectedImages.length} images.`,
                variant: 'success'
            });
        } catch (error) {
            console.error('Selection backup failed:', error);
        } finally {
            setIsDownloading(false);
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const result = await syncImagesFromVersions();
            let message = '';
            if (result.added > 0 && result.cleaned > 0) {
                message = `Successfully added ${result.added} new images and removed ${result.cleaned} duplicates.`;
            } else if (result.added > 0) {
                message = `Successfully added ${result.added} new images.`;
            } else if (result.cleaned > 0) {
                message = `Successfully cleaned up ${result.cleaned} duplicate images.`;
            } else {
                message = 'All images are already in your library and deduplicated.';
            }

            setFeedback({
                isOpen: true,
                title: 'Sync Complete',
                message,
                variant: result.added > 0 || result.cleaned > 0 ? 'success' : 'info'
            });

            if (result.added > 0 || result.cleaned > 0) {
                await fetchData();
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

    const handleBackupZip = async () => {
        setIsBackingUp(true);
        try {
            const blob = await exportMediaZip(images);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `media-backup-${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setFeedback({
                isOpen: true,
                title: 'Backup Created',
                message: 'Successfully exported compressed media library.',
                variant: 'success'
            });
        } catch (error) {
            console.error('Backup failed:', error);
            setFeedback({
                isOpen: true,
                title: 'Backup Failed',
                message: 'Failed to create compressed backup.',
                variant: 'danger'
            });
        } finally {
            setIsBackingUp(false);
        }
    };

    const handleRestoreZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsRestoring(true);
        try {
            const result = await restoreMediaFromZip(file, async (filename, previewUrl) => {
                return new Promise<Resolution>((resolve) => {
                    setConflict({ filename, previewUrl, resolve });
                });
            });

            setFeedback({
                isOpen: true,
                title: 'Restore Complete',
                message: `Successfully restored ${result.restored} images. (Skipped ${result.skipped})`,
                variant: 'success'
            });

            await fetchData();
        } catch (error: any) {
            console.error('Restore failed:', error);
            setFeedback({
                isOpen: true,
                title: 'Restore Failed',
                message: error.message || 'Failed to restore media from zip.',
                variant: 'danger'
            });
        } finally {
            setIsRestoring(false);
            setConflict(null);
            // Reset input
            e.target.value = '';
        }
    };

    const handleSelectAll = () => {
        if (selectedIds.length === images.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(images.map(img => img.id));
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
                    {!isSelectionMode ? (
                        <>
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
                                onClick={handleBackupZip}
                                isLoading={isBackingUp}
                                disabled={images.length === 0}
                                title="Download compressed ZIP of all images"
                            >
                                Backup (ZIP)
                            </Button>

                            <div className={styles.fileInputWrapper}>
                                <Button
                                    variant="secondary"
                                    isLoading={isRestoring}
                                    title="Upload ZIP to restore media library"
                                >
                                    Restore (ZIP)
                                </Button>
                                <input
                                    type="file"
                                    accept=".zip"
                                    onChange={handleRestoreZip}
                                    className={styles.fileInput}
                                />
                            </div>

                            <Button
                                variant="primary"
                                onClick={() => setIsSelectionMode(true)}
                                title="Select multiple images for actions"
                            >
                                Select Images
                            </Button>
                        </>
                    ) : (
                        <>
                            <div className={styles.selectionStats}>
                                <span>{selectedIds.length} selected</span>
                            </div>

                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={handleSelectAll}
                            >
                                {selectedIds.length === images.length ? 'Deselect All' : 'Select All'}
                            </Button>

                            <Button
                                size="sm"
                                variant="primary"
                                onClick={handleDownloadSelectedZip}
                                isLoading={isDownloading}
                                disabled={selectedIds.length === 0}
                                title="Download selected images as ZIP archive"
                            >
                                Download Selected (ZIP)
                            </Button>

                            <Button
                                size="sm"
                                variant="danger"
                                onClick={handleBulkDelete}
                                disabled={selectedIds.length === 0}
                                title="Delete selected images from library"
                            >
                                Delete Selected
                            </Button>

                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }}
                            >
                                Cancel
                            </Button>
                        </>
                    )}
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
                        selectedIds={selectedIds}
                        isSelectionMode={isSelectionMode}
                        onSelectionModeChange={setIsSelectionMode}
                        onSelectedIdsChange={setSelectedIds}
                    />
                )
            }

            {conflict && (
                <RestoreConflictModal
                    filename={conflict.filename}
                    previewUrl={conflict.previewUrl}
                    onResolve={(res) => {
                        conflict.resolve(res);
                        setConflict(null);
                    }}
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

            <ConfirmationModal
                isOpen={confirmation.isOpen}
                onClose={() => setConfirmation(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmation.onConfirm}
                title={confirmation.title}
                message={confirmation.message}
                variant={confirmation.variant}
                confirmLabel="Confirm"
                cancelLabel="Cancel"
            />
        </div >
    );
}
