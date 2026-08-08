const DB_NAME = "knowledgeDiscord";
const DB_VERSION = 3;
const STRUCTURE_ID = "main";

let db;

function requestToPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transactionDone(tx) {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const nextDb = event.target.result;
            const tx = event.target.transaction;

            // Version 1 used an incompatible messages store.  Do not delete it:
            // keeping it is safer than risking existing notes during an upgrade.
            if (!nextDb.objectStoreNames.contains("messages")) {
                nextDb.createObjectStore("messages", { keyPath: "channel" });
            }

            if (!nextDb.objectStoreNames.contains("structure")) {
                nextDb.createObjectStore("structure", { keyPath: "id" });
            }

            if (!nextDb.objectStoreNames.contains("messageItems")) {
                const items = nextDb.createObjectStore("messageItems", { keyPath: "id" });
                items.createIndex("channel", "channel", { unique: false });

                // Copy the current channel bundles into the new per-message store.
                // This only runs for the compatible v2 store and leaves that store
                // untouched as a recovery copy.
                const oldMessages = tx.objectStore("messages");
                if (oldMessages.keyPath === "channel") {
                    oldMessages.openCursor().onsuccess = (cursorEvent) => {
                        const cursor = cursorEvent.target.result;
                        if (!cursor) return;
                        const record = cursor.value;
                        (record.messages || []).forEach((message) => {
                            if (message?.id) {
                                items.put({ id: message.id, channel: record.channel, message });
                            }
                        });
                        cursor.continue();
                    };
                }
            }
        };

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onerror = () => reject(request.error);
    });
}

function ensureDB() {
    if (!db) {
        throw new Error("Database has not been initialized.");
    }
}

async function loadStructure() {
    ensureDB();

    const tx = db.transaction("structure", "readonly");
    const store = tx.objectStore("structure");
    const record = await requestToPromise(store.get(STRUCTURE_ID));

    return record?.data || null;
}

async function saveStructure(data) {
    ensureDB();

    const tx = db.transaction("structure", "readwrite");
    const store = tx.objectStore("structure");

    store.put({
        id: STRUCTURE_ID,
        data
    });

    await transactionDone(tx);
}

async function getChannelMessages(channelId) {
    ensureDB();

    if (db.objectStoreNames.contains("messageItems")) {
        const tx = db.transaction("messageItems", "readonly");
        const index = tx.objectStore("messageItems").index("channel");
        const records = await requestToPromise(index.getAll(channelId));
        return records.map((record) => record.message);
    }

    const tx = db.transaction("messages", "readonly");
    const store = tx.objectStore("messages");
    const record = await requestToPromise(store.get(channelId));
    return record?.messages || [];
}

async function saveChannelMessages(channelId, messages) {
    ensureDB();

    if (db.objectStoreNames.contains("messageItems")) {
        const tx = db.transaction("messageItems", "readwrite");
        const store = tx.objectStore("messageItems");
        const index = store.index("channel");
        const existingRequest = index.getAllKeys(channelId);
        existingRequest.onsuccess = () => {
            const nextIds = new Set(messages.map((message) => message.id));
            existingRequest.result
                .filter((id) => !nextIds.has(id))
                .forEach((id) => store.delete(id));
            messages.forEach((message) => store.put({ id: message.id, channel: channelId, message }));
        };
        existingRequest.onerror = () => tx.abort();
        await transactionDone(tx);
        return;
    }

    const tx = db.transaction("messages", "readwrite");
    tx.objectStore("messages").put({ channel: channelId, messages });

    await transactionDone(tx);
}

async function deleteChannelMessages(channelId) {
    ensureDB();

    if (db.objectStoreNames.contains("messageItems")) {
        const tx = db.transaction("messageItems", "readwrite");
        const store = tx.objectStore("messageItems");
        const keysRequest = store.index("channel").getAllKeys(channelId);
        keysRequest.onsuccess = () => keysRequest.result.forEach((key) => store.delete(key));
        keysRequest.onerror = () => tx.abort();
        await transactionDone(tx);
        return;
    }

    const tx = db.transaction("messages", "readwrite");
    tx.objectStore("messages").delete(channelId);

    await transactionDone(tx);
}

async function getAllChannelMessages() {
    ensureDB();
    if (db.objectStoreNames.contains("messageItems")) {
        const tx = db.transaction("messageItems", "readonly");
        const records = await requestToPromise(tx.objectStore("messageItems").getAll());
        const grouped = new Map();
        records.forEach((record) => grouped.set(record.channel, [...(grouped.get(record.channel) || []), record.message]));
        return [...grouped.entries()].map(([channelId, messages]) => ({ channelId, messages }));
    }
    const tx = db.transaction("messages", "readonly");
    const records = await requestToPromise(tx.objectStore("messages").getAll());
    return records.map((record) => ({ channelId: record.channel, messages: record.messages || [] }));
}

async function replaceAllChannelMessages(channelEntries) {
    ensureDB();
    const entries = Array.isArray(channelEntries) ? channelEntries : [];
    if (db.objectStoreNames.contains("messageItems")) {
        const tx = db.transaction("messageItems", "readwrite");
        const store = tx.objectStore("messageItems");
        store.clear();
        entries.forEach(({ channelId, messages }) => (messages || []).forEach((message) => {
            if (message?.id) store.put({ id: message.id, channel: channelId, message });
        }));
        await transactionDone(tx);
        return;
    }
    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    store.clear();
    entries.forEach(({ channelId, messages }) => store.put({ channel: channelId, messages: messages || [] }));
    await transactionDone(tx);
}
