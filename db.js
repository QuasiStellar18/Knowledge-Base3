const DB_NAME = "knowledgeDiscord";
const DB_VERSION = 4;
const STRUCTURE_ID = "main";

let db;
// Keep writes for a channel in order.  A mobile browser can start several
// actions close together, and a later snapshot must never be written before
// an earlier one has finished its IndexedDB transaction.
const channelWriteQueues = new Map();

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

            let items;
            if (!nextDb.objectStoreNames.contains("messageItems")) {
                items = nextDb.createObjectStore("messageItems", { keyPath: "id" });
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
                                items.put({ id: message.id, channel: record.channel, createdAt: message.createdAt || new Date(0).toISOString(), message });
                            }
                        });
                        cursor.continue();
                    };
                }
            } else {
                items = tx.objectStore("messageItems");
            }

            if (!items.indexNames.contains("channelMessageCreatedAt")) {
                // This reads the date already inside each message, so adding
                // the index does not rewrite or duplicate stored image Blobs.
                items.createIndex("channelMessageCreatedAt", ["channel", "message.createdAt"], { unique: false });
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
    // A request error can bubble before tx.error is populated. Waiting for
    // abort preserves the real cause and confirms that nothing was committed.
    await new Promise((resolve, reject) => {
        let tx, requestError = null;
        const describeFailure = (cause, aborted) => {
            const failure = new Error(cause?.message || "The local database aborted the structure save without providing a reason.");
            failure.name = cause?.name || "AbortError";
            failure.structureTransactionAborted = aborted;
            return failure;
        };
        try {
            tx = db.transaction("structure", "readwrite");
            tx.oncomplete = () => resolve();
            tx.onerror = (event) => { requestError ||= event?.target?.error || tx.error || null; };
            tx.onabort = () => reject(describeFailure(requestError || tx.error, true));
            const request = tx.objectStore("structure").put({ id: STRUCTURE_ID, data });
            request.onerror = () => { requestError ||= request.error || null; };
        } catch (error) {
            if (tx) { try { tx.abort(); } catch (_) { /* already inactive */ } }
            reject(describeFailure(error, false));
        }
    });
}

// The original channel-bundle store is deliberately retained during the
// per-message migration. It is a read-only recovery source: using it here
// never deletes, migrates, or changes a saved photo or note.
async function getLegacyChannelMessages(channelId) {
    if (!db.objectStoreNames.contains("messages")) return [];
    const tx = db.transaction("messages", "readonly");
    const record = await requestToPromise(tx.objectStore("messages").get(channelId));
    return record?.messages || [];
}

async function getChannelMessages(channelId) {
    ensureDB();

    if (db.objectStoreNames.contains("messageItems")) {
        try {
            const tx = db.transaction("messageItems", "readonly");
            const store = tx.objectStore("messageItems");
            let records;
            if (store.indexNames.contains("channel")) {
                try {
                    records = await requestToPromise(store.index("channel").getAll(channelId));
                } catch (error) {
                    // Some interrupted mobile upgrades can leave an index present
                    // but temporarily unreadable. The records themselves remain
                    // safe, so fall back to reading and filtering the store.
                    console.warn("Channel index read failed; using item-store fallback.", error);
                }
            }
            if (!records) {
                records = (await requestToPromise(store.getAll()))
                    .filter((record) => record.channel === channelId);
            }
            // `getAll` is ordered by its internal primary key, not by when a
            // note was added. Keeping reads chronological makes old channels,
            // galleries, and any reloaded photo list stable after a restart.
            return records
                .map((record) => record.message)
                .sort((first, second) => new Date(first?.createdAt || 0) - new Date(second?.createdAt || 0));
        } catch (error) {
            // A failed messageItems read must not hide the preserved original
            // channel record. It remains untouched as a recovery copy.
            console.warn("Message-item store could not be read; using preserved channel copy.", error);
        }
    }

    return getLegacyChannelMessages(channelId);
}

// Read a single referenced message without loading every image in its channel.
// This does not migrate or modify either the current store or the legacy copy.
async function getChannelMessage(channelId, messageId) {
    ensureDB();
    if (db.objectStoreNames.contains("messageItems")) {
        try {
            const tx = db.transaction("messageItems", "readonly");
            const record = await requestToPromise(tx.objectStore("messageItems").get(messageId));
            return record?.channel === channelId ? record.message : null;
        } catch (error) {
            console.warn("Could not read the source message; checking the preserved legacy store.", error);
        }
    }
    return (await getLegacyChannelMessages(channelId)).find((message) => message?.id === messageId) || null;
}

// Locate a globally identified message after an inbox/sorting move, without
// changing any saved references or loading its entire destination channel.
async function getMessageLocation(messageId, preferredChannelId = null) {
    ensureDB();
    if (db.objectStoreNames.contains("messageItems")) {
        const tx = db.transaction("messageItems", "readonly");
        const record = await requestToPromise(tx.objectStore("messageItems").get(messageId));
        return record?.message && record?.channel ? { channelId: record.channel, message: record.message } : null;
    }
    const tx = db.transaction("messages", "readonly");
    const records = await requestToPromise(tx.objectStore("messages").getAll());
    const ordered = [...records].sort((a, b) => Number(b.channel === preferredChannelId) - Number(a.channel === preferredChannelId));
    for (const record of ordered) {
        const message = (record.messages || []).find((item) => item?.id === messageId);
        if (message) return { channelId: record.channel, message };
    }
    return null;
}

async function getRecentChannelMessages(channelId, limit = 100) {
    ensureDB();
    const safeLimit = Math.max(1, Number(limit) || 100);

    if (db.objectStoreNames.contains("messageItems")) {
        try {
            const tx = db.transaction("messageItems", "readonly");
            const store = tx.objectStore("messageItems");
            if (!store.indexNames.contains("channelMessageCreatedAt")) throw new Error("Recent-message index is unavailable.");
            const index = store.index("channelMessageCreatedAt");
            const range = IDBKeyRange.bound([channelId, ""], [channelId, "\uffff"]);
            const indexedCount = requestToPromise(index.count(range));
            const channelCount = store.indexNames.contains("channel")
                ? requestToPromise(store.index("channel").count(channelId)) : Promise.resolve(null);
            const cursorItems = new Promise((resolve, reject) => {
                const items = [];
                const request = index.openCursor(range, "prev");
                request.onsuccess = () => {
                    const cursor = request.result;
                    if (!cursor || items.length >= safeLimit) {
                        resolve(items);
                        return;
                    }
                    items.push(cursor.value.message);
                    cursor.continue();
                };
                request.onerror = () => reject(request.error);
            });
            const [newestFirst, indexed, total] = await Promise.all([cursorItems, indexedCount, channelCount]);
            // Missing or non-string timestamps are not included in the compound
            // index. Fall back to a complete channel read so older photos do
            // not become permanently unreachable through pagination.
            if (total !== null && indexed < total) throw new Error("Some notes are not present in the date index.");
            return newestFirst.reverse();
        } catch (error) {
            // Keep the optimized index optional. A direct channel read below
            // can also fall back to the preserved channel bundle if needed.
            console.warn("Recent-message index read failed; using recovery path.", error);
        }
    }

    const messages = await getChannelMessages(channelId);
    return messages
        .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
        .slice(-safeLimit);
}

async function getChannelMessageCount(channelId) {
    ensureDB();
    if (db.objectStoreNames.contains("messageItems")) {
        try {
            const tx = db.transaction("messageItems", "readonly");
            const store = tx.objectStore("messageItems");
            if (store.indexNames.contains("channel")) {
                return await requestToPromise(store.index("channel").count(channelId));
            }
        } catch (error) {
            console.warn("Channel count index read failed; using recovery path.", error);
        }
    }
    return (await getChannelMessages(channelId)).length;
}

function enqueueChannelWrite(channelId, write) {
    const previous = channelWriteQueues.get(channelId) || Promise.resolve();
    const queued = previous.catch(() => undefined).then(write);
    const settled = queued.finally(() => {
        if (channelWriteQueues.get(channelId) === settled) {
            channelWriteQueues.delete(channelId);
        }
    });
    channelWriteQueues.set(channelId, settled);
    return settled;
}

function snapshotMessages(messages) {
    return (messages || []).map((message) => ({
        ...message,
        reactions: [...(message.reactions || [])],
        tags: [...(message.tags || [])],
        attachments: (message.attachments || []).map((attachment) => ({ ...attachment })),
        linkedPhotoRefs: (message.linkedPhotoRefs || []).map((ref) => ({ ...ref }))
    }));
}

function snapshotMessage(message) {
    return snapshotMessages([message])[0];
}

async function saveChannelMessagesNow(channelId, messages) {
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
            messages.forEach((message) => store.put({ id: message.id, channel: channelId, createdAt: message.createdAt || new Date(0).toISOString(), message }));
        };
        existingRequest.onerror = () => tx.abort();
        await transactionDone(tx);
        return;
    }

    const tx = db.transaction("messages", "readwrite");
    tx.objectStore("messages").put({ channel: channelId, messages });

    await transactionDone(tx);
}

async function saveChannelMessages(channelId, messages) {
    ensureDB();
    const snapshot = snapshotMessages(messages);
    return enqueueChannelWrite(channelId, () => saveChannelMessagesNow(channelId, snapshot));
}

async function saveChannelMessageNow(channelId, message) {
    ensureDB();

    if (db.objectStoreNames.contains("messageItems")) {
        const tx = db.transaction("messageItems", "readwrite");
        tx.objectStore("messageItems").put({ id: message.id, channel: channelId, createdAt: message.createdAt || new Date(0).toISOString(), message });
        await transactionDone(tx);
        return;
    }

    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    const currentRequest = store.get(channelId);
    currentRequest.onsuccess = () => {
        const current = currentRequest.result?.messages || [];
        const index = current.findIndex((item) => item.id === message.id);
        if (index >= 0) current[index] = message;
        else current.push(message);
        store.put({ channel: channelId, messages: current });
    };
    currentRequest.onerror = () => tx.abort();
    await transactionDone(tx);
}

// Use this for a single new or edited note. It avoids rewriting every image
// in a channel, which is especially important on memory-constrained phones.
async function saveChannelMessage(channelId, message) {
    ensureDB();
    const snapshot = snapshotMessage(message);
    return enqueueChannelWrite(channelId, () => saveChannelMessageNow(channelId, snapshot));
}

// Only updates the listed ordering metadata, in one transaction. It never
// replaces the channel snapshot or deletes unlisted messages.
async function saveChannelMessageOrder(channelId, orderedIds) {
    ensureDB();
    const ids = [...orderedIds];
    if (!ids.length || new Set(ids).size !== ids.length) throw new Error("Invalid photo order.");
    return enqueueChannelWrite(channelId, async () => {
        if (db.objectStoreNames.contains("messageItems")) {
            const tx = db.transaction("messageItems", "readwrite");
            const store = tx.objectStore("messageItems");
            ids.forEach((id, index) => {
                const request = store.get(id);
                request.onsuccess = () => {
                    const record = request.result;
                    if (!record || record.channel !== channelId || !record.message) { tx.abort(); return; }
                    store.put({ ...record, message: { ...record.message, arrayOrder: index } });
                };
                request.onerror = () => tx.abort();
            });
            await transactionDone(tx);
            return;
        }
        const tx = db.transaction("messages", "readwrite");
        const store = tx.objectStore("messages");
        const request = store.get(channelId);
        request.onsuccess = () => {
            const record = request.result;
            if (!record || !Array.isArray(record.messages)) { tx.abort(); return; }
            const positions = new Map(ids.map((id, index) => [id, index]));
            const found = new Set(record.messages.filter((message) => positions.has(message.id)).map((message) => message.id));
            if (found.size !== ids.length) { tx.abort(); return; }
            store.put({ ...record, messages: record.messages.map((message) => positions.has(message.id) ? { ...message, arrayOrder: positions.get(message.id) } : message) });
        };
        request.onerror = () => tx.abort();
        await transactionDone(tx);
    });
}

// Move a note in a single transaction: a failed destination write must never
// remove the source photo or message.
async function moveChannelMessage(sourceChannelId, destinationChannelId, messageId) {
    ensureDB();
    if (!sourceChannelId || !destinationChannelId || !messageId || sourceChannelId === destinationChannelId) throw new Error("Invalid message move.");
    return enqueueChannelWrite(sourceChannelId, async () => {
        if (db.objectStoreNames.contains("messageItems")) {
            const tx = db.transaction("messageItems", "readwrite");
            const store = tx.objectStore("messageItems");
            const request = store.get(messageId);
            request.onsuccess = () => {
                const record = request.result;
                if (!record || record.channel !== sourceChannelId || !record.message) { tx.abort(); return; }
                store.put({ ...record, channel: destinationChannelId });
            };
            request.onerror = () => tx.abort();
            await transactionDone(tx);
            return;
        }
        const tx = db.transaction("messages", "readwrite");
        const store = tx.objectStore("messages");
        const sourceRequest = store.get(sourceChannelId);
        const destinationRequest = store.get(destinationChannelId);
        let sourceReady = false, destinationReady = false;
        const commit = () => {
            if (!sourceReady || !destinationReady) return;
            const source = sourceRequest.result;
            const destination = destinationRequest.result || { channel: destinationChannelId, messages: [] };
            if (!Array.isArray(source?.messages) || !Array.isArray(destination.messages)) { tx.abort(); return; }
            const sourceMessages = source.messages;
            const destinationMessages = destination.messages;
            const message = sourceMessages.find((item) => item.id === messageId);
            if (!message || destinationMessages.some((item) => item.id === messageId)) { tx.abort(); return; }
            store.put({ ...source, messages: sourceMessages.filter((item) => item.id !== messageId) });
            store.put({ ...destination, messages: [...destinationMessages, message] });
        };
        sourceRequest.onsuccess = () => { sourceReady = true; commit(); };
        destinationRequest.onsuccess = () => { destinationReady = true; commit(); };
        sourceRequest.onerror = () => tx.abort();
        destinationRequest.onerror = () => tx.abort();
        await transactionDone(tx);
    });
}

async function deleteChannelMessagesNow(channelId) {
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

async function deleteChannelMessages(channelId) {
    ensureDB();
    return enqueueChannelWrite(channelId, () => deleteChannelMessagesNow(channelId));
}

async function deleteChannelMessageNow(channelId, messageId) {
    ensureDB();

    if (db.objectStoreNames.contains("messageItems")) {
        const tx = db.transaction("messageItems", "readwrite");
        const store = tx.objectStore("messageItems");
        const recordRequest = store.get(messageId);
        recordRequest.onsuccess = () => {
            // IDs are global. Do not remove a note that has just been moved
            // into a different channel by another queued write.
            if (recordRequest.result?.channel === channelId) store.delete(messageId);
        };
        recordRequest.onerror = () => tx.abort();
        await transactionDone(tx);
        return;
    }

    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    const currentRequest = store.get(channelId);
    currentRequest.onsuccess = () => {
        const current = currentRequest.result?.messages || [];
        store.put({ channel: channelId, messages: current.filter((message) => message.id !== messageId) });
    };
    currentRequest.onerror = () => tx.abort();
    await transactionDone(tx);
}

async function deleteChannelMessage(channelId, messageId) {
    ensureDB();
    return enqueueChannelWrite(channelId, () => deleteChannelMessageNow(channelId, messageId));
}

async function getAllChannelMessages() {
    ensureDB();
    if (db.objectStoreNames.contains("messageItems")) {
        try {
            const tx = db.transaction("messageItems", "readonly");
            const records = await requestToPromise(tx.objectStore("messageItems").getAll());
            const grouped = new Map();
            records.forEach((record) => grouped.set(record.channel, [...(grouped.get(record.channel) || []), record.message]));
            return [...grouped.entries()].map(([channelId, messages]) => ({ channelId, messages }));
        } catch (error) {
            console.warn("Message-item backup read failed; using preserved channel copies.", error);
        }
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
            if (message?.id) store.put({ id: message.id, channel: channelId, createdAt: message.createdAt || new Date(0).toISOString(), message });
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
