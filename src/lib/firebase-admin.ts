import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
let adminApp: admin.app.App;

export function getAdminApp(): admin.app.App {
    if (adminApp) {
        return adminApp;
    }

    // Check if already initialized
    if (admin.apps.length > 0) {
        adminApp = admin.apps[0] as admin.app.App;
        return adminApp;
    }

    // Initialize with service account from environment variables
    const serviceAccount = {
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

    adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
        databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
    });

    return adminApp;
}

export function getAdminFirestore(): admin.firestore.Firestore {
    const app = getAdminApp();
    // Use the specific database ID as configured in the client
    return getFirestore(app, 'imgprompt-db-0');
}

export function getAdminAuth(): admin.auth.Auth {
    const app = getAdminApp();
    return app.auth();
}
