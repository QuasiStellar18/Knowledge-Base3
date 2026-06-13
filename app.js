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
        randomTexts: []
    }
};

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
    error: ""
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
    storageInfo: document.getElementById("storageInfo")
};

document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
    bindEvents();
    render();

    try {
        await initDB();
        const savedStructure = await loadStructure();

        state.structure = normalizeStructure(savedStructure);
        selectInitialChannel();
        hydrateSettingsControls();

        await loadActiveChannelMessages();
        await ensureServerMessagesLoaded();
        state.ready = true;
        requestPersistentStorage();
        refreshStorageEstimate();
    } catch (error) {
        state.error = "Storage could not be loaded. Notes may not persist until this is fixed.";
        console.error(error);
    }

    render();
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

    els.searchInput.addEventListener("input", () => {
        state.search = els.searchInput.value.trim().toLowerCase();
        renderMessages();
    });

    els.randomMin.addEventListener("change", saveRandomRange);
    els.randomMax.addEventListener("change", saveRandomRange);
    els.randomNumberBtn.addEventListener("click", selectRandomNumber);
    els.saveRandomTextBtn.addEventListener("click", saveRandomTexts);
    els.randomTextBtn.addEventListener("click", selectRandomText);

    els.mobileStageNav.querySelectorAll("button").forEach((button) => {
        button.addEventListener("click", () => showMobileStage(button.dataset.stageTarget));
    });

    els.app.addEventListener("scroll", debounce(() => updateMobileStageNav(), 80), { passive: true });
    window.addEventListener("resize", () => updateMobileStageNav());
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
            ...(base.settings || {})
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
            channels: (category.channels || []).map((channel, channelIndex) => {
                const name = typeof channel === "string"
                    ? channel
                    : channel.name || `channel-${channelIndex + 1}`;

                return {
                    id: typeof channel === "string"
                        ? channelKey(serverId, name)
                        : channel.id || channelKey(serverId, name),
                    name
                };
            })
        }))
    };
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
            reactions: Array.isArray(message.reactions) ? message.reactions : [],
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

function getChannelById(channelId) {
    const server = getActiveServer();
    return allChannels(server).find((channel) => channel.id === channelId);
}

function getActiveMessages() {
    return state.messagesByChannel.get(state.activeChannelId) || [];
}

async function ensureServerMessagesLoaded() {
    const channels = allChannels();
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
            await ensureServerMessagesLoaded();
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

    server.categories.forEach((category) => {
        const group = document.createElement("section");
        group.className = "category";

        const header = document.createElement("button");
        header.className = "categoryHeader";
        header.type = "button";
        header.innerHTML = `<span>${category.collapsed ? ">" : "v"}</span><strong>${escapeHTML(category.name)}</strong>`;
        header.addEventListener("click", async () => {
            category.collapsed = !category.collapsed;
            await saveStructure(state.structure);
            renderChannels();
        });

        group.appendChild(header);

        if (!category.collapsed) {
            category.channels.forEach((channel) => {
                group.appendChild(renderChannelRow(channel));
            });
        }

        els.channels.appendChild(group);
    });

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
    select.innerHTML = `<span class="hash">${escapeHTML(view.prefix)}</span><span>${escapeHTML(view.label)}</span>`;
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
        await loadActiveChannelMessages();
        render();
        showMobileStage("chat");
    });

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

    row.append(select, random, remove);
    return row;
}

async function openView(type, id) {
    state.activeView = { type, id };

    if (type === "channel") {
        state.activeChannelId = id;
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
    if (state.activeView.type === "settings") {
        els.activeTitle.textContent = "Organization settings";
        els.activeMeta.textContent = "Manage categories and create channels";
        return;
    }

    if (state.activeView.type === "pinned") {
        const messages = getPinnedEntries();
        els.activeTitle.textContent = "Pinned notes";
        els.activeMeta.textContent = `${messages.length} pinned across this workspace`;
        return;
    }

    if (state.activeView.type === "emoji") {
        const messages = getEmojiEntries(state.activeView.id);
        els.activeTitle.textContent = `${state.activeView.id} reactions`;
        els.activeMeta.textContent = `${messages.length} notes, images, and links with this reaction`;
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

    if (state.activeView.type === "settings") {
        renderSettingsPage();
        return;
    }

    const messages = getVisibleMessages();

    if (messages.length === 0) {
        els.messages.appendChild(emptyPanel(state.search ? "No matching notes" : "No notes yet"));
        return;
    }

    messages.forEach((entry) => {
        els.messages.appendChild(renderMessage(entry.message || entry, entry.channelId));
    });

    els.messages.scrollTop = els.messages.scrollHeight;
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

    actions.append(pinButton, reactButton, deleteButton);
    header.append(meta, actions);
    article.appendChild(header);

    if (message.text) {
        const text = document.createElement("p");
        text.className = "messageText";
        text.textContent = message.text;
        article.appendChild(text);
    }

    renderAttachments(message.attachments).forEach((attachment) => article.appendChild(attachment));

    const url = firstURL(message.text);
    const embed = createEmbed(url);
    if (url) {
        const link = document.createElement("a");
        link.className = "sourceLink";
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = url;
        article.appendChild(link);
    }

    if (embed) {
        article.appendChild(embed);
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

function renderAttachments(attachments) {
    return attachments.map((attachment) => {
        if (attachment.type?.startsWith("image/")) {
            const figure = document.createElement("figure");
            figure.className = "imageAttachment";

            const image = document.createElement("img");
            image.src = attachment.dataUrl;
            image.alt = attachment.name || "Pasted image";
            image.loading = "lazy";

            const caption = document.createElement("figcaption");
            caption.textContent = `${attachment.name || "Local image"} · ${formatBytes(attachment.size || 0)}`;

            figure.append(image, caption);
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
    const enabled = state.ready && hasChannel && state.activeView.type === "channel";
    els.noteInput.disabled = !enabled;
    els.sendBtn.disabled = !enabled;
    els.attachImageBtn.disabled = !enabled;
    els.newChannelBtn.disabled = !state.ready;
    els.newCategoryBtn.disabled = !state.ready;
    els.deleteChannelBtn.disabled = !enabled;
    els.randomChannelBtn.disabled = !state.ready || allChannels().length === 0;
    els.randomMessageBtn.disabled = !enabled;

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
    return getWorkspaceEntries()
        .filter((entry) => entry.message.pinned)
        .sort((a, b) => new Date(a.message.createdAt) - new Date(b.message.createdAt));
}

function getEmojiEntries(emoji) {
    return getWorkspaceEntries()
        .filter((entry) => entry.message.reactions?.includes(emoji))
        .sort((a, b) => new Date(a.message.createdAt) - new Date(b.message.createdAt));
}

function getWorkspaceEntries() {
    return allChannels().flatMap((channel) => (
        (state.messagesByChannel.get(channel.id) || []).map((message) => ({
            channelId: channel.id,
            message
        }))
    ));
}

function getReactionEmojis() {
    return [...new Set(getWorkspaceEntries().flatMap((entry) => entry.message.reactions || []))];
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
                channels: [{ id: uniqueId("channel", "general"), name: "general" }]
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

        const reactions = message.reactions || [];
        return {
            ...message,
            reactions: reactions.includes(emoji)
                ? reactions.filter((item) => item !== emoji)
                : [...reactions, emoji]
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

async function selectRandomChannel() {
    const channels = allChannels();
    const channel = randomItem(channels);
    if (!channel) return;

    state.activeChannelId = channel.id;
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
    const attachments = await Promise.all(images.map(fileToAttachment));

    state.draftAttachments.push(...attachments);
    els.imageInput.value = "";
    renderComposer();
}

function fileToAttachment(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
            id: crypto.randomUUID(),
            name: file.name || "pasted-image",
            type: file.type,
            size: file.size,
            dataUrl: reader.result
        });
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
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

    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) {
        const video = document.createElement("video");
        video.className = "embed";
        video.src = url;
        video.controls = true;
        return video;
    }

    return null;
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
        navigator.serviceWorker.register("sw.js").catch((error) => {
            console.warn("Service worker registration failed", error);
        });
    }
}
