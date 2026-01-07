'use client';

import { useState, useEffect } from 'react';
import {
    collection,
    query,
    where,
    onSnapshot,
    orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Share } from '@/types';

export function useShares() {
    const { user } = useAuth();
    const [incomingShares, setIncomingShares] = useState<Share[]>([]);
    const [outgoingShares, setOutgoingShares] = useState<Share[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setIncomingShares([]);
            setOutgoingShares([]);
            setIsLoading(false);
            return;
        }

        const sharesRef = collection(db, 'shares');

        // Listen for incoming shares
        const incomingQuery = query(
            sharesRef,
            where('recipientId', '==', user.id),
            orderBy('createdAt', 'desc')
        );

        const unsubscribeIncoming = onSnapshot(incomingQuery, (snapshot) => {
            const shares = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Share));
            setIncomingShares(shares);
            setIsLoading(false);
        }, (error) => {
            console.error('Error listening to incoming shares:', error);
            setIsLoading(false);
        });

        // Listen for outgoing shares
        const outgoingQuery = query(
            sharesRef,
            where('senderId', '==', user.id),
            orderBy('createdAt', 'desc')
        );

        const unsubscribeOutgoing = onSnapshot(outgoingQuery, (snapshot) => {
            const shares = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Share));
            setOutgoingShares(shares);
        }, (error) => {
            console.error('Error listening to outgoing shares:', error);
        });

        return () => {
            unsubscribeIncoming();
            unsubscribeOutgoing();
        };
    }, [user]);

    const pendingIncomingCount = incomingShares.filter(s => s.state === 'inTransit').length;
    const pendingOutgoingCount = outgoingShares.filter(s => s.state === 'inTransit').length;

    return {
        incomingShares,
        outgoingShares,
        pendingIncomingCount,
        pendingOutgoingCount,
        isLoading
    };
}
