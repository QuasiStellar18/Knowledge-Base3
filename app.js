const DEFAULT_STRUCTURE = {
    servers: [
        {
            id: "main",
            name: "Main",
            categories: [
                {
                    id: "main:general",
                    name: "General",
                    collapsed: false,
                    channels: [
                        { id: "inbox", name: "inbox", isInboxChannel: true },
                        { id: "ideas", name: "ideas" },
                        { id: "lectures", name: "lectures" }
                    ]
                }
            ]
        }
    ],
    settings: {
        randomMin: 1,
        randomMax: 100,
        randomTexts: [],
        photoGridEnabled: false,
        discordEmbedControls: false,
        photoCollections: []
    }
};

const CHANNEL_PIN = "58008";

const state = {
    ready: false,
    structure: structuredClone(DEFAULT_STRUCTURE),
    activeServerId: "main",
    activeChannelId: "ideas",
    activeView: { type: "channel", id: "ideas" },
    messagesByChannel: new Map(),
    search: "",
    draftAttachments: [],
    storageText: "Storage: checking",
    randomNumberText: "",
    randomText: "",
    error: "",
    visibleMessageLimit: 100,
    randomPhotoArray: [],
    isUnlocked: false,
    selectedPhotoRefs: []
};

const els = {
    app: document.getElementById("app"),
    servers: document.getElementById("servers"),
    sidebar: document.getElementById("sidebar"),
    chat: document.getElementById("chat"),
    mobileStageNav: document.getElementById("mobileStageNav"),
    channels: document.getElementById("channels"),
    activeTitle: document.getElementById("activeTitle"),
    activeMeta: document.getElementById("activeMeta"),
    messages: document.getElementById("messages"),
    noteInput: document.getElementById("noteInput"),
    sendBtn: document.getElementById("sendBtn"),
    settingsBtn: document.getElementById("settingsBtn"),
    newChannelBtn: document.getElementById("newChannelBtn"),
    newServerBtn: document.getElementById("newServerBtn"),
    newCategoryBtn: document.getElementById("newCategoryBtn"),
    deleteChannelBtn: document.getElementById("deleteChannelBtn"),
    randomChannelBtn: document.getElementById("randomChannelBtn"),
    randomMessageBtn: document.getElementById("randomMessageBtn"),
    saveRandomArrayBtn: document.getElementById("saveRandomArrayBtn"),
    lockWorkspaceBtn: document.getElementById("lockWorkspaceBtn"),
    imageInput: document.getElementById("imageInput"),
    attachImageBtn: document.getElementById("attachImageBtn"),
    attachmentPreview: document.getElementById("attachmentPreview"),
    searchInput: document.getElementById("searchInput"),
    randomMin: document.getElementById("randomMin"),
    randomMax: document.getElementById("randomMax"),
    randomNumberBtn: document.getElementById("randomNumberBtn"),
    randomNumberResult: document.getElementById("randomNumberResult"),
    savedRandomInput: document.getElementById("savedRandomInput"),
    saveRandomTextBtn: document.getElementById("saveRandomTextBtn"),
    randomTextBtn: document.getElementById("randomTextBtn"),
    randomTextResult: document.getElementById("randomTextResult"),
    savedRandomList: document.getElementById("savedRandomList"),
    storageInfo: document.getElementById("storageInfo"),
    photoGridToggle: document.getElementById("photoGridToggle"),
    embedControlsToggle: document.getElementById("embedControlsToggle"),
    randomPhotoCount: document.getElementById("randomPhotoCount"),
    randomPhotoArrayBtn: document.getElementById("randomPhotoArrayBtn"),
    lockScreen: document.getElementById("lockScreen"),
    unlockForm: document.getElementById("unlockForm"),
    channelPinInput: document.getElementById("channelPinInput"),
    unlockError: document.getElementById("unlockError")
};

document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
    console.log("initApp: start");
    bindEvents();
    render();

    try {
        await initDB();
        console.log("initApp: DB initialized");
        const savedStructure = await loadStructure();
        console.log("initApp: structure loaded", !!savedStructure);

        state.structure = normalizeStructure(savedStructure);
        const createdInbox = ensureInboxChannel();
        selectInitialChannel();
        hydrateSettingsControls();
        state.ready = true;
        if (createdInbox) await saveStructure(state.structure);
        requestPersistentStorage();
        refreshStorageEstimate();
    } catch (error) {
        state.error = "Storage could not be loaded. Notes may not persist until this is fixed.";
        console.error("initApp error:", error);
    }

    render();
    renderLockScreen();
    showMobileStage(state.activeView.type ? "chat" : "sidebar", "auto");
    registerServiceWorker();
}

function bindEvents() {
    els.sendBtn.addEventListener("click", sendMessage);

    els.noteInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    els.noteInput.addEventListener("paste", handlePaste);
    els.attachImageBtn.addEventListener("click", () => els.imageInput.click());
    els.imageInput.addEventListener("change", () => addImageFiles([...els.imageInput.files]));

    els.newServerBtn.addEventListener("click", createServer);
    els.settingsBtn.addEventListener("click", openSettings);
    els.newCategoryBtn.addEventListener("click", createCategory);
    els.newChannelBtn.addEventListener("click", createChannel);
    els.deleteChannelBtn.addEventListener("click", deleteActiveChannel);
    els.randomChannelBtn.addEventListener("click", selectRandomChannel);
    els.randomMessageBtn.addEventListener("click", selectRandomMessageInActiveChannel);
    els.saveRandomArrayBtn.addEventListener("click", saveRandomPhotoArray);
    els.lockWorkspaceBtn.addEventListener("click", lockWorkspace);
    els.unlockForm.addEventListener("submit", unlockWorkspace);

    els.searchInput.addEventListener("input", () => {
        state.search = els.searchInput.value.trim().toLowerCase();
        renderMessages();
    });

    els.randomMin.addEventListener("change", saveRandomRange);
    els.randomMax.addEventListener("change", saveRandomRange);
    els.randomNumberBtn.addEventListener("click", selectRandomNumber);
    els.saveRandomTextBtn.addEventListener("click", saveRandomTexts);
    els.randomTextBtn.addEventListener("click", selectRandomText);
    els.photoGridToggle.addEventListener("change", togglePhotoGrid);
    els.embedControlsToggle.addEventListener("change", toggleEmbedControls);
    els.randomPhotoArrayBtn.addEventListener("click", createRandomPhotoArray);

    els.mobileStageNav.querySelectorAll("button").forEach((button) => {
        button.addEventListener("click", () => showMobileStage(button.dataset.stageTarget));
    });

    els.app.addEventListener("scroll", debounce(() => updateMobileStageNav(), 80), { passive: true });
    window.addEventListener("resize", () => updateMobileStageNav());
}

async function unlockWorkspace(event) {
    event.preventDefault();
    if (els.channelPinInput.value !== CHANNEL_PIN) {
        els.unlockError.textContent = "Incorrect PIN.";
        els.channelPinInput.select();
        return;
    }

    state.isUnlocked = true;
    els.channelPinInput.value = "";
    els.unlockError.textContent = "";
    await loadActiveChannelMessages();
    render();
    renderLockScreen();
}

function lockWorkspace() {
    state.isUnlocked = false;
    state.messagesByChannel.clear();
    state.randomPhotoArray = [];
    state.search = "";
    els.searchInput.value = "";
    render();
    renderLockScreen();
}

function renderLockScreen() {
    els.lockScreen.hidden = state.isUnlocked;
    els.lockWorkspaceBtn.hidden = !state.isUnlocked;
    if (!state.isUnlocked) {
        requestAnimationFrame(() => els.channelPinInput.focus());
    }
}

function normalizeStructure(savedStructure) {
    const base = savedStructure || structuredClone(DEFAULT_STRUCTURE);

    if (!base.servers && !Array.isArray(base)) {
        const servers = Object.entries(base).map(([serverName, channels]) => ({
            id: slugify(serverName),
            name: serverName,
            channels: (channels || []).map((channelName) => ({
                id: channelKey(slugify(serverName), channelName),
                name: channelName
            }))
        }));

        return normalizeStructure({ servers });
    }

    const servers = (base.servers || [])
        .map((server, serverIndex) => normalizeServer(server, serverIndex))
        .filter((server) => server.name);

    const structure = {
        servers: servers.length ? servers : structuredClone(DEFAULT_STRUCTURE.servers),
        settings: {
            ...DEFAULT_STRUCTURE.settings,
            ...(base.settings || {}),
            photoCollections: Array.isArray(base.settings?.photoCollections) ? base.settings.photoCollections : []
        }
    };

    if (structure.servers.every((server) => allChannels(server).length === 0)) {
        structure.servers[0].categories[0].channels.push({
            id: channelKey(structure.servers[0].id, "general"),
            name: "general"
        });
    }

    return structure;
}

function normalizeServer(server, serverIndex) {
    const serverId = server.id || slugify(server.name || `server-${serverIndex + 1}`);
    const legacyChannels = server.channels || [];
    const rawCategories = server.categories?.length
        ? server.categories
        : [{ id: `${serverId}:general`, name: "General", collapsed: false, channels: legacyChannels }];

    return {
        id: serverId,
        name: server.name || "Untitled",
        categories: rawCategories.map((category, categoryIndex) => ({
            id: category.id || `${serverId}:${slugify(category.name || `category-${categoryIndex + 1}`)}`,
            name: category.name || "General",
            collapsed: Boolean(category.collapsed),
            hidden: Boolean(category.hidden),
            channels: (category.channels || []).map((channel, channelIndex) => {
                const name = typeof channel === "string"
                    ? channel
                    : channel.name || `channel-${channelIndex + 1}`;

                return {
                    id: typeof channel === "string"
                        ? channelKey(serverId, name)
                        : channel.id || channelKey(serverId, name),
                    name,
                    hidden: Boolean(channel.hidden),
                    isInboxChannel: Boolean(channel.isInboxChannel),
                    isSavedArrayChannel: Boolean(channel.isSavedArrayChannel)
                };
            })
        }))
    };
}

function ensureInboxChannel() {
    let changed = false;
    state.structure.servers.forEach((server) => {
        let inbox = allChannels(server).find((channel) => channel.isInboxChannel || channel.name === "inbox");
        if (inbox) {
            if (!inbox.isInboxChannel) {
                inbox.isInboxChannel = true;
                changed = true;
            }
            return;
        }
        const category = server.categories[0];
        if (category) {
            category.channels.unshift({ id: uniqueId("channel", "inbox"), name: "inbox", isInboxChannel: true });
            changed = true;
        }
    });
    return changed;
}

function selectInitialChannel() {
    const server = getActiveServer() || state.structure.servers[0];
    state.activeServerId = server.id;

    const channel = allChannels(server).find((item) => item.id === state.activeChannelId) || allChannels(server)[0];
    state.activeChannelId = channel?.id || null;
    state.activeView = state.activeChannelId
        ? { type: "channel", id: state.activeChannelId }
        : { type: "settings", id: "settings" };
}

async function loadActiveChannelMessages() {
    if (!state.activeChannelId) return;

    const rawMessages = await getChannelMessages(state.activeChannelId);
    state.messagesByChannel.set(state.activeChannelId, normalizeMessages(rawMessages));
    state.visibleMessageLimit = 100;
}

function normalizeMessages(messages) {
    return (messages || []).map((message) => {
        if (typeof message === "string") {
            return createMessage(message, []);
        }

        return {
            id: message.id || crypto.randomUUID(),
            text: message.text || "",
            createdAt: message.createdAt || new Date().toISOString(),
            pinned: Boolean(message.pinned),
            reactions: Array.isArray(message.reactions) ? [...new Set(message.reactions)] : [],
            tags: Array.isArray(message.tags) ? message.tags : extractTags(message.text || ""),
            attachments: Array.isArray(message.attachments) ? message.attachments : []
        };
    });
}

function getActiveServer() {
    return state.structure.servers.find((server) => server.id === state.activeServerId);
}

function getActiveCategory() {
    const server = getActiveServer();
    return server?.categories.find((category) => (
        category.channels.some((channel) => channel.id === state.activeChannelId)
    ));
}

function getActiveChannel() {
    return getActiveCategory()?.channels.find((channel) => channel.id === state.activeChannelId);
}

function getAllChannels() {
    return state.structure.servers.flatMap((server) => (
        server.categories.flatMap((category) => category.channels)
    ));
}

function getChannelById(channelId) {
    return getAllChannels().find((channel) => channel.id === channelId);
}

function getChannelCategory(channelId) {
    return state.structure.servers
        .flatMap((server) => server.categories)
        .find((category) => category.channels.some((channel) => channel.id === channelId));
}

function getChannelServer(channelId) {
    return state.structure.servers.find((server) => (
        server.categories.some((category) => category.channels.some((channel) => channel.id === channelId))
    ));
}

function getActiveMessages() {
    return state.messagesByChannel.get(state.activeChannelId) || [];
}

async function ensureServerMessagesLoaded() {
    const channels = getAllChannels();
    await Promise.all(channels.map(async (channel) => {
        if (!state.messagesByChannel.has(channel.id)) {
            const rawMessages = await getChannelMessages(channel.id);
            state.messagesByChannel.set(channel.id, normalizeMessages(rawMessages));
        }
    }));
}

function allChannels(server = getActiveServer()) {
    return server?.categories.flatMap((category) => category.channels) || [];
}

function render() {
    renderServers();
    renderChannels();
    renderHeader();
    renderMessages();
    renderComposer();
    renderUtilityPanel();
}

function renderServers() {
    els.servers.innerHTML = "";

    state.structure.servers.forEach((server) => {
        const button = document.createElement("button");
        button.className = `server ${server.id === state.activeServerId ? "active" : ""}`;
        button.type = "button";
        button.textContent = initials(server.name);
        button.title = server.name;

        button.addEventListener("click", async () => {
            state.activeServerId = server.id;
            state.activeChannelId = allChannels(server)[0]?.id || null;
            state.activeView = state.activeChannelId
                ? { type: "channel", id: state.activeChannelId }
                : { type: "settings", id: "settings" };
            await loadActiveChannelMessages();
            render();
            showMobileStage("sidebar");
        });

        els.servers.appendChild(button);
    });
}

function renderChannels() {
    els.channels.innerHTML = "";
    const server = getActiveServer();

    if (!server) {
        els.channels.appendChild(emptyPanel("No channels yet"));
        return;
    }

    els.channels.appendChild(renderSpecialViews());

    if (allChannels(server).length === 0) {
        els.channels.appendChild(emptyPanel("No channels yet"));
    }

    server.categories.filter((category) => !category.hidden).forEach((category) => {
        const group = document.createElement("section");
        group.className = "category";

        const headerRow = document.createElement("div");
        headerRow.className = "categoryHeaderRow";
        const header = document.createElement("button");
        header.className = "categoryHeader";
        header.type = "button";
        header.innerHTML = `<span>${category.collapsed ? ">" : "v"}</span><strong>${escapeHTML(category.name)}</strong>`;
        header.addEventListener("click", async () => {
            category.collapsed = !category.collapsed;
            await saveStructure(state.structure);
            renderChannels();
        });

        const rename = categoryTool("Rename folder", "Edit", () => renameCategory(category.id));
        const hide = categoryTool("Hide folder", "Hide", () => setCategoryHidden(category.id, true));
        const remove = categoryTool("Delete folder", "Delete", () => deleteCategory(category.id), "danger");
        headerRow.append(header, rename, hide, remove);
        group.appendChild(headerRow);

        if (!category.collapsed) {
            category.channels.filter((channel) => !channel.hidden).forEach((channel) => {
                group.appendChild(renderChannelRow(channel));
            });

            const hiddenChannels = category.channels.filter((channel) => channel.hidden);
            if (hiddenChannels.length > 0) {
                group.appendChild(renderHiddenChannels(category, hiddenChannels));
            }
        }

        els.channels.appendChild(group);
    });

    const hiddenCategories = server.categories.filter((category) => category.hidden);
    if (hiddenCategories.length > 0) {
        const group = document.createElement("section");
        group.className = "category hiddenCategoryList";
        group.appendChild(staticCategoryHeader(`Hidden folders (${hiddenCategories.length})`));
        hiddenCategories.forEach((category) => {
            const restore = document.createElement("button");
            restore.className = "restoreHidden";
            restore.type = "button";
            restore.textContent = `Show ${category.name}`;
            restore.addEventListener("click", () => setCategoryHidden(category.id, false));
            group.appendChild(restore);
        });
        els.channels.appendChild(group);
    }

    const emojis = getReactionEmojis();
    if (emojis.length > 0) {
        const group = document.createElement("section");
        group.className = "category";
        group.appendChild(staticCategoryHeader("Emoji collections"));

        emojis.forEach((emoji) => {
            group.appendChild(renderSmartChannelRow({
                id: emoji,
                type: "emoji",
                label: emoji,
                prefix: emoji,
                title: `${emoji} reactions`
            }));
        });

        els.channels.appendChild(group);
    }

    const collections = getServerCollections();
    if (collections.length > 0) {
        const group = document.createElement("section");
        group.className = "category";
        group.appendChild(staticCategoryHeader("Photo collections"));
        collections.forEach((collection) => {
            group.appendChild(renderSmartChannelRow({
                id: collection.id,
                type: "collection",
                label: collection.name,
                prefix: "@",
                title: `${collection.name} photo collection`
            }));
        });
        els.channels.appendChild(group);
    }
}

function categoryTool(title, text, handler, modifier = "") {
    const button = document.createElement("button");
    button.className = `categoryTool ${modifier}`;
    button.type = "button";
    button.title = title;
    button.textContent = text;
    button.addEventListener("click", handler);
    return button;
}

function renderHiddenChannels(category, channels) {
    const details = document.createElement("details");
    details.className = "hiddenChannels";
    const summary = document.createElement("summary");
    summary.textContent = `Hidden channels (${channels.length})`;
    details.appendChild(summary);
    channels.forEach((channel) => {
        const restore = document.createElement("button");
        restore.className = "restoreHidden";
        restore.type = "button";
        restore.textContent = `Show #${channel.name}`;
        restore.addEventListener("click", () => setChannelHidden(category.id, channel.id, false));
        details.appendChild(restore);
    });
    return details;
}

function renderSpecialViews() {
    const group = document.createElement("section");
    group.className = "category";
    group.appendChild(staticCategoryHeader("Workspace"));
    group.appendChild(renderSmartChannelRow({
        id: "pinned",
        type: "pinned",
        label: "pinned",
        prefix: "*",
        title: "Pinned notes"
    }));
    group.appendChild(renderSmartChannelRow({
        id: "settings",
        type: "settings",
        label: "organization settings",
        prefix: "!",
        title: "Organization settings"
    }));
    if (state.randomPhotoArray.length > 0) {
        group.appendChild(renderSmartChannelRow({
            id: "random-photo-array",
            type: "randomArray",
            label: "random photo array",
            prefix: "~",
            title: "Temporary random photo array"
        }));
    }
    return group;
}

function staticCategoryHeader(name) {
    const header = document.createElement("div");
    header.className = "categoryHeader staticCategoryHeader";
    header.innerHTML = `<span>v</span><strong>${escapeHTML(name)}</strong>`;
    return header;
}

function renderSmartChannelRow(view) {
    const row = document.createElement("div");
    row.className = `channelRow smartChannel ${isActiveView(view.type, view.id) ? "active" : ""}`;

    const select = document.createElement("button");
    select.className = "channel";
    select.type = "button";
    const labelHTML = view.prefix === view.label
        ? `<span>${escapeHTML(view.label)}</span>`
        : `<span class="hash">${escapeHTML(view.prefix)}</span><span>${escapeHTML(view.label)}</span>`;
    select.innerHTML = labelHTML;
    select.addEventListener("click", async () => {
        await openView(view.type, view.id);
    });

    row.appendChild(select);
    return row;
}

function renderChannelRow(channel) {
    const row = document.createElement("div");
    row.className = `channelRow ${isActiveView("channel", channel.id) ? "active" : ""}`;

    const select = document.createElement("button");
    select.className = "channel";
    select.type = "button";
    select.innerHTML = `<span class="hash">#</span><span>${escapeHTML(channel.name)}</span>`;
    select.addEventListener("click", async () => {
        if (isActiveView("channel", channel.id)) {
            showMobileStage("chat");
            return;
        }

        state.activeChannelId = channel.id;
        state.activeView = { type: "channel", id: channel.id };
        state.selectedPhotoRefs = [];
        await loadActiveChannelMessages();
        render();
        showMobileStage("chat");
    });

    const rename = document.createElement("button");
    rename.className = "channelTool";
    rename.type = "button";
    rename.textContent = "Edit";
    rename.title = "Rename channel";
    rename.addEventListener("click", () => renameChannel(channel.id));

    const hide = document.createElement("button");
    hide.className = "channelTool";
    hide.type = "button";
    hide.textContent = "Hide";
    hide.title = "Hide channel";
    hide.addEventListener("click", () => setChannelHidden(getChannelCategory(channel.id)?.id, channel.id, true));

    const random = document.createElement("button");
    random.className = "channelTool";
    random.type = "button";
    random.textContent = "?";
    random.title = "Random note in this channel";
    random.addEventListener("click", async () => {
        await selectRandomMessage(channel.id);
    });

    const remove = document.createElement("button");
    remove.className = "channelTool danger";
    remove.type = "button";
    remove.textContent = "x";
    remove.title = "Delete channel";
    remove.addEventListener("click", () => deleteChannel(channel.id));

    row.append(select, rename, hide, random, remove);
    return row;
}

async function openView(type, id) {
    state.activeView = { type, id };
    state.selectedPhotoRefs = [];

    if (type === "channel") {
        state.activeChannelId = id;
        state.activeServerId = getChannelServer(id)?.id || state.activeServerId;
        await loadActiveChannelMessages();
    } else {
        await ensureServerMessagesLoaded();
    }

    render();
    showMobileStage("chat");
}

function openSettings() {
    openView("settings", "settings");
}

function isActiveView(type, id) {
    return state.activeView.type === type && state.activeView.id === id;
}

function renderHeader() {
    const isRandomArray = state.activeView.type === "randomArray";
    els.saveRandomArrayBtn.hidden = !isRandomArray;
    els.saveRandomArrayBtn.disabled = !isRandomArray || state.randomPhotoArray.length === 0;
    els.lockWorkspaceBtn.hidden = !state.isUnlocked;

    if (state.activeView.type === "settings") {
        els.activeTitle.textContent = "Organization settings";
        els.activeMeta.textContent = "Manage categories and create channels";
        return;
    }

    if (state.activeView.type === "pinned") {
        const messages = getPinnedEntries();
        els.activeTitle.textContent = "Pinned notes";
        els.activeMeta.textContent = `${messages.length} pinned in ${getActiveServer()?.name || "this server"}`;
        return;
    }

    if (state.activeView.type === "emoji") {
        const messages = getEmojiEntries(state.activeView.id);
        els.activeTitle.textContent = `${state.activeView.id} reactions`;
        els.activeMeta.textContent = `${messages.length} notes, images, and links in ${getActiveServer()?.name || "this server"}`;
        return;
    }

    if (state.activeView.type === "collection") {
        const collection = getServerCollections().find((item) => item.id === state.activeView.id);
        els.activeTitle.textContent = collection ? `@ ${collection.name}` : "Photo collection";
        els.activeMeta.textContent = `${getCollectionEntries(state.activeView.id).length} referenced photos · no duplicate files`;
        return;
    }

    if (isRandomArray) {
        els.activeTitle.textContent = "Random photo array";
        els.activeMeta.textContent = `${state.randomPhotoArray.length} random photos · temporary until saved`;
        return;
    }

    const channel = getActiveChannel();
    const category = getActiveCategory();
    const messages = getActiveMessages();
    const pinnedCount = messages.filter((message) => message.pinned).length;

    els.activeTitle.textContent = channel ? `# ${channel.name}` : "No channel selected";
    els.activeMeta.textContent = channel
        ? `${category?.name || "General"} · ${messages.length} notes · ${pinnedCount} pinned · local only`
        : "Create a channel to start";
}

function renderMessages() {
    els.messages.innerHTML = "";

    if (state.error) {
        els.messages.appendChild(emptyPanel(state.error));
        return;
    }

    if (!state.ready) {
        els.messages.appendChild(emptyPanel("Loading notes"));
        return;
    }

    if (!state.isUnlocked) {
        els.messages.appendChild(emptyPanel("Locked"));
        return;
    }

    if (state.activeView.type === "settings") {
        renderSettingsPage();
        return;
    }

    const allMessages = getVisibleMessages();
    const messages = allMessages.slice(-state.visibleMessageLimit);

    if (messages.length === 0) {
        els.messages.appendChild(emptyPanel(state.search ? "No matching notes" : "No notes yet"));
        return;
    }

    if (usesPhotoGrid()) {
        renderPhotoGrid(messages);
    } else {
        messages.forEach((entry) => {
            els.messages.appendChild(renderMessage(entry.message || entry, entry.channelId));
        });
    }

    if (allMessages.length > messages.length) {
        const older = document.createElement("button");
        older.className = "loadOlder";
        older.type = "button";
        older.textContent = `Show ${Math.min(100, allMessages.length - messages.length)} older notes`;
        older.addEventListener("click", () => {
            state.visibleMessageLimit += 100;
            renderMessages();
        });
        els.messages.prepend(older);
    }

    els.messages.scrollTop = els.messages.scrollHeight;
}

function usesPhotoGrid() {
    return state.activeView.type === "randomArray"
        || state.activeView.type === "collection"
        || (state.activeView.type === "channel" && Boolean(state.structure.settings.photoGridEnabled));
}

function renderPhotoGrid(entries) {
    const imageEntries = entries.flatMap((entry) => {
        const message = entry.message || entry;
        return (message.attachments || [])
            .filter((attachment) => attachment.type?.startsWith("image/"))
            .map((attachment) => ({ message, attachment, channelId: entry.channelId || state.activeChannelId }));
    });

    if (imageEntries.length > 0) {
        const grid = document.createElement("section");
        grid.className = "photoGrid";
        grid.setAttribute("aria-label", "Photo gallery");
        imageEntries.forEach(({ message, attachment, channelId }) => grid.appendChild(renderPhotoTile(message, attachment, channelId)));
        els.messages.appendChild(grid);
    }

    renderBatchActions();

    entries
        .map((entry) => entry.message || entry)
        .filter((message) => !message.attachments?.some((attachment) => attachment.type?.startsWith("image/")))
        .forEach((message) => els.messages.appendChild(renderMessage(message)));
}

function renderPhotoTile(message, attachment, channelId) {
    const figure = document.createElement("figure");
    figure.className = "photoTile";
    figure.title = "Tap to view fullscreen";

    const image = document.createElement("img");
    const objectUrl = attachment.blob ? URL.createObjectURL(attachment.blob) : "";
    image.src = objectUrl || attachment.dataUrl || "";
    image.alt = attachment.name || message.text || "Local photo";
    image.loading = "lazy";
    if (objectUrl) {
        image.addEventListener("load", () => URL.revokeObjectURL(objectUrl), { once: true });
        image.addEventListener("error", () => URL.revokeObjectURL(objectUrl), { once: true });
    }

    const caption = document.createElement("figcaption");
    const source = message.arraySourceName ? `#${message.arraySourceName} · ` : "";
    caption.textContent = attachment.note || message.text || `${source}${attachment.name || "Local photo"} · ${formatDate(message.createdAt)}`;
    figure.append(image, caption);
    if (canSelectPhotos()) {
        const ref = { channelId, messageId: message.id, attachmentId: attachment.id };
        const key = photoRefKey(ref);
        const selector = document.createElement("input");
        selector.className = "photoSelector";
        selector.type = "checkbox";
        selector.checked = state.selectedPhotoRefs.some((item) => photoRefKey(item) === key);
        selector.setAttribute("aria-label", "Select photo for batch actions");
        selector.addEventListener("click", (event) => event.stopPropagation());
        selector.addEventListener("change", () => togglePhotoSelection(ref, selector.checked));
        figure.appendChild(selector);
    }
    figure.addEventListener("click", () => requestFullscreenForElement(figure));
    return figure;
}

function canSelectPhotos() {
    return ["channel", "collection", "randomArray"].includes(state.activeView.type);
}

function renderBatchActions() {
    if (state.selectedPhotoRefs.length === 0 || !canSelectPhotos()) return;
    const bar = document.createElement("div");
    bar.className = "batchActions";
    const label = document.createElement("span");
    label.textContent = `${state.selectedPhotoRefs.length} selected`;
    const add = document.createElement("button");
    add.type = "button";
    add.textContent = "Add to collection";
    add.addEventListener("click", () => addPhotosToCollection(state.selectedPhotoRefs));
    const clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = "Clear";
    clear.addEventListener("click", () => {
        state.selectedPhotoRefs = [];
        renderMessages();
    });
    bar.append(label, add, clear);
    els.messages.prepend(bar);
}

function renderSettingsPage() {
    const server = getActiveServer();
    const page = document.createElement("section");
    page.className = "settingsPage";

    const intro = document.createElement("div");
    intro.className = "settingsIntro";
    intro.innerHTML = `<h3>${escapeHTML(server?.name || "Workspace")}</h3><p>Organize channels under categories. Everything is saved in this browser on this device.</p>`;
    page.appendChild(intro);

    server.categories.forEach((category) => {
        const section = document.createElement("section");
        section.className = "settingsCategory";

        const header = document.createElement("div");
        header.className = "settingsCategoryHeader";
        header.innerHTML = `<h4>${escapeHTML(category.name)}</h4><span>${category.channels.length} channels</span>`;

        const add = document.createElement("button");
        add.type = "button";
        add.textContent = "Create channel";
        add.addEventListener("click", () => createChannelInCategory(category.id));
        header.appendChild(add);

        const list = document.createElement("div");
        list.className = "settingsChannelList";

        if (category.channels.length === 0) {
            list.appendChild(emptyPanel("No channels in this category"));
        } else {
            category.channels.forEach((channel) => {
                const row = document.createElement("div");
                row.className = "settingsChannelRow";
                row.innerHTML = `<span># ${escapeHTML(channel.name)}</span>`;

                const open = document.createElement("button");
                open.type = "button";
                open.textContent = "Open";
                open.addEventListener("click", () => openView("channel", channel.id));
                row.appendChild(open);
                list.appendChild(row);
            });
        }

        section.append(header, list);
        page.appendChild(section);
    });

    els.messages.appendChild(page);
}

function renderMessage(message, sourceChannelId = state.activeChannelId) {
    const article = document.createElement("article");
    article.className = `message ${message.pinned ? "pinned" : ""}`;
    article.dataset.messageId = message.id;

    const header = document.createElement("div");
    header.className = "messageHeader";

    const meta = document.createElement("div");
    meta.className = "messageMeta";
    const sourceChannel = sourceChannelId && (sourceChannelId !== state.activeChannelId || state.activeView.type !== "channel")
        ? getChannelById(sourceChannelId)
        : null;
    meta.textContent = sourceChannel
        ? `# ${sourceChannel.name} · ${formatDate(message.createdAt)}`
        : formatDate(message.createdAt);

    const actions = document.createElement("div");
    actions.className = "messageActions";

    const pinButton = document.createElement("button");
    pinButton.className = "iconButton";
    pinButton.type = "button";
    pinButton.textContent = message.pinned ? "Unpin" : "Pin";
    pinButton.addEventListener("click", () => togglePin(message.id, sourceChannelId));

    const reactButton = document.createElement("button");
    reactButton.className = "iconButton";
    reactButton.type = "button";
    reactButton.textContent = "React";
    reactButton.addEventListener("click", () => addReaction(message.id, sourceChannelId));

    const deleteButton = document.createElement("button");
    deleteButton.className = "iconButton danger";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteMessage(message.id, sourceChannelId));

    if (getChannelById(sourceChannelId)?.isInboxChannel) {
        const moveButton = document.createElement("button");
        moveButton.className = "iconButton";
        moveButton.type = "button";
        moveButton.textContent = "Move";
        moveButton.addEventListener("click", () => moveInboxMessage(message.id, sourceChannelId));
        actions.append(pinButton, reactButton, moveButton, deleteButton);
    } else {
        actions.append(pinButton, reactButton, deleteButton);
    }
    header.append(meta, actions);
    article.appendChild(header);

    if (message.text) {
        const text = document.createElement("p");
        text.className = "messageText";
        text.textContent = message.text;
        article.appendChild(text);
    }

    renderAttachments(message.attachments, message, sourceChannelId).forEach((attachment) => article.appendChild(attachment));

    const url = firstURL(message.text);
    const embed = createEmbed(url);

    if (embed) {
        const wrap = document.createElement("div");
        wrap.className = "embedWrap";

        const header = document.createElement("div");
        header.className = "embedHeader";

        const sourceLabel = document.createElement("div");
        sourceLabel.className = "sourceLabel";
        sourceLabel.textContent = url;

        const openBtn = document.createElement("button");
        openBtn.type = "button";
        openBtn.className = "embedOpen";
        openBtn.title = "Open link";
        openBtn.textContent = "Open";
        openBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            window.open(url, "_blank");
        });

        const fullscreenBtn = document.createElement("button");
        fullscreenBtn.type = "button";
        fullscreenBtn.className = "embedFullscreen";
        fullscreenBtn.title = "Enter fullscreen";
        fullscreenBtn.textContent = "Fullscreen";
        fullscreenBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            requestFullscreenForElement(wrap);
        });

        header.append(sourceLabel, fullscreenBtn, openBtn);
        wrap.append(header, embed);

        if (["video", "audio"].includes(embed.tagName?.toLowerCase()) && state.structure.settings.discordEmbedControls) {
            wrap.classList.add("discordMediaEmbed");
            wrap.appendChild(createDiscordMediaControls(embed, wrap));
        }

        // Prevent clicks on the embed wrapper from causing navigation outside the embed.
        wrap.addEventListener("click", (e) => e.stopPropagation());

        // Prevent clicks on the media element from bubbling to surrounding elements.
        try {
            const tag = embed.tagName?.toLowerCase();
            if (tag === "video" || tag === "audio") {
                embed.addEventListener("click", (e) => e.stopPropagation());
                embed.addEventListener("play", (e) => e.stopPropagation());
                embed.addEventListener("pause", (e) => e.stopPropagation());
            }
        } catch (e) {
            // ignore if embed is cross-origin iframe or unexpected
        }

        article.appendChild(wrap);
    } else if (url) {
        const link = document.createElement("a");
        link.className = "sourceLink";
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = url;
        article.appendChild(link);
    }

    if (message.tags.length > 0) {
        const tags = document.createElement("div");
        tags.className = "tags";

        message.tags.forEach((tag) => {
            const chip = document.createElement("button");
            chip.className = "tag";
            chip.type = "button";
            chip.textContent = `#${tag}`;
            chip.addEventListener("click", () => {
                els.searchInput.value = `#${tag}`;
                state.search = `#${tag}`;
                renderMessages();
            });
            tags.appendChild(chip);
        });

        article.appendChild(tags);
    }

    if (message.reactions?.length > 0) {
        const reactions = document.createElement("div");
        reactions.className = "reactions";

        message.reactions.forEach((emoji) => {
            const chip = document.createElement("button");
            chip.className = "reactionChip";
            chip.type = "button";
            chip.textContent = emoji;
            chip.title = `Open ${emoji} reactions`;
            chip.addEventListener("click", () => openView("emoji", emoji));
            reactions.appendChild(chip);
        });

        article.appendChild(reactions);
    }

    return article;
}

function renderAttachments(attachments, message, channelId) {
    return attachments.map((attachment) => {
        if (attachment.type?.startsWith("image/")) {
            const figure = document.createElement("figure");
            figure.className = "imageAttachment";
            figure.title = "Click to view fullscreen";

            const image = document.createElement("img");
            const objectUrl = attachment.blob ? URL.createObjectURL(attachment.blob) : "";
            image.src = objectUrl || attachment.dataUrl || "";
            if (objectUrl) {
                image.addEventListener("load", () => URL.revokeObjectURL(objectUrl), { once: true });
                image.addEventListener("error", () => URL.revokeObjectURL(objectUrl), { once: true });
            }
            image.alt = attachment.name || "Pasted image";
            image.loading = "lazy";

            const caption = document.createElement("figcaption");
            caption.textContent = attachment.note || `${attachment.name || "Local image"} · ${formatBytes(attachment.size || 0)}`;

            const noteButton = document.createElement("button");
            noteButton.className = "imageNoteButton";
            noteButton.type = "button";
            noteButton.textContent = attachment.note ? "Edit image note" : "Add image note";
            noteButton.addEventListener("click", (event) => {
                event.stopPropagation();
                editAttachmentNote(message.id, attachment.id, channelId);
            });

            const collectionButton = document.createElement("button");
            collectionButton.className = "imageNoteButton";
            collectionButton.type = "button";
            collectionButton.textContent = "Add to collection";
            collectionButton.addEventListener("click", (event) => {
                event.stopPropagation();
                addPhotosToCollection([{ channelId, messageId: message.id, attachmentId: attachment.id }]);
            });

            figure.append(image, caption, noteButton, collectionButton);
            figure.addEventListener("click", () => requestFullscreenForElement(figure));
            return figure;
        }

        const fallback = document.createElement("div");
        fallback.className = "fileAttachment";
        fallback.textContent = attachment.name || "Local file";
        return fallback;
    });
}

function renderComposer() {
    const hasChannel = Boolean(state.activeChannelId);
    const enabled = state.ready && state.isUnlocked && hasChannel && state.activeView.type === "channel";
    els.noteInput.disabled = !enabled;
    els.sendBtn.disabled = !enabled;
    els.attachImageBtn.disabled = !enabled;
    els.newChannelBtn.disabled = !state.ready || !state.isUnlocked;
    els.newCategoryBtn.disabled = !state.ready || !state.isUnlocked;
    els.deleteChannelBtn.disabled = !enabled;
    els.randomChannelBtn.disabled = !state.ready || !state.isUnlocked || allChannels().length === 0;
    els.randomMessageBtn.disabled = !enabled;
    els.randomPhotoArrayBtn.disabled = !state.ready || !state.isUnlocked;

    els.attachmentPreview.innerHTML = "";
    state.draftAttachments.forEach((attachment) => {
        const chip = document.createElement("button");
        chip.className = "attachmentChip";
        chip.type = "button";
        chip.textContent = `${attachment.name || "image"} x`;
        chip.title = "Remove image";
        chip.addEventListener("click", () => {
            state.draftAttachments = state.draftAttachments.filter((item) => item.id !== attachment.id);
            renderComposer();
        });
        els.attachmentPreview.appendChild(chip);
    });
}

function renderUtilityPanel() {
    els.storageInfo.textContent = state.storageText;
    els.randomNumberResult.textContent = state.randomNumberText;
    els.randomTextResult.textContent = state.randomText;

    els.savedRandomList.innerHTML = "";
    const randomTexts = state.structure.settings.randomTexts || [];
    randomTexts.forEach((text) => {
        const chip = document.createElement("button");
        chip.className = "savedTextChip";
        chip.type = "button";
        chip.textContent = text;
        chip.title = "Remove saved text";
        chip.addEventListener("click", async () => {
            state.structure.settings.randomTexts = randomTexts.filter((item) => item !== text);
            await saveStructure(state.structure);
            renderUtilityPanel();
        });
        els.savedRandomList.appendChild(chip);
    });
}

function getVisibleMessages() {
    if (state.activeView.type === "collection") {
        return getCollectionEntries(state.activeView.id);
    }

    if (state.activeView.type === "randomArray") {
        return state.randomPhotoArray.map((item) => ({
            channelId: item.channelId,
            message: {
                ...item.message,
                attachments: [item.attachment],
                arraySourceName: getChannelById(item.channelId)?.name || "saved channel"
            }
        }));
    }

    if (state.activeView.type === "pinned") {
        return filterEntries(getPinnedEntries());
    }

    if (state.activeView.type === "emoji") {
        return filterEntries(getEmojiEntries(state.activeView.id));
    }

    const messages = getActiveMessages();
    const ordered = [...messages].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(a.createdAt) - new Date(b.createdAt);
    });

    if (!state.search) {
        return ordered;
    }

    return ordered.filter((message) => {
        const searchable = [
            message.text,
            message.tags.map((tag) => `#${tag}`).join(" "),
            message.attachments.map((attachment) => attachment.name).join(" ")
        ].join(" ").toLowerCase();
        return searchable.includes(state.search);
    });
}

function getPinnedEntries() {
    return getServerEntries()
        .filter((entry) => entry.message.pinned)
        .sort((a, b) => new Date(a.message.createdAt) - new Date(b.message.createdAt));
}

function getEmojiEntries(emoji) {
    return getServerEntries()
        .filter((entry) => entry.message.reactions?.includes(emoji))
        .sort((a, b) => new Date(a.message.createdAt) - new Date(b.message.createdAt));
}

function getWorkspaceEntries() {
    return getAllChannels().flatMap((channel) => (
        (state.messagesByChannel.get(channel.id) || []).map((message) => ({
            channelId: channel.id,
            message
        }))
    ));
}

function getServerEntries(server = getActiveServer()) {
    return allChannels(server).flatMap((channel) => (
        (state.messagesByChannel.get(channel.id) || []).map((message) => ({
            channelId: channel.id,
            message
        }))
    ));
}

function getReactionEmojis() {
    return [...new Set(getServerEntries().flatMap((entry) => entry.message.reactions || []))];
}

function getServerCollections(server = getActiveServer()) {
    return (state.structure.settings.photoCollections || []).filter((collection) => collection.serverId === server?.id);
}

function getCollectionEntries(collectionId) {
    const collection = getServerCollections().find((item) => item.id === collectionId);
    return (collection?.photoRefs || []).flatMap((ref) => {
        const message = (state.messagesByChannel.get(ref.channelId) || []).find((item) => item.id === ref.messageId);
        const attachment = message?.attachments.find((item) => item.id === ref.attachmentId);
        return attachment ? [{
            channelId: ref.channelId,
            message: { ...message, attachments: [attachment] }
        }] : [];
    });
}

function photoRefKey(ref) {
    return `${ref.channelId}:${ref.messageId}:${ref.attachmentId}`;
}

function togglePhotoSelection(ref, selected) {
    const key = photoRefKey(ref);
    state.selectedPhotoRefs = selected
        ? [...state.selectedPhotoRefs.filter((item) => photoRefKey(item) !== key), ref]
        : state.selectedPhotoRefs.filter((item) => photoRefKey(item) !== key);
    renderMessages();
}

async function addPhotosToCollection(refs) {
    if (refs.length === 0) return;
    const collections = getServerCollections();
    const choices = collections.map((item, index) => `${index + 1}. ${item.name}`).join("\n");
    const response = prompt(`Add ${refs.length} photo${refs.length === 1 ? "" : "s"} to a collection.\n${choices ? `${choices}\n` : ""}Type a number, or a new collection name.`);
    if (!response?.trim()) return;

    const selected = Number.parseInt(response, 10);
    let collection = collections[selected - 1];
    if (!collection) {
        const name = normalizeDisplayName(response);
        if (!name) return;
        collection = {
            id: uniqueId("collection", name),
            serverId: getActiveServer()?.id,
            name,
            photoRefs: []
        };
        state.structure.settings.photoCollections.push(collection);
    }

    const existing = new Set((collection.photoRefs || []).map(photoRefKey));
    collection.photoRefs = [...(collection.photoRefs || []), ...refs.filter((ref) => !existing.has(photoRefKey(ref)))];
    state.selectedPhotoRefs = [];
    await saveStructure(state.structure);
    render();
}

function filterEntries(entries) {
    if (!state.search) return entries;

    return entries.filter((entry) => {
        const channel = getChannelById(entry.channelId);
        const message = entry.message;
        const searchable = [
            channel?.name,
            message.text,
            message.reactions?.join(" "),
            message.tags.map((tag) => `#${tag}`).join(" "),
            message.attachments.map((attachment) => attachment.name).join(" ")
        ].join(" ").toLowerCase();
        return searchable.includes(state.search);
    });
}

async function sendMessage() {
    const text = els.noteInput.value.trim();

    if (
        (!text && state.draftAttachments.length === 0)
        || !state.activeChannelId
        || !state.ready
        || state.activeView.type !== "channel"
    ) {
        return;
    }

    const messages = [...getActiveMessages(), createMessage(text, state.draftAttachments)];
    state.messagesByChannel.set(state.activeChannelId, messages);
    state.draftAttachments = [];
    state.visibleMessageLimit = 100;
    els.noteInput.value = "";
    render();

    await saveChannelMessages(state.activeChannelId, messages);
    refreshStorageEstimate();
}

async function createServer() {
    const rawName = prompt("Workspace/server name?");
    const name = normalizeDisplayName(rawName);
    if (!name) return;

    const server = {
        id: uniqueId("server", name),
        name,
        categories: [
            {
                id: uniqueId("category", "general"),
                name: "General",
                collapsed: false,
                channels: [
                    { id: uniqueId("channel", "inbox"), name: "inbox", isInboxChannel: true },
                    { id: uniqueId("channel", "general"), name: "general" }
                ]
            }
        ]
    };

    state.structure.servers.push(server);
    state.activeServerId = server.id;
    state.activeChannelId = server.categories[0].channels[0].id;
    state.activeView = { type: "channel", id: state.activeChannelId };
    state.messagesByChannel.set(state.activeChannelId, []);

    await saveStructure(state.structure);
    render();
    showMobileStage("sidebar");
}

async function createCategory() {
    const server = getActiveServer();
    if (!server) return;

    const rawName = prompt("Category/folder name?");
    const name = normalizeDisplayName(rawName);
    if (!name) return;

    server.categories.push({
        id: uniqueId("category", name),
        name,
        collapsed: false,
        channels: []
    });

    await saveStructure(state.structure);
    render();
}

async function renameCategory(categoryId) {
    const category = getActiveServer()?.categories.find((item) => item.id === categoryId);
    if (!category) return;

    const name = normalizeDisplayName(prompt("Folder name?", category.name));
    if (!name || name === category.name) return;
    category.name = name;
    await saveStructure(state.structure);
    render();
}

async function setCategoryHidden(categoryId, hidden) {
    const server = getActiveServer();
    const category = server?.categories.find((item) => item.id === categoryId);
    if (!category) return;

    category.hidden = hidden;
    if (hidden && category.channels.some((channel) => channel.id === state.activeChannelId)) {
        await selectVisibleChannel(server);
    }
    await saveStructure(state.structure);
    render();
}

async function deleteCategory(categoryId) {
    const server = getActiveServer();
    const category = server?.categories.find((item) => item.id === categoryId);
    if (!category) return;

    const count = category.channels.length;
    const confirmed = confirm(`Delete folder ${category.name}? This permanently deletes its ${count} channel${count === 1 ? "" : "s"} and all notes and photos inside.`);
    if (!confirmed) return;

    await Promise.all(category.channels.map((channel) => deleteChannelMessages(channel.id)));
    category.channels.forEach((channel) => state.messagesByChannel.delete(channel.id));
    server.categories = server.categories.filter((item) => item.id !== categoryId);

    if (server.categories.length === 0) {
        server.categories.push({
            id: uniqueId("category", "general"),
            name: "General",
            collapsed: false,
            hidden: false,
            channels: []
        });
    }

    if (!getChannelById(state.activeChannelId)) {
        await selectVisibleChannel(server);
    }
    await saveStructure(state.structure);
    render();
    refreshStorageEstimate();
}

async function createChannel() {
    await createChannelInCategory(getActiveCategory()?.id);
}

async function createChannelInCategory(categoryId) {
    const server = getActiveServer();
    if (!server) return;

    const rawName = prompt("Channel name?");
    const name = normalizeChannelName(rawName);

    if (!name) return;

    const existing = allChannels(server).find((channel) => channel.name.toLowerCase() === name.toLowerCase());
    if (existing) {
        state.activeChannelId = existing.id;
        state.activeView = { type: "channel", id: existing.id };
        await loadActiveChannelMessages();
        render();
        showMobileStage("chat");
        return;
    }

    const category = server.categories.find((item) => item.id === categoryId) || getActiveCategory() || server.categories[0];
    const channel = {
        id: uniqueId("channel", name),
        name
    };

    category.channels.push(channel);
    category.collapsed = false;
    state.activeChannelId = channel.id;
    state.activeView = { type: "channel", id: channel.id };
    state.messagesByChannel.set(channel.id, []);

    await saveStructure(state.structure);
    render();
    showMobileStage("chat");
}

async function renameChannel(channelId) {
    const server = getActiveServer();
    const channel = allChannels(server).find((item) => item.id === channelId);
    if (!channel) return;

    const name = normalizeChannelName(prompt("Channel name?", channel.name));
    if (!name || name === channel.name) return;
    const duplicate = allChannels(server).find((item) => item.id !== channelId && item.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
        alert("A channel with that name already exists in this workspace.");
        return;
    }

    channel.name = name;
    await saveStructure(state.structure);
    render();
}

async function setChannelHidden(categoryId, channelId, hidden) {
    const server = getActiveServer();
    const category = server?.categories.find((item) => item.id === categoryId);
    const channel = category?.channels.find((item) => item.id === channelId);
    if (!channel) return;

    channel.hidden = hidden;
    if (hidden && state.activeChannelId === channelId) {
        await selectVisibleChannel(server);
    }
    await saveStructure(state.structure);
    render();
}

async function selectVisibleChannel(server = getActiveServer()) {
    const channel = allChannels(server).find((item) => !item.hidden && !getChannelCategory(item.id)?.hidden);
    state.activeChannelId = channel?.id || null;
    state.activeView = state.activeChannelId
        ? { type: "channel", id: state.activeChannelId }
        : { type: "settings", id: "settings" };
    if (state.activeChannelId) {
        await loadActiveChannelMessages();
    }
}

async function deleteActiveChannel() {
    if (state.activeChannelId) {
        await deleteChannel(state.activeChannelId);
    }
}

async function deleteChannel(channelId) {
    const server = getActiveServer();
    if (!server) return;

    const channel = allChannels(server).find((item) => item.id === channelId);
    if (!channel) return;

    const confirmed = confirm(`Delete #${channel.name}? Notes in this channel will no longer appear.`);
    if (!confirmed) return;

    server.categories.forEach((category) => {
        category.channels = category.channels.filter((item) => item.id !== channelId);
    });

    state.messagesByChannel.delete(channelId);

    if (state.activeChannelId === channelId) {
        state.activeChannelId = allChannels(server)[0]?.id || null;
        state.activeView = state.activeChannelId
            ? { type: "channel", id: state.activeChannelId }
            : { type: "settings", id: "settings" };
        await loadActiveChannelMessages();
    }

    await deleteChannelMessages(channelId);
    await saveStructure(state.structure);
    render();
    refreshStorageEstimate();
}

async function togglePin(messageId, channelId = state.activeChannelId) {
    const messages = (state.messagesByChannel.get(channelId) || []).map((message) => (
        message.id === messageId
            ? { ...message, pinned: !message.pinned }
            : message
    ));

    state.messagesByChannel.set(channelId, messages);
    render();

    await saveChannelMessages(channelId, messages);
}

async function addReaction(messageId, channelId = state.activeChannelId) {
    const rawEmoji = prompt("Emoji reaction?");
    const emoji = normalizeEmoji(rawEmoji);
    if (!emoji) return;

    const messages = (state.messagesByChannel.get(channelId) || []).map((message) => {
        if (message.id !== messageId) return message;

        const reactions = Array.isArray(message.reactions) ? message.reactions : [];
        const has = reactions.includes(emoji);
        const newReactions = has
            ? reactions.filter((item) => item !== emoji)
            : [...new Set([...reactions, emoji])];

        return {
            ...message,
            reactions: newReactions
        };
    });

    state.messagesByChannel.set(channelId, messages);
    await saveChannelMessages(channelId, messages);
    render();
}

async function deleteMessage(messageId, channelId = state.activeChannelId) {
    const confirmed = confirm("Delete this note?");
    if (!confirmed) return;

    const messages = (state.messagesByChannel.get(channelId) || []).filter((message) => message.id !== messageId);

    state.messagesByChannel.set(channelId, messages);
    render();

    await saveChannelMessages(channelId, messages);
    refreshStorageEstimate();
}

async function editAttachmentNote(messageId, attachmentId, channelId = state.activeChannelId) {
    const messages = state.messagesByChannel.get(channelId) || [];
    const message = messages.find((item) => item.id === messageId);
    const attachment = message?.attachments.find((item) => item.id === attachmentId);
    if (!attachment) return;

    const note = prompt("Image note (leave blank to remove)", attachment.note || "");
    if (note === null) return;

    const updated = messages.map((item) => item.id !== messageId ? item : {
        ...item,
        attachments: item.attachments.map((itemAttachment) => (
            itemAttachment.id === attachmentId
                ? { ...itemAttachment, note: note.trim() }
                : itemAttachment
        ))
    });
    state.messagesByChannel.set(channelId, updated);
    await saveChannelMessages(channelId, updated);
    render();
}

async function moveInboxMessage(messageId, inboxChannelId) {
    const server = getChannelServer(inboxChannelId);
    const destinations = allChannels(server).filter((channel) => !channel.isInboxChannel && !channel.hidden);
    if (destinations.length === 0) {
        alert("Create another visible channel before sorting Inbox items.");
        return;
    }

    const choices = destinations.map((channel, index) => `${index + 1}. #${channel.name}`).join("\n");
    const selected = Number.parseInt(prompt(`Move this Inbox item to:\n${choices}`), 10);
    const destination = destinations[selected - 1];
    if (!destination) return;

    const inboxMessages = state.messagesByChannel.get(inboxChannelId) || [];
    const message = inboxMessages.find((item) => item.id === messageId);
    if (!message) return;

    if (!state.messagesByChannel.has(destination.id)) {
        const existing = await getChannelMessages(destination.id);
        state.messagesByChannel.set(destination.id, normalizeMessages(existing));
    }

    const nextInbox = inboxMessages.filter((item) => item.id !== messageId);
    const nextDestination = [...state.messagesByChannel.get(destination.id), message];
    state.messagesByChannel.set(inboxChannelId, nextInbox);
    state.messagesByChannel.set(destination.id, nextDestination);
    await saveChannelMessages(inboxChannelId, nextInbox);
    await saveChannelMessages(destination.id, nextDestination);
    render();
}

async function selectRandomChannel() {
    const channels = getAllChannels();
    const channel = randomItem(channels);
    if (!channel) return;

    state.activeChannelId = channel.id;
    state.activeServerId = getChannelServer(channel.id)?.id || state.activeServerId;
    state.activeView = { type: "channel", id: channel.id };
    await loadActiveChannelMessages();
    render();
    showMobileStage("chat");
}

async function selectRandomMessageInActiveChannel() {
    await selectRandomMessage(state.activeChannelId);
}

async function selectRandomMessage(channelId) {
    if (!channelId) return;

    if (channelId !== state.activeChannelId) {
        state.activeChannelId = channelId;
        state.activeServerId = getChannelServer(channelId)?.id || state.activeServerId;
        state.activeView = { type: "channel", id: channelId };
        await loadActiveChannelMessages();
    }

    const message = randomItem(getActiveMessages());
    render();
    showMobileStage("chat");

    if (!message) return;

    requestAnimationFrame(() => {
        const node = els.messages.querySelector(`[data-message-id="${message.id}"]`);
        node?.scrollIntoView({ behavior: "smooth", block: "center" });
        node?.classList.add("selected");
        setTimeout(() => node?.classList.remove("selected"), 1400);
    });
}

async function createRandomPhotoArray() {
    const requested = Number.parseInt(els.randomPhotoCount.value, 10);
    const count = Math.min(Math.max(requested || 9, 1), 500);
    els.randomPhotoCount.value = count;

    await ensureServerMessagesLoaded();
    const candidates = getWorkspaceEntries().flatMap((entry) => (
        (entry.message.attachments || [])
            .filter((attachment) => attachment.type?.startsWith("image/"))
            .map((attachment) => ({ channelId: entry.channelId, message: entry.message, attachment }))
    ));

    if (candidates.length === 0) {
        alert("Add photos to a channel before creating a random photo array.");
        return;
    }

    for (let index = candidates.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
    }

    state.randomPhotoArray = candidates.slice(0, Math.min(count, candidates.length));
    state.activeView = { type: "randomArray", id: "random-photo-array" };
    state.selectedPhotoRefs = [];
    state.visibleMessageLimit = 500;
    render();
    showMobileStage("chat");
}

async function saveRandomPhotoArray() {
    if (state.randomPhotoArray.length === 0) return;

    const server = getActiveServer();
    if (!server) return;
    const confirmed = confirm(`Save ${state.randomPhotoArray.length} copies to #saved-arrays? The original photos will stay where they are.`);
    if (!confirmed) return;

    let channel = allChannels(server).find((item) => item.isSavedArrayChannel);
    if (!channel) {
        const category = getActiveCategory()
            || server.categories.find((item) => !item.hidden)
            || server.categories[0];
        if (!category) return;

        channel = {
            id: uniqueId("channel", "saved-arrays"),
            name: "saved-arrays",
            hidden: false,
            isSavedArrayChannel: true
        };
        category.channels.push(channel);
        category.collapsed = false;
        state.messagesByChannel.set(channel.id, []);
    }

    if (!state.messagesByChannel.has(channel.id)) {
        const existing = await getChannelMessages(channel.id);
        state.messagesByChannel.set(channel.id, normalizeMessages(existing));
    }

    const messages = [
        ...state.messagesByChannel.get(channel.id),
        ...state.randomPhotoArray.map((item) => createMessage(item.message.text, [item.attachment]))
    ];
    state.messagesByChannel.set(channel.id, messages);
    await saveChannelMessages(channel.id, messages);
    await saveStructure(state.structure);

    state.randomPhotoArray = [];
    state.activeChannelId = channel.id;
    state.activeView = { type: "channel", id: channel.id };
    state.visibleMessageLimit = 100;
    render();
    refreshStorageEstimate();
}

async function selectRandomNumber() {
    const range = getRandomRange();
    const min = Math.min(range.min, range.max);
    const max = Math.max(range.min, range.max);
    const value = Math.floor(Math.random() * (max - min + 1)) + min;

    state.randomNumberText = String(value);
    state.structure.settings.randomMin = min;
    state.structure.settings.randomMax = max;
    hydrateSettingsControls();
    renderUtilityPanel();

    await saveStructure(state.structure);
}

async function saveRandomTexts() {
    const entries = els.savedRandomInput.value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);

    if (entries.length === 0) return;

    state.structure.settings.randomTexts = [
        ...new Set([...(state.structure.settings.randomTexts || []), ...entries])
    ];
    els.savedRandomInput.value = "";

    await saveStructure(state.structure);
    renderUtilityPanel();
}

async function selectRandomText() {
    const options = state.structure.settings.randomTexts || [];
    const value = randomItem(options);

    state.randomText = value || "Add saved text first";
    renderUtilityPanel();
}

async function saveRandomRange() {
    const range = getRandomRange();
    state.structure.settings.randomMin = range.min;
    state.structure.settings.randomMax = range.max;
    await saveStructure(state.structure);
}

function getRandomRange() {
    return {
        min: Number.parseInt(els.randomMin.value, 10) || DEFAULT_STRUCTURE.settings.randomMin,
        max: Number.parseInt(els.randomMax.value, 10) || DEFAULT_STRUCTURE.settings.randomMax
    };
}

function hydrateSettingsControls() {
    els.randomMin.value = state.structure.settings.randomMin;
    els.randomMax.value = state.structure.settings.randomMax;
    els.photoGridToggle.checked = Boolean(state.structure.settings.photoGridEnabled);
    els.embedControlsToggle.checked = Boolean(state.structure.settings.discordEmbedControls);
}

async function togglePhotoGrid() {
    state.structure.settings.photoGridEnabled = els.photoGridToggle.checked;
    await saveStructure(state.structure);
    renderMessages();
}

async function toggleEmbedControls() {
    state.structure.settings.discordEmbedControls = els.embedControlsToggle.checked;
    await saveStructure(state.structure);
    renderMessages();
}

function createMessage(text, attachments) {
    return {
        id: crypto.randomUUID(),
        text,
        createdAt: new Date().toISOString(),
        pinned: false,
        reactions: [],
        tags: extractTags(text),
        attachments: structuredClone(attachments)
    };
}

async function handlePaste(event) {
    const files = [...event.clipboardData?.files || []].filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) return;

    event.preventDefault();
    await addImageFiles(files);
}

async function addImageFiles(files) {
    const images = files.filter((file) => file.type.startsWith("image/"));
    const attachments = images.map(fileToAttachment);

    state.draftAttachments.push(...attachments);
    els.imageInput.value = "";
    renderComposer();
}

function fileToAttachment(file) {
    return {
        id: crypto.randomUUID(),
        name: file.name || "pasted-image",
        type: file.type,
        size: file.size,
        blob: file
    };
}

function createEmbed(url) {
    if (!url) return null;

    const youtubeId = getYouTubeId(url);
    if (youtubeId) {
        const iframe = document.createElement("iframe");
        iframe.className = "embed";
        iframe.src = `https://www.youtube.com/embed/${youtubeId}`;
        iframe.title = "Embedded YouTube video";
        iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        iframe.allowFullscreen = true;
        return iframe;
    }

    // Redgifs embeds (https://redgifs.com/watch/{id} -> https://redgifs.com/ifr/{id})
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        if (host.includes("redgifs.com") || host.includes("redgif.com")) {
            const parts = parsed.pathname.split("/").filter(Boolean);
            const id = parts.pop();
            if (id) {
                const iframe = document.createElement("iframe");
                iframe.className = "embed";
                iframe.src = `https://redgifs.com/ifr/${encodeURIComponent(id)}`;
                iframe.title = "Embedded Redgifs video";
                iframe.allow = "autoplay; encrypted-media; picture-in-picture";
                iframe.allowFullscreen = true;
                return iframe;
            }
        }
    } catch (e) {
        // ignore parse errors and fallthrough
    }

    // Video file embeds (mp4, webm, ogg)
    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) {
        const video = document.createElement("video");
        video.className = "embed";
        video.src = url;
        video.controls = !state.structure.settings.discordEmbedControls;
        video.playsInline = true;
        video.preload = "metadata";
        return video;
    }

    // Audio file embeds (mp3, wav, m4a, aac, ogg)
    if (/\.(mp3|wav|m4a|aac|flac|ogg)(\?.*)?$/i.test(url)) {
        const audio = document.createElement("audio");
        audio.className = "embed";
        audio.src = url;
        audio.controls = !state.structure.settings.discordEmbedControls;
        audio.preload = "metadata";
        return audio;
    }

    return null;
}

function createDiscordMediaControls(media, container) {
    const controls = document.createElement("div");
    controls.className = "discordMediaControls";
    const play = document.createElement("button");
    play.type = "button";
    play.addEventListener("click", () => (media.paused ? media.play().catch(() => {}) : media.pause()));
    const mute = document.createElement("button");
    mute.type = "button";
    mute.addEventListener("click", () => { media.muted = !media.muted; });
    const seek = document.createElement("input");
    seek.type = "range";
    seek.min = "0";
    seek.max = "0";
    seek.step = "0.1";
    seek.addEventListener("input", () => { media.currentTime = Number(seek.value); });
    const time = document.createElement("output");
    const update = () => {
        const duration = Number.isFinite(media.duration) ? media.duration : 0;
        seek.max = String(duration);
        seek.value = String(Math.min(media.currentTime || 0, duration));
        play.textContent = media.paused ? "Play" : "Pause";
        mute.textContent = media.muted ? "Unmute" : "Mute";
        time.textContent = `${formatMediaTime(media.currentTime)} / ${formatMediaTime(duration)}`;
    };
    ["loadedmetadata", "timeupdate", "play", "pause", "volumechange", "ended"].forEach((eventName) => media.addEventListener(eventName, update));
    update();
    const fullscreen = document.createElement("button");
    fullscreen.type = "button";
    fullscreen.textContent = "Fullscreen";
    fullscreen.addEventListener("click", () => requestFullscreenForElement(container));
    controls.append(play, mute, seek, time, fullscreen);
    return controls;
}

function formatMediaTime(seconds) {
    const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

function firstURL(text) {
    return text.match(/https?:\/\/[^\s]+/i)?.[0] || "";
}

function getYouTubeId(url) {
    try {
        const parsed = new URL(url);

        if (parsed.hostname.includes("youtu.be")) {
            return parsed.pathname.slice(1);
        }

        if (parsed.hostname.includes("youtube.com")) {
            return parsed.searchParams.get("v");
        }
    } catch {
        return "";
    }

    return "";
}

async function refreshStorageEstimate() {
    if (!navigator.storage?.estimate) {
        state.storageText = "Storage: browser estimate unavailable";
        renderUtilityPanel();
        return;
    }

    const estimate = await navigator.storage.estimate();
    const used = formatBytes(estimate.usage || 0);
    const quota = formatBytes(estimate.quota || 0);
    state.storageText = `Storage: ${used} used of ${quota} available on this device`;
    renderUtilityPanel();
}

async function requestPersistentStorage() {
    if (!navigator.storage?.persist) return;

    try {
        await navigator.storage.persist();
    } catch {
        // Browsers may deny persistence silently; IndexedDB still remains local to this device.
    }
}

function requestFullscreenForElement(element) {
    if (!element) return;

    const fsElement = element.requestFullscreen
        ? element
        : element.webkitRequestFullscreen
            ? element
            : element.mozRequestFullScreen
                ? element
                : element.msRequestFullscreen
                    ? element
                    : null;

    if (!fsElement) return;

    const request = fsElement.requestFullscreen
        || fsElement.webkitRequestFullscreen
        || fsElement.mozRequestFullScreen
        || fsElement.msRequestFullscreen;

    if (request) {
        request.call(fsElement).catch(() => {
            // Some elements may refuse fullscreen, ignore failures.
        });
    }
}

function extractTags(text) {
    const tags = text.match(/#[a-z0-9_-]+/gi) || [];
    return [...new Set(tags.map((tag) => tag.slice(1).toLowerCase()))];
}

function normalizeEmoji(value) {
    return (value || "").trim().split(/\s+/)[0] || "";
}

function normalizeChannelName(value) {
    return (value || "")
        .trim()
        .toLowerCase()
        .replace(/^#/, "")
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function normalizeDisplayName(value) {
    return (value || "").trim().replace(/\s+/g, " ");
}

function channelKey(serverId, name) {
    return `${serverId}:${normalizeChannelName(name) || crypto.randomUUID()}`;
}

function slugify(value) {
    return normalizeChannelName(value) || crypto.randomUUID();
}

function uniqueId(prefix, name) {
    return `${prefix}:${slugify(name)}:${crypto.randomUUID().slice(0, 8)}`;
}

function initials(value) {
    return value
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("") || "K";
}

function randomItem(items) {
    if (!items.length) return null;
    return items[Math.floor(Math.random() * items.length)];
}

function showMobileStage(stageId, behavior = "smooth") {
    if (!isMobileLayout()) return;

    const target = {
        servers: els.servers,
        sidebar: els.sidebar,
        chat: els.chat
    }[stageId];

    if (!target) return;

    requestAnimationFrame(() => {
        els.app.scrollTo({
            left: target.offsetLeft,
            behavior
        });
        updateMobileStageNav(stageId);
    });
}

function updateMobileStageNav(forcedStageId) {
    const stageId = forcedStageId || getCurrentMobileStage();

    els.mobileStageNav.querySelectorAll("button").forEach((button) => {
        const isActive = button.dataset.stageTarget === stageId;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-current", isActive ? "page" : "false");
    });
}

function getCurrentMobileStage() {
    const stages = [
        ["servers", els.servers],
        ["sidebar", els.sidebar],
        ["chat", els.chat]
    ];
    const center = els.app.scrollLeft + (els.app.clientWidth / 2);
    const current = stages.find(([, element]) => (
        center >= element.offsetLeft && center < element.offsetLeft + element.offsetWidth
    ));

    return current?.[0] || "chat";
}

function isMobileLayout() {
    return window.matchMedia("(max-width: 700px)").matches;
}

function debounce(callback, delay) {
    let timeoutId;

    return (...args) => {
        window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => callback(...args), delay);
    };
}

function formatDate(value) {
    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
    }).format(new Date(value));
}

function formatBytes(bytes) {
    if (!bytes) return "0 B";

    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** index;
    return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function emptyPanel(text) {
    const panel = document.createElement("div");
    panel.className = "emptyPanel";
    panel.textContent = text;
    return panel;
}

function escapeHTML(value) {
    const span = document.createElement("span");
    span.textContent = value;
    return span.innerHTML;
}

function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
        // Only register service worker on secure origins or localhost to avoid
        // unexpected failures when opening files or non-HTTPS dev servers.
        if (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1") {
            navigator.serviceWorker.register("sw.js").then(() => {
                console.log("Service worker registered");
            }).catch((error) => {
                console.warn("Service worker registration failed", error);
            });
        } else {
            console.log("Service worker registration skipped on insecure origin", location.href);
        }
    }
}
