/**
 * Firebase Database & Auth Bridge
 * Living Archive
 */

const ArchiveDB = {
    auth: null,
    db: null,
    currentUser: null,
    adminEmail: "jcsayan7@gmail.com",

    // Initialization
    init() {
        if (typeof firebase === 'undefined') {
            console.warn("Firebase SDK is not loaded. Operating in static mode.");
            return false;
        }

        if (!window.firebaseConfig || window.firebaseConfig.apiKey.startsWith("PLACEHOLDER")) {
            console.warn("Firebase config is not configured yet. Operating in static mode.");
            return false;
        }

        try {
            // Initialize Firebase
            firebase.initializeApp(window.firebaseConfig);
            this.auth = firebase.auth();
            this.db = firebase.firestore();
            
            // Enable persistence if possible
            this.db.settings({
                cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
            });
            this.db.enablePersistence().catch(err => {
                console.warn("Firestore persistence failed to enable:", err.code);
            });

            console.log("Firebase initialized successfully in production mode.");
            return true;
        } catch (error) {
            console.error("Firebase initialization failed:", error);
            return false;
        }
    },

    // --- AUTHENTICATION ---
    onAuthStateChanged(callback) {
        if (!this.auth) return;
        this.auth.onAuthStateChanged(user => {
            this.currentUser = user;
            callback(user);
        });
    },

    async signInWithGoogle() {
        if (!this.auth) throw new Error("Auth not initialized");
        const provider = new firebase.auth.GoogleAuthProvider();
        return this.auth.signInWithPopup(provider);
    },

    async signInWithEmail(email, password) {
        if (!this.auth) throw new Error("Auth not initialized");
        return this.auth.signInWithEmailAndPassword(email, password);
    },

    async signUpWithEmail(email, password) {
        if (!this.auth) throw new Error("Auth not initialized");
        return this.auth.createUserWithEmailAndPassword(email, password);
    },

    async signOut() {
        if (!this.auth) return;
        return this.auth.signOut();
    },

    isAdmin() {
        return this.currentUser && this.currentUser.email && this.currentUser.email.toLowerCase() === this.adminEmail.toLowerCase();
    },

    getCurrentUser() {
        return this.currentUser;
    },

    // --- FIRESTORE CRUD FOR BLOGS, THOUGHTS, LIFE INCIDENTS ---
    getCollectionName(type) {
        switch (type) {
            case 'blog': return 'blogs';
            case 'thoughts': return 'thoughts';
            case 'life': return 'lifeIncidents';
            default: return 'blogs';
        }
    },

    async fetchEntries(type) {
        if (!this.db) return [];
        const collection = this.getCollectionName(type);
        try {
            const snapshot = await this.db.collection(collection).get();
            const entries = [];
            snapshot.forEach(doc => {
                entries.push({ ...doc.data(), docId: doc.id });
            });
            return entries;
        } catch (error) {
            console.error(`Error fetching ${type} from Firestore:`, error);
            throw error;
        }
    },

    async addEntry(type, entry) {
        if (!this.db) throw new Error("Database not initialized");
        if (!this.isAdmin()) throw new Error("Unauthorized: Admin privilege required");

        const collection = this.getCollectionName(type);
        const docId = entry.id; // Match local ID structure
        const entryData = {
            ...entry,
            likesCount: entry.likesCount || 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await this.db.collection(collection).doc(docId).set(entryData);
            return docId;
        } catch (error) {
            console.error(`Error adding entry to ${type}:`, error);
            throw error;
        }
    },

    async updateEntry(type, id, updatedData) {
        if (!this.db) throw new Error("Database not initialized");
        if (!this.isAdmin()) throw new Error("Unauthorized: Admin privilege required");

        const collection = this.getCollectionName(type);
        try {
            await this.db.collection(collection).doc(id).update({
                ...updatedData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error(`Error updating entry ${id}:`, error);
            throw error;
        }
    },

    async deleteEntry(type, id) {
        if (!this.db) throw new Error("Database not initialized");
        if (!this.isAdmin()) throw new Error("Unauthorized: Admin privilege required");

        const collection = this.getCollectionName(type);
        try {
            await this.db.collection(collection).doc(id).delete();
            
            // Clean up associated likes & saves
            const likesSnapshot = await this.db.collection('likes').where('entryId', '==', id).get();
            const batch = this.db.batch();
            likesSnapshot.forEach(doc => batch.delete(doc.ref));

            const savesSnapshot = await this.db.collection('saves').where('entryId', '==', id).get();
            savesSnapshot.forEach(doc => batch.delete(doc.ref));

            await batch.commit();
        } catch (error) {
            console.error(`Error deleting entry ${id}:`, error);
            throw error;
        }
    },

    // Auto Seeding helper
    async seedFirestoreIfEmpty(type, localData) {
        if (!this.db) return;
        const collection = this.getCollectionName(type);
        try {
            const snapshot = await this.db.collection(collection).limit(1).get();
            if (snapshot.empty && localData && localData.length > 0) {
                console.log(`Firestore ${collection} is empty. Seeding with local JSON content...`);
                const batch = this.db.batch();
                
                localData.forEach(item => {
                    const docRef = this.db.collection(collection).doc(item.id);
                    batch.set(docRef, {
                        ...item,
                        likesCount: 0,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });
                
                await batch.commit();
                console.log(`Successfully seeded ${collection} in Firestore.`);
            }
        } catch (error) {
            console.warn(`Error seeding collection ${collection}:`, error);
        }
    },

    // --- LIKES SYSTEM ---
    async getLikesState(entryId) {
        if (!this.db) return { count: 0, isLiked: false };
        
        try {
            // Fetch entry likes count
            // We search across all 3 collections to find the matching entry
            let entryDoc = null;
            for (const coll of ['blogs', 'thoughts', 'lifeIncidents']) {
                const doc = await this.db.collection(coll).doc(entryId).get();
                if (doc.exists) {
                    entryDoc = doc;
                    break;
                }
            }

            const count = entryDoc ? (entryDoc.data().likesCount || 0) : 0;
            let isLiked = false;

            if (this.currentUser) {
                const likeId = `${this.currentUser.uid}_${entryId}`;
                const likeDoc = await this.db.collection('likes').doc(likeId).get();
                isLiked = likeDoc.exists;
            }

            return { count, isLiked };
        } catch (error) {
            console.error("Error getting likes state:", error);
            return { count: 0, isLiked: false };
        }
    },

    async toggleLike(entryId, entryType) {
        if (!this.db) throw new Error("Database not initialized");
        if (!this.currentUser) throw new Error("Authentication required to like entries");

        const collection = this.getCollectionName(entryType);
        const likeId = `${this.currentUser.uid}_${entryId}`;
        const likeRef = this.db.collection('likes').doc(likeId);
        const entryRef = this.db.collection(collection).doc(entryId);

        try {
            const likeDoc = await likeRef.get();
            const isLiked = likeDoc.exists;

            await this.db.runTransaction(async transaction => {
                const entrySnap = await transaction.get(entryRef);
                if (!entrySnap.exists) throw new Error("Post does not exist");
                
                const currentLikes = entrySnap.data().likesCount || 0;

                if (isLiked) {
                    // Unlike
                    transaction.delete(likeRef);
                    transaction.update(entryRef, { likesCount: Math.max(0, currentLikes - 1) });
                } else {
                    // Like
                    transaction.set(likeRef, {
                        userId: this.currentUser.uid,
                        entryId: entryId,
                        entryType: entryType,
                        likedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    transaction.update(entryRef, { likesCount: currentLikes + 1 });
                }
            });

            return !isLiked;
        } catch (error) {
            console.error("Error toggling like:", error);
            throw error;
        }
    },

    // --- BOOKMARKS / SAVES SYSTEM ---
    async isSaved(entryId) {
        if (!this.db || !this.currentUser) return false;
        const saveId = `${this.currentUser.uid}_${entryId}`;
        try {
            const saveDoc = await this.db.collection('saves').doc(saveId).get();
            return saveDoc.exists;
        } catch (error) {
            console.error("Error checking bookmark status:", error);
            return false;
        }
    },

    async toggleSave(entryId, entryType) {
        if (!this.db) throw new Error("Database not initialized");
        if (!this.currentUser) throw new Error("Authentication required to save entries");

        const saveId = `${this.currentUser.uid}_${entryId}`;
        const saveRef = this.db.collection('saves').doc(saveId);

        try {
            const saveDoc = await saveRef.get();
            const isSaved = saveDoc.exists;

            if (isSaved) {
                await saveRef.delete();
                return false; // Removed
            } else {
                await saveRef.set({
                    userId: this.currentUser.uid,
                    entryId: entryId,
                    entryType: entryType,
                    savedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                return true; // Saved
            }
        } catch (error) {
            console.error("Error toggling save status:", error);
            throw error;
        }
    },

    async fetchSavedEntries() {
        if (!this.db || !this.currentUser) return [];

        try {
            // Fetch the user's bookmarks
            const snapshot = await this.db.collection('saves')
                .where('userId', '==', this.currentUser.uid)
                .get();

            const savedRefs = [];
            snapshot.forEach(doc => {
                savedRefs.push(doc.data());
            });

            if (savedRefs.length === 0) return [];

            // Resolve references in batches from respective collections
            const resolvedEntries = [];
            for (const ref of savedRefs) {
                const collection = this.getCollectionName(ref.entryType);
                const doc = await this.db.collection(collection).doc(ref.entryId).get();
                if (doc.exists) {
                    resolvedEntries.push({
                        ...doc.data(),
                        entryType: ref.entryType
                    });
                }
            }
            
            // Sort by saved date desc
            resolvedEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
            return resolvedEntries;
        } catch (error) {
            console.error("Error fetching saved entries:", error);
            return [];
        }
    }
};

// Expose globally
window.ArchiveDB = ArchiveDB;
