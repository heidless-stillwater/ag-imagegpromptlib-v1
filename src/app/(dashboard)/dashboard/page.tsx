'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { PromptSet, Category } from '@/types';
import { getPromptSets, createPromptSet, deletePromptSet } from '@/services/promptSets';
import { getCategories } from '@/services/categories';
import PromptSetCard from '@/components/prompts/PromptSetCard';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import ShareModal from '@/components/shares/ShareModal';
import styles from './page.module.css';

export default function DashboardPage() {
    const { user, isAdmin } = useAuth();
    const router = useRouter();

    const [promptSets, setPromptSets] = useState<PromptSet[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [shareModalPromptSetId, setShareModalPromptSetId] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showAll, setShowAll] = useState(false); // For admins to toggle "Mine" vs "All"
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string }>({ isOpen: false, id: '' });

    // Form state
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newCategoryId, setNewCategoryId] = useState('');
    const [newPrompt, setNewPrompt] = useState('');

    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [user]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [sets, cats] = await Promise.all([
                getPromptSets(),
                getCategories()
            ]);
            setPromptSets(sets);
            setCategories(cats);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreatePromptSet = async () => {
        if (!newTitle.trim()) return;

        try {
            const created = await createPromptSet({
                title: newTitle,
                description: newDescription,
                categoryId: newCategoryId || undefined,
                initialPrompt: newPrompt || undefined,
            });

            if (created) {
                await loadData();
                setIsCreateModalOpen(false);
                resetForm();
                router.push(`/prompts/${created.id}`);
            }
        } catch (error) {
            console.error('Failed to create prompt set:', error);
        }
    };

    const handleDelete = (id: string) => {
        setConfirmDelete({ isOpen: true, id });
    };

    const confirmDeleteAction = async () => {
        const id = confirmDelete.id;
        setConfirmDelete({ isOpen: false, id: '' });
        try {
            await deletePromptSet(id);
            await loadData();
        } catch (error) {
            console.error('Failed to delete prompt set:', error);
        }
    };

    const resetForm = () => {
        setNewTitle('');
        setNewDescription('');
        setNewCategoryId('');
        setNewPrompt('');
    };

    // Filter prompt sets
    const filteredSets = promptSets.filter(set => {
        // If admin and not showAll, only show their own
        if (isAdmin && !showAll && set.userId !== user?.id) return false;

        const matchesCategory = selectedCategory === 'all' || set.categoryId === selectedCategory;
        const matchesSearch = !searchQuery ||
            set.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            set.description?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.titleSection}>
                    <h1 className={styles.title}>
                        {isAdmin ? (showAll ? 'All Prompt Sets (Admin)' : 'My Prompt Sets') : 'My Prompt Sets'}
                    </h1>
                    <p className={styles.subtitle}>
                        {filteredSets.length} prompt set{filteredSets.length !== 1 ? 's' : ''}
                    </p>
                </div>

                <Button onClick={() => setIsCreateModalOpen(true)}>
                    + New Prompt Set
                </Button>
            </div>

            <div className={styles.filters}>
                <div className={styles.searchBox}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search prompts..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className={styles.searchInput}
                    />
                </div>

                <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    className={styles.categorySelect}
                >
                    <option value="all">All Categories</option>
                    {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                </select>

                {isAdmin && (
                    <div className={styles.adminToggle}>
                        <Button
                            variant={showAll ? 'success' : 'secondary'}
                            size="sm"
                            onClick={() => setShowAll(!showAll)}
                        >
                            {showAll ? 'Showing All Prompts' : 'Show All prompts (Admin)'}
                        </Button>
                    </div>
                )}
            </div>

            {
                isLoading ? (
                    <div className={styles.loading}>
                        <div className={styles.spinner} />
                        <p>Loading your prompts...</p>
                    </div>
                ) : filteredSets.length === 0 ? (
                    <div className={styles.empty}>
                        <span className={styles.emptyIcon}>📝</span>
                        <h3>No prompt sets yet</h3>
                        <p>Create your first prompt set to get started</p>
                        <Button onClick={() => setIsCreateModalOpen(true)}>
                            Create Prompt Set
                        </Button>
                    </div>
                ) : (
                    <div className={styles.grid}>
                        {filteredSets.map(set => (
                            <PromptSetCard
                                key={set.id}
                                promptSet={set}
                                onView={id => router.push(`/prompts/${id}`)}
                                onEdit={id => router.push(`/prompts/${id}`)}
                                onDelete={handleDelete}
                                onShare={id => setShareModalPromptSetId(id)}
                            />
                        ))}
                    </div>
                )
            }

            {/* Create Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    resetForm();
                }}
                title="Create New Prompt Set"
            >
                <div className={styles.form}>
                    <div className={styles.formGroup}>
                        <label className={styles.label}>Title *</label>
                        <input
                            type="text"
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                            placeholder="My Awesome Prompt"
                            className="input"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Description</label>
                        <textarea
                            value={newDescription}
                            onChange={e => setNewDescription(e.target.value)}
                            placeholder="What is this prompt set about?"
                            className="input textarea"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Category</label>
                        <select
                            value={newCategoryId}
                            onChange={e => setNewCategoryId(e.target.value)}
                            className="input select"
                        >
                            <option value="">Select a category</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label className={styles.label}>Initial Prompt</label>
                        <textarea
                            value={newPrompt}
                            onChange={e => setNewPrompt(e.target.value)}
                            placeholder="Enter your first prompt version..."
                            className="input textarea"
                            rows={4}
                        />
                    </div>

                    <div className={styles.formActions}>
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setIsCreateModalOpen(false);
                                resetForm();
                            }}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleCreatePromptSet} disabled={!newTitle.trim()}>
                            Create Prompt Set
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Share Modal */}
            {shareModalPromptSetId && (
                <ShareModal
                    promptSetId={shareModalPromptSetId}
                    onClose={() => setShareModalPromptSetId(null)}
                />
            )}
            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, id: '' })}
                onConfirm={confirmDeleteAction}
                title="Delete Prompt Set"
                message="Are you sure you want to delete this prompt set? This action will remove all associated versions and images. This cannot be undone."
                variant="danger"
                confirmLabel="Delete"
            />
        </div >
    );
}
