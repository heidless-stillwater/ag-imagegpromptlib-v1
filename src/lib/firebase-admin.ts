// Initialize Firebase Admin SDK
let adminApp: any;

/**
 * Robustly initialize Firebase Admin SDK
 */
export function getAdminApp(): any {
    if (adminApp) return adminApp;

    // Use late-bound require to avoid module resolution issues at top-level
    const admin = require('firebase-admin');

    const apps = admin.apps;
    if (apps && apps.length > 0) {
        adminApp = apps[0];
        return adminApp;
    }

    try {
        let serviceAccount: any;

        // Try getting from JSON string first (production standard)
        const jsonKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (jsonKey) {
            try {
                let keyStr = jsonKey.trim();
                // Strip literal quotes that might be included in the env var file
                if ((keyStr.startsWith("'") && keyStr.endsWith("'")) ||
                    (keyStr.startsWith('"') && keyStr.endsWith('"'))) {
                    keyStr = keyStr.substring(1, keyStr.length - 1);
                }
                serviceAccount = JSON.parse(keyStr);
            } catch (parseError) {
                console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON:', parseError);
            }
        }

        // If no JSON or parse failed, use individual environment variables
        if (!serviceAccount) {
            serviceAccount = {
                type: process.env.FIREBASE_ADMIN_TYPE || 'service_account',
                project_id: process.env.FIREBASE_ADMIN_PROJECT_ID,
                private_key_id: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
                private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
                client_id: process.env.FIREBASE_ADMIN_CLIENT_ID,
                auth_uri: process.env.FIREBASE_ADMIN_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
                token_uri: process.env.FIREBASE_ADMIN_TOKEN_URI || 'https://oauth2.googleapis.com/token',
                auth_provider_x509_cert_url: process.env.FIREBASE_ADMIN_AUTH_PROVIDER_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
                client_x509_cert_url: process.env.FIREBASE_ADMIN_CLIENT_CERT_URL,
                universe_domain: process.env.FIREBASE_ADMIN_UNIVERSE_DOMAIN || 'googleapis.com',
            };
        }

        // Final validation
        if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
            const missing = [];
            if (!serviceAccount.project_id) missing.push('project_id');
            if (!serviceAccount.private_key) missing.push('private_key');
            if (!serviceAccount.client_email) missing.push('client_email');
            throw new Error(`Missing mandatory service account fields: ${missing.join(', ')}`);
        }

        adminApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
        });

        return adminApp;
    } catch (error) {
        console.error('CRITICAL: Firebase Admin initialization failed:', error);
        throw error;
    }
}

/**
 * Get Firestore instance targeting the specific database
 */
export function getAdminFirestore(): any {
    const app = getAdminApp();
    // Use modular getFirestore dynamically to ensure proper database targeting
    const { getFirestore } = require('firebase-admin/firestore');
    return getFirestore(app, 'imgprompt-db-0');
}

/**
 * Get Auth instance
 */
export function getAdminAuth(): any {
    const app = getAdminApp();
    return app.auth();
}
