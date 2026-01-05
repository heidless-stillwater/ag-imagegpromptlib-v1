'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { PromptSet, Category, User } from '@/types';
import { getPromptSets, deletePromptSet } from '@/services/promptSets';
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/services/categories';
import { getAllUsers } from '@/services/auth';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import PromptSetCard from '@/components/prompts/PromptSetCard';
import ShareModal from '@/components/shares/ShareModal';
import styles from './page.module.css';

type TabType = 'prompts' | 'categories' | 'users';

export default function AdminPage() {
    const { isAdmin } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>('prompts');

    const [promptSets, setPromptSets] = useState<PromptSet[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    // Category modal state
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [categoryName, setCategoryName] = useState('');
    const [categoryDescription, setCategoryDescription] = useState('');
    const [isSystemCategory, setIsSystemCategory] = useState(true);

    // Share modal
    const [shareModalPromptSetId, setShareModalPromptSetId] = useState<string | null>(null);

    // Confirmation Modal state
    const [confirmDelete, setConfirmDelete] = useState<{
        isOpen: boolean;
        id: string;
        type: 'promptSet' | 'category';
        title: string;
        message: string;
    }>({
        isOpen: false,
        id: '',
        type: 'promptSet',
        title: '',
        message: ''
    });

    useEffect(() => {
        if (!isAdmin) {
            router.push('/dashboard');
            return;
        }
        loadData();
    }, [isAdmin]);

    const loadData = async () => {
        try {
            const [sets, cats, allUsers] = await Promise.all([
                getPromptSets(),
                getCategories(),
                getAllUsers()
            ]);
            setPromptSets(sets);
            setCategories(cats);
            setUsers(allUsers);
        } catch (error) {
            console.error('Failed to load admin data:', error);
        }
    };

    const handleDeletePromptSet = (id: string) => {
        setConfirmDelete({
            isOpen: true,
            id,
            type: 'promptSet',
            title: 'Delete Prompt Set',
            message: 'Are you sure you want to delete this prompt set? This will remove all associated versions and images. This action cannot be undone.'
        });
    };

    const handleDeleteCategory = (id: string) => {
        setConfirmDelete({
            isOpen: true,
            id,
            type: 'category',
            title: 'Delete Category',
            message: 'Are you sure you want to delete this category? Any prompt sets currently using this category will become uncategorized.'
        });
    };

    const handleConfirmDelete = async () => {
        const { id, type } = confirmDelete;
        setConfirmDelete(prev => ({ ...prev, isOpen: false }));

        try {
            if (type === 'promptSet') {
                await deletePromptSet(id);
            } else {
                await deleteCategory(id);
            }
            await loadData();
        } catch (error) {
            console.error(`Failed to delete ${type}:`, error);
        }
    };

    const handleOpenCategoryModal = (category?: Category) => {
        if (category) {
            setEditingCategory(category);
            setCategoryName(category.name);
            setCategoryDescription(category.description || '');
            setIsSystemCategory(category.isSystem);
        } else {
            setEditingCategory(null);
            setCategoryName('');
            setCategoryDescription('');
            setIsSystemCategory(true);
        }
        setIsCategoryModalOpen(true);
    };

    const handleSaveCategory = async () => {
        if (!categoryName.trim()) return;

        if (editingCategory) {
            await updateCategory(editingCategory.id, {
                name: categoryName,
                description: categoryDescription,
            });
        } else {
            await createCategory({
                name: categoryName,
                description: categoryDescription,
                isSystem: isSystemCategory,
            });
        }

        await loadData();
        setIsCategoryModalOpen(false);
    };

    if (!isAdmin) return null;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Admin Panel</h1>
                <p className={styles.subtitle}>Manage all prompt sets, categories, and users</p>
            </div>

            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeTab === 'prompts' ? styles.active : ''}`}
                    onClick={() => setActiveTab('prompts')}
                >
                    📝 All Prompts ({promptSets.length})
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'categories' ? styles.active : ''}`}
                    onClick={() => setActiveTab('categories')}
                >
                    🏷️ Categories ({categories.length})
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'users' ? styles.active : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    👥 Users ({users.length})
                </button>
            </div>

            <div className={styles.content}>
                {activeTab === 'prompts' && (
                    <div className={styles.grid}>
                        {promptSets.map(set => (
                            <PromptSetCard
                                key={set.id}
                                promptSet={set}
                                onView={id => router.push(`/prompts/${id}`)}
                                onEdit={id => router.push(`/prompts/${id}`)}
                                onDelete={handleDeletePromptSet}
                                onShare={id => setShareModalPromptSetId(id)}
                            />
                        ))}
                    </div>
                )}

                {activeTab === 'categories' && (
                    <div className={styles.categoriesSection}>
                        <div className={styles.sectionHeader}>
                            <h2>Manage Categories</h2>
                            <Button onClick={() => handleOpenCategoryModal()}>+ New Category</Button>
                        </div>

                        <div className={styles.categoryList}>
                            {categories.map(cat => (
                                <div key={cat.id} className={styles.categoryItem}>
                                    <div className={styles.categoryInfo}>
                                        <div className={styles.categoryNameRow}>
                                            <h3>{cat.name}</h3>
                                            {cat.isSystem && <span className={styles.systemBadge}>System</span>}
                                        </div>
                                        <p>{cat.description || 'No description'}</p>
                                    </div>
                                    <div className={styles.categoryActions}>
                                        <Button size="sm" variant="secondary" onClick={() => handleOpenCategoryModal(cat)}>
                                            Edit
                                        </Button>
                                        <Button size="sm" variant="danger" onClick={() => handleDeleteCategory(cat.id)}>
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className={styles.usersSection}>
                        <h2>All Users</h2>
                        <div className={styles.userList}>
                            {users.map(user => (
                                <div key={user.id} className={styles.userItem}>
                                    <div className={styles.avatar}>
                                        {user.displayName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className={styles.userInfo}>
                                        <span className={styles.userName}>{user.displayName}</span>
                                        <span className={styles.userEmail}>{user.email}</span>
                                    </div>
                                    <span className={`${styles.roleBadge} ${styles[user.role]}`}>
                                        {user.role}
                                    </span>
                                    <span className={styles.userPrompts}>
                                        {promptSets.filter(s => s.userId === user.id).length} prompts
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Category Modal */}
            <Modal
                isOpen={isCategoryModalOpen}
                onClose={() => setIsCategoryModalOpen(false)}
                title={editingCategory ? 'Edit Category' : 'New Category'}
            >
                <div className={styles.form}>
                    <div className={styles.formGroup}>
                        <label>Name *</label>
                        <input
                            type="text"
                            value={categoryName}
                            onChange={e => setCategoryName(e.target.value)}
                            className="input"
                            placeholder="Category name"
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Description</label>
                        <textarea
                            value={categoryDescription}
                            onChange={e => setCategoryDescription(e.target.value)}
                            className="input textarea"
                            placeholder="Category description"
                        />
                    </div>
                    {!editingCategory && (
                        <div className={styles.formGroup}>
                            <label className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={isSystemCategory}
                                    onChange={e => setIsSystemCategory(e.target.checked)}
                                />
                                <span>System category (visible to all users)</span>
                            </label>
                        </div>
                    )}
                    <div className={styles.formActions}>
                        <Button variant="secondary" onClick={() => setIsCategoryModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveCategory} disabled={!categoryName.trim()}>
                            {editingCategory ? 'Save Changes' : 'Create Category'}
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
                onClose={() => setConfirmDelete(prev => ({ ...prev, isOpen: false }))}
                onConfirm={handleConfirmDelete}
                title={confirmDelete.title}
                message={confirmDelete.message}
                variant="danger"
                confirmLabel="Delete"
            />
        </div>
    );
}
