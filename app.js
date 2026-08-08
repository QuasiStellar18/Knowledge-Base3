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
        photoCollections: [],
        adventures: [],
        adventureComponents: [],
        adventureSessions: [],
        thumbnailMediaPicker: true,
        metronomeBpm: 120,
        metronomeMin: 80,
        metronomeMax: 160,
        randomBpmOnMessage: false,
        randomBpmOnChannel: false,
        randomBpmOnArray: false,
        timerSeconds: 60,
        timerMinSeconds: 30,
        timerMaxSeconds: 180,
        timerCoupleMetronome: false,
        timerRepeatWithRandomBpm: false,
        randomTimerOnMessage: false,
        randomTimerOnChannel: false,
        randomTimerOnArray: false,
        showHiddenPhotos: false,
        channelQuizSettings: {},
        channelQuizHighScores: {},
        channelQuizPresets: {}
    }
};

const CHANNEL_PIN = "58008";
const UNLOCK_SESSION_KEY = "knowledgeDiscordUnlocked";

const state = {
    ready: false,
    structure: structuredClone(DEFAULT_STRUCTURE),
    activeServerId: "main",
    activeChannelId: "ideas",
    activeView: { type: "channel", id: "ideas" },
    messagesByChannel: new Map(),
    search: "",
    draftAttachments: [],
    draftLinkedPhotoRefs: [],
    storageText: "Storage: checking",
    randomNumberText: "",
    randomText: "",
    error: "",
    visibleMessageLimit: 100,
    randomPhotoArray: [],
    randomZoom: null,
    randomZoomSize: 60,
    randomZoomPreset: "normal",
    randomZoomSlideshowMs: 5000,
    isUnlocked: sessionStorage.getItem(UNLOCK_SESSION_KEY) === "1",
    loadingChannelId: null,
    selectedPhotoRefs: [],
    focusMode: false,
    focusSessionCollectionId: null,
    activeAdventureSessionId: null,
    focusAdventureSceneId: null,
    adventureEditorStage: "setup",
    channelQuiz: { channelIds: [], useAllChannels: false, answerMode: "choice", current: null, score: 0, rounds: 0, ended: false, screen: "setup", lastChannelId: null, answering: false }
};

let adventureAutosaveTimer;

let metronomeContext;
let metronomeTimer;
let countdownTimer;
let countdownRemaining = 60;
let countdownEndsAt = null;
let adventureTimerTick;
let adventureAutoAdvanceTimer;
let adventureAutoAdvanceKey;
let adventureAutoAdvanceStartedMetronome = false;
let channelQuizPunishmentTimer;
let channelQuizAdvanceTimer;
let randomZoomSlideshowTimer;

const els = {
    app: document.getElementById("app"),
    servers: document.getElementById("servers"),
    sidebar: document.getElementById("sidebar"),
    chat: document.getElementById("chat"),
    mobileStageNav: document.getElementById("mobileStageNav"),
    mobileQuickActions: document.getElementById("mobileQuickActions"),
    mobileBackBtn: document.getElementById("mobileBackBtn"),
    mobileRandomBtn: document.getElementById("mobileRandomBtn"),
    mobileAddImageBtn: document.getElementById("mobileAddImageBtn"),
    mobileMoreBtn: document.getElementById("mobileMoreBtn"),
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
    randomServerMessageBtn: document.getElementById("randomServerMessageBtn"),
    randomMessageBtn: document.getElementById("randomMessageBtn"),
    comparePhotosBtn: document.getElementById("comparePhotosBtn"),
    saveRandomArrayBtn: document.getElementById("saveRandomArrayBtn"),
    lockWorkspaceBtn: document.getElementById("lockWorkspaceBtn"),
    imageInput: document.getElementById("imageInput"),
    attachImageBtn: document.getElementById("attachImageBtn"),
    linkPhotosBtn: document.getElementById("linkPhotosBtn"),
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
    thumbnailMediaPickerToggle: document.getElementById("thumbnailMediaPickerToggle"),
    showHiddenPhotosToggle: document.getElementById("showHiddenPhotosToggle"),
    randomPhotoCount: document.getElementById("randomPhotoCount"),
    randomPhotoArrayBtn: document.getElementById("randomPhotoArrayBtn"),
    metronomeBpm: document.getElementById("metronomeBpm"),
    metronomeMin: document.getElementById("metronomeMin"),
    metronomeMax: document.getElementById("metronomeMax"),
    randomMetronomeBtn: document.getElementById("randomMetronomeBtn"),
    metronomeToggleBtn: document.getElementById("metronomeToggleBtn"),
    metronomeStatus: document.getElementById("metronomeStatus"),
    randomBpmOnMessage: document.getElementById("randomBpmOnMessage"),
    randomBpmOnChannel: document.getElementById("randomBpmOnChannel"),
    randomBpmOnArray: document.getElementById("randomBpmOnArray"),
    timerSeconds: document.getElementById("timerSeconds"),
    timerMinSeconds: document.getElementById("timerMinSeconds"),
    timerMaxSeconds: document.getElementById("timerMaxSeconds"),
    randomTimerBtn: document.getElementById("randomTimerBtn"),
    timerToggleBtn: document.getElementById("timerToggleBtn"),
    timerResetBtn: document.getElementById("timerResetBtn"),
    timerStatus: document.getElementById("timerStatus"),
    chatTimerQuick: document.getElementById("chatTimerQuick"),
    chatTimerStatus: document.getElementById("chatTimerStatus"),
    chatTimerProgress: document.getElementById("chatTimerProgress"),
    timerCoupleMetronome: document.getElementById("timerCoupleMetronome"),
    timerRepeatWithRandomBpm: document.getElementById("timerRepeatWithRandomBpm"),
    randomTimerOnMessage: document.getElementById("randomTimerOnMessage"),
    randomTimerOnChannel: document.getElementById("randomTimerOnChannel"),
    randomTimerOnArray: document.getElementById("randomTimerOnArray"),
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
        const createdAdventureServer = ensureAdventureServer();
        const createdInbox = ensureInboxChannel();
        selectInitialChannel();
        hydrateSettingsControls();
        state.ready = true;
        if (createdInbox || createdAdventureServer) await saveStructure(state.structure);
        if (state.isUnlocked) await loadActiveChannelMessages();
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
    els.linkPhotosBtn.addEventListener("click", openLinkedPhotoPicker);
    els.imageInput.addEventListener("change", () => addImageFiles([...els.imageInput.files]));

    els.newServerBtn.addEventListener("click", createServer);
    els.settingsBtn.addEventListener("click", openSettings);
    els.newCategoryBtn.addEventListener("click", createCategory);
    els.newChannelBtn.addEventListener("click", createChannel);
    els.deleteChannelBtn.addEventListener("click", deleteActiveChannel);
    els.randomChannelBtn.addEventListener("click", selectRandomChannel);
    els.randomServerMessageBtn.addEventListener("click", selectRandomMessageInAnyChannel);
    els.randomMessageBtn.addEventListener("click", selectRandomMessageForCurrentView);
    els.comparePhotosBtn.addEventListener("click", openComparePicker);
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
    els.thumbnailMediaPickerToggle.addEventListener("change", toggleThumbnailMediaPicker);
    els.showHiddenPhotosToggle.addEventListener("change", toggleShowHiddenPhotos);
    els.randomPhotoArrayBtn.addEventListener("click", createRandomPhotoArray);
    els.metronomeBpm.addEventListener("change", saveMetronomeSettings);
    els.metronomeMin.addEventListener("change", saveMetronomeSettings);
    els.metronomeMax.addEventListener("change", saveMetronomeSettings);
    els.randomMetronomeBtn.addEventListener("click", selectRandomMetronomeBpm);
    els.metronomeToggleBtn.addEventListener("click", toggleMetronome);
    [els.randomBpmOnMessage, els.randomBpmOnChannel, els.randomBpmOnArray]
        .forEach((control) => control.addEventListener("change", saveMetronomeTriggers));
    [els.timerSeconds, els.timerMinSeconds, els.timerMaxSeconds]
        .forEach((control) => control.addEventListener("change", saveTimerSettings));
    els.randomTimerBtn.addEventListener("click", selectRandomTimer);
    els.timerToggleBtn.addEventListener("click", toggleCountdownTimer);
    els.timerResetBtn.addEventListener("click", resetCountdownTimer);
    els.chatTimerQuick.addEventListener("click", toggleCountdownTimer);
    els.timerCoupleMetronome.addEventListener("change", saveTimerCoupling);
    els.timerRepeatWithRandomBpm.addEventListener("change", saveTimerCoupling);
    [els.randomTimerOnMessage, els.randomTimerOnChannel, els.randomTimerOnArray]
        .forEach((control) => control.addEventListener("change", saveTimerTriggers));

    els.mobileStageNav.querySelectorAll("button").forEach((button) => {
        button.addEventListener("click", () => showMobileStage(button.dataset.stageTarget));
    });
    els.mobileBackBtn.addEventListener("click", () => showMobileStage("sidebar"));
    els.mobileRandomBtn.addEventListener("click", selectRandomMessageForCurrentView);
    els.mobileAddImageBtn.addEventListener("click", () => els.imageInput.click());
    els.mobileMoreBtn.addEventListener("click", openMobileQuickActions);

    els.app.addEventListener("scroll", debounce(() => updateMobileStageNav(), 80), { passive: true });
    window.addEventListener("resize", () => updateMobileStageNav());
    window.addEventListener("beforeunload", (event) => {
        if (adventureAutosaveTimer) {
            event.preventDefault();
            event.returnValue = "";
        }
    });
}

async function unlockWorkspace(event) {
    event.preventDefault();
    if (els.channelPinInput.value !== CHANNEL_PIN) {
        els.unlockError.textContent = "Incorrect PIN.";
        els.channelPinInput.select();
        return;
    }

    state.isUnlocked = true;
    sessionStorage.setItem(UNLOCK_SESSION_KEY, "1");
    els.channelPinInput.value = "";
    els.unlockError.textContent = "";
    await loadActiveChannelMessages();
    render();
    renderLockScreen();
}

function lockWorkspace() {
    stopMetronome();
    stopRandomZoomSlideshow();
    state.isUnlocked = false;
    sessionStorage.removeItem(UNLOCK_SESSION_KEY);
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
        isAdventureServer: Boolean(server.isAdventureServer),
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
        if (server.isAdventureServer) return;
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

function ensureAdventureServer() {
    if (state.structure.servers.some((server) => server.isAdventureServer)) return false;
    state.structure.servers.push({
        id: "adventures",
        name: "Adventures",
        isAdventureServer: true,
        categories: []
    });
    return true;
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
    const messages = normalizeMessages(rawMessages);
    state.messagesByChannel.set(state.activeChannelId, messages);
    const linkedChannels = [...new Set(messages.flatMap((message) => (message.linkedPhotoRefs || []).map((ref) => ref.channelId)).filter((channelId) => channelId && channelId !== state.activeChannelId && !state.messagesByChannel.has(channelId)))];
    await Promise.all(linkedChannels.map(async (channelId) => {
        state.messagesByChannel.set(channelId, normalizeMessages(await getChannelMessages(channelId)));
    }));
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
            attachments: Array.isArray(message.attachments) ? message.attachments : [],
            linkedPhotoRefs: Array.isArray(message.linkedPhotoRefs) ? message.linkedPhotoRefs.filter((ref) => ref?.channelId && ref?.messageId && ref?.attachmentId) : []
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
    document.body.classList.toggle("focusMode", state.focusMode);
    renderServers();
    renderChannels();
    renderHeader();
    renderMessages();
    renderComposer();
    renderUtilityPanel();
}

function renderServers() {
    els.servers.innerHTML = "";

    const heading = document.createElement("h2");
    heading.className = "serverListTitle";
    heading.textContent = "Workspaces";
    els.servers.appendChild(heading);

    state.structure.servers.forEach((server) => {
        const button = document.createElement("button");
        button.className = `server ${server.id === state.activeServerId ? "active" : ""}`;
        button.type = "button";
        button.title = server.name;
        button.setAttribute("aria-label", `Open ${server.name}`);
        const icon = document.createElement("span");
        icon.className = "serverIcon";
        icon.textContent = initials(server.name);
        const name = document.createElement("span");
        name.className = "serverName";
        name.textContent = server.name;
        button.append(icon, name);

        button.addEventListener("click", async () => {
            state.activeServerId = server.id;
            state.activeChannelId = allChannels(server)[0]?.id || null;
            state.activeView = server.isAdventureServer
                ? { type: "adventureStudio", id: "studio" }
                : state.activeChannelId
                    ? { type: "channel", id: state.activeChannelId }
                    : { type: "settings", id: "settings" };
            showMobileStage("sidebar");
            if (state.isUnlocked && state.activeChannelId) {
                state.loadingChannelId = state.activeChannelId;
                renderChannels();
                renderHeader();
                renderMessages();
                await loadActiveChannelMessages();
                state.loadingChannelId = null;
            }
            render();
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

    if (allChannels(server).length === 0 && !server.isAdventureServer) {
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

    if (!server.isAdventureServer) {
        const group = document.createElement("section");
        group.className = "category emojiReactionChannels";
        group.appendChild(staticCategoryHeader("Emoji collections"));
        const emojis = getReactionEmojis();

        if (emojis.length > 0) {
            emojis.forEach((emoji) => {
                group.appendChild(renderSmartChannelRow({
                    id: emoji,
                    type: "emoji",
                    label: emoji,
                    prefix: emoji,
                    title: `${emoji} reactions`
                }));
            });
        } else {
            const empty = document.createElement("button");
            empty.className = "loadEmojiChannels";
            empty.type = "button";
            empty.textContent = "Find reaction channels";
            empty.title = "Load reactions from this workspace";
            empty.addEventListener("click", () => loadServerReactionChannels(server.id, empty));
            group.appendChild(empty);
        }

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

    if (server.isAdventureServer) {
        const group = document.createElement("section");
        group.className = "category";
        group.appendChild(staticCategoryHeader("Choose your adventure"));
        group.appendChild(renderSmartChannelRow({
            id: "studio",
            type: "adventureStudio",
            label: "adventure studio",
            prefix: "✦",
            title: "Create and edit adventures"
        }));
        getAdventures().forEach((adventure) => {
            group.appendChild(renderSmartChannelRow({
                id: adventure.id,
                type: "adventureEditor",
                label: adventure.title,
                prefix: "›",
                title: `Edit ${adventure.title}`
            }));
        });
        els.channels.appendChild(group);
    }
}

async function loadServerReactionChannels(serverId, button) {
    const server = state.structure.servers.find((item) => item.id === serverId);
    if (!server) return;
    if (button) {
        button.disabled = true;
        button.textContent = "Finding reactions…";
    }
    try {
        await Promise.all(allChannels(server).map(async (channel) => {
            if (state.messagesByChannel.has(channel.id)) return;
            state.messagesByChannel.set(channel.id, normalizeMessages(await getChannelMessages(channel.id)));
        }));
    } finally {
        if (state.activeServerId === serverId) renderChannels();
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
        id: "favorites",
        type: "favorites",
        label: "favorite photos",
        prefix: "★",
        title: "Local favorite photos"
    }));
    group.appendChild(renderSmartChannelRow({
        id: "settings",
        type: "settings",
        label: "organization settings",
        prefix: "!",
        title: "Organization settings"
    }));
    group.appendChild(renderSmartChannelRow({
        id: "stats",
        type: "stats",
        label: "statistics",
        prefix: "#",
        title: "Workspace statistics"
    }));
    group.appendChild(renderSmartChannelRow({
        id: "focus-session",
        type: "focusSession",
        label: "focus session",
        prefix: "◉",
        title: "Timer, metronome, and collection slideshow"
    }));
    if (!getActiveServer()?.isAdventureServer) {
        group.appendChild(renderSmartChannelRow({
            id: "channel-quiz",
            type: "channelQuiz",
            label: "channel quiz",
            prefix: "?",
            title: "Guess which channel a random image came from"
        }));
        group.appendChild(renderSmartChannelRow({
            id: "zoom-quiz",
            type: "zoomQuiz",
            label: "zoom quiz",
            prefix: "⌕",
            title: "Guess an image's channel from a cropped detail"
        }));
        group.appendChild(renderSmartChannelRow({
            id: "random-zoom",
            type: "randomZoom",
            label: "random zoom",
            prefix: "⌕",
            title: "Reveal a random detail from a local image"
        }));
    }
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
        state.loadingChannelId = channel.id;
        renderChannels();
        renderHeader();
        renderMessages();
        renderComposer();
        showMobileStage("chat");
        await loadActiveChannelMessages();
        state.loadingChannelId = null;
        renderChannels();
        renderHeader();
        renderMessages();
        renderComposer();
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
    if (type !== "randomZoom") stopRandomZoomSlideshow();
    if (["channelQuiz", "zoomQuiz"].includes(type) && state.activeView.type !== type) {
        window.clearTimeout(channelQuizPunishmentTimer);
        window.clearTimeout(channelQuizAdvanceTimer);
        state.channelQuiz.current = null;
        state.channelQuiz.punishment = null;
        state.channelQuiz.score = 0;
        state.channelQuiz.rounds = 0;
        state.channelQuiz.ended = false;
        state.channelQuiz.feedback = null;
        state.channelQuiz.revealed = false;
        state.channelQuiz.answering = false;
        state.channelQuiz.screen = "setup";
    }
    state.activeView = { type, id };
    state.selectedPhotoRefs = [];

    if (type === "channel") {
        state.activeChannelId = id;
        state.activeServerId = getChannelServer(id)?.id || state.activeServerId;
        await loadActiveChannelMessages();
    } else if (["adventureEditor", "adventurePlay"].includes(type)) {
        await ensureServerMessagesLoaded();
    } else if (type !== "adventureStudio") {
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
    els.randomMessageBtn.textContent = state.activeView.type === "collection"
        ? "Random collection note"
        : state.activeView.type === "randomArray"
            ? "Random array note"
            : "Random note";
    const compareAvailable = state.ready && state.isUnlocked && !["settings", "stats", "focusSession", "channelQuiz", "adventureStudio", "adventureEditor", "adventureMap", "adventurePlay"].includes(state.activeView.type);
    els.comparePhotosBtn.hidden = !compareAvailable;
    els.comparePhotosBtn.disabled = !compareAvailable;

    if (state.activeView.type === "settings") {
        els.activeTitle.textContent = "Organization settings";
        els.activeMeta.textContent = "Manage categories and create channels";
        return;
    }

    if (state.activeView.type === "stats") {
        els.activeTitle.textContent = "Workspace statistics";
        els.activeMeta.textContent = `Local totals for ${getActiveServer()?.name || "this workspace"}`;
        return;
    }

    if (state.activeView.type === "focusSession") {
        els.activeTitle.textContent = "Focus session";
        els.activeMeta.textContent = "Local timer, metronome, and collection slideshow";
        return;
    }

    if (state.activeView.type === "channelQuiz") {
        els.activeTitle.textContent = "Channel quiz";
        els.activeMeta.textContent = "Guess where a random local image came from";
        return;
    }

    if (state.activeView.type === "zoomQuiz") {
        els.activeTitle.textContent = "Zoom quiz";
        els.activeMeta.textContent = "Guess which channel a cropped local image came from";
        return;
    }

    if (state.activeView.type === "randomZoom") {
        els.activeTitle.textContent = "Random zoom";
        els.activeMeta.textContent = "A random close-up from a local image in this workspace";
        return;
    }

    if (state.activeView.type === "adventureStudio") {
        els.activeTitle.textContent = "Adventure studio";
        els.activeMeta.textContent = "Create local branching stories with photos and GIFs from any server";
        return;
    }

    if (state.activeView.type === "adventureEditor") {
        const adventure = getAdventure(state.activeView.id);
        els.activeTitle.textContent = adventure?.title || "Adventure editor";
        els.activeMeta.textContent = "Scenes use references to local images and GIFs; source files are not copied";
        return;
    }

    if (state.activeView.type === "adventureMap") {
        const adventure = getAdventure(state.activeView.id);
        els.activeTitle.textContent = `${adventure?.title || "Adventure"} map`;
        els.activeMeta.textContent = "Tap a scene to return to its editor";
        return;
    }

    if (state.activeView.type === "adventurePlay") {
        const adventure = getAdventure(state.activeView.id);
        const session = getAdventureSession(state.activeView.id);
        els.activeTitle.textContent = adventure?.title || "Adventure";
        els.activeMeta.textContent = session?.completed ? "Completed · restart to play again" : "Playing locally · progress is saved";
        return;
    }

    if (state.activeView.type === "pinned") {
        const messages = getPinnedEntries();
        els.activeTitle.textContent = "Pinned notes";
        els.activeMeta.textContent = `${messages.length} pinned in ${getActiveServer()?.name || "this server"}`;
        return;
    }

    if (state.activeView.type === "favorites") {
        const total = getFavoriteEntries().reduce((count, entry) => count + entry.message.attachments.length, 0);
        els.activeTitle.textContent = "Favorite photos";
        els.activeMeta.textContent = `${total} local favorites in ${getActiveServer()?.name || "this workspace"}`;
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
        renderChannelLoadingSkeleton("Opening your local workspace…");
        return;
    }

    if (!state.isUnlocked) {
        els.messages.appendChild(emptyPanel("Locked"));
        return;
    }

    if (state.loadingChannelId && state.loadingChannelId === state.activeChannelId) {
        renderChannelLoadingSkeleton("Loading channel…");
        return;
    }

    if (["channel", "randomArray", "adventurePlay"].includes(state.activeView.type)) {
        const focus = document.createElement("button");
        focus.type = "button";
        focus.className = "focusModeButton";
        focus.textContent = state.focusMode ? "Exit focus mode" : "Focus mode";
        focus.addEventListener("click", () => {
            state.focusMode = !state.focusMode;
            render();
        });
        els.messages.appendChild(focus);
    }

    if (state.activeView.type === "settings") {
        renderSettingsPage();
        return;
    }

    if (state.activeView.type === "stats") {
        renderStatsPage();
        return;
    }

    if (state.activeView.type === "focusSession") {
        renderFocusSession();
        return;
    }

    if (["channelQuiz", "zoomQuiz"].includes(state.activeView.type)) {
        renderChannelQuiz();
        return;
    }

    if (state.activeView.type === "favorites") {
        const favorites = getFavoriteEntries();
        if (favorites.length === 0) els.messages.appendChild(emptyPanel("No favorite photos yet. Use a photo's action menu to favorite it."));
        else renderPhotoGrid(favorites);
        return;
    }

    if (state.activeView.type === "randomZoom") {
        renderRandomZoom();
        return;
    }

    if (state.activeView.type === "adventureStudio") {
        renderAdventureStudio();
        return;
    }

    if (state.activeView.type === "adventureEditor") {
        renderAdventureEditor(state.activeView.id);
        return;
    }

    if (state.activeView.type === "adventureMap") {
        renderAdventureMap(state.activeView.id);
        return;
    }

    if (state.activeView.type === "adventurePlay") {
        renderAdventurePlayer(state.activeView.id);
        return;
    }

    const allMessages = getVisibleMessages();
    const messages = allMessages.slice(-state.visibleMessageLimit);
    const slideshowItems = getSlideshowItems(messages);
    if (slideshowItems.length > 1) {
        const slideshow = document.createElement("button");
        slideshow.type = "button";
        slideshow.className = "focusModeButton";
        slideshow.textContent = "Slideshow";
        slideshow.addEventListener("click", () => openSlideshow(slideshowItems));
        els.messages.appendChild(slideshow);
    }

    renderBatchActions();

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

}

function renderChannelLoadingSkeleton(label = "Loading…") {
    const loading = document.createElement("section");
    loading.className = "channelLoadingSkeleton";
    loading.setAttribute("role", "status");
    const text = document.createElement("p");
    text.textContent = label;
    const grid = document.createElement("div");
    grid.className = "channelLoadingPhotoGrid";
    for (let index = 0; index < 8; index += 1) {
        const tile = document.createElement("span");
        tile.className = "skeletonBlock";
        grid.appendChild(tile);
    }
    const lines = document.createElement("div");
    lines.className = "channelLoadingLines";
    for (let index = 0; index < 3; index += 1) {
        const line = document.createElement("span");
        line.className = "skeletonBlock";
        lines.appendChild(line);
    }
    loading.append(text, grid, lines);
    els.messages.appendChild(loading);
}

function getSlideshowItems(entries) {
    return entries.flatMap((entry) => {
        const message = entry.message || entry;
        const channelId = entry.channelId || state.activeChannelId;
        return (message.attachments || []).filter((attachment) => attachment.type?.startsWith("image/") && shouldShowAttachment(attachment)).map((attachment) => ({
            attachment,
            alt: attachment.note || message.text || attachment.name || "Local photo",
            channelName: getChannelById(channelId)?.name || "local",
            date: message.createdAt,
            tags: message.tags || []
        }));
    });
}

function shouldShowAttachment(attachment) {
    return Boolean(state.structure.settings.showHiddenPhotos) || !attachment.hidden;
}

function usesPhotoGrid() {
    return state.activeView.type === "collection"
        || (state.activeView.type === "channel" && Boolean(getActiveChannel()?.isSavedArrayChannel))
        || (["channel", "randomArray"].includes(state.activeView.type)
            && Boolean(state.structure.settings.photoGridEnabled));
}

function renderPhotoGrid(entries) {
    const imageEntries = entries.flatMap((entry) => {
        const message = entry.message || entry;
        return (message.attachments || [])
            .filter((attachment) => attachment.type?.startsWith("image/") && shouldShowAttachment(attachment))
            .map((attachment) => ({ message, attachment, channelId: entry.channelId || state.activeChannelId }));
    });

    if (imageEntries.length > 0) {
        const grid = document.createElement("section");
        grid.className = "photoGrid";
        grid.setAttribute("aria-label", "Photo gallery");
        const viewerItems = imageEntries.map(({ message, attachment, channelId }) => ({ attachment, alt: attachment.note || message.text || attachment.name || "Local photo", channelName: getChannelById(channelId)?.name || "saved channel", date: message.createdAt, tags: message.tags || [] }));
        imageEntries.forEach(({ message, attachment, channelId }, index) => grid.appendChild(renderPhotoTile(message, attachment, channelId, viewerItems, index)));
        els.messages.appendChild(grid);
    }

    entries
        .map((entry) => entry.message || entry)
        .filter((message) => !message.attachments?.some((attachment) => attachment.type?.startsWith("image/") && shouldShowAttachment(attachment)))
        .forEach((message) => els.messages.appendChild(renderMessage(message)));
}

function renderPhotoTile(message, attachment, channelId, viewerItems = null, viewerIndex = 0) {
    const figure = document.createElement("figure");
    figure.className = "photoTile";
    figure.classList.toggle("isFavorite", Boolean(attachment.favorite));
    figure.title = "Tap to view fullscreen · hold for actions";
    const ref = { channelId, messageId: message.id, attachmentId: attachment.id };
    const key = photoRefKey(ref);
    figure.dataset.photoRef = key;
    figure.classList.toggle("isSelected", state.selectedPhotoRefs.some((item) => photoRefKey(item) === key));

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
    const meta = document.createElement("span");
    meta.className = "photoTileMeta";
    const sourceName = getChannelById(channelId)?.name || message.arraySourceName || "saved channel";
    meta.textContent = `# ${sourceName} · ${formatDate(message.createdAt)}`;
    const description = document.createElement("span");
    description.className = "photoTileDescription";
    description.textContent = attachment.note || message.text || attachment.name || "Local photo";
    caption.append(meta, description);
    figure.append(image, caption);
    const more = document.createElement("button");
    more.type = "button";
    more.className = "photoMenuButton";
    more.textContent = "⋯";
    more.title = "Photo actions";
    more.setAttribute("aria-label", "Photo actions");
    more.addEventListener("pointerdown", (event) => event.stopPropagation());
    more.addEventListener("click", (event) => {
        event.stopPropagation();
        openPhotoActionSheet({ message, attachment, channelId, viewerItems, viewerIndex, alt: image.alt });
    });
    figure.appendChild(more);
    if (canSelectPhotos()) {
        const selector = document.createElement("input");
        selector.className = "photoSelector";
        selector.type = "checkbox";
        selector.checked = state.selectedPhotoRefs.some((item) => photoRefKey(item) === key);
        selector.setAttribute("aria-label", "Select photo for batch actions");
        selector.addEventListener("click", (event) => event.stopPropagation());
        selector.addEventListener("change", () => togglePhotoSelection(ref, selector.checked));
        figure.appendChild(selector);
    }
    const order = getPhotoOrderPosition({ channelId, messageId: message.id, attachmentId: attachment.id });
    if (order) {
        const controls = document.createElement("div");
        controls.className = "photoOrderControls";
        const earlier = document.createElement("button");
        earlier.type = "button";
        earlier.textContent = "←";
        earlier.title = "Move photo earlier";
        earlier.disabled = order.index === 0;
        earlier.addEventListener("click", (event) => {
            event.stopPropagation();
            movePhotoInCurrentView(order.index, -1);
        });
        const later = document.createElement("button");
        later.type = "button";
        later.textContent = "→";
        later.title = "Move photo later";
        later.disabled = order.index === order.length - 1;
        later.addEventListener("click", (event) => {
            event.stopPropagation();
            movePhotoInCurrentView(order.index, 1);
        });
        controls.append(earlier, later);
        figure.appendChild(controls);
    }
    bindPhotoQuickActions(figure, { message, attachment, channelId, viewerItems, viewerIndex, alt: image.alt });
    figure.addEventListener("click", (event) => {
        if (figure.dataset.longPressHandled === "1") {
            figure.dataset.longPressHandled = "";
            event.preventDefault();
            return;
        }
        openImageViewer(attachment, image.alt, viewerItems, viewerIndex);
    });
    return figure;
}

function bindPhotoQuickActions(element, photo) {
    let timer;
    let startX = 0;
    let startY = 0;
    let opened = false;
    const open = () => {
        if (opened) return;
        opened = true;
        window.clearTimeout(timer);
        element.classList.remove("isPressing");
        element.dataset.longPressHandled = "1";
        if (typeof navigator.vibrate === "function") navigator.vibrate(8);
        openPhotoActionSheet(photo);
    };
    const cancel = () => {
        window.clearTimeout(timer);
        timer = undefined;
        element.classList.remove("isPressing");
    };
    element.addEventListener("pointerdown", (event) => {
        if (event.target.closest("button, input")) return;
        if (event.button !== undefined && event.button !== 0) return;
        opened = false;
        startX = event.clientX;
        startY = event.clientY;
        element.classList.add("isPressing");
        element.setPointerCapture?.(event.pointerId);
        timer = window.setTimeout(open, 430);
    });
    element.addEventListener("pointermove", (event) => {
        if (Math.hypot(event.clientX - startX, event.clientY - startY) > 12) cancel();
    });
    ["pointerup", "pointercancel"].forEach((type) => element.addEventListener(type, (event) => {
        const wasOpened = opened;
        cancel();
        if (wasOpened) {
            event.preventDefault();
            window.setTimeout(() => { element.dataset.longPressHandled = ""; }, 0);
        }
    }));
    element.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse") cancel(); });
    element.addEventListener("contextmenu", (event) => {
        if (event.target.closest("button, input")) return;
        event.preventDefault();
        cancel();
        open();
    });
}

function openPhotoActionSheet({ message, attachment, channelId, viewerItems, viewerIndex = 0, alt }) {
    const modal = document.createElement("div");
    modal.className = "photoActionSheet";
    const card = document.createElement("section");
    card.className = "photoActionSheetCard";
    const title = document.createElement("strong");
    title.textContent = attachment.note || attachment.name || "Photo actions";
    const close = () => modal.remove();
    const action = (label, callback, danger = false) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        if (danger) button.className = "dangerAction";
        button.addEventListener("click", () => { close(); callback(); });
        return button;
    };
    const ref = { channelId, messageId: message.id, attachmentId: attachment.id };
    card.append(
        title,
        action(attachment.favorite ? "Remove favorite" : "Favorite", () => toggleAttachmentFlag(ref, "favorite")),
        action("Add to collection", () => addPhotosToCollection([ref])),
        action(attachment.note ? "Edit image note" : "Add image note", () => editAttachmentNote(message.id, attachment.id, channelId)),
        action(state.selectedPhotoRefs.some((item) => photoRefKey(item) === photoRefKey(ref)) ? "Remove from compare" : "Add to compare (select 2–4 photos)", () => togglePhotoSelection(ref, !state.selectedPhotoRefs.some((item) => photoRefKey(item) === photoRefKey(ref)))),
        action(attachment.hidden ? "Unhide photo" : "Hide photo", () => toggleAttachmentFlag(ref, "hidden"), !attachment.hidden),
        action("Start slideshow", () => openSlideshow(viewerItems?.length ? viewerItems : [{ attachment, alt: alt || attachment.name || "Local photo", channelName: getChannelById(channelId)?.name || "channel", date: message.createdAt, tags: message.tags || [] }])),
        action("Cancel", close)
    );
    modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
    modal.appendChild(card);
    document.body.appendChild(modal);
}

async function toggleAttachmentFlag(ref, flag) {
    const messages = state.messagesByChannel.get(ref.channelId) || [];
    const updated = messages.map((message) => message.id !== ref.messageId ? message : {
        ...message,
        attachments: message.attachments.map((attachment) => attachment.id !== ref.attachmentId ? attachment : {
            ...attachment,
            [flag]: !attachment[flag]
        })
    });
    state.messagesByChannel.set(ref.channelId, updated);
    await saveChannelMessages(ref.channelId, updated);
    render();
}

function canSelectPhotos() {
    return ["channel", "collection", "randomArray"].includes(state.activeView.type);
}

function getPhotoOrderPosition(ref) {
    if (state.activeView.type === "collection") {
        const refs = getAnyPhotoCollection(state.activeView.id)?.photoRefs || [];
        const index = refs.findIndex((item) => photoRefKey(item) === photoRefKey(ref));
        return index >= 0 ? { index, length: refs.length } : null;
    }
    const channel = getActiveChannel();
    if (state.activeView.type === "channel" && channel?.isSavedArrayChannel && ref.channelId === channel.id) {
        const messages = state.messagesByChannel.get(channel.id) || [];
        const index = messages.findIndex((item) => item.id === ref.messageId);
        return index >= 0 ? { index, length: messages.length } : null;
    }
    return null;
}

async function movePhotoInCurrentView(from, offset) {
    const to = from + offset;
    if (state.activeView.type === "collection") {
        const collection = getAnyPhotoCollection(state.activeView.id);
        if (!collection?.photoRefs || to < 0 || to >= collection.photoRefs.length) return;
        [collection.photoRefs[from], collection.photoRefs[to]] = [collection.photoRefs[to], collection.photoRefs[from]];
        await saveStructure(state.structure);
    } else {
        const channel = getActiveChannel();
        const messages = channel?.isSavedArrayChannel ? state.messagesByChannel.get(channel.id) : null;
        if (!messages || to < 0 || to >= messages.length) return;
        [messages[from], messages[to]] = [messages[to], messages[from]];
        await saveChannelMessages(channel.id, messages);
    }
    renderMessages();
}

function renderBatchActions() {
    els.messages.querySelector("#batchActions")?.remove();
    if (state.selectedPhotoRefs.length === 0 || !canSelectPhotos()) return;
    const bar = document.createElement("div");
    bar.id = "batchActions";
    bar.className = "batchActions";
    const label = document.createElement("span");
    const count = state.selectedPhotoRefs.length;
    label.textContent = count === 1 ? "1 photo ready for comparison — add 1 to 3 more" : `${count} photos ready for comparison`;
    const add = document.createElement("button");
    add.type = "button";
    add.textContent = "Add to collection";
    add.addEventListener("click", () => addPhotosToCollection(state.selectedPhotoRefs));
    const compare = document.createElement("button");
    compare.type = "button";
    compare.textContent = count >= 2 && count <= 4 ? `Compare ${count}` : "Compare";
    compare.disabled = count < 2 || count > 4;
    compare.addEventListener("click", () => openPhotoCompare(state.selectedPhotoRefs));
    const clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = "Clear";
    clear.addEventListener("click", () => {
        state.selectedPhotoRefs = [];
        renderMessages();
    });
    bar.append(label, add, compare, clear);
    els.messages.prepend(bar);
}

function getWorkspaceStats() {
    const channels = allChannels();
    const channelStats = new Map(channels.map((channel) => [channel.id, {
        channel,
        notes: 0,
        photos: 0,
        gifs: 0,
        pinned: 0,
        favorites: 0,
        reactions: 0
    }]));
    const reactions = new Map();
    const tags = new Map();
    let notes = 0;
    let photos = 0;
    let gifs = 0;
    let pinned = 0;
    let favorites = 0;
    let reactionTotal = 0;
    getServerEntries().forEach((entry) => {
        const stat = channelStats.get(entry.channelId);
        const message = entry.message;
        notes += 1;
        if (stat) stat.notes += 1;
        if (message.pinned) { pinned += 1; if (stat) stat.pinned += 1; }
        (message.attachments || []).forEach((attachment) => {
            if (!attachment.type?.startsWith("image/")) return;
            photos += 1;
            if (stat) stat.photos += 1;
            if (attachment.type === "image/gif") { gifs += 1; if (stat) stat.gifs += 1; }
            if (attachment.favorite) { favorites += 1; if (stat) stat.favorites += 1; }
        });
        (message.reactions || []).forEach((emoji) => {
            reactionTotal += 1;
            if (stat) stat.reactions += 1;
            if (!reactions.has(emoji)) reactions.set(emoji, { emoji, total: 0, channels: new Map() });
            const reaction = reactions.get(emoji);
            reaction.total += 1;
            reaction.channels.set(entry.channelId, (reaction.channels.get(entry.channelId) || 0) + 1);
        });
        (message.tags || []).forEach((tag) => tags.set(tag, (tags.get(tag) || 0) + 1));
    });
    return {
        channels: [...channelStats.values()],
        reactions: [...reactions.values()].sort((a, b) => b.total - a.total || a.emoji.localeCompare(b.emoji)),
        tags: [...tags.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
        notes,
        photos,
        gifs,
        pinned,
        favorites,
        reactionTotal
    };
}

function renderFocusSession() {
    const collections = getServerCollections();
    const page = document.createElement("section");
    page.className = "focusSession";
    const intro = document.createElement("section");
    intro.className = "focusSessionIntro";
    const title = document.createElement("h3");
    title.textContent = "Focus session";
    const description = document.createElement("p");
    description.textContent = "Use one collection as a calm visual backdrop while your local timer and metronome run.";
    intro.append(title, description);
    if (collections.length === 0) {
        intro.appendChild(emptyPanel("Create a photo collection first, then return here to use it in a focus session."));
        page.appendChild(intro);
        els.messages.appendChild(page);
        return;
    }
    const selectedCollection = collections.find((collection) => collection.id === state.focusSessionCollectionId) || collections[0];
    state.focusSessionCollectionId = selectedCollection.id;
    const collectionLabel = document.createElement("label");
    collectionLabel.textContent = "Photo collection";
    const collectionSelect = document.createElement("select");
    collections.forEach((collection) => {
        const option = document.createElement("option");
        option.value = collection.id;
        option.textContent = `${collection.name} (${collection.photoRefs?.length || 0})`;
        option.selected = collection.id === selectedCollection.id;
        collectionSelect.appendChild(option);
    });
    collectionSelect.addEventListener("change", () => { state.focusSessionCollectionId = collectionSelect.value; renderMessages(); });
    collectionLabel.appendChild(collectionSelect);
    const secondsLabel = document.createElement("label");
    secondsLabel.textContent = "Timer seconds";
    const seconds = document.createElement("input");
    seconds.type = "number";
    seconds.min = "1";
    seconds.max = "7200";
    seconds.inputMode = "numeric";
    seconds.value = els.timerSeconds.value || state.structure.settings.timerSeconds;
    secondsLabel.appendChild(seconds);
    const bpmLabel = document.createElement("label");
    bpmLabel.textContent = "Metronome BPM";
    const bpm = document.createElement("input");
    bpm.type = "number";
    bpm.min = "20";
    bpm.max = "300";
    bpm.inputMode = "numeric";
    bpm.value = els.metronomeBpm.value || state.structure.settings.metronomeBpm;
    bpmLabel.appendChild(bpm);
    const setup = document.createElement("section");
    setup.className = "focusSessionSetup";
    setup.append(collectionLabel, secondsLabel, bpmLabel);
    const controls = document.createElement("section");
    controls.className = "focusSessionControls";
    const timer = document.createElement("button");
    timer.type = "button";
    timer.className = "adventurePrimary";
    timer.textContent = countdownTimer ? `Pause timer (${formatTimer(Math.ceil((countdownEndsAt - Date.now()) / 1000))})` : `Start timer (${formatTimer(seconds.value)})`;
    timer.addEventListener("click", async () => {
        els.timerSeconds.value = seconds.value;
        await saveTimerSettings();
        toggleCountdownTimer();
        renderMessages();
    });
    const metronome = document.createElement("button");
    metronome.type = "button";
    metronome.textContent = metronomeTimer ? `Stop metronome (${els.metronomeBpm.value} BPM)` : `Start metronome (${bpm.value} BPM)`;
    metronome.addEventListener("click", async () => {
        els.metronomeBpm.value = bpm.value;
        await saveMetronomeSettings();
        toggleMetronome();
        renderMessages();
    });
    const randomTime = document.createElement("button");
    randomTime.type = "button";
    randomTime.textContent = "Random time";
    randomTime.addEventListener("click", async () => { await selectRandomTimer(); renderMessages(); });
    const slideshow = document.createElement("button");
    slideshow.type = "button";
    slideshow.textContent = "Start collection slideshow";
    slideshow.addEventListener("click", () => {
        const entries = getCollectionEntries(state.focusSessionCollectionId);
        const items = entries.flatMap((entry) => (entry.message.attachments || []).filter((attachment) => attachment.type?.startsWith("image/")).map((attachment) => ({
            attachment,
            alt: attachment.note || entry.message.text || attachment.name || "Local photo",
            channelName: getChannelById(entry.channelId)?.name || "collection",
            date: entry.message.createdAt,
            tags: entry.message.tags || []
        })));
        if (items.length === 0) { alert("This collection has no available photos or GIFs."); return; }
        openSlideshow(items);
    });
    const distractionFree = document.createElement("button");
    distractionFree.type = "button";
    distractionFree.textContent = state.focusMode ? "Exit distraction-free" : "Enter distraction-free";
    distractionFree.addEventListener("click", () => { state.focusMode = !state.focusMode; render(); });
    controls.append(timer, metronome, randomTime, slideshow, distractionFree);
    const note = document.createElement("p");
    note.className = "focusSessionNote";
    note.textContent = "The timer and metronome stay local and keep running while you view the slideshow.";
    page.append(intro, setup, controls, note);
    els.messages.appendChild(page);
}

function renderChannelQuiz() {
    const quiz = state.channelQuiz;
    const isZoomQuiz = state.activeView.type === "zoomQuiz";
    if (quiz.screen === "play") {
        renderChannelQuizPlay();
        return;
    }
    const quizSettings = getChannelQuizSettings();
    const highScore = getChannelQuizHighScore();
    const page = document.createElement("section");
    page.className = "channelQuiz";
    const intro = document.createElement("section");
    intro.className = "focusSessionIntro";
    intro.innerHTML = isZoomQuiz
        ? "<h3>Zoom quiz</h3><p>Pick the channels to draw from, then identify each image's source from a randomly cropped detail.</p>"
        : "<h3>Which channel?</h3><p>Pick the channels to draw from, then identify the source of each randomly chosen local image or GIF.</p>";
    const setup = document.createElement("section");
    setup.className = "channelQuizSetup";
    const all = document.createElement("label");
    const allInput = document.createElement("input");
    allInput.type = "checkbox";
    allInput.checked = quiz.useAllChannels;
    all.append(allInput, " Use all channels in this workspace");
    const sources = document.createElement("label");
    sources.textContent = "Or choose channels";
    const sourceInput = document.createElement("select");
    sourceInput.multiple = true;
    sourceInput.size = Math.min(7, Math.max(2, allChannels().length));
    allChannels().forEach((channel) => {
        const option = document.createElement("option");
        option.value = channel.id;
        option.textContent = `# ${channel.name}`;
        option.selected = quiz.channelIds.includes(channel.id);
        sourceInput.appendChild(option);
    });
    sources.appendChild(sourceInput);
    const mode = document.createElement("label");
    mode.textContent = "Answer with";
    const modeInput = document.createElement("select");
    [["choice", "Multiple choice"], ["text", "Type the channel name"]].forEach(([value, label]) => {
        const option = document.createElement("option"); option.value = value; option.textContent = label; option.selected = quiz.answerMode === value; modeInput.appendChild(option);
    });
    mode.appendChild(modeInput);
    const presets = document.createElement("details");
    presets.className = "channelQuizPresets";
    const presetsSummary = document.createElement("summary");
    presetsSummary.textContent = "Saved quiz presets";
    const presetHelp = document.createElement("p");
    presetHelp.textContent = "Save a channel selection and answer style so you can return to the same quiz setup in one tap.";
    const presetControls = document.createElement("div");
    presetControls.className = "channelQuizPresetControls";
    const presetSelect = document.createElement("select");
    const emptyPreset = document.createElement("option");
    emptyPreset.value = "";
    emptyPreset.textContent = "Choose a saved preset";
    presetSelect.appendChild(emptyPreset);
    getChannelQuizPresets().forEach((preset) => {
        const option = document.createElement("option");
        option.value = preset.id;
        option.textContent = preset.name;
        presetSelect.appendChild(option);
    });
    const loadPreset = document.createElement("button");
    loadPreset.type = "button";
    loadPreset.textContent = "Load";
    loadPreset.addEventListener("click", () => {
        const preset = getChannelQuizPresets().find((item) => item.id === presetSelect.value);
        if (!preset) { alert("Choose a saved quiz preset first."); return; }
        allInput.checked = Boolean(preset.useAllChannels);
        [...sourceInput.options].forEach((option) => { option.selected = (preset.channelIds || []).includes(option.value); });
        modeInput.value = preset.answerMode === "text" ? "text" : "choice";
    });
    const presetName = document.createElement("input");
    presetName.type = "text";
    presetName.maxLength = 48;
    presetName.placeholder = "New preset name";
    const savePreset = document.createElement("button");
    savePreset.type = "button";
    savePreset.textContent = "Save setup";
    savePreset.addEventListener("click", async () => {
        const name = normalizeDisplayName(presetName.value);
        if (!name) { alert("Give this quiz preset a name."); return; }
        await saveChannelQuizPreset({
            name,
            useAllChannels: allInput.checked,
            channelIds: [...sourceInput.selectedOptions].map((option) => option.value),
            answerMode: modeInput.value
        });
        presetName.value = "";
        renderMessages();
    });
    const deletePreset = document.createElement("button");
    deletePreset.type = "button";
    deletePreset.textContent = "Delete";
    deletePreset.addEventListener("click", async () => {
        if (!presetSelect.value) { alert("Choose a saved quiz preset first."); return; }
        await deleteChannelQuizPreset(presetSelect.value);
        renderMessages();
    });
    presetControls.append(presetSelect, loadPreset, presetName, savePreset, deletePreset);
    presets.append(presetsSummary, presetHelp, presetControls);
    const settings = document.createElement("details");
    settings.className = "channelQuizSettings";
    const settingsSummary = document.createElement("summary");
    settingsSummary.textContent = "Quiz settings and penalties";
    const bpmPenalty = document.createElement("label");
    const bpmPenaltyInput = document.createElement("input");
    bpmPenaltyInput.type = "checkbox";
    bpmPenaltyInput.checked = Boolean(quizSettings.increaseBpmOnWrong);
    bpmPenalty.append(bpmPenaltyInput, " Increase metronome BPM after a wrong answer");
    const bpmStep = document.createElement("label");
    bpmStep.textContent = "BPM increase";
    const bpmStepInput = document.createElement("input");
    bpmStepInput.type = "number";
    bpmStepInput.min = "1";
    bpmStepInput.max = "100";
    bpmStepInput.value = quizSettings.bpmIncrease;
    bpmStep.appendChild(bpmStepInput);
    const punishment = document.createElement("label");
    const punishmentInput = document.createElement("input");
    punishmentInput.type = "checkbox";
    punishmentInput.checked = Boolean(quizSettings.punishmentEnabled);
    punishment.append(punishmentInput, " Show a random punishment image after a wrong answer");
    const punishmentChannel = document.createElement("label");
    punishmentChannel.textContent = "Punishment image channel";
    const punishmentChannelInput = document.createElement("select");
    const noChannel = document.createElement("option");
    noChannel.value = "";
    noChannel.textContent = "Choose a channel";
    punishmentChannelInput.appendChild(noChannel);
    allChannels().forEach((channel) => {
        const option = document.createElement("option");
        option.value = channel.id;
        option.textContent = `# ${channel.name}`;
        option.selected = channel.id === quizSettings.punishmentChannelId;
        punishmentChannelInput.appendChild(option);
    });
    punishmentChannel.appendChild(punishmentChannelInput);
    const punishmentSeconds = document.createElement("label");
    punishmentSeconds.textContent = "Punishment seconds";
    const punishmentSecondsInput = document.createElement("input");
    punishmentSecondsInput.type = "number";
    punishmentSecondsInput.min = "1";
    punishmentSecondsInput.max = "60";
    punishmentSecondsInput.value = quizSettings.punishmentSeconds;
    punishmentSeconds.appendChild(punishmentSecondsInput);
    const randomCrop = document.createElement("label");
    const randomCropInput = document.createElement("input");
    randomCropInput.type = "checkbox";
    randomCropInput.checked = Boolean(quizSettings.randomCropEnabled);
    randomCrop.append(randomCropInput, " Randomly crop every quiz image");
    const cropSize = document.createElement("label");
    cropSize.textContent = "Visible crop size (%) — lower is harder";
    const cropSizeInput = document.createElement("input");
    cropSizeInput.type = "number";
    cropSizeInput.min = "20";
    cropSizeInput.max = "100";
    cropSizeInput.value = quizSettings.randomCropSize;
    cropSize.appendChild(cropSizeInput);
    const cropPreset = document.createElement("label");
    cropPreset.textContent = "Crop difficulty preset";
    const cropPresetInput = document.createElement("select");
    const presetForSize = ({ 80: "easy", 60: "normal", 35: "hard" })[Number(quizSettings.randomCropSize)] || "custom";
    [["easy", "Easy · 80% visible"], ["normal", "Normal · 60% visible"], ["hard", "Hard · 35% visible"], ["custom", "Custom percentage"]].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        option.selected = value === presetForSize;
        cropPresetInput.appendChild(option);
    });
    cropPreset.appendChild(cropPresetInput);
    cropPresetInput.addEventListener("change", () => {
        const presetSizes = { easy: 80, normal: 60, hard: 35 };
        if (presetSizes[cropPresetInput.value]) cropSizeInput.value = presetSizes[cropPresetInput.value];
        saveQuizSettings();
    });
    const saveQuizSettings = async () => {
        saveChannelQuizSettings({
            increaseBpmOnWrong: bpmPenaltyInput.checked,
            bpmIncrease: clampAdventureNumber(bpmStepInput.value, 1, 100, 10),
            punishmentEnabled: punishmentInput.checked,
            punishmentChannelId: punishmentChannelInput.value || null,
            punishmentSeconds: clampAdventureNumber(punishmentSecondsInput.value, 1, 60, 5),
            randomCropEnabled: randomCropInput.checked,
            randomCropSize: clampAdventureNumber(cropSizeInput.value, 20, 100, 60)
        });
    };
    [bpmPenaltyInput, bpmStepInput, punishmentInput, punishmentChannelInput, punishmentSecondsInput, randomCropInput, cropSizeInput].forEach((input) => input.addEventListener("change", saveQuizSettings));
    settings.append(settingsSummary, bpmPenalty, bpmStep, punishment, punishmentChannel, punishmentSeconds, randomCrop, cropPreset, cropSize);
    const start = document.createElement("button");
    start.type = "button";
    start.className = "adventurePrimary";
    start.textContent = quiz.current ? "Resume quiz" : quiz.ended ? "Start new quiz" : isZoomQuiz ? "Start zoom quiz" : "Start quiz";
    start.addEventListener("click", () => {
        quiz.useAllChannels = allInput.checked;
        quiz.channelIds = [...sourceInput.selectedOptions].map((option) => option.value);
        quiz.answerMode = modeInput.value;
        if (quiz.current) {
            quiz.screen = "play";
            renderMessages();
            return;
        }
        if (quiz.ended) {
            quiz.score = 0;
            quiz.rounds = 0;
            quiz.ended = false;
        }
        quiz.lastChannelId = null;
        quiz.answering = false;
        quiz.screen = "play";
        drawChannelQuizQuestion();
    });
    setup.append(all, sources, mode, presets, settings, start);
    page.append(intro, setup);
    els.messages.appendChild(page);
}

function renderChannelQuizPlay() {
    const quiz = state.channelQuiz;
    const isZoomQuiz = state.activeView.type === "zoomQuiz";
    const quizSettings = getChannelQuizSettings();
    const highScore = getChannelQuizHighScore();
    const page = document.createElement("section");
    page.className = "channelQuiz channelQuizPlay";
    const header = document.createElement("section");
    header.className = "channelQuizPlayHeader";
    const title = document.createElement("div");
    const heading = document.createElement("h3");
    heading.textContent = isZoomQuiz ? "Zoom quiz" : "Which channel?";
    const score = document.createElement("p");
    score.className = "channelQuizScore";
    score.textContent = `${quiz.score} correct out of ${quiz.rounds} answered · high score: ${highScore.bestCorrect} correct`;
    title.append(heading, score);
    const setupButton = document.createElement("button");
    setupButton.type = "button";
    setupButton.textContent = "Quiz settings";
    setupButton.addEventListener("click", () => { quiz.screen = "setup"; renderMessages(); });
    header.append(title, setupButton);
    page.appendChild(header);

    const actions = document.createElement("div");
    actions.className = "channelQuizActions";
    const fresh = document.createElement("button");
    fresh.type = "button";
    fresh.textContent = "Start a fresh score";
    fresh.addEventListener("click", () => {
        window.clearTimeout(channelQuizPunishmentTimer);
        window.clearTimeout(channelQuizAdvanceTimer);
        quiz.score = 0;
        quiz.rounds = 0;
        quiz.current = null;
        quiz.punishment = null;
        quiz.ended = false;
        quiz.lastChannelId = null;
        quiz.answering = false;
        quiz.screen = "setup";
        renderMessages();
    });
    actions.appendChild(fresh);
    if (!quiz.ended) {
        const busted = document.createElement("button");
        busted.type = "button";
        busted.className = "channelQuizBustedButton";
        busted.textContent = "Busted — end quiz";
        busted.addEventListener("click", finishChannelQuizAsBusted);
        actions.appendChild(busted);
    }
    page.appendChild(actions);

    if (quiz.ended) {
        const result = document.createElement("section");
        result.className = "channelQuizBusted";
        const resultHeading = document.createElement("h3");
        resultHeading.textContent = "Quiz busted";
        const message = document.createElement("p");
        message.textContent = `Final score: ${quiz.score} correct out of ${quiz.rounds}.`;
        result.append(resultHeading, message);
        page.appendChild(result);
        els.messages.appendChild(page);
        return;
    }

    if (quiz.punishment) {
        const punishmentPanel = document.createElement("section");
        punishmentPanel.className = "channelQuizPunishment";
        const note = document.createElement("p");
        note.textContent = `Wrong answer. Returning to a new question in ${quizSettings.punishmentSeconds} seconds…`;
        punishmentPanel.append(note, renderAdventurePlayerMedia(quiz.punishment.ref));
        page.appendChild(punishmentPanel);
        els.messages.appendChild(page);
        return;
    }

    const attachment = quiz.current ? findAttachment(quiz.current.ref) : null;
    if (!attachment) {
        const recovery = document.createElement("button");
        recovery.type = "button";
        recovery.className = "adventurePrimary";
        recovery.textContent = "Draw next question";
        recovery.addEventListener("click", drawChannelQuizQuestion);
        page.appendChild(recovery);
        els.messages.appendChild(page);
        return;
    }

    const content = document.createElement("section");
    content.className = "channelQuizPlayContent";
    const media = renderAdventurePlayerMedia(quiz.current.ref);
    media.classList.add("channelQuizMedia");
    if (quiz.crop && !quiz.revealed) {
        media.classList.add("isCropped");
        const image = media.querySelector("img");
        if (image) {
            image.style.transform = `scale(${quiz.crop.scale})`;
            image.style.transformOrigin = `${quiz.crop.x}% ${quiz.crop.y}%`;
        }
    } else if (quiz.crop && quiz.revealed) {
        media.classList.add("isRevealed");
    }
    const answerPanel = document.createElement("section");
    answerPanel.className = "channelQuizAnswerPanel";
    const question = document.createElement("h3");
    question.textContent = quiz.answerMode === "text" ? "Type the channel name" : "Which channel did this image come from?";
    const answerArea = document.createElement("div");
    answerArea.className = "adventurePlayerChoices";
    if (quiz.feedback) {
        const feedback = document.createElement("p");
        feedback.className = `channelQuizFeedback ${quiz.feedback.correct ? "isCorrect" : "isWrong"}`;
        feedback.textContent = `${quiz.feedback.correct ? "Correct" : "Not quite"} — it was #${quiz.feedback.sourceName}. Revealing the full image…`;
        answerArea.appendChild(feedback);
        answerPanel.append(question, answerArea);
        content.append(media, answerPanel);
        page.appendChild(content);
        els.messages.appendChild(page);
        return;
    }
    if (quiz.answerMode === "text") {
        const input = document.createElement("input");
        input.type = "text";
        input.autocomplete = "off";
        input.spellcheck = false;
        input.placeholder = "Channel name";
        const suggestions = document.createElement("div");
        suggestions.className = "channelQuizSuggestions";
        const eligible = [...new Set([quiz.current.ref.channelId, ...(quiz.useAllChannels ? allChannels().map((channel) => channel.id) : quiz.channelIds)])]
            .map((id) => getChannelById(id))
            .filter(Boolean);
        const renderSuggestions = () => {
            const typed = input.value.trim().replace(/^#\s*/, "").toLowerCase();
            suggestions.replaceChildren();
            if (!typed) {
                suggestions.hidden = true;
                return;
            }
            eligible
                .filter((channel) => channel.name.toLowerCase().includes(typed))
                .slice(0, 5)
                .forEach((channel) => {
                    const suggestion = document.createElement("button");
                    suggestion.type = "button";
                    suggestion.textContent = `# ${channel.name}`;
                    suggestion.addEventListener("click", () => answerChannelQuiz(channel.name));
                    suggestions.appendChild(suggestion);
                });
            suggestions.hidden = suggestions.childElementCount === 0;
        };
        const submit = document.createElement("button");
        submit.type = "button";
        submit.className = "adventureChoiceButton adventurePrimary";
        submit.textContent = "Check answer";
        submit.addEventListener("click", () => answerChannelQuiz(input.value));
        input.addEventListener("input", renderSuggestions);
        input.addEventListener("keydown", (event) => { if (event.key === "Enter") answerChannelQuiz(input.value); });
        answerArea.append(input, suggestions, submit);
        requestAnimationFrame(() => input.focus());
    } else {
        const eligible = quiz.useAllChannels ? allChannels().map((channel) => channel.id) : quiz.channelIds;
        [...new Set([quiz.current.ref.channelId, ...eligible])]
            .map((id) => getChannelById(id))
            .filter(Boolean)
            .sort(() => Math.random() - .5)
            .forEach((channel) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "adventureChoiceButton";
                button.textContent = `# ${channel.name}`;
                button.addEventListener("click", () => answerChannelQuiz(channel.id));
                answerArea.appendChild(button);
            });
    }
    answerPanel.append(question, answerArea);
    content.append(media, answerPanel);
    page.appendChild(content);
    els.messages.appendChild(page);
}

function renderRandomZoom() {
    const page = document.createElement("section");
    page.className = "randomZoom";
    const intro = document.createElement("section");
    intro.className = "focusSessionIntro";
    intro.innerHTML = "<h3>Random zoom</h3><p>Reveal a randomly cropped detail from one local photo or GIF in this workspace.</p>";
    const controls = document.createElement("div");
    controls.className = "randomZoomControls";
    const difficulty = document.createElement("label");
    difficulty.textContent = "Crop difficulty";
    const difficultyInput = document.createElement("select");
    [["easy", "Easy · 80% visible"], ["normal", "Normal · 60% visible"], ["hard", "Hard · 35% visible"], ["custom", "Custom"]].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        option.selected = state.randomZoomPreset === value;
        difficultyInput.appendChild(option);
    });
    const customSize = document.createElement("input");
    customSize.type = "number";
    customSize.min = "20";
    customSize.max = "100";
    customSize.value = state.randomZoomSize;
    customSize.setAttribute("aria-label", "Custom visible crop size percentage");
    customSize.hidden = state.randomZoomPreset !== "custom";
    difficultyInput.addEventListener("change", () => {
        state.randomZoomPreset = difficultyInput.value;
        const presetSizes = { easy: 80, normal: 60, hard: 35 };
        if (presetSizes[difficultyInput.value]) state.randomZoomSize = presetSizes[difficultyInput.value];
        renderMessages();
    });
    customSize.addEventListener("change", () => {
        state.randomZoomPreset = "custom";
        state.randomZoomSize = clampAdventureNumber(customSize.value, 20, 100, 60);
        renderMessages();
    });
    difficulty.append(difficultyInput, customSize);
    const next = document.createElement("button");
    next.type = "button";
    next.className = "adventurePrimary";
    next.textContent = state.randomZoom ? "Another random zoom" : "Reveal random detail";
    next.addEventListener("click", drawRandomZoom);
    const slideshow = document.createElement("button");
    slideshow.type = "button";
    slideshow.textContent = randomZoomSlideshowTimer ? "Pause auto reveal" : "Start auto reveal";
    slideshow.addEventListener("click", toggleRandomZoomSlideshow);
    const speed = document.createElement("select");
    [[3000, "3 sec"], [5000, "5 sec"], [8000, "8 sec"]].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = label;
        option.selected = state.randomZoomSlideshowMs === value;
        speed.appendChild(option);
    });
    speed.setAttribute("aria-label", "Random zoom slideshow speed");
    speed.addEventListener("change", () => {
        state.randomZoomSlideshowMs = Number.parseInt(speed.value, 10) || 5000;
        if (randomZoomSlideshowTimer) {
            stopRandomZoomSlideshow();
            toggleRandomZoomSlideshow();
        }
    });
    controls.append(difficulty, next, slideshow, speed);
    page.append(intro, controls);

    const zoom = state.randomZoom;
    const attachment = zoom ? findAttachment(zoom.ref) : null;
    if (zoom && attachment) {
        const frame = document.createElement("figure");
        frame.className = "randomZoomFrame";
        const image = document.createElement("img");
        const objectUrl = attachment.blob ? URL.createObjectURL(attachment.blob) : "";
        image.src = objectUrl || attachment.dataUrl || "";
        image.alt = attachment.note || attachment.name || "Random local photo";
        image.style.transform = `scale(${zoom.scale})`;
        image.style.transformOrigin = `${zoom.x}% ${zoom.y}%`;
        if (objectUrl) image.addEventListener("load", () => URL.revokeObjectURL(objectUrl), { once: true });
        image.addEventListener("click", () => openImageViewer(attachment, image.alt));
        const caption = document.createElement("figcaption");
        caption.textContent = `# ${getChannelById(zoom.ref.channelId)?.name || "channel"} · ${attachment.note || attachment.name || "Local image"} · tap to view full image`;
        frame.append(image, caption);
        const full = document.createElement("button");
        full.type = "button";
        full.textContent = "View full image";
        full.addEventListener("click", () => openImageViewer(attachment, image.alt));
        page.append(frame, full);
    }
    els.messages.appendChild(page);
}

function drawRandomZoom() {
    const candidates = getServerEntries().flatMap((entry) => (
        (entry.message.attachments || [])
            .filter((attachment) => attachment.type?.startsWith("image/") && shouldShowAttachment(attachment))
            .map((attachment) => ({
                ref: { channelId: entry.channelId, messageId: entry.message.id, attachmentId: attachment.id }
            }))
    ));
    const chosen = randomItem(candidates);
    if (!chosen) {
        alert("Add a local image or GIF to this workspace first.");
        return;
    }
    state.randomZoom = {
        ref: chosen.ref,
        scale: 100 / clampAdventureNumber(state.randomZoomSize, 20, 100, 60),
        x: 18 + Math.random() * 64,
        y: 18 + Math.random() * 64
    };
    renderMessages();
}

function stopRandomZoomSlideshow() {
    window.clearInterval(randomZoomSlideshowTimer);
    randomZoomSlideshowTimer = null;
}

function toggleRandomZoomSlideshow() {
    if (randomZoomSlideshowTimer) {
        stopRandomZoomSlideshow();
        renderMessages();
        return;
    }
    drawRandomZoom();
    randomZoomSlideshowTimer = window.setInterval(() => {
        if (state.activeView.type !== "randomZoom") {
            stopRandomZoomSlideshow();
            return;
        }
        drawRandomZoom();
    }, state.randomZoomSlideshowMs);
    renderMessages();
}

function drawChannelQuizQuestion() {
    const quiz = state.channelQuiz;
    window.clearTimeout(channelQuizAdvanceTimer);
    const allowed = quiz.useAllChannels ? null : new Set(quiz.channelIds);
    const candidatesByChannel = new Map();
    getServerEntries().forEach((entry) => {
        if (allowed && !allowed.has(entry.channelId)) return;
        const images = (entry.message.attachments || [])
            .filter((attachment) => attachment.type?.startsWith("image/") && shouldShowAttachment(attachment))
            .map((attachment) => ({ ref: { channelId: entry.channelId, messageId: entry.message.id, attachmentId: attachment.id } }));
        if (images.length === 0) return;
        candidatesByChannel.set(entry.channelId, [...(candidatesByChannel.get(entry.channelId) || []), ...images]);
    });
    const channelCandidates = [...candidatesByChannel.values()];
    const chosen = randomItem(randomItem(channelCandidates) || []);
    if (!chosen) { alert("Choose at least one channel with local images, or use all channels."); return; }
    quiz.current = chosen;
    const settings = getChannelQuizSettings();
    const visiblePercent = clampAdventureNumber(settings.randomCropSize, 20, 100, 60);
    quiz.crop = (settings.randomCropEnabled || state.activeView.type === "zoomQuiz") ? {
        scale: 100 / visiblePercent,
        x: 18 + Math.random() * 64,
        y: 18 + Math.random() * 64
    } : null;
    quiz.feedback = null;
    quiz.revealed = false;
    quiz.screen = "play";
    quiz.answering = false;
    renderMessages();
}

async function answerChannelQuiz(answer) {
    const quiz = state.channelQuiz;
    if (!quiz.current || quiz.answering) return;
    quiz.answering = true;
    const source = getChannelById(quiz.current.ref.channelId);
    const typed = String(answer || "").trim().replace(/^#\s*/, "").toLowerCase();
    const correct = quiz.answerMode === "text" ? typed === String(source?.name || "").toLowerCase() : answer === quiz.current.ref.channelId;
    quiz.rounds += 1;
    if (correct) {
        quiz.score += 1;
        await saveChannelQuizHighScore();
        showChannelQuizReveal(true, source?.name || "channel");
        return;
    }
    const settings = getChannelQuizSettings();
    if (settings.increaseBpmOnWrong) {
        els.metronomeBpm.value = clampAdventureNumber(Number(els.metronomeBpm.value || state.structure.settings.metronomeBpm) + settings.bpmIncrease, 20, 300, 120);
        await saveMetronomeSettings();
        if (metronomeTimer) startMetronome();
    }
    const punishmentRef = getChannelQuizPunishmentRef(settings);
    showChannelQuizReveal(false, source?.name || "channel", settings.punishmentEnabled ? punishmentRef : null);
}

function showChannelQuizReveal(correct, sourceName, punishmentRef = null) {
    const quiz = state.channelQuiz;
    quiz.feedback = { correct, sourceName };
    quiz.revealed = true;
    renderMessages();
    window.clearTimeout(channelQuizAdvanceTimer);
    channelQuizAdvanceTimer = window.setTimeout(() => {
        quiz.feedback = null;
        quiz.revealed = false;
        if (!correct && punishmentRef) {
            quiz.punishment = { ref: punishmentRef };
            renderMessages();
            window.clearTimeout(channelQuizPunishmentTimer);
            channelQuizPunishmentTimer = window.setTimeout(() => {
                quiz.punishment = null;
                drawChannelQuizQuestion();
            }, getChannelQuizSettings().punishmentSeconds * 1000);
            return;
        }
        drawChannelQuizQuestion();
    }, 1200);
}

async function finishChannelQuizAsBusted() {
    const quiz = state.channelQuiz;
    if (quiz.ended) return;
    window.clearTimeout(channelQuizPunishmentTimer);
    window.clearTimeout(channelQuizAdvanceTimer);
    quiz.current = null;
    quiz.punishment = null;
    quiz.answering = false;
    quiz.ended = true;
    await saveChannelQuizHighScore();
    renderMessages();
}

function getChannelQuizSettings() {
    const serverId = getActiveServer()?.id || "main";
    const saved = state.structure.settings.channelQuizSettings?.[serverId] || {};
    const defaultPunishment = allChannels().find((channel) => channel.name.toLowerCase() === "punishment")?.id || null;
    return {
        increaseBpmOnWrong: false,
        bpmIncrease: 10,
        punishmentEnabled: false,
        punishmentChannelId: defaultPunishment,
        punishmentSeconds: 5,
        randomCropEnabled: false,
        randomCropSize: 60,
        ...saved
    };
}

async function saveChannelQuizSettings(settings) {
    const serverId = getActiveServer()?.id || "main";
    state.structure.settings.channelQuizSettings ||= {};
    state.structure.settings.channelQuizSettings[serverId] = settings;
    await saveStructure(state.structure);
}

function getChannelQuizHighScore() {
    const serverId = getActiveServer()?.id || "main";
    return state.structure.settings.channelQuizHighScores?.[serverId] || { bestCorrect: 0, bestRounds: 0 };
}

function getChannelQuizPresets() {
    const serverId = getActiveServer()?.id || "main";
    return state.structure.settings.channelQuizPresets?.[serverId] || [];
}

async function saveChannelQuizPreset(preset) {
    const serverId = getActiveServer()?.id || "main";
    state.structure.settings.channelQuizPresets ||= {};
    const existing = getChannelQuizPresets();
    const normalizedName = preset.name.toLowerCase();
    const matching = existing.find((item) => item.name.toLowerCase() === normalizedName);
    const item = {
        id: matching?.id || crypto.randomUUID(),
        name: preset.name,
        useAllChannels: Boolean(preset.useAllChannels),
        channelIds: [...new Set(preset.channelIds || [])],
        answerMode: preset.answerMode === "text" ? "text" : "choice",
        updatedAt: new Date().toISOString()
    };
    state.structure.settings.channelQuizPresets[serverId] = matching
        ? existing.map((existingPreset) => existingPreset.id === matching.id ? item : existingPreset)
        : [...existing, item];
    await saveStructure(state.structure);
}

async function deleteChannelQuizPreset(presetId) {
    const serverId = getActiveServer()?.id || "main";
    state.structure.settings.channelQuizPresets ||= {};
    state.structure.settings.channelQuizPresets[serverId] = getChannelQuizPresets().filter((preset) => preset.id !== presetId);
    await saveStructure(state.structure);
}

async function saveChannelQuizHighScore() {
    const serverId = getActiveServer()?.id || "main";
    const existing = getChannelQuizHighScore();
    if (state.channelQuiz.score <= existing.bestCorrect) return;
    state.structure.settings.channelQuizHighScores ||= {};
    state.structure.settings.channelQuizHighScores[serverId] = { bestCorrect: state.channelQuiz.score, bestRounds: state.channelQuiz.rounds, achievedAt: new Date().toISOString() };
    await saveStructure(state.structure);
}

function getChannelQuizPunishmentRef(settings) {
    if (!settings.punishmentChannelId) return null;
    const candidates = (state.messagesByChannel.get(settings.punishmentChannelId) || []).flatMap((message) => (
        (message.attachments || []).filter((attachment) => attachment.type?.startsWith("image/") && shouldShowAttachment(attachment)).map((attachment) => ({
            channelId: settings.punishmentChannelId,
            messageId: message.id,
            attachmentId: attachment.id
        }))
    ));
    return randomItem(candidates);
}

function renderStatsPage() {
    const stats = getWorkspaceStats();
    const page = document.createElement("section");
    page.className = "statsPage";
    const intro = document.createElement("section");
    intro.className = "statsIntro";
    const title = document.createElement("h3");
    title.textContent = `${getActiveServer()?.name || "Workspace"} at a glance`;
    const description = document.createElement("p");
    description.textContent = "These counts use only the notes and media stored locally in this workspace.";
    intro.append(title, description);
    const metricGrid = document.createElement("div");
    metricGrid.className = "statsMetricGrid";
    [
        ["Notes", stats.notes],
        ["Photos / GIFs", stats.photos],
        ["GIFs", stats.gifs],
        ["Reaction uses", stats.reactionTotal],
        ["Pinned notes", stats.pinned],
        ["Favorite photos", stats.favorites]
    ].forEach(([label, value]) => {
        const card = document.createElement("div");
        card.className = "statsMetric";
        const number = document.createElement("strong");
        number.textContent = String(value);
        const caption = document.createElement("span");
        caption.textContent = label;
        card.append(number, caption);
        metricGrid.appendChild(card);
    });
    const reactionSection = document.createElement("section");
    reactionSection.className = "statsSection";
    const reactionHeading = document.createElement("h3");
    reactionHeading.textContent = "Emoji reactions";
    const reactionHelp = document.createElement("p");
    reactionHelp.textContent = "Each card shows the total uses of an emoji and the channels where it appears most.";
    reactionSection.append(reactionHeading, reactionHelp);
    if (stats.reactions.length === 0) reactionSection.appendChild(emptyPanel("No emoji reactions in this workspace yet."));
    else {
        const grid = document.createElement("div");
        grid.className = "statsReactionGrid";
        stats.reactions.forEach((reaction) => {
            const card = document.createElement("article");
            card.className = "statsReactionCard";
            const emoji = document.createElement("strong");
            emoji.textContent = reaction.emoji;
            const total = document.createElement("span");
            total.textContent = `${reaction.total} total`;
            const channelList = document.createElement("div");
            channelList.className = "statsReactionChannels";
            [...reaction.channels.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([channelId, count]) => {
                const channel = getChannelById(channelId);
                const row = document.createElement("button");
                row.type = "button";
                row.textContent = `# ${channel?.name || "missing"} · ${count}`;
                row.addEventListener("click", () => openView("channel", channelId));
                channelList.appendChild(row);
            });
            const open = document.createElement("button");
            open.type = "button";
            open.className = "statsOpenReaction";
            open.textContent = "Open reactions";
            open.addEventListener("click", () => openView("emoji", reaction.emoji));
            card.append(emoji, total, channelList, open);
            grid.appendChild(card);
        });
        reactionSection.appendChild(grid);
    }
    const channelSection = document.createElement("section");
    channelSection.className = "statsSection";
    const channelHeading = document.createElement("h3");
    channelHeading.textContent = "Channel activity";
    const channelHelp = document.createElement("p");
    channelHelp.textContent = "Most active channels in this workspace, including reactions received.";
    const channelList = document.createElement("div");
    channelList.className = "statsChannelList";
    stats.channels.sort((a, b) => (b.reactions + b.notes + b.photos) - (a.reactions + a.notes + a.photos) || a.channel.name.localeCompare(b.channel.name)).forEach((item) => {
        const row = document.createElement("button");
        row.type = "button";
        const name = document.createElement("strong");
        name.textContent = `# ${item.channel.name}`;
        const detail = document.createElement("span");
        detail.textContent = `${item.notes} notes · ${item.photos} photos · ${item.reactions} reactions`;
        row.append(name, detail);
        row.addEventListener("click", () => openView("channel", item.channel.id));
        channelList.appendChild(row);
    });
    channelSection.append(channelHeading, channelHelp, channelList);
    const tagSection = document.createElement("section");
    tagSection.className = "statsSection";
    const tagHeading = document.createElement("h3");
    tagHeading.textContent = "Popular tags";
    tagSection.appendChild(tagHeading);
    if (stats.tags.length === 0) tagSection.appendChild(emptyPanel("No #tags in this workspace yet."));
    else {
        const tags = document.createElement("div");
        tags.className = "statsTags";
        stats.tags.slice(0, 24).forEach(([tag, count]) => {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.textContent = `#${tag} · ${count}`;
            chip.addEventListener("click", () => {
                els.searchInput.value = `#${tag}`;
                state.search = `#${tag}`.toLowerCase();
                openView("channel", state.activeChannelId);
            });
            tags.appendChild(chip);
        });
        tagSection.appendChild(tags);
    }
    page.append(intro, metricGrid, reactionSection, channelSection, tagSection);
    els.messages.appendChild(page);
}

function renderSettingsPage() {
    const server = getActiveServer();
    const page = document.createElement("section");
    page.className = "settingsPage";

    const intro = document.createElement("div");
    intro.className = "settingsIntro";
    intro.innerHTML = `<h3>${escapeHTML(server?.name || "Workspace")}</h3><p>Organize channels under categories. Everything is saved in this browser on this device.</p>`;
    page.appendChild(intro);

    const backup = document.createElement("section");
    backup.className = "settingsCategory";
    backup.innerHTML = "<h4>Private backup</h4><p>Export includes local notes, images/GIFs, organization, and adventures. Import replaces this device’s current local data after confirmation.</p>";
    const exportButton = document.createElement("button");
    exportButton.type = "button";
    exportButton.textContent = "Export local backup";
    exportButton.addEventListener("click", exportLocalBackup);
    const importButton = document.createElement("button");
    importButton.type = "button";
    importButton.textContent = "Import local backup";
    const importInput = document.createElement("input");
    importInput.type = "file";
    importInput.accept = "application/json,.knowledge-backup.json";
    importInput.hidden = true;
    importButton.addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", () => importLocalBackup(importInput.files?.[0]));
    backup.append(exportButton, importButton, importInput);
    page.appendChild(backup);

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

async function attachmentToBackup(attachment) {
    const copy = { ...attachment };
    if (attachment.blob) {
        copy.dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(attachment.blob);
        });
        delete copy.blob;
    }
    return copy;
}

async function exportLocalBackup() {
    const entries = await getAllChannelMessages();
    const messages = await Promise.all(entries.map(async ({ channelId, messages: channelMessages }) => ({
        channelId,
        messages: await Promise.all(channelMessages.map(async (message) => ({
            ...message,
            attachments: await Promise.all((message.attachments || []).map(attachmentToBackup))
        })))
    })));
    const backup = { format: "knowledge-discord-backup", version: 1, exportedAt: new Date().toISOString(), structure: state.structure, messages };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `knowledge-discord-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importLocalBackup(file) {
    if (!file) return;
    try {
        const backup = JSON.parse(await file.text());
        if (backup.format !== "knowledge-discord-backup" || !backup.structure || !Array.isArray(backup.messages)) throw new Error("Invalid backup format");
        if (!confirm("Import this backup? It will replace the current local notes, photos, organization, and adventures on this device.")) return;
        const structure = normalizeStructure(backup.structure);
        await replaceAllChannelMessages(backup.messages);
        await saveStructure(structure);
        state.structure = structure;
        state.messagesByChannel.clear();
        state.activeAdventureSessionId = null;
        selectInitialChannel();
        await loadActiveChannelMessages();
        hydrateSettingsControls();
        render();
        refreshStorageEstimate();
        alert("Local backup imported.");
    } catch (error) {
        alert(`Could not import backup: ${error.message || "invalid file"}`);
    }
}

function getAdventures() {
    return state.structure.settings.adventures || [];
}

function getAdventure(adventureId) {
    return getAdventures().find((adventure) => adventure.id === adventureId);
}

function queueAdventureAutosave(status = document.querySelector(".adventureSaveStatus")) {
    if (status) status.textContent = "Saving…";
    window.clearTimeout(adventureAutosaveTimer);
    adventureAutosaveTimer = window.setTimeout(async () => {
        try {
            await saveAdventures();
            if (status) status.textContent = "Saved locally";
        } catch {
            if (status) status.textContent = "Could not save";
        } finally {
            adventureAutosaveTimer = undefined;
        }
    }, 500);
}

function renderAdventureMap(adventureId) {
    const adventure = getAdventure(adventureId);
    if (!adventure) {
        els.messages.appendChild(emptyPanel("Adventure not found."));
        return;
    }
    const page = document.createElement("section");
    page.className = "adventureMap";
    const intro = document.createElement("p");
    intro.textContent = "Scene map. Each card lists its outgoing paths; tap a card to edit it.";
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = "Back to editor";
    back.addEventListener("click", () => openView("adventureEditor", adventureId));
    page.append(intro, back);
    const canvas = document.createElement("div");
    canvas.className = "adventureMapCanvas";
    adventure.scenes.forEach((scene, index) => {
        const node = document.createElement("button");
        node.type = "button";
        node.className = "adventureMapNode";
        const heading = document.createElement("strong");
        heading.textContent = `${index + 1}. ${scene.title || "Untitled scene"}`;
        const paths = document.createElement("span");
        const labels = [
            ...(scene.choices || []).map((choice) => choice.label || "Choice"),
            ...(scene.randomEvent?.type === "quiz" ? scene.randomEvent.answers?.map((answer) => answer.label || "Answer") || [] : []),
            ...(scene.randomEvent?.type === "dice" ? ["Dice branch"] : []),
            ...(scene.randomEvent?.type === "weighted" ? ["Weighted path"] : []),
            ...(scene.randomEvent?.type === "wheel" ? ["Spinning wheel"] : []),
            ...(scene.randomEvent?.type === "timer" ? ["Countdown timer"] : [])
        ];
        paths.textContent = scene.isEnding ? "Ending" : labels.length ? `→ ${labels.join(" · ")}` : "No outgoing path";
        node.append(heading, paths);
        node.addEventListener("click", () => {
            state.focusAdventureSceneId = scene.id;
            openView("adventureEditor", adventureId);
        });
        canvas.appendChild(node);
    });
    page.appendChild(canvas);
    els.messages.appendChild(page);
}

function renderAdventureStudio() {
    const page = document.createElement("section");
    page.className = "adventureStudio";
    const intro = document.createElement("div");
    intro.className = "adventureIntro";
    intro.innerHTML = "<h3>Choose your adventure</h3><p>Build branching stories using references to your local photos and GIFs from any server.</p>";
    const create = document.createElement("button");
    create.type = "button";
    create.className = "adventurePrimary";
    create.textContent = "Create adventure";
    create.addEventListener("click", createAdventure);
    intro.appendChild(create);
    page.appendChild(intro);

    const adventures = getAdventures();
    if (adventures.length === 0) {
        page.appendChild(emptyPanel("No adventures yet. Create one to begin."));
    }
    adventures.forEach((adventure) => {
        const card = document.createElement("article");
        card.className = "adventureCard";
        const title = document.createElement("h4");
        title.textContent = adventure.title;
        const meta = document.createElement("p");
        meta.textContent = `${adventure.scenes.length} scene${adventure.scenes.length === 1 ? "" : "s"} · ${adventure.description || "No description"}`;
        const edit = document.createElement("button");
        edit.type = "button";
        edit.textContent = "Edit";
        edit.addEventListener("click", () => openView("adventureEditor", adventure.id));
        const play = document.createElement("button");
        play.type = "button";
        play.className = "adventurePrimary";
        play.textContent = getAdventureSession(adventure.id) ? "Play / resume" : "Play";
        play.addEventListener("click", () => startAdventurePlay(adventure.id));
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "dangerAction";
        remove.textContent = "Delete";
        remove.addEventListener("click", () => deleteAdventure(adventure.id));
        card.append(title, meta, play, edit, remove);
        page.appendChild(card);
    });
    els.messages.appendChild(page);
}

function renderAdventureEditor(adventureId) {
    const adventure = getAdventure(adventureId);
    if (!adventure) {
        els.messages.appendChild(emptyPanel("Adventure not found."));
        return;
    }

    const page = document.createElement("section");
    page.className = "adventureEditor";
    const details = document.createElement("section");
    details.className = "adventureDetails";
    const saveStatus = document.createElement("output");
    saveStatus.className = "adventureSaveStatus";
    saveStatus.textContent = "Saved locally";
    const title = document.createElement("input");
    title.type = "text";
    title.value = adventure.title;
    title.placeholder = "Adventure title";
    title.addEventListener("input", () => {
        adventure.title = normalizeDisplayName(title.value) || "Untitled adventure";
        queueAdventureAutosave(saveStatus);
    });
    const description = document.createElement("textarea");
    description.rows = 2;
    description.value = adventure.description || "";
    description.placeholder = "Short description";
    description.addEventListener("input", () => {
        adventure.description = description.value;
        queueAdventureAutosave(saveStatus);
    });
    const showStats = document.createElement("label");
    const showStatsInput = document.createElement("input");
    showStatsInput.type = "checkbox";
    showStatsInput.checked = Boolean(adventure.showStats);
    showStats.append(showStatsInput, " Show stats while playing (off by default)");
    const showProgress = document.createElement("label");
    const showProgressInput = document.createElement("input");
    showProgressInput.type = "checkbox";
    showProgressInput.checked = adventure.showProgress !== false;
    showProgress.append(showProgressInput, " Show scene progress while playing");
    const vibration = document.createElement("label");
    const vibrationInput = document.createElement("input");
    vibrationInput.type = "checkbox";
    vibrationInput.checked = Boolean(adventure.vibrateOnTimer);
    vibration.append(vibrationInput, " Vibrate when an adventure timer finishes (if supported)");
    const editorMode = document.createElement("label");
    editorMode.textContent = "Editor mode";
    const editorModeInput = document.createElement("select");
    [["basic", "Basic"], ["advanced", "Advanced"]].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        option.selected = value === (adventure.editorMode || "basic");
        editorModeInput.appendChild(option);
    });
    editorMode.appendChild(editorModeInput);
    const modeHelp = document.createElement("p");
    modeHelp.className = "adventureModeHelp";
    const updateModeHelp = () => {
        modeHelp.textContent = editorModeInput.value === "advanced"
            ? "Advanced adds optional variables, conditions, and scene effects. Your story can still stay simple."
            : "Basic keeps each scene focused on text, local media, choices, and endings. Switch to Advanced only when you need rules or variables.";
    };
    updateModeHelp();
    editorModeInput.addEventListener("change", () => {
        adventure.editorMode = editorModeInput.value;
        updateModeHelp();
        queueAdventureAutosave(saveStatus);
    });
    const enableVariables = document.createElement("label");
    const enableVariablesInput = document.createElement("input");
    enableVariablesInput.type = "checkbox";
    enableVariablesInput.checked = Boolean(adventure.enableVariables);
    enableVariables.append(enableVariablesInput, " Enable variables, health, and stats mechanics");
    enableVariablesInput.addEventListener("change", () => {
        adventure.enableVariables = enableVariablesInput.checked;
        queueAdventureAutosave(saveStatus);
    });
    showStatsInput.addEventListener("change", () => {
        adventure.showStats = showStatsInput.checked;
        queueAdventureAutosave(saveStatus);
    });
    showProgressInput.addEventListener("change", () => { adventure.showProgress = showProgressInput.checked; queueAdventureAutosave(saveStatus); });
    vibrationInput.addEventListener("change", () => { adventure.vibrateOnTimer = vibrationInput.checked; queueAdventureAutosave(saveStatus); });
    const adventureMetronome = document.createElement("label");
    const adventureMetronomeInput = document.createElement("input");
    adventureMetronomeInput.type = "checkbox";
    adventureMetronomeInput.checked = adventure.metronomeEnabled !== false;
    adventureMetronome.append(adventureMetronomeInput, " Include a metronome control when playing this adventure");
    const adventureBpm = numericField("Adventure metronome BPM", adventure.metronomeBpm || state.structure.settings.metronomeBpm);
    const startScene = document.createElement("label");
    startScene.textContent = "Start scene";
    const startSceneInput = document.createElement("select");
    adventure.scenes.forEach((scene, index) => {
        const option = document.createElement("option");
        option.value = scene.id;
        option.textContent = `${index + 1}. ${scene.title || "Untitled scene"}`;
        option.selected = scene.id === (adventure.startSceneId || adventure.scenes[0]?.id);
        startSceneInput.appendChild(option);
    });
    startScene.appendChild(startSceneInput);
    startSceneInput.addEventListener("change", () => {
        adventure.startSceneId = startSceneInput.value;
        queueAdventureAutosave(saveStatus);
    });
    adventureMetronomeInput.addEventListener("change", () => {
        adventure.metronomeEnabled = adventureMetronomeInput.checked;
        queueAdventureAutosave(saveStatus);
    });
    adventureBpm.input.addEventListener("input", () => {
        adventure.metronomeBpm = clampAdventureNumber(adventureBpm.input.value, 20, 300, 120);
        adventure.startSceneId = startSceneInput.value;
        queueAdventureAutosave(saveStatus);
    });
    const variables = renderAdventureVariableEditor(adventure);
    const inventory = document.createElement("label");
    const inventoryInput = document.createElement("input");
    inventoryInput.type = "checkbox";
    inventoryInput.checked = Boolean(adventure.enableInventory);
    inventory.append(inventoryInput, " Enable a simple adventure inventory");
    inventoryInput.addEventListener("change", () => { adventure.enableInventory = inventoryInput.checked; queueAdventureAutosave(saveStatus); });
    const saveDetails = document.createElement("button");
    saveDetails.type = "button";
    saveDetails.textContent = "Save details";
    saveDetails.addEventListener("click", async () => {
        adventure.title = normalizeDisplayName(title.value) || adventure.title;
        adventure.description = description.value.trim();
        adventure.editorMode = editorModeInput.value;
        adventure.enableVariables = enableVariablesInput.checked;
        adventure.showStats = showStatsInput.checked;
        adventure.showProgress = showProgressInput.checked;
        adventure.vibrateOnTimer = vibrationInput.checked;
        adventure.metronomeEnabled = adventureMetronomeInput.checked;
        adventure.metronomeBpm = clampAdventureNumber(adventureBpm.input.value, 20, 300, 120);
        adventure.startSceneId = startSceneInput.value;
        adventure.enableInventory = inventoryInput.checked;
        if (adventure.editorMode === "advanced") variables.save();
        await saveAdventures();
        render();
    });
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = "All adventures";
    back.addEventListener("click", () => openView("adventureStudio", "studio"));
    const map = document.createElement("button");
    map.type = "button";
    map.textContent = "Map";
    map.addEventListener("click", () => openView("adventureMap", adventure.id));
    const play = document.createElement("button");
    play.type = "button";
    play.className = "adventurePrimary";
    play.textContent = "Play adventure";
    play.addEventListener("click", () => startAdventurePlay(adventure.id));
    const actions = document.createElement("div");
    actions.className = "adventureEditorActions";
    actions.append(play, map, saveDetails, back);
    const options = document.createElement("details");
    options.className = "adventureEditorOptions";
    const optionsSummary = document.createElement("summary");
    optionsSummary.textContent = "Adventure setup and playback options";
    options.append(optionsSummary, startScene, editorMode, modeHelp, adventureMetronome, adventureBpm.label, inventory, enableVariables, showStats, showProgress, vibration);
    if ((adventure.editorMode || "basic") === "advanced") options.appendChild(variables.element);
    details.append(title, description, actions, saveStatus, options);
    const creatorIntro = document.createElement("section");
    creatorIntro.className = "adventureCreatorGuide";
    creatorIntro.innerHTML = "<h3>Adventure creator</h3><p>Build one scene at a time. Keep it simple: write the moment, add local media, then add the paths a player can take.</p>";
    const steps = document.createElement("ol");
    ["Name the adventure and choose its opening scene below.", "Open a scene, write its text, and add an image or GIF if you want one.", "Add choices and set where each choice goes. Use Test from here whenever you want to check it."].forEach((text, index) => {
        const step = document.createElement("li");
        step.innerHTML = `<strong>${index + 1}.</strong> ${escapeHTML(text)}`;
        steps.appendChild(step);
    });
    creatorIntro.appendChild(steps);
    const stage = state.adventureEditorStage || "setup";
    const stageNav = document.createElement("nav");
    stageNav.className = "adventureStageNav";
    [["setup", "1. Setup", "Name it and choose the starting point"], ["scenes", "2. Build scenes", "Add media, paths, and game moments"], ["test", "3. Test", "Check the map and play your story"]].forEach(([id, label, hint]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = id === stage ? "active" : "";
        button.textContent = label;
        button.title = hint;
        button.addEventListener("click", () => { state.adventureEditorStage = id; renderMessages(); });
        stageNav.appendChild(button);
    });
    page.appendChild(stageNav);
    if (stage === "setup") {
        page.append(creatorIntro, details);
    }

    const heading = document.createElement("div");
    heading.className = "adventureSceneHeading";
    heading.innerHTML = `<h3>Scenes (${adventure.scenes.length})</h3><p>Each scene is one moment in the story.</p>`;
    const addScene = document.createElement("button");
    addScene.type = "button";
    addScene.textContent = "Add scene";
    addScene.addEventListener("click", () => addAdventureScene(adventure.id));
    heading.appendChild(addScene);
    if (stage === "scenes") {
        const sceneGuide = document.createElement("section");
        sceneGuide.className = "adventureStageGuide";
        sceneGuide.innerHTML = "<h3>Build scenes</h3><p>For each scene: choose a pattern, write the moment, add media, then set what happens next. Open only one scene at a time.</p>";
        page.append(sceneGuide, heading);
        adventure.scenes.forEach((scene, index) => page.appendChild(renderAdventureSceneEditor(adventure, scene, index)));
    }
    if (stage === "test") {
        const testGuide = document.createElement("section");
        testGuide.className = "adventureStageGuide";
        testGuide.innerHTML = "<h3>Test your adventure</h3><p>Fix anything flagged below, view the scene map, then play through a saved local test run.</p>";
        const testActions = document.createElement("div");
        testActions.className = "adventureEditorActions";
        const testPlay = play.cloneNode(true);
        testPlay.addEventListener("click", () => startAdventurePlay(adventure.id));
        const testMap = map.cloneNode(true);
        testMap.addEventListener("click", () => openView("adventureMap", adventure.id));
        const testScenes = document.createElement("button");
        testScenes.type = "button";
        testScenes.textContent = "Back to scenes";
        testScenes.addEventListener("click", () => { state.adventureEditorStage = "scenes"; renderMessages(); });
        testActions.append(testPlay, testMap, testScenes);
        page.append(testGuide, renderAdventureValidation(adventure), testActions);
    }
    els.messages.appendChild(page);
}

function renderAdventureValidation(adventure) {
    const issues = [];
    const reachable = new Set([adventure.startSceneId || adventure.scenes[0]?.id]);
    const targets = (scene) => [
        ...(scene.choices || []).map((choice) => choice.targetSceneId),
        scene.randomEvent?.successTargetId,
        scene.randomEvent?.failureTargetId,
        scene.randomEvent?.completeTargetId,
        ...(scene.randomEvent?.paths || []).map((path) => path.targetSceneId),
        ...(scene.randomEvent?.answers || []).map((answer) => answer.targetSceneId)
    ].filter(Boolean);
    let changed = true;
    while (changed) {
        changed = false;
        adventure.scenes.filter((scene) => reachable.has(scene.id)).forEach((scene) => targets(scene).forEach((target) => {
            if (!reachable.has(target)) { reachable.add(target); changed = true; }
        }));
    }
    adventure.scenes.forEach((scene) => {
        if (!scene.isEnding && !(scene.choices || []).some((choice) => choice.targetSceneId) && !scene.randomEvent) issues.push(`${scene.title || "Untitled scene"}: no outgoing path.`);
        if (!reachable.has(scene.id)) issues.push(`${scene.title || "Untitled scene"}: unreachable from the start scene.`);
        (scene.mediaRefs || []).forEach((ref) => { if (!findAttachment(ref)) issues.push(`${scene.title || "Untitled scene"}: missing media reference.`); });
        const event = scene.randomEvent;
        if (event?.type === "wheel" && !(event.paths || []).some((path) => path.targetSceneId)) issues.push(`${scene.title || "Untitled scene"}: wheel has no destination.`);
        if (event?.type === "timer" && !event.completeTargetId) issues.push(`${scene.title || "Untitled scene"}: timer ends the story because it has no destination.`);
        if (event?.type === "quiz" && event.mode === "manual" && !(event.answers || []).some((answer) => answer.label)) issues.push(`${scene.title || "Untitled scene"}: quiz has no answers.`);
        if (event?.type === "quiz" && ["source-choice", "source-text"].includes(event.mode) && (!event.mediaRef || !findAttachment(event.mediaRef))) issues.push(`${scene.title || "Untitled scene"}: source quiz needs a valid image.`);
        if (event?.type === "quiz" && String(event.mode || "").startsWith("random-source") && !event.useAllChannels && !(event.channelIds || []).length) issues.push(`${scene.title || "Untitled scene"}: random channel quiz needs selected channels or all channels enabled.`);
    });
    const panel = document.createElement("details");
    panel.className = "adventureValidation";
    const summary = document.createElement("summary");
    summary.textContent = issues.length ? `Validation: ${issues.length} item${issues.length === 1 ? "" : "s"} to review` : "Validation: ready to play";
    panel.appendChild(summary);
    if (issues.length === 0) panel.appendChild(document.createTextNode("No missing media, orphaned scenes, or incomplete random events found."));
    else {
        const list = document.createElement("ul");
        issues.forEach((issue) => { const item = document.createElement("li"); item.textContent = issue; list.appendChild(item); });
        panel.appendChild(list);
    }
    return panel;
}

function renderAdventureSceneEditor(adventure, scene, index) {
    const section = document.createElement("details");
    section.className = "adventureScene";
    section.open = scene.id === state.focusAdventureSceneId || (index === 0 && !state.focusAdventureSceneId);
    const summary = document.createElement("summary");
    const mediaCount = (scene.mediaRefs || []).length;
    const choiceCount = (scene.choices || []).filter((choice) => choice.label).length;
    summary.textContent = `${index + 1}. ${scene.title || "Untitled scene"}${scene.isEnding ? " · ending" : ` · ${choiceCount} path${choiceCount === 1 ? "" : "s"}${mediaCount ? ` · ${mediaCount} media` : ""}`}`;
    section.appendChild(summary);

    const title = document.createElement("input");
    title.type = "text";
    title.value = scene.title || "";
    title.placeholder = "Scene title";
    const text = document.createElement("textarea");
    text.rows = 4;
    text.value = scene.text || "";
    text.placeholder = "Story text and instructions";
    const ending = document.createElement("label");
    const endingInput = document.createElement("input");
    endingInput.type = "checkbox";
    endingInput.checked = Boolean(scene.isEnding);
    ending.append(endingInput, " This is an ending");
    const readyPrompt = document.createElement("label");
    const readyPromptInput = document.createElement("input");
    readyPromptInput.type = "checkbox";
    readyPromptInput.checked = Boolean(scene.requireReady);
    readyPrompt.append(readyPromptInput, " Require “Continue when ready” before this scene can advance");
    const collectible = document.createElement("input");
    collectible.type = "text";
    collectible.value = scene.inventoryItem || "";
    collectible.placeholder = "Collectible item in this scene (optional)";
    collectible.addEventListener("input", () => { scene.inventoryItem = collectible.value; queueAdventureAutosave(); });
    const saveDraft = () => {
        scene.title = normalizeDisplayName(title.value) || "Untitled scene";
        scene.text = text.value;
        scene.isEnding = endingInput.checked;
        scene.requireReady = readyPromptInput.checked;
        scene.inventoryItem = normalizeDisplayName(collectible.value);
        queueAdventureAutosave();
    };
    title.addEventListener("input", saveDraft);
    text.addEventListener("input", saveDraft);
    endingInput.addEventListener("change", saveDraft);
    readyPromptInput.addEventListener("change", saveDraft);

    const media = document.createElement("div");
    media.className = "adventureMediaList";
    (scene.mediaRefs || []).forEach((ref, mediaIndex) => {
        const mediaItem = renderAdventureMedia(adventure.id, scene.id, ref);
        const caption = document.createElement("input");
        caption.type = "text";
        caption.placeholder = "Adventure caption / alt text";
        caption.value = scene.mediaCaptions?.[photoRefKey(ref)] || "";
        caption.addEventListener("input", () => {
            scene.mediaCaptions ||= {};
            scene.mediaCaptions[photoRefKey(ref)] = caption.value;
            queueAdventureAutosave();
        });
        mediaItem.appendChild(caption);
        const moveEarlier = document.createElement("button");
        moveEarlier.type = "button";
        moveEarlier.textContent = "←";
        moveEarlier.title = "Move media earlier";
        moveEarlier.disabled = mediaIndex === 0;
        moveEarlier.addEventListener("click", () => moveSceneMedia(adventure.id, scene.id, mediaIndex, -1));
        const moveLater = document.createElement("button");
        moveLater.type = "button";
        moveLater.textContent = "→";
        moveLater.title = "Move media later";
        moveLater.disabled = mediaIndex === (scene.mediaRefs || []).length - 1;
        moveLater.addEventListener("click", () => moveSceneMedia(adventure.id, scene.id, mediaIndex, 1));
        mediaItem.append(moveEarlier, moveLater);
        media.appendChild(mediaItem);
    });
    const addMedia = document.createElement("button");
    addMedia.type = "button";
    addMedia.textContent = "Add image or GIF";
    addMedia.addEventListener("click", () => pickAdventureMedia(adventure.id, scene.id));
    const templateLibrary = renderAdventureTemplateLibrary(adventure, scene);

    const choices = document.createElement("div");
    choices.className = "adventureChoices";
    const choiceRows = [];
    (scene.choices || []).forEach((choice) => {
        const row = document.createElement("div");
        row.className = "adventureChoiceRow";
        const label = document.createElement("input");
        label.type = "text";
        label.value = choice.label || "";
        label.placeholder = "Choice text";
        const shortLabel = document.createElement("input");
        shortLabel.type = "text";
        shortLabel.value = choice.shortLabel || "";
        shortLabel.placeholder = "Short mobile label (optional)";
        const target = document.createElement("select");
        const endingTarget = document.createElement("option");
        endingTarget.value = "";
        endingTarget.textContent = "End story";
        target.appendChild(endingTarget);
        adventure.scenes.filter((item) => item.id !== scene.id).forEach((item, targetIndex) => {
            const option = document.createElement("option");
            option.value = item.id;
            option.textContent = `${targetIndex + 1}. ${item.title || "Untitled scene"}`;
            option.selected = item.id === choice.targetSceneId;
            target.appendChild(option);
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => {
            row.remove();
            const position = choiceRows.indexOf(row);
            if (position >= 0) choiceRows.splice(position, 1);
        });
        row.append(label, shortLabel, target, remove);
        label.addEventListener("input", () => {
            choice.label = label.value;
            queueAdventureAutosave();
        });
        target.addEventListener("change", () => {
            choice.targetSceneId = target.value || null;
            queueAdventureAutosave();
        });
        shortLabel.addEventListener("input", () => {
            choice.shortLabel = shortLabel.value;
            queueAdventureAutosave();
        });
        if (adventure.editorMode === "advanced") {
            const rules = renderAdventureChoiceRuleEditor(adventure, choice);
            row.adventureRuleEditor = rules;
            row.appendChild(rules.element);
        }
        choiceRows.push(row);
        choices.appendChild(row);
    });
    const addChoice = document.createElement("button");
    addChoice.type = "button";
    addChoice.textContent = "Add path / choice";
    addChoice.addEventListener("click", () => {
        const choice = { id: crypto.randomUUID(), label: "", targetSceneId: "" };
        scene.choices = [...(scene.choices || []), choice];
        renderMessages();
    });

    const advanced = adventure.editorMode === "advanced";
    const ambience = renderAdventureAmbienceEditor(scene);
    const randomEditor = advanced ? renderAdventureRandomEditor(adventure, scene) : null;
    const sceneEffects = advanced ? renderAdventureEffectsEditor(adventure, scene.effects || [], "When this scene opens") : null;
    const autoAdvance = advanced ? renderAdventureAutoAdvanceEditor(adventure, scene) : null;

    const save = document.createElement("button");
    save.type = "button";
    save.className = "adventurePrimary";
    save.textContent = "Save scene";
    save.addEventListener("click", async () => {
        scene.title = normalizeDisplayName(title.value) || "Untitled scene";
        scene.text = text.value.trim();
        scene.isEnding = endingInput.checked;
        scene.requireReady = readyPromptInput.checked;
        if (sceneEffects) scene.effects = sceneEffects.save();
        scene.choices = choiceRows.map((row) => ({
            id: crypto.randomUUID(),
            label: row.querySelector("input").value.trim() || "Continue",
            shortLabel: row.querySelectorAll("input")[1].value.trim(),
            targetSceneId: row.querySelector("select").value || null,
            ...(row.adventureRuleEditor ? row.adventureRuleEditor.save() : {})
        }));
        if (randomEditor) randomEditor.save();
        if (autoAdvance) autoAdvance.save();
        ambience.save();
        await saveAdventures();
        renderMessages();
    });
    const removeScene = document.createElement("button");
    removeScene.type = "button";
    removeScene.className = "dangerAction";
    removeScene.textContent = "Delete scene";
    removeScene.disabled = adventure.scenes.length === 1;
    removeScene.addEventListener("click", () => deleteAdventureScene(adventure.id, scene.id));
    const duplicateScene = document.createElement("button");
    duplicateScene.type = "button";
    duplicateScene.textContent = "Duplicate scene";
    duplicateScene.addEventListener("click", () => duplicateAdventureScene(adventure.id, scene.id));
    const testScene = document.createElement("button");
    testScene.type = "button";
    testScene.textContent = "Test from here";
    testScene.addEventListener("click", () => startAdventureTest(adventure.id, scene.id));
    const template = document.createElement("select");
    [["", "Apply a saved template…"], ...(state.structure.settings.adventureComponents || []).map((component) => [`component:${component.id}`, `Saved: ${component.name}`])].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        template.appendChild(option);
    });
    template.addEventListener("change", () => {
        if (!template.value) return;
        applyAdventureSceneTemplate(adventure.id, scene.id, template.value);
    });
    const saveComponent = document.createElement("button");
    saveComponent.type = "button";
    saveComponent.textContent = "Save as reusable component";
    saveComponent.addEventListener("click", () => saveAdventureComponent(adventure.id, scene.id));
    const moveUp = document.createElement("button");
    moveUp.type = "button";
    moveUp.textContent = "Move up";
    moveUp.disabled = index === 0;
    moveUp.addEventListener("click", () => moveAdventureScene(adventure.id, scene.id, -1));
    const moveDown = document.createElement("button");
    moveDown.type = "button";
    moveDown.textContent = "Move down";
    moveDown.disabled = index === adventure.scenes.length - 1;
    moveDown.addEventListener("click", () => moveAdventureScene(adventure.id, scene.id, 1));
    section.draggable = true;
    section.addEventListener("dragstart", (event) => event.dataTransfer.setData("text/plain", scene.id));
    section.addEventListener("dragover", (event) => event.preventDefault());
    section.addEventListener("drop", (event) => {
        event.preventDefault();
        const sourceId = event.dataTransfer.getData("text/plain");
        if (sourceId && sourceId !== scene.id) moveAdventureSceneTo(adventure.id, sourceId, scene.id);
    });

    const optional = document.createElement("details");
    optional.className = "adventureSceneOptional";
    const optionalSummary = document.createElement("summary");
    optionalSummary.textContent = advanced ? "More scene options and advanced mechanics" : "More scene options";
    optional.append(optionalSummary, readyPrompt, ambience.element);
    if (adventure.enableInventory) optional.appendChild(collectible);
    if (sceneEffects) optional.appendChild(sceneEffects.element);
    if (randomEditor) optional.appendChild(randomEditor.element);
    if (autoAdvance) optional.appendChild(autoAdvance.element);
    section.append(templateLibrary, title, text, media, addMedia, choices, addChoice, ending, optional);
    const tools = document.createElement("details");
    tools.className = "adventureSceneTools";
    const toolsSummary = document.createElement("summary");
    toolsSummary.textContent = "Scene tools (template, reorder, reusable component)";
    const toolsContent = document.createElement("div");
    toolsContent.className = "adventureSceneToolsContent";
    toolsContent.append(template, saveComponent, moveUp, moveDown);
    tools.append(toolsSummary, toolsContent);
    const actions = document.createElement("div");
    actions.className = "adventureSceneActions";
    actions.append(save, duplicateScene, testScene, removeScene);
    section.append(tools, actions);
    return section;
}

async function moveSceneMedia(adventureId, sceneId, from, offset) {
    const scene = getAdventure(adventureId)?.scenes.find((item) => item.id === sceneId);
    const to = from + offset;
    if (!scene?.mediaRefs || to < 0 || to >= scene.mediaRefs.length) return;
    [scene.mediaRefs[from], scene.mediaRefs[to]] = [scene.mediaRefs[to], scene.mediaRefs[from]];
    await saveAdventures();
    renderMessages();
}

function renderAdventureTemplateLibrary(adventure, scene) {
    const panel = document.createElement("section");
    panel.className = "adventureTemplateLibrary";
    const heading = document.createElement("strong");
    heading.textContent = "Choose what this scene does";
    const help = document.createElement("p");
    help.textContent = "Pick one starting pattern. It fills the scene with the right controls; you can still change everything afterward.";
    const grid = document.createElement("div");
    grid.className = "adventureTemplateGrid";
    [
        ["twoPath", "Decision", "Player chooses between two paths"],
        ["imageScene", "Image moment", "Write around one image or GIF"],
        ["randomImage", "Random reveal", "Draw one local image or GIF"],
        ["dice", "Dice check", "Roll for success or failure"],
        ["weighted", "Random path", "Chance picks a destination"],
        ["wheel", "Spinning wheel", "Spin for the next scene"],
        ["timer", "Timer challenge", "Countdown before continuing"],
        ["imageQuiz", "Fixed-image quiz", "Ask where a chosen scene image came from"],
        ["randomChannelQuiz", "Random channel quiz", "Draw an image, then identify its channel"],
        ["quiz", "Written quiz", "Ask a custom multiple-choice question"],
        ["ending", "Ending", "Finish this story here"]
    ].forEach(([id, label, description]) => {
        const button = document.createElement("button");
        button.type = "button";
        const title = document.createElement("strong");
        title.textContent = label;
        const text = document.createElement("span");
        text.textContent = description;
        button.append(title, text);
        button.addEventListener("click", () => applyAdventureSceneTemplate(adventure.id, scene.id, id));
        grid.appendChild(button);
    });
    panel.append(heading, help, grid);
    return panel;
}

async function applyAdventureSceneTemplate(adventureId, sceneId, template) {
    const scene = getAdventure(adventureId)?.scenes.find((item) => item.id === sceneId);
    if (!scene) return;
    if (template.startsWith("component:")) {
        const component = (state.structure.settings.adventureComponents || []).find((item) => item.id === template.slice("component:".length));
        if (component?.scene) {
            const copy = structuredClone(component.scene);
            copy.choices = (copy.choices || []).map((choice) => ({ ...choice, id: crypto.randomUUID(), targetSceneId: null }));
            if (copy.randomEvent) {
                ["successTargetId", "failureTargetId", "completeTargetId"].forEach((key) => { if (key in copy.randomEvent) copy.randomEvent[key] = null; });
                copy.randomEvent.paths = copy.randomEvent.paths?.map((path) => ({ ...path, targetSceneId: null }));
                copy.randomEvent.answers = copy.randomEvent.answers?.map((answer) => ({ ...answer, targetSceneId: null }));
            }
            Object.assign(scene, copy, { id: scene.id, title: `${component.name} copy` });
        }
        await saveAdventures();
        renderMessages();
        return;
    }
    if (["dice", "weighted", "wheel", "timer", "randomImage", "imageQuiz", "randomChannelQuiz", "quiz"].includes(template)) adventure.editorMode = "advanced";
    if (template === "twoPath") {
        scene.isEnding = false;
        scene.randomEvent = null;
        scene.text ||= "Choose what to do next.";
        scene.choices = [{ id: crypto.randomUUID(), label: "Take the first path", targetSceneId: null }, { id: crypto.randomUUID(), label: "Take the second path", targetSceneId: null }];
    } else if (template === "imageScene") {
        scene.isEnding = false;
        scene.randomEvent = null;
        scene.text ||= "Add an image or GIF, then write the moment around it.";
        scene.choices = scene.choices?.length ? scene.choices : [{ id: crypto.randomUUID(), label: "Continue", targetSceneId: null }];
    } else if (template === "randomImage") {
        scene.isEnding = false;
        scene.randomEvent = defaultRandomEvent("image");
        scene.text ||= "Reveal a random local image or GIF.";
        scene.choices = [];
    } else if (template === "dice") {
        scene.isEnding = false;
        scene.randomEvent = defaultRandomEvent("dice");
        scene.text ||= "Roll to see what happens.";
        scene.choices = [];
    } else if (template === "weighted") {
        scene.isEnding = false;
        scene.randomEvent = defaultRandomEvent("weighted");
        scene.text ||= "Let chance choose the next path.";
        scene.choices = [];
    } else if (template === "imageQuiz") {
        scene.randomEvent = { type: "quiz", mode: "source-choice", question: "Which channel did this image come from?", mediaRef: scene.mediaRefs?.[0] || null, channelIds: [], successTargetId: null, failureTargetId: null };
        scene.isEnding = false;
        scene.choices = [];
    } else if (template === "randomChannelQuiz") {
        scene.randomEvent = { type: "quiz", mode: "random-source-choice", question: "Which channel did this image come from?", channelIds: [], useAllChannels: false, successTargetId: null, failureTargetId: null };
        scene.isEnding = false;
        scene.text ||= "Identify the channel behind the random image.";
        scene.choices = [];
    } else if (template === "quiz") {
        scene.isEnding = false;
        scene.randomEvent = defaultRandomEvent("quiz");
        scene.text ||= "Choose the best answer.";
        scene.choices = [];
    } else if (template === "timer") {
        scene.randomEvent = defaultRandomEvent("timer");
        scene.isEnding = false;
        scene.text ||= "Complete the timer challenge.";
    } else if (template === "wheel") {
        scene.randomEvent = defaultRandomEvent("wheel");
        scene.isEnding = false;
        scene.text ||= "Let the wheel decide what happens next.";
    } else if (template === "ending") {
        scene.isEnding = true;
        scene.choices = [];
        scene.randomEvent = null;
        scene.text ||= "The adventure ends here.";
    }
    await saveAdventures();
    renderMessages();
}

async function saveAdventureComponent(adventureId, sceneId) {
    const scene = getAdventure(adventureId)?.scenes.find((item) => item.id === sceneId);
    if (!scene) return;
    const name = normalizeDisplayName(prompt("Reusable component name?", scene.title || "Scene component"));
    if (!name) return;
    const copy = structuredClone(scene);
    copy.id = crypto.randomUUID();
    state.structure.settings.adventureComponents = [...(state.structure.settings.adventureComponents || []), { id: crypto.randomUUID(), name, scene: copy, createdAt: new Date().toISOString() }];
    await saveAdventures();
    renderMessages();
}

function renderAdventureAmbienceEditor(scene) {
    const wrap = document.createElement("section");
    wrap.className = "adventureAmbienceEditor";
    const heading = document.createElement("strong");
    heading.textContent = "Scene ambience (optional)";
    const theme = document.createElement("label");
    theme.textContent = "Theme";
    const themeInput = document.createElement("select");
    [["", "Default"], ["ocean", "Ocean"], ["forest", "Forest"], ["ember", "Ember"], ["violet", "Violet"]].forEach(([value, label]) => {
        const option = document.createElement("option"); option.value = value; option.textContent = label; option.selected = value === (scene.ambience?.theme || ""); themeInput.appendChild(option);
    });
    theme.appendChild(themeInput);
    const bpm = numericField("Scene metronome BPM (blank keeps adventure BPM)", scene.ambience?.metronomeBpm || "");
    bpm.input.placeholder = "Optional BPM";
    const timer = numericField("Scene timer preset seconds (optional)", scene.ambience?.timerSeconds || "");
    timer.input.placeholder = "Optional seconds";
    wrap.append(heading, theme, bpm.label, timer.label);
    return {
        element: wrap,
        save: () => {
            const metronomeBpm = Number.parseInt(bpm.input.value, 10);
            const timerSeconds = Number.parseInt(timer.input.value, 10);
            scene.ambience = {
                theme: themeInput.value,
                metronomeBpm: metronomeBpm ? clampAdventureNumber(metronomeBpm, 20, 300, 120) : null,
                timerSeconds: timerSeconds ? clampAdventureNumber(timerSeconds, 1, 7200, 60) : null
            };
        }
    };
}

function renderAdventureAutoAdvanceEditor(adventure, scene) {
    const wrap = document.createElement("section");
    wrap.className = "adventureAutoAdvanceEditor";
    const heading = document.createElement("strong");
    heading.textContent = "Automatic transition (optional)";
    const mode = document.createElement("select");
    [["", "Off"], ["delay", "After a delay"], ["timer", "After a timer"], ["beats", "After metronome beats"]].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        option.selected = value === (scene.autoAdvance?.mode || "");
        mode.appendChild(option);
    });
    const value = numericField(mode.value === "beats" ? "Number of beats" : "Seconds", scene.autoAdvance?.value || "");
    value.input.placeholder = mode.value === "beats" ? "4" : "10";
    const target = adventureTargetSelect(adventure, scene.id, scene.autoAdvance?.targetSceneId, "Continue to");
    const updateLabel = () => {
        value.label.firstChild.textContent = mode.value === "beats" ? "Number of beats" : "Seconds";
        value.input.placeholder = mode.value === "beats" ? "4" : "10";
    };
    mode.addEventListener("change", updateLabel);
    wrap.append(heading, mode, value.label, target.label);
    return {
        element: wrap,
        save: () => {
            if (!mode.value || !target.select.value) {
                scene.autoAdvance = null;
                return;
            }
            scene.autoAdvance = {
                mode: mode.value,
                value: clampAdventureNumber(value.input.value, 1, 7200, mode.value === "beats" ? 4 : 10),
                targetSceneId: target.select.value
            };
        }
    };
}

async function moveAdventureScene(adventureId, sceneId, offset) {
    const adventure = getAdventure(adventureId);
    const from = adventure?.scenes.findIndex((scene) => scene.id === sceneId) ?? -1;
    const to = from + offset;
    if (!adventure || from < 0 || to < 0 || to >= adventure.scenes.length) return;
    [adventure.scenes[from], adventure.scenes[to]] = [adventure.scenes[to], adventure.scenes[from]];
    await saveAdventures();
    renderMessages();
}

async function moveAdventureSceneTo(adventureId, sourceId, targetId) {
    const adventure = getAdventure(adventureId);
    const from = adventure?.scenes.findIndex((scene) => scene.id === sourceId) ?? -1;
    const to = adventure?.scenes.findIndex((scene) => scene.id === targetId) ?? -1;
    if (!adventure || from < 0 || to < 0) return;
    const [scene] = adventure.scenes.splice(from, 1);
    adventure.scenes.splice(to, 0, scene);
    await saveAdventures();
    renderMessages();
}

function renderAdventureRandomEditor(adventure, scene) {
    const wrap = document.createElement("section");
    wrap.className = "adventureRandomEditor";
    const heading = document.createElement("strong");
    heading.textContent = "Optional random event";
    const type = document.createElement("select");
    [
        ["", "None"],
        ["dice", "Dice branch"],
        ["weighted", "Weighted path"],
        ["wheel", "Spinning wheel"],
        ["timer", "Countdown timer"],
        ["image", "Random image"],
        ["quiz", "Quiz gate"]
    ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        option.selected = value === scene.randomEvent?.type;
        type.appendChild(option);
    });
    type.addEventListener("change", () => {
        scene.randomEvent = defaultRandomEvent(type.value);
        renderMessages();
    });
    wrap.append(heading, type);
    const event = scene.randomEvent;
    if (!event) return { element: wrap, save: () => { scene.randomEvent = null; } };

    if (event.type === "dice") {
        const sides = numericField("Dice sides", event.sides || 20);
        const threshold = numericField("Success on", event.threshold || 12);
        const success = adventureTargetSelect(adventure, scene.id, event.successTargetId, "Success destination");
        const failure = adventureTargetSelect(adventure, scene.id, event.failureTargetId, "Failure destination");
        wrap.append(sides.label, threshold.label, success.label, failure.label);
        return {
            element: wrap,
            save: () => {
                scene.randomEvent = {
                    type: "dice",
                    sides: clampAdventureNumber(sides.input.value, 2, 1000, 20),
                    threshold: clampAdventureNumber(threshold.input.value, 1, 1000, 12),
                    successTargetId: success.select.value || null,
                    failureTargetId: failure.select.value || null
                };
            }
        };
    }

    if (event.type === "timer") {
        const seconds = numericField("Countdown seconds", event.seconds || 60);
        const random = document.createElement("label");
        const randomInput = document.createElement("input");
        randomInput.type = "checkbox";
        randomInput.checked = Boolean(event.random);
        random.append(randomInput, " Randomize this countdown when it starts");
        const couple = document.createElement("label");
        const coupleInput = document.createElement("input");
        coupleInput.type = "checkbox";
        coupleInput.checked = Boolean(event.coupleMetronome);
        couple.append(coupleInput, " Metronome follows this timer");
        const min = numericField("Random minimum seconds", event.minSeconds || 30);
        const max = numericField("Random maximum seconds", event.maxSeconds || 90);
        const complete = adventureTargetSelect(adventure, scene.id, event.completeTargetId, "When timer finishes");
        wrap.append(seconds.label, random, couple, min.label, max.label, complete.label);
        return {
            element: wrap,
            save: () => {
                scene.randomEvent = {
                    type: "timer",
                    seconds: clampAdventureNumber(seconds.input.value, 1, 7200, 60),
                    random: randomInput.checked,
                    coupleMetronome: coupleInput.checked,
                    minSeconds: clampAdventureNumber(min.input.value, 1, 7200, 30),
                    maxSeconds: clampAdventureNumber(max.input.value, 1, 7200, 90),
                    completeTargetId: complete.select.value || null
                };
            }
        };
    }

    if (event.type === "weighted" || event.type === "wheel") {
        const paths = document.createElement("div");
        paths.className = "adventureWeightedPaths";
        const rows = [];
        (event.paths || []).forEach((path) => {
            const row = document.createElement("div");
            row.className = "adventureWeightedRow";
            const target = adventureTargetSelect(adventure, scene.id, path.targetSceneId, "Destination").select;
            const weight = document.createElement("input");
            weight.type = "number";
            weight.min = "1";
            weight.value = path.weight || 1;
            const remove = document.createElement("button");
            remove.type = "button";
            remove.textContent = "Remove";
            remove.addEventListener("click", () => {
                row.remove();
                rows.splice(rows.indexOf(row), 1);
            });
            row.append(target, weight, remove);
            rows.push(row);
            paths.appendChild(row);
        });
        const add = document.createElement("button");
        add.type = "button";
        add.textContent = event.type === "wheel" ? "Add wheel segment" : "Add weighted path";
        add.addEventListener("click", () => {
            scene.randomEvent.paths = [...(scene.randomEvent.paths || []), { targetSceneId: null, weight: 1 }];
            renderMessages();
        });
        wrap.append(paths, add);
        return {
            element: wrap,
            save: () => {
                scene.randomEvent = {
                    type: event.type,
                    paths: rows.map((row) => ({
                        targetSceneId: row.querySelector("select").value || null,
                        weight: clampAdventureNumber(row.querySelector("input").value, 1, 1000, 1)
                    }))
                };
            }
        };
    }

    if (event.type === "quiz") {
        const mode = document.createElement("label");
        mode.textContent = "Quiz type";
        const modeInput = document.createElement("select");
        [
            ["manual", "Manual answer buttons"],
            ["source-choice", "Which channel was this image from?"],
            ["source-text", "Type the source channel name"],
            ["random-source-choice", "Random image: choose its channel"],
            ["random-source-text", "Random image: type its channel"]
        ].forEach(([value, label]) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            option.selected = value === (event.mode || "manual");
            modeInput.appendChild(option);
        });
        mode.appendChild(modeInput);
        modeInput.addEventListener("change", () => {
            scene.randomEvent = { ...event, mode: modeInput.value };
            renderMessages();
        });
        const question = document.createElement("textarea");
        question.rows = 2;
        question.value = event.question || "";
        question.placeholder = modeInput.value === "manual" ? "Quiz question" : "Optional question (defaults to a source-channel question)";
        if (modeInput.value !== "manual") {
            const randomSource = modeInput.value.startsWith("random-source");
            if (randomSource) {
                const useAll = document.createElement("label");
                const useAllInput = document.createElement("input");
                useAllInput.type = "checkbox";
                useAllInput.checked = Boolean(event.useAllChannels);
                useAll.append(useAllInput, " Draw from every channel with local images in all workspaces");
                const channels = document.createElement("label");
                channels.textContent = "Otherwise draw from these channels";
                const channelsInput = document.createElement("select");
                channelsInput.multiple = true;
                channelsInput.size = Math.min(6, Math.max(2, getAllChannels().length));
                getAllChannels().forEach((channel) => {
                    const option = document.createElement("option");
                    option.value = channel.id;
                    option.textContent = `#${channel.name} (${getChannelServer(channel.id)?.name || "server"})`;
                    option.selected = (event.channelIds || []).includes(channel.id);
                    channelsInput.appendChild(option);
                });
                const success = adventureTargetSelect(adventure, scene.id, event.successTargetId, "Correct answer destination");
                const failure = adventureTargetSelect(adventure, scene.id, event.failureTargetId, "Wrong answer destination");
                wrap.append(mode, question, useAll, channels, success.label, failure.label);
                return {
                    element: wrap,
                    save: () => {
                        scene.randomEvent = {
                            type: "quiz",
                            mode: modeInput.value,
                            question: question.value.trim(),
                            channelIds: [...channelsInput.selectedOptions].map((option) => option.value),
                            useAllChannels: useAllInput.checked,
                            successTargetId: success.select.value || null,
                            failureTargetId: failure.select.value || null
                        };
                    }
                };
            }
            const media = document.createElement("label");
            media.textContent = "Quiz image (add local media to this scene first)";
            const mediaInput = document.createElement("select");
            const unavailable = document.createElement("option");
            unavailable.value = "";
            unavailable.textContent = scene.mediaRefs?.length ? "Choose image" : "No scene media available";
            mediaInput.appendChild(unavailable);
            (scene.mediaRefs || []).forEach((ref) => {
                const attachment = findAttachment(ref);
                const option = document.createElement("option");
                option.value = photoRefKey(ref);
                option.textContent = `#${getChannelById(ref.channelId)?.name || "missing"} · ${attachment?.note || attachment?.name || "image"}`;
                option.selected = photoRefKey(ref) === photoRefKey(event.mediaRef || {});
                mediaInput.appendChild(option);
            });
            media.appendChild(mediaInput);
            const success = adventureTargetSelect(adventure, scene.id, event.successTargetId, "Correct answer destination");
            const failure = adventureTargetSelect(adventure, scene.id, event.failureTargetId, "Wrong answer destination");
            const channels = document.createElement("label");
            channels.textContent = modeInput.value === "source-choice" ? "Extra channels to offer as answers" : "";
            const channelsInput = document.createElement("select");
            channelsInput.multiple = true;
            channelsInput.size = Math.min(5, Math.max(2, getAllChannels().length));
            getAllChannels().forEach((channel) => {
                const option = document.createElement("option");
                option.value = channel.id;
                option.textContent = `#${channel.name} (${getChannelServer(channel.id)?.name || "server"})`;
                option.selected = (event.channelIds || []).includes(channel.id);
                channelsInput.appendChild(option);
            });
            channels.appendChild(channelsInput);
            wrap.append(mode, question, media, success.label, failure.label);
            if (modeInput.value === "source-choice") wrap.appendChild(channels);
            return {
                element: wrap,
                save: () => {
                    const selectedRef = (scene.mediaRefs || []).find((ref) => photoRefKey(ref) === mediaInput.value) || null;
                    scene.randomEvent = {
                        type: "quiz",
                        mode: modeInput.value,
                        question: question.value.trim(),
                        mediaRef: selectedRef,
                        channelIds: [...channelsInput.selectedOptions].map((option) => option.value),
                        successTargetId: success.select.value || null,
                        failureTargetId: failure.select.value || null
                    };
                }
            };
        }
        const answers = document.createElement("div");
        answers.className = "adventureWeightedPaths";
        const rows = [];
        (event.answers || []).forEach((answer) => {
            const row = document.createElement("div");
            row.className = "adventureWeightedRow";
            const label = document.createElement("input");
            label.type = "text";
            label.value = answer.label || "";
            label.placeholder = "Answer";
            const target = adventureTargetSelect(adventure, scene.id, answer.targetSceneId, "Destination").select;
            const remove = document.createElement("button");
            remove.type = "button";
            remove.textContent = "Remove";
            remove.addEventListener("click", () => {
                row.remove();
                rows.splice(rows.indexOf(row), 1);
            });
            row.append(label, target, remove);
            rows.push(row);
            answers.appendChild(row);
        });
        const add = document.createElement("button");
        add.type = "button";
        add.textContent = "Add answer";
        add.addEventListener("click", () => {
            scene.randomEvent.answers = [...(scene.randomEvent.answers || []), { label: "", targetSceneId: null }];
            renderMessages();
        });
        wrap.append(mode, question, answers, add);
        return {
            element: wrap,
            save: () => {
                scene.randomEvent = {
                    type: "quiz",
                    mode: "manual",
                    question: question.value.trim(),
                    answers: rows.map((row) => ({
                        label: row.querySelector("input").value.trim() || "Continue",
                        targetSceneId: row.querySelector("select").value || null
                    }))
                };
            }
        };
    }

    const sourceNames = [
        ...(event.channelIds || []).map((id) => `#${getChannelById(id)?.name || "missing"}`),
        ...(event.collectionIds || []).map((id) => `@${getAnyPhotoCollection(id)?.name || "missing"}`)
    ].join(", ");
    const sourceText = document.createElement("p");
    sourceText.textContent = sourceNames || "No image channels selected";
    const setSources = document.createElement("button");
    setSources.type = "button";
    setSources.textContent = "Choose image channels";
    setSources.addEventListener("click", () => setAdventureRandomImageSources(adventure.id, scene.id));
    wrap.append(sourceText, setSources);
    return { element: wrap, save: () => {} };
}

function defaultRandomEvent(type) {
    if (type === "dice") return { type, sides: 20, threshold: 12, successTargetId: null, failureTargetId: null };
    if (type === "weighted") return { type, paths: [{ targetSceneId: null, weight: 1 }, { targetSceneId: null, weight: 1 }] };
    if (type === "wheel") return { type, paths: [{ targetSceneId: null, weight: 1 }, { targetSceneId: null, weight: 1 }] };
    if (type === "timer") return { type, seconds: 60, random: false, coupleMetronome: false, minSeconds: 30, maxSeconds: 90, completeTargetId: null };
    if (type === "image") return { type, channelIds: [], collectionIds: [] };
    if (type === "quiz") return { type, question: "", answers: [{ label: "", targetSceneId: null }, { label: "", targetSceneId: null }] };
    return null;
}

function numericField(labelText, value) {
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = document.createElement("input");
    input.type = "number";
    input.value = value;
    label.appendChild(input);
    return { label, input };
}

function adventureTargetSelect(adventure, currentSceneId, selectedId, labelText) {
    const label = document.createElement("label");
    label.textContent = labelText;
    const select = document.createElement("select");
    const ending = document.createElement("option");
    ending.value = "";
    ending.textContent = "End story";
    select.appendChild(ending);
    adventure.scenes.filter((scene) => scene.id !== currentSceneId).forEach((scene, index) => {
        const option = document.createElement("option");
        option.value = scene.id;
        option.textContent = `${index + 1}. ${scene.title || "Untitled scene"}`;
        option.selected = scene.id === selectedId;
        select.appendChild(option);
    });
    label.appendChild(select);
    return { label, select };
}

function clampAdventureNumber(value, minimum, maximum, fallback) {
    return Math.min(maximum, Math.max(minimum, Number.parseInt(value, 10) || fallback));
}

function renderAdventureVariableEditor(adventure) {
    const wrap = document.createElement("section");
    wrap.className = "adventureVariablesEditor";
    const heading = document.createElement("strong");
    heading.textContent = "Optional variables";
    wrap.appendChild(heading);
    const rows = [];
    (adventure.variables || []).forEach((variable) => {
        const row = document.createElement("div");
        row.className = "adventureVariableRow";
        row.dataset.variableId = variable.id;
        const name = document.createElement("input");
        name.type = "text";
        name.value = variable.name || "";
        name.placeholder = "Name";
        const type = document.createElement("select");
        [["boolean", "Yes / no"], ["number", "Number"]].forEach(([value, label]) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            option.selected = value === variable.type;
            type.appendChild(option);
        });
        const initial = document.createElement("input");
        initial.type = variable.type === "number" ? "number" : "text";
        initial.value = variable.type === "number" ? Number(variable.initialValue || 0) : (variable.initialValue ? "true" : "false");
        initial.placeholder = variable.type === "number" ? "Starting value" : "true / false";
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => {
            row.remove();
            rows.splice(rows.indexOf(row), 1);
        });
        type.addEventListener("change", () => {
            initial.type = type.value === "number" ? "number" : "text";
            initial.value = type.value === "number" ? "0" : "false";
            initial.placeholder = type.value === "number" ? "Starting value" : "true / false";
        });
        row.append(name, type, initial, remove);
        rows.push(row);
        wrap.appendChild(row);
    });
    const add = document.createElement("button");
    add.type = "button";
    add.textContent = "Add variable";
    add.addEventListener("click", () => {
        adventure.variables = [...(adventure.variables || []), { id: crypto.randomUUID(), name: "New variable", type: "boolean", initialValue: false }];
        renderMessages();
    });
    wrap.appendChild(add);
    return {
        element: wrap,
        save: () => {
            adventure.variables = rows.map((row) => {
                const [name, type, initial] = row.querySelectorAll("input, select");
                return {
                    id: row.dataset.variableId,
                    name: normalizeDisplayName(name.value) || "Variable",
                    type: type.value,
                    initialValue: type.value === "number" ? Number(initial.value) || 0 : initial.value.trim().toLowerCase() === "true"
                };
            });
        }
    };
}

function renderAdventureEffectsEditor(adventure, effects, headingText) {
    const wrap = document.createElement("section");
    wrap.className = "adventureEffectsEditor";
    const heading = document.createElement("strong");
    heading.textContent = headingText;
    wrap.appendChild(heading);
    const rows = [];
    const addRow = (effect = {}) => {
        const row = document.createElement("div");
        row.className = "adventureEffectRow";
        const variable = adventureVariableSelect(adventure, effect.variableId, "Choose variable");
        const mode = document.createElement("select");
        [["set", "Set"], ["add", "Add (numbers)"]].forEach(([value, label]) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            option.selected = value === effect.mode;
            mode.appendChild(option);
        });
        const value = document.createElement("input");
        value.type = "text";
        value.value = effect.value ?? "true";
        value.placeholder = "true, false, or number";
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => {
            row.remove();
            rows.splice(rows.indexOf(row), 1);
        });
        row.append(variable, mode, value, remove);
        rows.push(row);
        wrap.appendChild(row);
    };
    effects.forEach(addRow);
    const add = document.createElement("button");
    add.type = "button";
    add.textContent = "Add change";
    add.disabled = !(adventure.variables || []).length;
    add.addEventListener("click", () => addRow({ variableId: adventure.variables[0]?.id, mode: "set", value: "true" }));
    wrap.appendChild(add);
    return {
        element: wrap,
        save: () => rows.map((row) => {
            const [variable, mode, value] = row.querySelectorAll("select, input");
            return { variableId: variable.value, mode: mode.value, value: value.value.trim() };
        }).filter((effect) => effect.variableId)
    };
}

function renderAdventureChoiceRuleEditor(adventure, choice) {
    const wrap = document.createElement("details");
    wrap.className = "adventureChoiceRules";
    const summary = document.createElement("summary");
    summary.textContent = "Condition / variable change";
    wrap.appendChild(summary);
    const condition = document.createElement("div");
    condition.className = "adventureConditionRow";
    const conditionVariable = adventureVariableSelect(adventure, choice.condition?.variableId, "Always available");
    const operator = document.createElement("select");
    [["truthy", "is true"], ["falsy", "is false"], [">=", "number ≥"], ["<=", "number ≤"], ["=", "equals"]].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        option.selected = value === choice.condition?.operator;
        operator.appendChild(option);
    });
    const conditionValue = document.createElement("input");
    conditionValue.type = "text";
    conditionValue.value = choice.condition?.value ?? "";
    conditionValue.placeholder = "Value when needed";
    condition.append(conditionVariable, operator, conditionValue);
    const effects = renderAdventureEffectsEditor(adventure, choice.effects || [], "After this choice");
    wrap.append(condition, effects.element);
    return {
        element: wrap,
        save: () => ({
            condition: conditionVariable.value ? {
                variableId: conditionVariable.value,
                operator: operator.value,
                value: conditionValue.value.trim()
            } : null,
            effects: effects.save()
        })
    };
}

function adventureVariableSelect(adventure, selectedId, emptyLabel) {
    const select = document.createElement("select");
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = emptyLabel;
    select.appendChild(empty);
    (adventure.variables || []).forEach((variable) => {
        const option = document.createElement("option");
        option.value = variable.id;
        option.textContent = variable.name;
        option.selected = variable.id === selectedId;
        select.appendChild(option);
    });
    return select;
}

function renderAdventureMedia(adventureId, sceneId, ref) {
    const wrap = document.createElement("div");
    wrap.className = "adventureMediaRef";
    const attachment = findAttachment(ref);
    if (attachment) {
        const image = document.createElement("img");
        const objectUrl = attachment.blob ? URL.createObjectURL(attachment.blob) : "";
        image.src = objectUrl || attachment.dataUrl || "";
        image.alt = attachment.note || attachment.name || "Adventure media";
        if (objectUrl) image.addEventListener("load", () => URL.revokeObjectURL(objectUrl), { once: true });
        wrap.appendChild(image);
    } else {
        wrap.appendChild(emptyPanel("Missing source media"));
        const repair = document.createElement("button");
        repair.type = "button";
        repair.textContent = "Repair media";
        repair.addEventListener("click", () => pickAdventureMedia(adventureId, sceneId, ref));
        wrap.appendChild(repair);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove media";
    remove.addEventListener("click", () => removeAdventureMedia(adventureId, sceneId, ref));
    wrap.appendChild(remove);
    return wrap;
}

function getAdventureSessions(adventureId) {
    return (state.structure.settings.adventureSessions || []).filter((session) => session.adventureId === adventureId);
}

function getAdventureSession(adventureId, sessionId = state.activeAdventureSessionId) {
    const sessions = getAdventureSessions(adventureId);
    const session = sessions.find((item) => item.id === sessionId)
        || sessions.find((item) => !item.isTest)
        || sessions[0];
    if (!session) return null;
    if (!session.id) session.id = crypto.randomUUID();
    if (!session.name) session.name = session.isTest ? "Test run" : "Main run";
    state.activeAdventureSessionId = session.id;
    return session;
}

function resetAdventureSession(session, adventure, startSceneId = null) {
    session.currentSceneId = startSceneId || adventure.startSceneId || adventure.scenes[0].id;
    session.history = [];
    session.randomResults = [];
    session.timers = {};
    session.readyScenes = [];
    session.checkpoints = [];
    session.inventory = [];
    session.variables = createAdventureVariables(adventure);
    session.completed = false;
    session.updatedAt = new Date().toISOString();
    applyAdventureEffects(session, adventure, adventure.scenes.find((scene) => scene.id === session.currentSceneId)?.effects);
}

async function createAdventureSession(adventureId, { name = "New run", isTest = false, startSceneId = null } = {}) {
    const adventure = getAdventure(adventureId);
    if (!adventure?.scenes.length) return null;
    const session = {
        id: crypto.randomUUID(),
        name,
        isTest,
        adventureId,
        currentSceneId: null,
        history: [],
        randomResults: [],
        readyScenes: [],
        variables: {},
        completed: false,
        updatedAt: new Date().toISOString()
    };
    resetAdventureSession(session, adventure, startSceneId);
    state.structure.settings.adventureSessions = [...(state.structure.settings.adventureSessions || []), session];
    state.activeAdventureSessionId = session.id;
    await saveAdventures();
    return session;
}

async function startAdventurePlay(adventureId, restart = false) {
    const adventure = getAdventure(adventureId);
    if (!adventure?.scenes.length) return;
    let session = getAdventureSession(adventureId);
    if (!session) {
        session = await createAdventureSession(adventureId, { name: "Main run" });
    } else if (restart) {
        resetAdventureSession(session, adventure);
        await saveAdventures();
    } else {
        ensureAdventureSessionVariables(session, adventure);
        await saveAdventures();
    }
    if (session) await openView("adventurePlay", adventureId);
}

async function startAdventureTest(adventureId, sceneId) {
    const adventure = getAdventure(adventureId);
    const scene = adventure?.scenes.find((item) => item.id === sceneId);
    if (!scene) return;
    await createAdventureSession(adventureId, {
        name: `Test: ${scene.title || "scene"}`,
        isTest: true,
        startSceneId: sceneId
    });
    await openView("adventurePlay", adventureId);
}

function renderAdventurePlayer(adventureId) {
    const adventure = getAdventure(adventureId);
    const session = getAdventureSession(adventureId);
    if (!adventure || !session) {
        els.messages.appendChild(emptyPanel("Start this adventure from Adventure Studio."));
        return;
    }

    const page = document.createElement("section");
    page.className = "adventurePlayer";
    const controls = document.createElement("div");
    controls.className = "adventurePlayerControls";
    const runPicker = document.createElement("label");
    runPicker.className = "adventureRunPicker";
    const runLabel = document.createElement("span");
    runLabel.textContent = "Saved run";
    const runSelect = document.createElement("select");
    getAdventureSessions(adventureId).forEach((item, index) => {
        if (!item.id) item.id = crypto.randomUUID();
        const option = document.createElement("option");
        option.value = item.id;
        option.selected = item.id === session.id;
        option.textContent = `${item.name || (item.isTest ? "Test run" : `Run ${index + 1}`)}${item.completed ? " · finished" : ""}`;
        runSelect.appendChild(option);
    });
    runSelect.addEventListener("change", async () => {
        state.activeAdventureSessionId = runSelect.value;
        await saveAdventures();
        render();
    });
    runPicker.append(runLabel, runSelect);
    const newRun = document.createElement("button");
    newRun.type = "button";
    newRun.textContent = "New run";
    newRun.addEventListener("click", async () => {
        const name = prompt("Name this saved run?", `Run ${getAdventureSessions(adventureId).length + 1}`);
        if (name === null) return;
        await createAdventureSession(adventureId, { name: normalizeDisplayName(name) || "New run" });
        render();
    });
    const restart = document.createElement("button");
    restart.type = "button";
    restart.textContent = "Restart";
    restart.addEventListener("click", () => startAdventurePlay(adventureId, true));
    const checkpoint = document.createElement("button");
    checkpoint.type = "button";
    checkpoint.textContent = "Save checkpoint";
    checkpoint.addEventListener("click", () => saveAdventureCheckpoint(adventureId));
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => openView("adventureEditor", adventureId));
    controls.append(runPicker, newRun, restart, checkpoint);
    if (adventure.metronomeEnabled !== false) {
        const adventureBpm = clampAdventureNumber(adventure.metronomeBpm, 20, 300, state.structure.settings.metronomeBpm || 120);
        const metronome = document.createElement("button");
        metronome.type = "button";
        metronome.textContent = metronomeTimer ? `Stop metronome (${adventureBpm} BPM)` : `Start metronome (${adventureBpm} BPM)`;
        metronome.addEventListener("click", async () => {
            els.metronomeBpm.value = adventureBpm;
            await toggleMetronome();
            render();
        });
        controls.appendChild(metronome);
    }
    controls.append(edit);
    page.appendChild(controls);

    if (session.isTest) {
        const testNotice = document.createElement("p");
        testNotice.className = "adventureTestNotice";
        testNotice.textContent = "Play-test run: this starts at the selected scene and is saved separately from your normal runs.";
        page.appendChild(testNotice);
    }

    ensureAdventureSessionVariables(session, adventure);
    if (adventure.enableVariables && adventure.showStats && adventure.variables?.length) {
        page.appendChild(renderAdventureStats(adventure, session));
    }
    if (adventure.enableInventory) page.appendChild(renderAdventureInventory(adventureId, session));

    if (session.completed) {
        clearAdventureAutoAdvance();
        const ending = document.createElement("section");
        ending.className = "adventureEnding";
        ending.innerHTML = "<h3>The end</h3><p>Your progress is saved locally. Restart whenever you want another path.</p>";
        page.appendChild(ending);
        page.appendChild(renderAdventureCompletionGallery(adventure, session));
    } else {
        const scene = adventure.scenes.find((item) => item.id === session.currentSceneId) || adventure.scenes[0];
        if (scene.ambience?.theme) page.classList.add(`adventureTheme-${scene.ambience.theme}`);
        const title = document.createElement("h2");
        title.textContent = scene.title || "Untitled scene";
        page.appendChild(title);
        if (adventure.showProgress !== false) {
            const progress = document.createElement("p");
            progress.className = "adventureProgress";
            progress.textContent = `Scene ${Math.max(1, adventure.scenes.findIndex((item) => item.id === scene.id) + 1)} of ${adventure.scenes.length}`;
            page.appendChild(progress);
        }
        const media = document.createElement("div");
        media.className = "adventurePlayerMedia";
        (scene.mediaRefs || []).forEach((ref) => media.appendChild(renderAdventurePlayerMedia(ref, scene.mediaCaptions?.[photoRefKey(ref)] || "")));
        const randomImage = getAdventureRandomResult(session, scene.id, "image");
        if (randomImage?.ref) media.appendChild(renderAdventurePlayerMedia(randomImage.ref));
        if (media.childElementCount) page.appendChild(media);
        if (scene.text) {
            const text = document.createElement("p");
            text.className = "adventurePlayerText";
            text.textContent = scene.text;
            page.appendChild(text);
        }
        const waitingForReady = Boolean(scene.requireReady) && !(session.readyScenes || []).includes(scene.id);
        if (waitingForReady) {
            clearAdventureAutoAdvance();
            page.appendChild(renderAdventureReadyPrompt(adventureId, scene.id));
        } else {
        const automatic = renderAdventureAutoAdvanceNotice(adventure, session, scene);
        if (automatic) page.appendChild(automatic);
        if (adventure.enableInventory && scene.inventoryItem && !(session.inventory || []).includes(scene.inventoryItem)) {
            const collect = document.createElement("button");
            collect.type = "button";
            collect.className = "adventureChoiceButton";
            collect.textContent = `Collect: ${scene.inventoryItem}`;
            collect.addEventListener("click", () => collectAdventureItem(adventureId, scene.inventoryItem));
            page.appendChild(collect);
        }
        if (scene.ambience?.metronomeBpm || scene.ambience?.timerSeconds) {
            const ambience = document.createElement("section");
            ambience.className = "adventureAmbiencePlayer";
            if (scene.ambience.metronomeBpm) {
                const metronome = document.createElement("button");
                metronome.type = "button";
                metronome.textContent = `Start scene metronome (${scene.ambience.metronomeBpm} BPM)`;
                metronome.addEventListener("click", () => { els.metronomeBpm.value = scene.ambience.metronomeBpm; startMetronome(); render(); });
                ambience.appendChild(metronome);
            }
            if (scene.ambience.timerSeconds) {
                const timer = document.createElement("button");
                timer.type = "button";
                timer.textContent = `Start scene timer (${formatTimer(scene.ambience.timerSeconds)})`;
                timer.addEventListener("click", () => { els.timerSeconds.value = scene.ambience.timerSeconds; resetCountdownTimer(); toggleCountdownTimer(); });
                ambience.appendChild(timer);
            }
            page.appendChild(ambience);
        }

        const randomAction = renderAdventureRandomPlayerAction(adventure, scene, session);
        if (randomAction) page.appendChild(randomAction);
        const choices = (scene.choices || []).filter((choice) => choice.label && isAdventureChoiceAvailable(choice, session.variables, adventure));
        if (scene.randomEvent && scene.randomEvent.type !== "image") {
            // Dice and weighted events decide the next path before ordinary choices are shown.
        } else if (scene.isEnding || choices.length === 0) {
            const end = document.createElement("button");
            end.type = "button";
            end.className = "adventureChoiceButton adventurePrimary";
            end.textContent = "Finish adventure";
            end.addEventListener("click", () => finishAdventure(adventureId, scene.id));
            page.appendChild(end);
        } else {
            const choiceList = document.createElement("div");
            choiceList.className = "adventurePlayerChoices";
            choices.forEach((choice) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "adventureChoiceButton";
                button.textContent = isMobileLayout() && choice.shortLabel ? choice.shortLabel : choice.label;
                button.addEventListener("click", () => advanceAdventure(adventureId, scene.id, choice));
                choiceList.appendChild(button);
            });
            page.appendChild(choiceList);
        }
        }
    }

    const history = document.createElement("details");
    history.className = "adventureHistory";
    const summary = document.createElement("summary");
    summary.textContent = `History (${session.history.length})`;
    history.appendChild(summary);
    if (session.history.length === 0) history.appendChild(emptyPanel("Your choices will appear here."));
    session.history.forEach((entry) => {
        const row = document.createElement("p");
        const scene = adventure.scenes.find((item) => item.id === entry.sceneId);
        row.textContent = `${scene?.title || "Scene"}: ${entry.choiceLabel || "Started"}`;
        history.appendChild(row);
    });
    page.appendChild(history);
    const checkpoints = renderAdventureCheckpoints(adventureId, session);
    if (checkpoints) page.appendChild(checkpoints);
    els.messages.appendChild(page);
}

function renderAdventureReadyPrompt(adventureId, sceneId) {
    const panel = document.createElement("section");
    panel.className = "adventureReadyPrompt";
    const message = document.createElement("p");
    message.textContent = "Take your time. Continue when you’re ready.";
    const ready = document.createElement("button");
    ready.type = "button";
    ready.className = "adventureChoiceButton adventurePrimary";
    ready.textContent = "Continue when ready";
    ready.addEventListener("click", () => markAdventureSceneReady(adventureId, sceneId));
    panel.append(message, ready);
    return panel;
}

async function markAdventureSceneReady(adventureId, sceneId) {
    const session = getAdventureSession(adventureId);
    if (!session) return;
    session.readyScenes = [...new Set([...(session.readyScenes || []), sceneId])];
    session.updatedAt = new Date().toISOString();
    await saveAdventures();
    render();
}

function clearAdventureAutoAdvance() {
    if (adventureAutoAdvanceTimer) window.clearTimeout(adventureAutoAdvanceTimer);
    adventureAutoAdvanceTimer = undefined;
    adventureAutoAdvanceKey = undefined;
    if (adventureAutoAdvanceStartedMetronome) stopMetronome();
    adventureAutoAdvanceStartedMetronome = false;
}

function renderAdventureAutoAdvanceNotice(adventure, session, scene) {
    const setting = scene.autoAdvance;
    if (!setting?.mode || !setting.targetSceneId) return null;
    const target = adventure.scenes.find((item) => item.id === setting.targetSceneId);
    if (!target) return null;
    const bpm = clampAdventureNumber(scene.ambience?.metronomeBpm || adventure.metronomeBpm, 20, 300, state.structure.settings.metronomeBpm || 120);
    const durationMs = setting.mode === "beats"
        ? Math.round(Number(setting.value || 1) * 60000 / bpm)
        : Number(setting.value || 1) * 1000;
    const key = `${session.id}:${scene.id}`;
    if (adventureAutoAdvanceKey !== key) {
        clearAdventureAutoAdvance();
        adventureAutoAdvanceKey = key;
        if (setting.mode === "beats" && !metronomeTimer) {
            els.metronomeBpm.value = bpm;
            startMetronome();
            adventureAutoAdvanceStartedMetronome = true;
        }
        adventureAutoAdvanceTimer = window.setTimeout(async () => {
            adventureAutoAdvanceTimer = undefined;
            adventureAutoAdvanceKey = undefined;
            if (state.activeView.type !== "adventurePlay" || getAdventureSession(adventure.id)?.id !== session.id || session.currentSceneId !== scene.id) return;
            if (setting.mode === "timer") vibrateAdventureTimer(adventure);
            await advanceAdventure(adventure.id, scene.id, {
                label: `${setting.mode === "beats" ? `${setting.value} metronome beats` : `${setting.value}-second ${setting.mode}`} → ${target.title || "next scene"}`,
                targetSceneId: setting.targetSceneId,
                effects: []
            });
        }, durationMs);
    }
    const panel = document.createElement("p");
    panel.className = "adventureAutoAdvanceNotice";
    panel.textContent = setting.mode === "beats"
        ? `Continuing to ${target.title || "the next scene"} after ${setting.value} beat${Number(setting.value) === 1 ? "" : "s"} at ${bpm} BPM.`
        : `Continuing to ${target.title || "the next scene"} after ${setting.value} second${Number(setting.value) === 1 ? "" : "s"}.`;
    return panel;
}

function vibrateAdventureTimer(adventure) {
    if (adventure.vibrateOnTimer && typeof navigator.vibrate === "function") navigator.vibrate([90, 45, 120]);
}

function renderAdventureInventory(adventureId, session) {
    const panel = document.createElement("section");
    panel.className = "adventureInventory";
    const title = document.createElement("strong");
    title.textContent = "Inventory";
    const items = document.createElement("span");
    items.textContent = (session.inventory || []).length ? session.inventory.join(" · ") : "Nothing collected";
    panel.append(title, items);
    return panel;
}

async function collectAdventureItem(adventureId, item) {
    const session = getAdventureSession(adventureId);
    if (!session || !item) return;
    session.inventory = [...new Set([...(session.inventory || []), item])];
    session.updatedAt = new Date().toISOString();
    await saveAdventures();
    render();
}

function renderAdventureCheckpoints(adventureId, session) {
    const entries = session.checkpoints || [];
    if (entries.length === 0) return null;
    const panel = document.createElement("section");
    panel.className = "adventureHistory";
    const heading = document.createElement("h3");
    heading.textContent = "Checkpoints";
    panel.appendChild(heading);
    entries.forEach((checkpoint) => {
        const row = document.createElement("div");
        row.className = "adventureCheckpoint";
        const label = document.createElement("span");
        label.textContent = checkpoint.name;
        const restore = document.createElement("button");
        restore.type = "button";
        restore.textContent = "Restore";
        restore.addEventListener("click", () => restoreAdventureCheckpoint(adventureId, checkpoint.id));
        row.append(label, restore);
        panel.appendChild(row);
    });
    return panel;
}

async function saveAdventureCheckpoint(adventureId) {
    const session = getAdventureSession(adventureId);
    if (!session) return;
    const name = normalizeDisplayName(prompt("Checkpoint name?", `Checkpoint ${(session.checkpoints || []).length + 1}`));
    if (!name) return;
    const snapshot = structuredClone({ ...session, checkpoints: [] });
    session.checkpoints = [...(session.checkpoints || []), { id: crypto.randomUUID(), name, createdAt: new Date().toISOString(), snapshot }];
    await saveAdventures();
    render();
}

async function restoreAdventureCheckpoint(adventureId, checkpointId) {
    const session = getAdventureSession(adventureId);
    const checkpoint = (session?.checkpoints || []).find((item) => item.id === checkpointId);
    if (!session || !checkpoint || !confirm(`Restore checkpoint “${checkpoint.name}”?`)) return;
    const checkpoints = session.checkpoints;
    Object.assign(session, structuredClone(checkpoint.snapshot), { id: session.id, adventureId, checkpoints, updatedAt: new Date().toISOString() });
    await saveAdventures();
    render();
}

function renderAdventureCompletionGallery(adventure, session) {
    const panel = document.createElement("section");
    panel.className = "adventureCompletionGallery";
    const heading = document.createElement("h3");
    heading.textContent = "Path gallery";
    panel.appendChild(heading);
    const seen = new Set();
    const refs = [];
    (session.history || []).forEach((entry) => {
        const scene = adventure.scenes.find((item) => item.id === entry.sceneId);
        (scene?.mediaRefs || []).forEach((ref) => {
            if (!seen.has(photoRefKey(ref))) { seen.add(photoRefKey(ref)); refs.push(ref); }
        });
    });
    (session.randomResults || []).filter((result) => result.ref).forEach((result) => {
        if (!seen.has(photoRefKey(result.ref))) { seen.add(photoRefKey(result.ref)); refs.push(result.ref); }
    });
    if (refs.length === 0) {
        panel.appendChild(emptyPanel("No images or GIFs were encountered on this path."));
        return panel;
    }
    const grid = document.createElement("div");
    grid.className = "adventureGalleryGrid";
    refs.forEach((ref) => grid.appendChild(renderAdventurePlayerMedia(ref)));
    const slideshow = document.createElement("button");
    slideshow.type = "button";
    slideshow.textContent = "Slideshow this path";
    slideshow.addEventListener("click", () => openSlideshow(refs.map((ref) => {
        const attachment = findAttachment(ref);
        return attachment ? { attachment, alt: attachment.note || attachment.name || "Adventure media", channelName: getChannelById(ref.channelId)?.name || "local" } : null;
    }).filter(Boolean)));
    panel.append(grid, slideshow);
    return panel;
}

function renderAdventureRandomPlayerAction(adventure, scene, session) {
    const event = scene.randomEvent;
    if (!event) return null;
    const panel = document.createElement("section");
    panel.className = "adventureRandomAction";
    if (event.type === "dice") {
        const text = document.createElement("p");
        text.textContent = `Roll 1d${event.sides || 20}. ${event.threshold || 12}+ succeeds.`;
        const roll = document.createElement("button");
        roll.type = "button";
        roll.className = "adventureChoiceButton adventurePrimary";
        roll.textContent = "Roll dice";
        roll.addEventListener("click", () => resolveAdventureDice(adventure.id, scene.id));
        panel.append(text, roll);
        return panel;
    }
    if (event.type === "quiz") {
        const question = document.createElement("p");
        const randomSourceQuiz = String(event.mode || "").startsWith("random-source");
        const sourceQuiz = ["source-choice", "source-text"].includes(event.mode) || randomSourceQuiz;
        const quizRef = randomSourceQuiz ? getAdventureRandomResult(session, scene.id, "quiz-image")?.ref : event.mediaRef;
        question.textContent = event.question || (event.mode === "source-text" || event.mode === "random-source-text"
            ? "Type the name of the channel this image came from."
            : event.mode === "source-choice" || event.mode === "random-source-choice"
                ? "Which channel did this image come from?"
                : "Choose an answer.");
        if (randomSourceQuiz && !quizRef) {
            const draw = document.createElement("button");
            draw.type = "button";
            draw.className = "adventureChoiceButton adventurePrimary";
            draw.textContent = "Draw quiz image";
            draw.addEventListener("click", () => drawAdventureQuizImage(adventure.id, scene.id));
            panel.append(question, draw);
            return panel;
        }
        if (sourceQuiz && quizRef) panel.appendChild(renderAdventurePlayerMedia(quizRef));
        if (sourceQuiz && (!quizRef || !findAttachment(quizRef))) {
            question.textContent = "Choose a local quiz image in the scene editor, or repair its missing reference.";
            panel.appendChild(question);
            return panel;
        }
        const answers = document.createElement("div");
        answers.className = "adventurePlayerChoices";
        if (event.mode === "source-text" || event.mode === "random-source-text") {
            const input = document.createElement("input");
            input.type = "text";
            input.placeholder = "Channel name";
            input.autocomplete = "off";
            const submit = document.createElement("button");
            submit.type = "button";
            submit.className = "adventureChoiceButton adventurePrimary";
            submit.textContent = "Submit answer";
            submit.addEventListener("click", () => resolveAdventureSourceQuiz(adventure.id, scene.id, input.value));
            answers.append(input, submit);
        } else if (event.mode === "source-choice" || event.mode === "random-source-choice") {
            const correctChannelId = quizRef?.channelId;
            const eligibleChannels = event.useAllChannels ? getAllChannels().map((channel) => channel.id) : (event.channelIds || []);
            const choices = [...new Set([correctChannelId, ...eligibleChannels])]
                .map((channelId) => getChannelById(channelId))
                .filter(Boolean)
                .sort(() => Math.random() - .5);
            choices.forEach((channel) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "adventureChoiceButton";
                button.textContent = `# ${channel.name}`;
                button.addEventListener("click", () => resolveAdventureSourceQuiz(adventure.id, scene.id, channel.id));
                answers.appendChild(button);
            });
            if (choices.length < 2) question.textContent = "Choose the quiz image and at least one extra channel in the editor.";
        } else {
        (event.answers || []).filter((answer) => answer.label).forEach((answer) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "adventureChoiceButton";
            button.textContent = answer.label;
            button.addEventListener("click", () => resolveAdventureQuiz(adventure.id, scene.id, answer));
            answers.appendChild(button);
        });
            if (answers.childElementCount === 0) question.textContent = "Add quiz answers in the editor first.";
        }
        panel.append(question, answers);
        return panel;
    }
    if (event.type === "weighted") {
        const text = document.createElement("p");
        text.textContent = "Let chance choose the next path.";
        const choose = document.createElement("button");
        choose.type = "button";
        choose.className = "adventureChoiceButton adventurePrimary";
        choose.textContent = "Choose random path";
        choose.addEventListener("click", () => resolveAdventureWeightedPath(adventure.id, scene.id));
        panel.append(text, choose);
        return panel;
    }
    if (event.type === "wheel") {
        const text = document.createElement("p");
        text.textContent = "Spin the wheel to choose the next path. Segment sizes follow their weights.";
        const wheel = renderAdventureWheel(event.paths || [], scene.id);
        const spin = document.createElement("button");
        spin.type = "button";
        spin.className = "adventureChoiceButton adventurePrimary";
        spin.textContent = "Spin wheel";
        spin.addEventListener("click", () => resolveAdventureWheel(adventure.id, scene.id));
        panel.append(text, wheel, spin);
        return panel;
    }
    if (event.type === "timer") {
        return renderAdventureTimerAction(adventure, scene, session);
    }
    if (getAdventureRandomResult(session, scene.id, "image")) return null;
    const text = document.createElement("p");
    const sourceCount = (event.channelIds?.length || 0) + (event.collectionIds?.length || 0);
    text.textContent = sourceCount ? "Reveal a random local image or GIF." : "Choose image channels or collections in the editor first.";
    const reveal = document.createElement("button");
    reveal.type = "button";
    reveal.className = "adventureChoiceButton";
    reveal.textContent = "Reveal random image";
    reveal.disabled = !sourceCount;
    reveal.addEventListener("click", () => revealAdventureRandomImage(adventure.id, scene.id));
    panel.append(text, reveal);
    return panel;
}

function getAdventureRandomResult(session, sceneId, kind) {
    return (session.randomResults || []).find((result) => result.sceneId === sceneId && result.kind === kind);
}

function getAdventureTimerState(session, scene) {
    session.timers ||= {};
    if (!session.timers[scene.id]) {
        const event = scene.randomEvent;
        const min = Math.min(event.minSeconds || event.seconds || 60, event.maxSeconds || event.seconds || 60);
        const max = Math.max(event.minSeconds || event.seconds || 60, event.maxSeconds || event.seconds || 60);
        session.timers[scene.id] = {
            remaining: event.random ? Math.floor(Math.random() * (max - min + 1)) + min : event.seconds || 60,
            running: false,
            completed: false,
            endsAt: null
        };
    }
    const timer = session.timers[scene.id];
    if (timer.running && timer.endsAt) timer.remaining = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
    return timer;
}

function renderAdventureTimerAction(adventure, scene, session) {
    const timer = getAdventureTimerState(session, scene);
    if (timer.running && !adventureTimerTick) startAdventureTimerTick(adventure.id, scene.id);
    const panel = document.createElement("section");
    panel.className = "adventureRandomAction adventureTimerAction";
    const display = document.createElement("strong");
    display.dataset.adventureTimerDisplay = scene.id;
    display.textContent = timer.completed ? "Timer complete" : formatTimer(timer.remaining);
    const note = document.createElement("p");
    note.textContent = timer.completed ? "The timer has already taken its completion path." : "Start, pause, or reset this scene timer.";
    const controls = document.createElement("div");
    controls.className = "adventureTimerControls";
    const start = document.createElement("button");
    start.type = "button";
    start.className = "adventureChoiceButton adventurePrimary";
    start.textContent = timer.running ? "Pause timer" : "Start timer";
    start.disabled = timer.completed;
    start.addEventListener("click", () => toggleAdventureTimer(adventure.id, scene.id));
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "adventureChoiceButton";
    reset.textContent = "Reset timer";
    reset.disabled = timer.completed;
    reset.addEventListener("click", () => resetAdventureTimer(adventure.id, scene.id));
    controls.append(start, reset);
    panel.append(display, note, controls);
    return panel;
}

async function toggleAdventureTimer(adventureId, sceneId) {
    const adventure = getAdventure(adventureId);
    const session = getAdventureSession(adventureId);
    const scene = adventure?.scenes.find((item) => item.id === sceneId);
    if (!adventure || !session || !scene) return;
    const timer = getAdventureTimerState(session, scene);
    if (timer.running) {
        timer.remaining = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
        timer.running = false;
        timer.endsAt = null;
        if (scene.randomEvent.coupleMetronome) stopMetronome();
    } else {
        timer.running = true;
        timer.endsAt = Date.now() + timer.remaining * 1000;
        if (scene.randomEvent.coupleMetronome) {
            els.metronomeBpm.value = clampAdventureNumber(adventure.metronomeBpm, 20, 300, state.structure.settings.metronomeBpm || 120);
            if (!metronomeTimer) startMetronome();
        }
        startAdventureTimerTick(adventureId, sceneId);
    }
    session.updatedAt = new Date().toISOString();
    await saveAdventures();
    render();
}

async function resetAdventureTimer(adventureId, sceneId) {
    const adventure = getAdventure(adventureId);
    const session = getAdventureSession(adventureId);
    const scene = adventure?.scenes.find((item) => item.id === sceneId);
    if (!adventure || !session || !scene) return;
    const event = scene.randomEvent;
    const min = Math.min(event.minSeconds || event.seconds || 60, event.maxSeconds || event.seconds || 60);
    const max = Math.max(event.minSeconds || event.seconds || 60, event.maxSeconds || event.seconds || 60);
    session.timers ||= {};
    session.timers[sceneId] = { remaining: event.random ? Math.floor(Math.random() * (max - min + 1)) + min : event.seconds || 60, running: false, completed: false, endsAt: null };
    if (adventureTimerTick) window.clearInterval(adventureTimerTick);
    adventureTimerTick = undefined;
    if (event.coupleMetronome) stopMetronome();
    await saveAdventures();
    render();
}

function startAdventureTimerTick(adventureId, sceneId) {
    if (adventureTimerTick) window.clearInterval(adventureTimerTick);
    adventureTimerTick = window.setInterval(async () => {
        const adventure = getAdventure(adventureId);
        const session = getAdventureSession(adventureId);
        const scene = adventure?.scenes.find((item) => item.id === sceneId);
        if (!adventure || !session || !scene || state.activeView.type !== "adventurePlay" || session.currentSceneId !== sceneId) {
            window.clearInterval(adventureTimerTick);
            adventureTimerTick = undefined;
            return;
        }
        const timer = getAdventureTimerState(session, scene);
        if (timer.remaining <= 0) {
            window.clearInterval(adventureTimerTick);
            adventureTimerTick = undefined;
            await completeAdventureTimer(adventureId, sceneId);
            return;
        }
        const display = document.querySelector(`[data-adventure-timer-display="${CSS.escape(sceneId)}"]`);
        if (display) display.textContent = formatTimer(timer.remaining);
    }, 250);
}

async function completeAdventureTimer(adventureId, sceneId) {
    const adventure = getAdventure(adventureId);
    const session = getAdventureSession(adventureId);
    const scene = adventure?.scenes.find((item) => item.id === sceneId);
    if (!adventure || !session || !scene) return;
    const timer = getAdventureTimerState(session, scene);
    if (timer.completed) return;
    timer.completed = true;
    timer.running = false;
    timer.endsAt = null;
    if (scene.randomEvent.coupleMetronome) stopMetronome();
    vibrateAdventureTimer(adventure);
    const target = scene.randomEvent.completeTargetId;
    const destination = adventure.scenes.find((item) => item.id === target)?.title || "The end";
    session.history.push({ sceneId, choiceLabel: `Timer finished → ${destination}`, at: new Date().toISOString() });
    session.currentSceneId = target || null;
    session.completed = !target;
    if (target) applyAdventureEffects(session, adventure, adventure.scenes.find((item) => item.id === target)?.effects);
    session.updatedAt = new Date().toISOString();
    await saveAdventures();
    render();
}

function getAdventureWeightedPath(paths) {
    const valid = paths.filter((path) => Number(path.weight) > 0);
    if (valid.length === 0) return null;
    const total = valid.reduce((sum, path) => sum + Number(path.weight), 0);
    let value = Math.random() * total;
    return valid.find((path) => {
        value -= Number(path.weight);
        return value < 0;
    }) || valid.at(-1);
}

function renderAdventureWheel(paths, sceneId) {
    const valid = paths.filter((path) => Number(path.weight) > 0);
    const colors = ["#5865f2", "#57f287", "#fee75c", "#eb459e", "#ed4245", "#3498db", "#9b59b6", "#e67e22"];
    const total = valid.reduce((sum, path) => sum + Number(path.weight), 0) || 1;
    let cursor = 0;
    const slices = valid.map((path, index) => {
        const next = cursor + (Number(path.weight) / total) * 360;
        const slice = `${colors[index % colors.length]} ${cursor}deg ${next}deg`;
        cursor = next;
        return slice;
    });
    const wrap = document.createElement("div");
    wrap.className = "adventureWheelWrap";
    const pointer = document.createElement("span");
    pointer.className = "adventureWheelPointer";
    pointer.setAttribute("aria-hidden", "true");
    const wheel = document.createElement("div");
    wheel.className = "adventureWheel";
    wheel.dataset.wheelScene = sceneId;
    wheel.style.background = slices.length ? `conic-gradient(${slices.join(", ")})` : "#3f4147";
    const center = document.createElement("span");
    center.textContent = "SPIN";
    wheel.appendChild(center);
    const legend = document.createElement("div");
    legend.className = "adventureWheelLegend";
    valid.forEach((path, index) => {
        const row = document.createElement("span");
        const target = getAdventure(state.activeView.id)?.scenes.find((scene) => scene.id === path.targetSceneId);
        row.textContent = `${index + 1}. ${target?.title || "End story"} (${path.weight})`;
        row.style.setProperty("--wheel-color", colors[index % colors.length]);
        legend.appendChild(row);
    });
    wrap.append(pointer, wheel, legend);
    return wrap;
}

async function resolveAdventureDice(adventureId, sceneId) {
    const adventure = getAdventure(adventureId);
    const session = getAdventureSession(adventureId);
    const scene = adventure?.scenes.find((item) => item.id === sceneId);
    if (!adventure || !session || !scene?.randomEvent) return;
    const event = scene.randomEvent;
    const roll = Math.floor(Math.random() * Math.max(2, event.sides || 20)) + 1;
    const success = roll >= (event.threshold || 12);
    const target = success ? event.successTargetId : event.failureTargetId;
    const destination = adventure.scenes.find((item) => item.id === target)?.title || "The end";
    session.history.push({ sceneId, choiceLabel: `Rolled ${roll} on d${event.sides || 20}: ${success ? "success" : "failure"} → ${destination}`, at: new Date().toISOString() });
    session.currentSceneId = target || null;
    session.completed = !target;
    if (target) applyAdventureEffects(session, adventure, adventure.scenes.find((scene) => scene.id === target)?.effects);
    session.updatedAt = new Date().toISOString();
    await saveAdventures();
    render();
}

async function resolveAdventureWeightedPath(adventureId, sceneId, choiceLabel = "Random path", chosenPath = null) {
    const adventure = getAdventure(adventureId);
    const session = getAdventureSession(adventureId);
    const paths = adventure?.scenes.find((item) => item.id === sceneId)?.randomEvent?.paths || [];
    const chosen = chosenPath || getAdventureWeightedPath(paths);
    if (!adventure || !session || !chosen) return;
    const destination = adventure.scenes.find((item) => item.id === chosen.targetSceneId)?.title || "The end";
    session.history.push({ sceneId, choiceLabel: `${choiceLabel} (weight ${chosen.weight}) → ${destination}`, at: new Date().toISOString() });
    session.currentSceneId = chosen.targetSceneId || null;
    session.completed = !chosen.targetSceneId;
    if (chosen.targetSceneId) applyAdventureEffects(session, adventure, adventure.scenes.find((scene) => scene.id === chosen.targetSceneId)?.effects);
    session.updatedAt = new Date().toISOString();
    await saveAdventures();
    render();
}

async function resolveAdventureWheel(adventureId, sceneId) {
    const adventure = getAdventure(adventureId);
    const paths = adventure?.scenes.find((item) => item.id === sceneId)?.randomEvent?.paths || [];
    const chosen = getAdventureWeightedPath(paths);
    if (!chosen) return;
    const wheel = document.querySelector(`[data-wheel-scene="${CSS.escape(sceneId)}"]`);
    if (wheel) {
        const turns = 1440 + Math.floor(Math.random() * 1080);
        wheel.classList.remove("isSpinning");
        wheel.style.setProperty("--wheel-turn", `${turns}deg`);
        void wheel.offsetWidth;
        wheel.classList.add("isSpinning");
        await new Promise((resolve) => window.setTimeout(resolve, 950));
    }
    await resolveAdventureWeightedPath(adventureId, sceneId, "Wheel", chosen);
}

async function resolveAdventureQuiz(adventureId, sceneId, answer) {
    const adventure = getAdventure(adventureId);
    const session = getAdventureSession(adventureId);
    if (!adventure || !session) return;
    const destination = adventure.scenes.find((scene) => scene.id === answer.targetSceneId)?.title || "The end";
    session.history.push({ sceneId, choiceLabel: `Quiz answer: ${answer.label} → ${destination}`, at: new Date().toISOString() });
    session.currentSceneId = answer.targetSceneId || null;
    session.completed = !answer.targetSceneId;
    if (answer.targetSceneId) applyAdventureEffects(session, adventure, adventure.scenes.find((scene) => scene.id === answer.targetSceneId)?.effects);
    session.updatedAt = new Date().toISOString();
    await saveAdventures();
    render();
}

async function drawAdventureQuizImage(adventureId, sceneId) {
    const adventure = getAdventure(adventureId);
    const session = getAdventureSession(adventureId);
    const event = adventure?.scenes.find((scene) => scene.id === sceneId)?.randomEvent;
    if (!adventure || !session || !event) return;
    await ensureServerMessagesLoaded();
    const allowed = event.useAllChannels ? null : new Set(event.channelIds || []);
    const candidates = getWorkspaceEntries().flatMap((entry) => (
        (!allowed || allowed.has(entry.channelId)) ? (entry.message.attachments || []).filter((attachment) => attachment.type?.startsWith("image/") && shouldShowAttachment(attachment)).map((attachment) => ({
            ref: { channelId: entry.channelId, messageId: entry.message.id, attachmentId: attachment.id }
        })) : []
    ));
    const chosen = randomItem(candidates);
    if (!chosen) {
        alert("Choose at least one channel with local images, or enable all channels.");
        return;
    }
    session.randomResults = [...(session.randomResults || []).filter((result) => !(result.sceneId === sceneId && result.kind === "quiz-image")), { sceneId, kind: "quiz-image", ref: chosen.ref }];
    session.updatedAt = new Date().toISOString();
    await saveAdventures();
    render();
}

async function resolveAdventureSourceQuiz(adventureId, sceneId, answer) {
    const adventure = getAdventure(adventureId);
    const session = getAdventureSession(adventureId);
    const event = adventure?.scenes.find((scene) => scene.id === sceneId)?.randomEvent;
    const mediaRef = String(event?.mode || "").startsWith("random-source") ? getAdventureRandomResult(session, sceneId, "quiz-image")?.ref : event?.mediaRef;
    if (!adventure || !session || !event || !mediaRef) return;
    const sourceChannel = getChannelById(mediaRef.channelId);
    const normalizedAnswer = String(answer || "").trim().replace(/^#\s*/, "").toLowerCase();
    const correct = event.mode === "source-text" || event.mode === "random-source-text"
        ? normalizedAnswer === String(sourceChannel?.name || "").trim().toLowerCase()
        : answer === mediaRef.channelId;
    const targetSceneId = correct ? event.successTargetId : event.failureTargetId;
    const destination = adventure.scenes.find((scene) => scene.id === targetSceneId)?.title || "The end";
    const answerLabel = event.mode === "source-text" || event.mode === "random-source-text" ? (String(answer).trim() || "No answer") : `#${getChannelById(answer)?.name || "missing"}`;
    session.history.push({
        sceneId,
        choiceLabel: `Source quiz: ${answerLabel} · ${correct ? "correct" : "wrong"} → ${destination}`,
        at: new Date().toISOString()
    });
    session.currentSceneId = targetSceneId || null;
    session.completed = !targetSceneId;
    if (targetSceneId) applyAdventureEffects(session, adventure, adventure.scenes.find((scene) => scene.id === targetSceneId)?.effects);
    session.updatedAt = new Date().toISOString();
    await saveAdventures();
    render();
}

async function revealAdventureRandomImage(adventureId, sceneId) {
    const adventure = getAdventure(adventureId);
    const session = getAdventureSession(adventureId);
    const scene = adventure?.scenes.find((item) => item.id === sceneId);
    const channelIds = scene?.randomEvent?.channelIds || [];
    const collectionIds = scene?.randomEvent?.collectionIds || [];
    if (!adventure || !session || channelIds.length + collectionIds.length === 0) return;
    const candidates = channelIds.flatMap((channelId) => (
        (state.messagesByChannel.get(channelId) || []).flatMap((message) => (
            (message.attachments || [])
                .filter((attachment) => attachment.type?.startsWith("image/") && shouldShowAttachment(attachment))
                .map((attachment) => ({ channelId, messageId: message.id, attachmentId: attachment.id }))
        ))
    ));
    collectionIds.forEach((collectionId) => {
        const collection = getAnyPhotoCollection(collectionId);
        (collection?.photoRefs || []).forEach((ref) => {
            if (findAttachment(ref)) candidates.push(ref);
        });
    });
    const ref = randomItem(candidates);
    if (!ref) {
        alert("Those channels do not currently contain a local image or GIF.");
        return;
    }
    session.randomResults = [...(session.randomResults || []), { sceneId, kind: "image", ref }];
    session.history.push({ sceneId, choiceLabel: `Revealed random media from #${getChannelById(ref.channelId)?.name || "channel"}`, at: new Date().toISOString() });
    session.updatedAt = new Date().toISOString();
    await saveAdventures();
    render();
}

function renderAdventurePlayerMedia(ref, caption = "") {
    const attachment = findAttachment(ref);
    const wrap = document.createElement("figure");
    wrap.className = "adventurePlayerMediaItem";
    if (!attachment) {
        wrap.appendChild(emptyPanel("Missing source media"));
        return wrap;
    }
    const image = document.createElement("img");
    const objectUrl = attachment.blob ? URL.createObjectURL(attachment.blob) : "";
    image.src = objectUrl || attachment.dataUrl || "";
    image.alt = caption || attachment.note || attachment.name || "Adventure media";
    if (objectUrl) image.addEventListener("load", () => URL.revokeObjectURL(objectUrl), { once: true });
    image.addEventListener("click", () => openImageViewer(attachment, image.alt));
    wrap.appendChild(image);
    if (caption) {
        const label = document.createElement("figcaption");
        label.textContent = caption;
        wrap.appendChild(label);
    }
    return wrap;
}

function createAdventureVariables(adventure) {
    return Object.fromEntries((adventure.variables || []).map((variable) => [
        variable.id,
        variable.type === "number" ? Number(variable.initialValue || 0) : Boolean(variable.initialValue)
    ]));
}

function ensureAdventureSessionVariables(session, adventure) {
    session.variables ||= {};
    (adventure.variables || []).forEach((variable) => {
        if (!(variable.id in session.variables)) {
            session.variables[variable.id] = variable.type === "number" ? Number(variable.initialValue || 0) : Boolean(variable.initialValue);
        }
    });
}

function applyAdventureEffects(session, adventure, effects = []) {
    if (!adventure.enableVariables) return;
    ensureAdventureSessionVariables(session, adventure);
    effects.forEach((effect) => {
        const variable = (adventure.variables || []).find((item) => item.id === effect.variableId);
        if (!variable) return;
        if (variable.type === "number") {
            const value = Number(effect.value) || 0;
            session.variables[variable.id] = effect.mode === "add"
                ? Number(session.variables[variable.id] || 0) + value
                : value;
        } else {
            session.variables[variable.id] = String(effect.value).toLowerCase() === "true";
        }
    });
}

function isAdventureChoiceAvailable(choice, variables = {}, adventure = {}) {
    if (!adventure.enableVariables) return true;
    const condition = choice.condition;
    if (!condition?.variableId) return true;
    const value = variables[condition.variableId];
    if (condition.operator === "truthy") return Boolean(value);
    if (condition.operator === "falsy") return !value;
    if (condition.operator === ">=") return Number(value) >= Number(condition.value);
    if (condition.operator === "<=") return Number(value) <= Number(condition.value);
    return String(value) === String(condition.value);
}

function renderAdventureStats(adventure, session) {
    const stats = document.createElement("section");
    stats.className = "adventureStats";
    (adventure.variables || []).forEach((variable) => {
        const row = document.createElement("span");
        const value = session.variables?.[variable.id];
        row.textContent = variable.type === "boolean"
            ? `${variable.name}: ${value ? "Yes" : "No"}`
            : `${variable.name}: ${Number(value || 0)}`;
        stats.appendChild(row);
    });
    return stats;
}

async function advanceAdventure(adventureId, sceneId, choice) {
    const session = getAdventureSession(adventureId);
    const adventure = getAdventure(adventureId);
    if (!session || !adventure) return;
    clearAdventureAutoAdvance();
    ensureAdventureSessionVariables(session, adventure);
    applyAdventureEffects(session, adventure, choice.effects);
    session.history.push({ sceneId, choiceLabel: choice.label, at: new Date().toISOString() });
    session.currentSceneId = choice.targetSceneId || null;
    session.completed = !choice.targetSceneId;
    if (choice.targetSceneId) applyAdventureEffects(session, adventure, adventure.scenes.find((scene) => scene.id === choice.targetSceneId)?.effects);
    session.updatedAt = new Date().toISOString();
    await saveAdventures();
    render();
}

async function finishAdventure(adventureId, sceneId) {
    const session = getAdventureSession(adventureId);
    if (!session) return;
    clearAdventureAutoAdvance();
    session.history.push({ sceneId, choiceLabel: "Finished", at: new Date().toISOString() });
    session.currentSceneId = null;
    session.completed = true;
    session.updatedAt = new Date().toISOString();
    await saveAdventures();
    render();
}

async function createAdventure() {
    const title = normalizeDisplayName(prompt("Adventure title?"));
    if (!title) return;
    const firstScene = {
        id: crypto.randomUUID(),
        title: "Opening scene",
        text: "",
        isEnding: false,
        mediaRefs: [],
        choices: []
    };
    const adventure = {
        id: uniqueId("adventure", title),
        title,
        description: "",
        metronomeEnabled: true,
        metronomeBpm: state.structure.settings.metronomeBpm || 120,
        scenes: [firstScene],
        startSceneId: firstScene.id,
        createdAt: new Date().toISOString()
    };
    state.structure.settings.adventures.push(adventure);
    await saveAdventures();
    state.activeView = { type: "adventureEditor", id: adventure.id };
    render();
}

async function saveAdventures() {
    await saveStructure(state.structure);
}

async function deleteAdventure(adventureId) {
    const adventure = getAdventure(adventureId);
    if (!adventure || !confirm(`Delete ${adventure.title}? This does not delete any source photos or GIFs.`)) return;
    state.structure.settings.adventures = getAdventures().filter((item) => item.id !== adventureId);
    state.structure.settings.adventureSessions = (state.structure.settings.adventureSessions || [])
        .filter((session) => session.adventureId !== adventureId);
    if (state.activeAdventureSessionId && !getAdventureSessions(adventureId).some((session) => session.id === state.activeAdventureSessionId)) {
        state.activeAdventureSessionId = null;
    }
    await saveAdventures();
    state.activeView = { type: "adventureStudio", id: "studio" };
    render();
}

async function addAdventureScene(adventureId) {
    const adventure = getAdventure(adventureId);
    if (!adventure) return;
    adventure.scenes.push({
        id: crypto.randomUUID(),
        title: `Scene ${adventure.scenes.length + 1}`,
        text: "",
        isEnding: false,
        mediaRefs: [],
        choices: []
    });
    await saveAdventures();
    renderMessages();
}

async function deleteAdventureScene(adventureId, sceneId) {
    const adventure = getAdventure(adventureId);
    if (!adventure || adventure.scenes.length <= 1 || !confirm("Delete this scene and its choices?")) return;
    adventure.scenes = adventure.scenes.filter((scene) => scene.id !== sceneId);
    adventure.scenes.forEach((scene) => {
        scene.choices = (scene.choices || []).map((choice) => (
            choice.targetSceneId === sceneId ? { ...choice, targetSceneId: null } : choice
        ));
    });
    if (adventure.startSceneId === sceneId) adventure.startSceneId = adventure.scenes[0].id;
    await saveAdventures();
    renderMessages();
}

async function duplicateAdventureScene(adventureId, sceneId) {
    const adventure = getAdventure(adventureId);
    const sceneIndex = adventure?.scenes.findIndex((scene) => scene.id === sceneId) ?? -1;
    if (!adventure || sceneIndex < 0) return;
    const original = adventure.scenes[sceneIndex];
    const copy = structuredClone(original);
    copy.id = crypto.randomUUID();
    copy.title = `${original.title || "Untitled scene"} copy`;
    copy.choices = (copy.choices || []).map((choice) => ({ ...choice, id: crypto.randomUUID() }));
    if (copy.randomEvent?.type === "quiz") {
        copy.randomEvent.answers = (copy.randomEvent.answers || []).map((answer) => ({ ...answer, id: crypto.randomUUID() }));
    }
    adventure.scenes.splice(sceneIndex + 1, 0, copy);
    await saveAdventures();
    renderMessages();
}

async function pickAdventureMedia(adventureId, sceneId, replaceRef = null) {
    openAdventureMediaSourcePicker(adventureId, sceneId, replaceRef);
}

function openMediaLoadingOverlay(label = "Loading local media…") {
    const modal = document.createElement("section");
    modal.className = "adventureMediaPicker";
    const card = document.createElement("div");
    card.className = "adventureMediaPickerCard mediaLoadingCard";
    const shimmer = document.createElement("span");
    shimmer.className = "skeletonBlock";
    const text = document.createElement("p");
    text.textContent = label;
    const detail = document.createElement("p");
    detail.textContent = "Reading only the photos stored in this browser.";
    card.append(shimmer, text, detail);
    modal.appendChild(card);
    document.body.appendChild(modal);
    return modal;
}

function openAdventureMediaSourcePicker(adventureId, sceneId, replaceRef) {
    const modal = document.createElement("section");
    modal.className = "adventureMediaPicker";
    const card = document.createElement("div");
    card.className = "adventureMediaPickerCard adventureMediaSourceCard";
    const heading = document.createElement("h3");
    heading.textContent = replaceRef ? "Repair adventure media" : "Add image or GIF";
    const help = document.createElement("p");
    help.textContent = "Start with a channel to find a specific photo, or browse your whole local media gallery.";
    const choices = document.createElement("div");
    choices.className = "adventureMediaSourceChoices";
    const channel = document.createElement("button");
    channel.type = "button";
    channel.textContent = "Choose a channel first";
    const gallery = document.createElement("button");
    gallery.type = "button";
    gallery.textContent = "Browse all media";
    const upload = document.createElement("button");
    upload.type = "button";
    upload.textContent = "Upload from this device";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Cancel";
    const dismiss = () => modal.remove();
    upload.addEventListener("click", () => {
        dismiss();
        chooseAdventureDeviceMedia(adventureId, sceneId, replaceRef);
    });
    channel.addEventListener("click", async () => {
        dismiss();
        await openAdventureMediaChannelPicker(adventureId, sceneId, replaceRef);
    });
    gallery.addEventListener("click", async () => { dismiss(); await pickAdventureMediaFromLibrary(adventureId, sceneId, replaceRef); });
    close.addEventListener("click", dismiss);
    modal.addEventListener("click", (event) => { if (event.target === modal) dismiss(); });
    choices.append(channel, gallery, upload, close);
    card.append(heading, help, choices);
    modal.appendChild(card);
    document.body.appendChild(modal);
}

async function pickAdventureMediaFromLibrary(adventureId, sceneId, replaceRef = null) {
    const loading = openMediaLoadingOverlay();
    try {
        await ensureServerMessagesLoaded();
    } finally {
        loading.remove();
    }
    const options = getAdventureMediaOptions();
    if (state.structure.settings.thumbnailMediaPicker) {
        openAdventureMediaPicker(adventureId, sceneId, options, replaceRef);
        return;
    }
    if (options.length === 0) {
        alert("Add an image or GIF to any server first.");
        return;
    }
    const visible = options.slice(0, 100);
    const selected = Number.parseInt(prompt(`Add which local image or GIF?\n${visible.map((item, index) => `${index + 1}. ${item.label}`).join("\n")}`), 10);
    const option = visible[selected - 1];
    if (!option) return;
    await applyAdventureMediaReference(adventureId, sceneId, option.ref, replaceRef);
}

async function openAdventureMediaChannelPicker(adventureId, sceneId, replaceRef = null) {
    const loading = openMediaLoadingOverlay("Finding channels with local media…");
    try {
        await ensureServerMessagesLoaded();
    } finally {
        loading.remove();
    }
    const options = getAdventureMediaOptions();
    const channelCounts = new Map();
    options.forEach((option) => channelCounts.set(option.ref.channelId, (channelCounts.get(option.ref.channelId) || 0) + 1));
    if (channelCounts.size === 0) {
        alert("Add an image or GIF to a channel first.");
        return;
    }
    const modal = document.createElement("section");
    modal.className = "adventureMediaPicker";
    const card = document.createElement("div");
    card.className = "adventureMediaPickerCard adventureMediaChannelCard";
    const heading = document.createElement("h3");
    heading.textContent = "Choose a channel";
    const help = document.createElement("p");
    help.textContent = "Only channels with local images or GIFs are shown.";
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Search channels or servers";
    const list = document.createElement("div");
    list.className = "adventureMediaChannelList";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Back";
    const dismiss = () => modal.remove();
    close.addEventListener("click", dismiss);
    const renderChannels = () => {
        list.innerHTML = "";
        const query = search.value.trim().toLowerCase();
        [...channelCounts.keys()].map((channelId) => {
            const selectedChannel = getChannelById(channelId);
            return { channelId, channel: selectedChannel, server: getChannelServer(channelId), count: channelCounts.get(channelId) };
        }).filter((item) => item.channel).filter((item) => !query || `${item.channel.name} ${item.server?.name || ""}`.toLowerCase().includes(query)).forEach((item) => {
            const button = document.createElement("button");
            button.type = "button";
            const name = document.createElement("strong");
            name.textContent = `# ${item.channel.name}`;
            const meta = document.createElement("span");
            meta.textContent = `${item.server?.name || "Local"} · ${item.count} ${item.count === 1 ? "item" : "items"}`;
            button.append(name, meta);
            button.addEventListener("click", () => {
                dismiss();
                openAdventureMediaPicker(adventureId, sceneId, options.filter((option) => option.ref.channelId === item.channelId), replaceRef, item.channel);
            });
            list.appendChild(button);
        });
    };
    search.addEventListener("input", renderChannels);
    modal.addEventListener("click", (event) => { if (event.target === modal) dismiss(); });
    card.append(heading, help, search, list, close);
    modal.appendChild(card);
    document.body.appendChild(modal);
    renderChannels();
}

function chooseAdventureDeviceMedia(adventureId, sceneId, replaceRef = null) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.hidden = true;
    input.addEventListener("change", async () => {
        const files = [...(input.files || [])];
        input.remove();
        await importAdventureDeviceMedia(adventureId, sceneId, files, replaceRef);
    }, { once: true });
    document.body.appendChild(input);
    input.click();
}

function ensureAdventureAssetsChannel() {
    const server = state.structure.servers.find((item) => item.isAdventureServer) || getActiveServer();
    if (!server) return null;
    let category = server.categories.find((item) => item.id === "adventure-assets");
    if (!category) {
        category = { id: "adventure-assets", name: "Adventure assets", collapsed: false, channels: [] };
        server.categories.unshift(category);
    }
    let channel = category.channels.find((item) => item.id === "adventure-assets:uploads");
    if (!channel) {
        channel = { id: "adventure-assets:uploads", name: "adventure-uploads", isAdventureAssetsChannel: true };
        category.channels.push(channel);
    }
    return channel;
}

async function importAdventureDeviceMedia(adventureId, sceneId, files, replaceRef = null) {
    const selected = files.filter((file) => file.type.startsWith("image/")).slice(0, 12);
    const accepted = selected.filter((file) => file.size <= 25 * 1024 * 1024);
    if (accepted.length === 0) {
        alert("Choose an image or GIF under 25 MB. Up to 12 files can be added at once.");
        return;
    }
    if (accepted.length < selected.length) alert("Some files were skipped because they are over 25 MB.");
    const channel = ensureAdventureAssetsChannel();
    const scene = getAdventure(adventureId)?.scenes.find((item) => item.id === sceneId);
    if (!channel || !scene) return;
    if (!state.messagesByChannel.has(channel.id)) {
        state.messagesByChannel.set(channel.id, normalizeMessages(await getChannelMessages(channel.id)));
    }
    const message = createMessage("Adventure upload", accepted.map(fileToAttachment));
    const messages = [...state.messagesByChannel.get(channel.id), message];
    const refs = message.attachments.map((attachment) => ({ channelId: channel.id, messageId: message.id, attachmentId: attachment.id }));
    state.messagesByChannel.set(channel.id, messages);
    if (replaceRef && refs[0]) scene.mediaRefs = (scene.mediaRefs || []).map((item) => photoRefKey(item) === photoRefKey(replaceRef) ? refs[0] : item);
    const existing = new Set((scene.mediaRefs || []).map(photoRefKey));
    scene.mediaRefs = [...(scene.mediaRefs || []), ...refs.slice(replaceRef ? 1 : 0).filter((ref) => !existing.has(photoRefKey(ref)))];
    await saveChannelMessages(channel.id, messages);
    await saveAdventures();
    renderMessages();
    refreshStorageEstimate();
}

function getAdventureMediaOptions() {
    return getWorkspaceEntries().flatMap((entry) => (
        (entry.message.attachments || [])
            .filter((attachment) => attachment.type?.startsWith("image/") && shouldShowAttachment(attachment))
            .map((attachment) => ({
                ref: { channelId: entry.channelId, messageId: entry.message.id, attachmentId: attachment.id },
                label: `#${getChannelById(entry.channelId)?.name || "channel"} · ${attachment.note || attachment.name || "image"}`
            }))
    ));
}

async function applyAdventureMediaReference(adventureId, sceneId, ref, replaceRef = null) {
    const scene = getAdventure(adventureId)?.scenes.find((item) => item.id === sceneId);
    if (!scene) return;
    if (replaceRef) {
        scene.mediaRefs = (scene.mediaRefs || []).map((item) => photoRefKey(item) === photoRefKey(replaceRef) ? ref : item);
    } else {
        const exists = (scene.mediaRefs || []).some((item) => photoRefKey(item) === photoRefKey(ref));
        if (!exists) scene.mediaRefs = [...(scene.mediaRefs || []), ref];
    }
    await saveAdventures();
    renderMessages();
}

function openAdventureMediaPicker(adventureId, sceneId, options, replaceRef, channel = null) {
    if (options.length === 0) {
        alert("Add an image or GIF to any server first.");
        return;
    }
    const modal = document.createElement("section");
    modal.className = "adventureMediaPicker";
    const card = document.createElement("div");
    card.className = "adventureMediaPickerCard";
    const heading = document.createElement("h3");
    heading.textContent = replaceRef ? "Repair media reference" : channel ? `Choose from #${channel.name}` : "Browse local media";
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = channel ? "Search this channel" : "Search filename, note, or channel";
    const grid = document.createElement("div");
    grid.className = "adventureMediaPickerGrid";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Close";
    const dismiss = () => modal.remove();
    close.addEventListener("click", dismiss);
    const more = document.createElement("button");
    more.type = "button";
    const pageSize = 10;
    let visibleLimit = pageSize;
    let matching = [];
    const appendOptions = (items) => {
        items.forEach((option) => {
            const attachment = findAttachment(option.ref);
            if (!attachment) return;
            const button = document.createElement("button");
            button.type = "button";
            const image = document.createElement("img");
            const objectUrl = attachment.blob ? URL.createObjectURL(attachment.blob) : "";
            image.src = objectUrl || attachment.dataUrl || "";
            image.alt = option.label;
            if (objectUrl) image.addEventListener("load", () => URL.revokeObjectURL(objectUrl), { once: true });
            const label = document.createElement("span");
            label.textContent = option.label;
            button.append(image, label);
            button.addEventListener("click", async () => {
                dismiss();
                await applyAdventureMediaReference(adventureId, sceneId, option.ref, replaceRef);
            });
            grid.appendChild(button);
        });
    };
    const updateMore = () => {
        more.hidden = matching.length <= visibleLimit;
        more.textContent = `Load 10 more (${matching.length - visibleLimit} remaining)`;
    };
    const loadMore = () => {
        if (visibleLimit >= matching.length) return;
        const previousLimit = visibleLimit;
        visibleLimit = Math.min(matching.length, visibleLimit + pageSize);
        appendOptions(matching.slice(previousLimit, visibleLimit));
        updateMore();
    };
    const renderOptions = () => {
        grid.replaceChildren();
        const query = search.value.trim().toLowerCase();
        matching = options.filter((option) => !query || option.label.toLowerCase().includes(query));
        visibleLimit = Math.min(pageSize, matching.length);
        appendOptions(matching.slice(0, visibleLimit));
        updateMore();
    };
    search.addEventListener("input", renderOptions);
    more.addEventListener("click", loadMore);
    grid.addEventListener("scroll", () => {
        if (grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 80) loadMore();
    }, { passive: true });
    modal.addEventListener("click", (event) => { if (event.target === modal) dismiss(); });
    card.append(heading, search, grid, more, close);
    modal.appendChild(card);
    document.body.appendChild(modal);
    renderOptions();
}

async function removeAdventureMedia(adventureId, sceneId, ref) {
    const scene = getAdventure(adventureId)?.scenes.find((item) => item.id === sceneId);
    if (!scene) return;
    scene.mediaRefs = (scene.mediaRefs || []).filter((item) => photoRefKey(item) !== photoRefKey(ref));
    await saveAdventures();
    renderMessages();
}

async function setAdventureRandomImageSources(adventureId, sceneId) {
    await ensureServerMessagesLoaded();
    const channels = getAllChannels().filter((channel) => (
        (state.messagesByChannel.get(channel.id) || []).some((message) => (
            message.attachments?.some((attachment) => attachment.type?.startsWith("image/"))
        ))
    ));
    if (channels.length === 0) {
        alert("Add images or GIFs to a channel first.");
        return;
    }
    const collections = state.structure.settings.photoCollections || [];
    const sources = [
        ...channels.map((channel) => ({ type: "channel", id: channel.id, label: `#${channel.name} (${getChannelServer(channel.id)?.name || "server"})` })),
        ...collections.map((collection) => ({ type: "collection", id: collection.id, label: `@${collection.name} (collection)` }))
    ];
    const response = prompt(`Choose image channels or collections by number (separate multiple numbers with commas):\n${sources.map((source, index) => `${index + 1}. ${source.label}`).join("\n")}`);
    if (response === null) return;
    const selected = response.split(",")
        .map((value) => sources[Number.parseInt(value.trim(), 10) - 1])
        .filter(Boolean);
    const scene = getAdventure(adventureId)?.scenes.find((item) => item.id === sceneId);
    if (!scene?.randomEvent || scene.randomEvent.type !== "image") return;
    scene.randomEvent.channelIds = [...new Set(selected.filter((item) => item.type === "channel").map((item) => item.id))];
    scene.randomEvent.collectionIds = [...new Set(selected.filter((item) => item.type === "collection").map((item) => item.id))];
    await saveAdventures();
    renderMessages();
}

function findAttachment(ref) {
    const message = (state.messagesByChannel.get(ref.channelId) || []).find((item) => item.id === ref.messageId);
    return message?.attachments.find((attachment) => attachment.id === ref.attachmentId) || null;
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
    const linkedPhotos = renderLinkedPhotoReferences(message);
    if (linkedPhotos) article.appendChild(linkedPhotos);

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

function renderLinkedPhotoReferences(message) {
    const refs = (message.linkedPhotoRefs || []).filter((ref) => findAttachment(ref));
    if (refs.length === 0) return null;
    const section = document.createElement("section");
    section.className = "linkedPhotoReferences";
    const heading = document.createElement("strong");
    heading.textContent = `Linked photos (${refs.length})`;
    const grid = document.createElement("div");
    grid.className = "linkedPhotoReferenceGrid";
    const gallery = refs.map((ref) => {
        const attachment = findAttachment(ref);
        const sourceMessage = (state.messagesByChannel.get(ref.channelId) || []).find((item) => item.id === ref.messageId);
        return { attachment, alt: attachment?.note || attachment?.name || "Linked photo", channelName: getChannelById(ref.channelId)?.name || "channel", date: sourceMessage?.createdAt, tags: sourceMessage?.tags || [] };
    }).filter((item) => item.attachment);
    gallery.forEach((item, index) => {
        const button = document.createElement("button");
        button.type = "button";
        const image = document.createElement("img");
        const objectUrl = item.attachment.blob ? URL.createObjectURL(item.attachment.blob) : "";
        image.src = objectUrl || item.attachment.dataUrl || "";
        image.alt = item.alt;
        if (objectUrl) image.addEventListener("load", () => URL.revokeObjectURL(objectUrl), { once: true });
        const label = document.createElement("span");
        label.textContent = `# ${item.channelName}`;
        button.append(image, label);
        button.addEventListener("click", () => openImageViewer(item.attachment, item.alt, gallery, index));
        grid.appendChild(button);
    });
    section.append(heading, grid);
    return section;
}

function renderAttachments(attachments, message, channelId) {
    return attachments.filter(shouldShowAttachment).map((attachment) => {
        if (attachment.type?.startsWith("image/")) {
            const figure = document.createElement("figure");
            figure.className = "imageAttachment";
            figure.classList.toggle("isFavorite", Boolean(attachment.favorite));
            figure.title = "Tap to view fullscreen · hold for actions";
            const ref = { channelId, messageId: message.id, attachmentId: attachment.id };
            const key = photoRefKey(ref);
            figure.dataset.photoRef = key;
            figure.classList.toggle("isSelected", state.selectedPhotoRefs.some((item) => photoRefKey(item) === key));

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

            const viewerItems = [{ attachment, alt: image.alt, channelName: getChannelById(channelId)?.name || "channel", date: message.createdAt, tags: message.tags || [] }];
            const moreButton = document.createElement("button");
            moreButton.className = "imageNoteButton";
            moreButton.type = "button";
            moreButton.textContent = "More photo actions";
            moreButton.addEventListener("click", (event) => {
                event.stopPropagation();
                openPhotoActionSheet({ message, attachment, channelId, viewerItems, alt: image.alt });
            });
            figure.append(image, caption, noteButton, collectionButton, moreButton);
            bindPhotoQuickActions(figure, { message, attachment, channelId, viewerItems, alt: image.alt });
            figure.addEventListener("click", (event) => {
                if (figure.dataset.longPressHandled === "1") {
                    figure.dataset.longPressHandled = "";
                    event.preventDefault();
                    return;
                }
                openImageViewer(attachment, image.alt, viewerItems);
            });
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
    els.linkPhotosBtn.disabled = !enabled;
    els.newChannelBtn.disabled = !state.ready || !state.isUnlocked;
    els.newCategoryBtn.disabled = !state.ready || !state.isUnlocked;
    els.deleteChannelBtn.disabled = !enabled;
    els.randomChannelBtn.disabled = !state.ready || !state.isUnlocked || allChannels().length === 0;
    els.randomServerMessageBtn.disabled = !state.ready || !state.isUnlocked || getAllChannels().length === 0;
    const collectionHasNotes = state.activeView.type === "collection" && getCollectionEntries(state.activeView.id).length > 0;
    const randomArrayHasNotes = state.activeView.type === "randomArray" && state.randomPhotoArray.length > 0;
    const canRandomizeCurrentView = enabled || collectionHasNotes || randomArrayHasNotes;
    els.randomMessageBtn.disabled = !state.ready || !state.isUnlocked || !canRandomizeCurrentView;
    els.randomPhotoArrayBtn.disabled = !state.ready || !state.isUnlocked;
    els.randomMetronomeBtn.disabled = !state.ready || !state.isUnlocked;
    els.metronomeToggleBtn.disabled = !state.ready || !state.isUnlocked;
    els.mobileBackBtn.disabled = !state.ready || !state.isUnlocked;
    els.mobileRandomBtn.disabled = !state.ready || !state.isUnlocked || !canRandomizeCurrentView;
    els.mobileAddImageBtn.disabled = !enabled;
    els.mobileMoreBtn.disabled = !state.ready || !state.isUnlocked;

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
    state.draftLinkedPhotoRefs.forEach((ref) => {
        const attachment = findAttachment(ref);
        const chip = document.createElement("button");
        chip.className = "attachmentChip linkedPhotoChip";
        chip.type = "button";
        chip.textContent = `Linked: ${attachment?.note || attachment?.name || "photo"} x`;
        chip.title = "Remove linked photo";
        chip.addEventListener("click", () => {
            state.draftLinkedPhotoRefs = state.draftLinkedPhotoRefs.filter((item) => photoRefKey(item) !== photoRefKey(ref));
            renderComposer();
        });
        els.attachmentPreview.appendChild(chip);
    });
}

function openMobileQuickActions() {
    const modal = document.createElement("section");
    modal.className = "adventureMediaPicker mobileQuickSheet";
    const card = document.createElement("div");
    card.className = "adventureMediaPickerCard mobileQuickSheetCard";
    const heading = document.createElement("h3");
    heading.textContent = "More actions";
    const help = document.createElement("p");
    help.textContent = "Quick tools for this local workspace.";
    const actions = document.createElement("div");
    actions.className = "mobileQuickSheetActions";
    const dismiss = () => modal.remove();
    const makeAction = (label, action, disabled = false, danger = false) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.disabled = disabled;
        button.classList.toggle("danger", danger);
        button.addEventListener("click", () => { dismiss(); action(); });
        return button;
    };
    const isChannel = state.activeView.type === "channel" && Boolean(state.activeChannelId);
    actions.append(
        makeAction("Start / pause timer", () => els.chatTimerQuick.click()),
        makeAction("Link local photos", openLinkedPhotoPicker, !isChannel),
        makeAction("Compare photos", openComparePicker, els.comparePhotosBtn.hidden || els.comparePhotosBtn.disabled),
        makeAction("Search this view", () => { els.searchInput.focus(); }, !isChannel),
        makeAction(state.focusMode ? "Exit focus mode" : "Focus this channel", () => { state.focusMode = !state.focusMode; render(); }, !isChannel),
        makeAction("Lock workspace", lockWorkspace, !state.isUnlocked),
        makeAction("Delete this channel", deleteActiveChannel, !isChannel, true)
    );
    const close = makeAction("Close", dismiss);
    modal.addEventListener("click", (event) => { if (event.target === modal) dismiss(); });
    card.append(heading, help, actions, close);
    modal.appendChild(card);
    document.body.appendChild(modal);
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

function getFavoriteEntries() {
    return getServerEntries()
        .map((entry) => ({
            ...entry,
            message: {
                ...entry.message,
                attachments: (entry.message.attachments || []).filter((attachment) => attachment.favorite && shouldShowAttachment(attachment))
            }
        }))
        .filter((entry) => entry.message.attachments.length > 0)
        .sort((a, b) => new Date(b.message.createdAt) - new Date(a.message.createdAt));
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

function getAnyPhotoCollection(collectionId) {
    return (state.structure.settings.photoCollections || []).find((collection) => collection.id === collectionId);
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
    document.querySelectorAll("[data-photo-ref]").forEach((element) => {
        const isSelected = state.selectedPhotoRefs.some((item) => photoRefKey(item) === element.dataset.photoRef);
        element.classList.toggle("isSelected", isSelected);
        const checkbox = element.querySelector(".photoSelector");
        if (checkbox) checkbox.checked = isSelected;
    });
    renderBatchActions();
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
        (!text && state.draftAttachments.length === 0 && state.draftLinkedPhotoRefs.length === 0)
        || !state.activeChannelId
        || !state.ready
        || state.activeView.type !== "channel"
    ) {
        return;
    }

    const messages = [...getActiveMessages(), createMessage(text, state.draftAttachments, state.draftLinkedPhotoRefs)];
    state.messagesByChannel.set(state.activeChannelId, messages);
    state.draftAttachments = [];
    state.draftLinkedPhotoRefs = [];
    state.visibleMessageLimit = 100;
    els.noteInput.value = "";
    render();

    await saveChannelMessages(state.activeChannelId, messages);
    els.messages.scrollTop = els.messages.scrollHeight;
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
    await maybeRandomizeMetronome("channel");
    await maybeRandomizeTimer("channel");
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

async function selectRandomMessageForCurrentView() {
    if (state.activeView.type === "collection") {
        await selectRandomMessageInCollection();
        return;
    }
    if (state.activeView.type === "randomArray") {
        await selectRandomMessageInRandomArray();
        return;
    }
    await selectRandomMessage(state.activeChannelId);
}

async function selectRandomMessageInCollection() {
    await maybeRandomizeMetronome("message");
    await maybeRandomizeTimer("message");
    const entry = randomItem(getCollectionEntries(state.activeView.id));
    if (!entry?.message || !entry.channelId) {
        alert("This collection has no available source notes.");
        return;
    }
    state.activeChannelId = entry.channelId;
    state.activeServerId = getChannelServer(entry.channelId)?.id || state.activeServerId;
    state.activeView = { type: "channel", id: entry.channelId };
    await loadActiveChannelMessages();
    render();
    showMobileStage("chat");
    requestAnimationFrame(() => {
        const node = els.messages.querySelector(`[data-message-id="${entry.message.id}"]`);
        node?.scrollIntoView({ behavior: "smooth", block: "center" });
        node?.classList.add("selected");
        setTimeout(() => node?.classList.remove("selected"), 1400);
    });
}

async function selectRandomMessageInRandomArray() {
    await maybeRandomizeMetronome("message");
    await maybeRandomizeTimer("message");
    const entry = randomItem(state.randomPhotoArray);
    if (!entry?.message || !entry.channelId) {
        alert("This random array has no available source notes.");
        return;
    }
    state.activeChannelId = entry.channelId;
    state.activeServerId = getChannelServer(entry.channelId)?.id || state.activeServerId;
    state.activeView = { type: "channel", id: entry.channelId };
    await loadActiveChannelMessages();
    render();
    showMobileStage("chat");
    requestAnimationFrame(() => {
        const node = els.messages.querySelector(`[data-message-id="${entry.message.id}"]`);
        node?.scrollIntoView({ behavior: "smooth", block: "center" });
        node?.classList.add("selected");
        setTimeout(() => node?.classList.remove("selected"), 1400);
    });
}

async function selectRandomMessageInAnyChannel() {
    await maybeRandomizeMetronome("message");
    await maybeRandomizeTimer("message");
    const channels = getAllChannels().filter((channel) => !channel.hidden && !getChannelCategory(channel.id)?.hidden);
    if (channels.length === 0) return;

    const shuffled = [...channels].sort(() => Math.random() - .5);
    for (const channel of shuffled) {
        if (!state.messagesByChannel.has(channel.id)) {
            state.messagesByChannel.set(channel.id, normalizeMessages(await getChannelMessages(channel.id)));
        }
        if ((state.messagesByChannel.get(channel.id) || []).length === 0) continue;
        await selectRandomMessage(channel.id, true);
        return;
    }
    alert("There are no notes in any visible channel yet.");
}

async function selectRandomMessage(channelId, skipRandomizers = false) {
    if (!skipRandomizers) {
        await maybeRandomizeMetronome("message");
        await maybeRandomizeTimer("message");
    }
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
    await maybeRandomizeMetronome("array");
    await maybeRandomizeTimer("array");
    const requested = Number.parseInt(els.randomPhotoCount.value, 10);
    const count = Math.min(Math.max(requested || 9, 1), 500);
    els.randomPhotoCount.value = count;

    await ensureServerMessagesLoaded();
    const candidates = getServerEntries().flatMap((entry) => (
        (entry.message.attachments || [])
            .filter((attachment) => attachment.type?.startsWith("image/") && shouldShowAttachment(attachment))
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
    els.thumbnailMediaPickerToggle.checked = state.structure.settings.thumbnailMediaPicker !== false;
    els.showHiddenPhotosToggle.checked = Boolean(state.structure.settings.showHiddenPhotos);
    els.metronomeBpm.value = state.structure.settings.metronomeBpm;
    els.metronomeMin.value = state.structure.settings.metronomeMin;
    els.metronomeMax.value = state.structure.settings.metronomeMax;
    els.randomBpmOnMessage.checked = Boolean(state.structure.settings.randomBpmOnMessage);
    els.randomBpmOnChannel.checked = Boolean(state.structure.settings.randomBpmOnChannel);
    els.randomBpmOnArray.checked = Boolean(state.structure.settings.randomBpmOnArray);
    els.timerSeconds.value = state.structure.settings.timerSeconds;
    els.timerMinSeconds.value = state.structure.settings.timerMinSeconds;
    els.timerMaxSeconds.value = state.structure.settings.timerMaxSeconds;
    els.timerCoupleMetronome.checked = Boolean(state.structure.settings.timerCoupleMetronome);
    els.timerRepeatWithRandomBpm.checked = Boolean(state.structure.settings.timerRepeatWithRandomBpm);
    els.randomTimerOnMessage.checked = Boolean(state.structure.settings.randomTimerOnMessage);
    els.randomTimerOnChannel.checked = Boolean(state.structure.settings.randomTimerOnChannel);
    els.randomTimerOnArray.checked = Boolean(state.structure.settings.randomTimerOnArray);
    renderMetronome();
    if (!countdownTimer) countdownRemaining = state.structure.settings.timerSeconds;
    renderCountdownTimer();
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

async function toggleThumbnailMediaPicker() {
    state.structure.settings.thumbnailMediaPicker = els.thumbnailMediaPickerToggle.checked;
    await saveStructure(state.structure);
}

async function toggleShowHiddenPhotos() {
    state.structure.settings.showHiddenPhotos = els.showHiddenPhotosToggle.checked;
    await saveStructure(state.structure);
    renderMessages();
}

function getMetronomeSettings() {
    const clamp = (value, fallback) => Math.min(300, Math.max(20, Number.parseInt(value, 10) || fallback));
    return {
        bpm: clamp(els.metronomeBpm.value, DEFAULT_STRUCTURE.settings.metronomeBpm),
        min: clamp(els.metronomeMin.value, DEFAULT_STRUCTURE.settings.metronomeMin),
        max: clamp(els.metronomeMax.value, DEFAULT_STRUCTURE.settings.metronomeMax)
    };
}

async function saveMetronomeSettings() {
    const settings = getMetronomeSettings();
    state.structure.settings.metronomeBpm = settings.bpm;
    state.structure.settings.metronomeMin = settings.min;
    state.structure.settings.metronomeMax = settings.max;
    els.metronomeBpm.value = settings.bpm;
    els.metronomeMin.value = settings.min;
    els.metronomeMax.value = settings.max;
    await saveStructure(state.structure);
    if (metronomeTimer) startMetronome();
}

async function selectRandomMetronomeBpm() {
    const settings = getMetronomeSettings();
    const min = Math.min(settings.min, settings.max);
    const max = Math.max(settings.min, settings.max);
    els.metronomeBpm.value = Math.floor(Math.random() * (max - min + 1)) + min;
    await saveMetronomeSettings();
}

async function maybeRandomizeMetronome(trigger) {
    const setting = {
        message: "randomBpmOnMessage",
        channel: "randomBpmOnChannel",
        array: "randomBpmOnArray"
    }[trigger];
    if (setting && state.structure.settings[setting]) {
        await selectRandomMetronomeBpm();
    }
}

async function saveMetronomeTriggers() {
    state.structure.settings.randomBpmOnMessage = els.randomBpmOnMessage.checked;
    state.structure.settings.randomBpmOnChannel = els.randomBpmOnChannel.checked;
    state.structure.settings.randomBpmOnArray = els.randomBpmOnArray.checked;
    await saveStructure(state.structure);
}

async function toggleMetronome() {
    if (metronomeTimer) {
        stopMetronome();
        return;
    }
    await saveMetronomeSettings();
    startMetronome();
}

function startMetronome() {
    stopMetronome(false);
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
        els.metronomeStatus.textContent = "Audio unavailable";
        return;
    }
    metronomeContext ||= new AudioContextClass();
    metronomeContext.resume().catch(() => {});
    const period = 60000 / getMetronomeSettings().bpm;
    playMetronomeClick();
    metronomeTimer = window.setInterval(playMetronomeClick, period);
    renderMetronome();
}

function stopMetronome(render = true) {
    if (metronomeTimer) window.clearInterval(metronomeTimer);
    metronomeTimer = undefined;
    if (render) renderMetronome();
}

function playMetronomeClick() {
    if (!metronomeContext) return;
    const oscillator = metronomeContext.createOscillator();
    const gain = metronomeContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 1000;
    gain.gain.setValueAtTime(0.11, metronomeContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, metronomeContext.currentTime + 0.045);
    oscillator.connect(gain).connect(metronomeContext.destination);
    oscillator.start();
    oscillator.stop(metronomeContext.currentTime + 0.05);
}

function renderMetronome() {
    const running = Boolean(metronomeTimer);
    els.metronomeToggleBtn.textContent = running ? "Stop" : "Start";
    els.metronomeStatus.textContent = running ? `${els.metronomeBpm.value || 120} BPM` : "Stopped";
}

function getTimerSettings() {
    const clamp = (value, fallback) => Math.min(7200, Math.max(1, Number.parseInt(value, 10) || fallback));
    return {
        seconds: clamp(els.timerSeconds.value, DEFAULT_STRUCTURE.settings.timerSeconds),
        min: clamp(els.timerMinSeconds.value, DEFAULT_STRUCTURE.settings.timerMinSeconds),
        max: clamp(els.timerMaxSeconds.value, DEFAULT_STRUCTURE.settings.timerMaxSeconds)
    };
}

function formatTimer(seconds) {
    const value = Math.max(0, Math.ceil(Number(seconds) || 0));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

async function saveTimerSettings() {
    const settings = getTimerSettings();
    state.structure.settings.timerSeconds = settings.seconds;
    state.structure.settings.timerMinSeconds = settings.min;
    state.structure.settings.timerMaxSeconds = settings.max;
    els.timerSeconds.value = settings.seconds;
    els.timerMinSeconds.value = settings.min;
    els.timerMaxSeconds.value = settings.max;
    if (!countdownTimer) countdownRemaining = settings.seconds;
    await saveStructure(state.structure);
    renderCountdownTimer();
}

async function selectRandomTimer() {
    const settings = getTimerSettings();
    const min = Math.min(settings.min, settings.max);
    const max = Math.max(settings.min, settings.max);
    els.timerSeconds.value = Math.floor(Math.random() * (max - min + 1)) + min;
    await saveTimerSettings();
}

async function maybeRandomizeTimer(trigger) {
    const setting = { message: "randomTimerOnMessage", channel: "randomTimerOnChannel", array: "randomTimerOnArray" }[trigger];
    if (setting && state.structure.settings[setting]) await selectRandomTimer();
}

async function saveTimerTriggers() {
    state.structure.settings.randomTimerOnMessage = els.randomTimerOnMessage.checked;
    state.structure.settings.randomTimerOnChannel = els.randomTimerOnChannel.checked;
    state.structure.settings.randomTimerOnArray = els.randomTimerOnArray.checked;
    await saveStructure(state.structure);
}

async function saveTimerCoupling() {
    state.structure.settings.timerCoupleMetronome = els.timerCoupleMetronome.checked;
    state.structure.settings.timerRepeatWithRandomBpm = els.timerRepeatWithRandomBpm.checked;
    await saveStructure(state.structure);
}

async function toggleCountdownTimer() {
    if (countdownTimer) {
        window.clearInterval(countdownTimer);
        countdownTimer = undefined;
        countdownRemaining = Math.max(0, Math.ceil((countdownEndsAt - Date.now()) / 1000));
        countdownEndsAt = null;
        if (state.structure.settings.timerCoupleMetronome) stopMetronome();
    } else {
        if (countdownRemaining <= 0) countdownRemaining = getTimerSettings().seconds;
        countdownEndsAt = Date.now() + countdownRemaining * 1000;
        countdownTimer = window.setInterval(() => {
            countdownRemaining = Math.max(0, Math.ceil((countdownEndsAt - Date.now()) / 1000));
            if (countdownRemaining <= 0) {
                if (state.structure.settings.timerCoupleMetronome && state.structure.settings.timerRepeatWithRandomBpm) {
                    void selectRandomMetronomeBpm().then(() => {
                        if (countdownTimer && metronomeTimer) startMetronome();
                    });
                    countdownRemaining = getTimerSettings().seconds;
                    countdownEndsAt = Date.now() + countdownRemaining * 1000;
                } else {
                    window.clearInterval(countdownTimer);
                    countdownTimer = undefined;
                    countdownEndsAt = null;
                    if (state.structure.settings.timerCoupleMetronome) stopMetronome();
                }
            }
            renderCountdownTimer();
        }, 250);
        if (state.structure.settings.timerCoupleMetronome && !metronomeTimer) startMetronome();
    }
    renderCountdownTimer();
}

function resetCountdownTimer() {
    if (countdownTimer) window.clearInterval(countdownTimer);
    countdownTimer = undefined;
    countdownEndsAt = null;
    if (state.structure.settings.timerCoupleMetronome) stopMetronome();
    countdownRemaining = getTimerSettings().seconds;
    renderCountdownTimer();
}

function renderCountdownTimer() {
    const remaining = countdownTimer ? Math.ceil((countdownEndsAt - Date.now()) / 1000) : countdownRemaining;
    const display = formatTimer(remaining);
    els.timerStatus.textContent = display;
    els.timerToggleBtn.textContent = countdownTimer ? "Pause" : "Start";
    els.chatTimerStatus.textContent = display;
    els.chatTimerQuick.classList.toggle("running", Boolean(countdownTimer));
    els.chatTimerQuick.setAttribute("aria-label", countdownTimer ? "Pause timer" : "Start timer");
    els.chatTimerProgress.style.width = `${Math.min(100, Math.max(0, (remaining / Math.max(1, getTimerSettings().seconds)) * 100))}%`;
}

function createMessage(text, attachments, linkedPhotoRefs = []) {
    return {
        id: crypto.randomUUID(),
        text,
        createdAt: new Date().toISOString(),
        pinned: false,
        reactions: [],
        tags: extractTags(text),
        attachments: structuredClone(attachments),
        linkedPhotoRefs: structuredClone(linkedPhotoRefs)
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

function openPhotoCompare(refs) {
    const items = refs.map((ref) => {
        const attachment = findAttachment(ref);
        const message = (state.messagesByChannel.get(ref.channelId) || []).find((item) => item.id === ref.messageId);
        return attachment ? { attachment, alt: attachment.note || attachment.name || "Local photo", channelName: getChannelById(ref.channelId)?.name || "channel", date: message?.createdAt, tags: message?.tags || [] } : null;
    }).filter(Boolean);
    if (items.length < 2) return;
    const modal = document.createElement("div");
    modal.className = "photoCompare";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Close compare";
    close.addEventListener("click", () => modal.remove());
    const grid = document.createElement("div");
    grid.className = "photoCompareGrid";
    grid.dataset.count = String(items.length);
    items.forEach((item, index) => {
        const figure = document.createElement("figure");
        const image = document.createElement("img");
        const objectUrl = item.attachment.blob ? URL.createObjectURL(item.attachment.blob) : "";
        image.src = objectUrl || item.attachment.dataUrl || "";
        image.alt = item.alt;
        if (objectUrl) image.addEventListener("load", () => URL.revokeObjectURL(objectUrl), { once: true });
        image.addEventListener("click", () => openImageViewer(item.attachment, item.alt, items, index));
        const caption = document.createElement("figcaption");
        caption.textContent = `#${item.channelName} · ${item.alt}`;
        figure.append(image, caption);
        grid.appendChild(figure);
    });
    modal.append(close, grid);
    document.body.appendChild(modal);
}

async function openComparePicker() {
    const loading = openMediaLoadingOverlay("Preparing photos to compare…");
    try {
        await ensureServerMessagesLoaded();
    } finally {
        loading.remove();
    }
    const options = getServerEntries().flatMap((entry) => (
        (entry.message.attachments || []).filter((attachment) => attachment.type?.startsWith("image/") && shouldShowAttachment(attachment)).map((attachment) => ({
            ref: { channelId: entry.channelId, messageId: entry.message.id, attachmentId: attachment.id },
            attachment,
            label: attachment.note || attachment.name || "Local photo",
            channelName: getChannelById(entry.channelId)?.name || "channel"
        }))
    ));
    if (options.length < 2) {
        alert("Add at least two local photos or GIFs to this workspace to compare them.");
        return;
    }
    const allowed = new Set(options.map((option) => photoRefKey(option.ref)));
    const selected = new Set(state.selectedPhotoRefs.map(photoRefKey).filter((key) => allowed.has(key)).slice(0, 4));
    const modal = document.createElement("section");
    modal.className = "adventureMediaPicker";
    const card = document.createElement("div");
    card.className = "adventureMediaPickerCard comparePickerCard";
    const heading = document.createElement("h3");
    heading.textContent = "Compare photos";
    const help = document.createElement("p");
    help.textContent = "Choose 2 to 4 photos or GIFs from this workspace. Tap one afterward to expand it.";
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Search image name, note, or channel";
    const status = document.createElement("p");
    status.className = "comparePickerStatus";
    const grid = document.createElement("div");
    grid.className = "adventureMediaPickerGrid comparePickerGrid";
    const more = document.createElement("button");
    more.type = "button";
    const actions = document.createElement("div");
    actions.className = "comparePickerActions";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Cancel";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = "Clear";
    const compare = document.createElement("button");
    compare.type = "button";
    compare.className = "adventurePrimary";
    const dismiss = () => modal.remove();
    const pageSize = 10;
    let visibleLimit = pageSize;
    let matching = [];
    const syncSelection = () => {
        status.textContent = selected.size === 0 ? "Select 2 to 4 photos." : `${selected.size} of 4 selected`;
        compare.textContent = selected.size >= 2 ? `Compare ${selected.size} photos` : "Choose at least 2 photos";
        compare.disabled = selected.size < 2;
        grid.querySelectorAll("button[data-photo-key]").forEach((button) => button.classList.toggle("isSelected", selected.has(button.dataset.photoKey)));
    };
    const appendOptions = (items) => {
        items.forEach((option) => {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.photoKey = photoRefKey(option.ref);
            const image = document.createElement("img");
            const objectUrl = option.attachment.blob ? URL.createObjectURL(option.attachment.blob) : "";
            image.src = objectUrl || option.attachment.dataUrl || "";
            image.alt = option.label;
            if (objectUrl) image.addEventListener("load", () => URL.revokeObjectURL(objectUrl), { once: true });
            const label = document.createElement("span");
            label.textContent = `#${option.channelName} · ${option.label}`;
            button.append(image, label);
            button.addEventListener("click", () => {
                const key = button.dataset.photoKey;
                if (selected.has(key)) selected.delete(key);
                else if (selected.size < 4) selected.add(key);
                else { status.textContent = "You can compare up to 4 photos at once."; return; }
                syncSelection();
            });
            grid.appendChild(button);
        });
    };
    const updateMore = () => {
        more.hidden = matching.length <= visibleLimit;
        more.textContent = `Load 10 more (${matching.length - visibleLimit} remaining)`;
    };
    const loadMore = () => {
        if (visibleLimit >= matching.length) return;
        const previousLimit = visibleLimit;
        visibleLimit = Math.min(matching.length, visibleLimit + pageSize);
        appendOptions(matching.slice(previousLimit, visibleLimit));
        updateMore();
        syncSelection();
    };
    const renderOptions = () => {
        grid.replaceChildren();
        const query = search.value.trim().toLowerCase();
        matching = options.filter((option) => !query || `${option.label} ${option.channelName}`.toLowerCase().includes(query));
        visibleLimit = Math.min(pageSize, matching.length);
        appendOptions(matching.slice(0, visibleLimit));
        updateMore();
        syncSelection();
    };
    search.addEventListener("input", renderOptions);
    more.addEventListener("click", loadMore);
    grid.addEventListener("scroll", () => {
        if (grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 80) loadMore();
    }, { passive: true });
    clear.addEventListener("click", () => { selected.clear(); syncSelection(); });
    close.addEventListener("click", dismiss);
    compare.addEventListener("click", () => {
        const refs = options.filter((option) => selected.has(photoRefKey(option.ref))).map((option) => option.ref);
        if (refs.length < 2) return;
        state.selectedPhotoRefs = refs;
        dismiss();
        renderBatchActions();
        openPhotoCompare(refs);
    });
    modal.addEventListener("click", (event) => { if (event.target === modal) dismiss(); });
    actions.append(close, clear, compare);
    card.append(heading, help, search, status, grid, more, actions);
    modal.appendChild(card);
    document.body.appendChild(modal);
    renderOptions();
}

async function openLinkedPhotoPicker() {
    const loading = openMediaLoadingOverlay("Preparing your local photo library…");
    try {
        await ensureServerMessagesLoaded();
    } finally {
        loading.remove();
    }
    const options = getServerEntries().flatMap((entry) => (
        (entry.message.attachments || []).filter((attachment) => attachment.type?.startsWith("image/") && shouldShowAttachment(attachment)).map((attachment) => ({
            ref: { channelId: entry.channelId, messageId: entry.message.id, attachmentId: attachment.id },
            attachment,
            label: attachment.note || attachment.name || "Local photo",
            channelName: getChannelById(entry.channelId)?.name || "channel"
        }))
    ));
    if (options.length === 0) {
        alert("Add an image or GIF to this workspace first.");
        return;
    }
    const available = new Set(options.map((option) => photoRefKey(option.ref)));
    const selected = new Set(state.draftLinkedPhotoRefs.map(photoRefKey).filter((key) => available.has(key)).slice(0, 12));
    const modal = document.createElement("section");
    modal.className = "adventureMediaPicker";
    const card = document.createElement("div");
    card.className = "adventureMediaPickerCard comparePickerCard";
    const heading = document.createElement("h3");
    heading.textContent = "Link existing photos";
    const help = document.createElement("p");
    help.textContent = "Choose up to 12 local photos or GIFs. The note will reference them without making extra copies.";
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Search image name, note, or channel";
    const status = document.createElement("p");
    status.className = "comparePickerStatus";
    const grid = document.createElement("div");
    grid.className = "adventureMediaPickerGrid comparePickerGrid";
    const more = document.createElement("button");
    more.type = "button";
    const actions = document.createElement("div");
    actions.className = "comparePickerActions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = "Clear";
    const add = document.createElement("button");
    add.type = "button";
    add.className = "adventurePrimary";
    const dismiss = () => modal.remove();
    const pageSize = 10;
    let visibleLimit = pageSize;
    let matching = [];
    const syncSelection = () => {
        status.textContent = selected.size ? `${selected.size} of 12 linked` : "Select photos to link to this note.";
        add.textContent = selected.size ? `Link ${selected.size} photo${selected.size === 1 ? "" : "s"}` : "Link selected photos";
        add.disabled = selected.size === 0;
        grid.querySelectorAll("button[data-photo-key]").forEach((button) => button.classList.toggle("isSelected", selected.has(button.dataset.photoKey)));
    };
    const appendOptions = (items) => {
        items.forEach((option) => {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.photoKey = photoRefKey(option.ref);
            const image = document.createElement("img");
            const objectUrl = option.attachment.blob ? URL.createObjectURL(option.attachment.blob) : "";
            image.src = objectUrl || option.attachment.dataUrl || "";
            image.alt = option.label;
            if (objectUrl) image.addEventListener("load", () => URL.revokeObjectURL(objectUrl), { once: true });
            const label = document.createElement("span");
            label.textContent = `#${option.channelName} · ${option.label}`;
            button.append(image, label);
            button.addEventListener("click", () => {
                const key = button.dataset.photoKey;
                if (selected.has(key)) selected.delete(key);
                else if (selected.size < 12) selected.add(key);
                else { status.textContent = "You can link up to 12 photos at once."; return; }
                syncSelection();
            });
            grid.appendChild(button);
        });
    };
    const updateMore = () => {
        more.hidden = matching.length <= visibleLimit;
        more.textContent = `Load 10 more (${matching.length - visibleLimit} remaining)`;
    };
    const loadMore = () => {
        if (visibleLimit >= matching.length) return;
        const previousLimit = visibleLimit;
        visibleLimit = Math.min(matching.length, visibleLimit + pageSize);
        appendOptions(matching.slice(previousLimit, visibleLimit));
        updateMore();
        syncSelection();
    };
    const renderOptions = () => {
        grid.replaceChildren();
        const query = search.value.trim().toLowerCase();
        matching = options.filter((option) => !query || `${option.label} ${option.channelName}`.toLowerCase().includes(query));
        visibleLimit = Math.min(pageSize, matching.length);
        appendOptions(matching.slice(0, visibleLimit));
        updateMore();
        syncSelection();
    };
    search.addEventListener("input", renderOptions);
    more.addEventListener("click", loadMore);
    grid.addEventListener("scroll", () => {
        if (grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 80) loadMore();
    }, { passive: true });
    cancel.addEventListener("click", dismiss);
    clear.addEventListener("click", () => { selected.clear(); syncSelection(); });
    add.addEventListener("click", () => {
        state.draftLinkedPhotoRefs = options.filter((option) => selected.has(photoRefKey(option.ref))).map((option) => option.ref);
        dismiss();
        renderComposer();
    });
    modal.addEventListener("click", (event) => { if (event.target === modal) dismiss(); });
    actions.append(cancel, clear, add);
    card.append(heading, help, search, status, grid, more, actions);
    modal.appendChild(card);
    document.body.appendChild(modal);
    renderOptions();
}

function openSlideshow(items) {
    if (!items?.length) return;
    const modal = document.createElement("div");
    modal.className = "slideshowViewer";
    let index = 0;
    let paused = false;
    let objectUrl = "";
    let intervalMs = 5000;
    let autoplayTimer;
    let pointerStartX = 0;
    const image = document.createElement("img");
    const caption = document.createElement("p");
    const controls = document.createElement("div");
    const close = document.createElement("button");
    close.type = "button"; close.textContent = "Close";
    const pause = document.createElement("button");
    pause.type = "button"; pause.textContent = "Pause";
    const previous = document.createElement("button");
    previous.type = "button"; previous.textContent = "Previous";
    const next = document.createElement("button");
    next.type = "button"; next.textContent = "Next";
    const open = document.createElement("button");
    open.type = "button"; open.textContent = "Expand";
    const speed = document.createElement("select");
    [[3000, "3 sec"], [5000, "5 sec"], [8000, "8 sec"]].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = String(value); option.textContent = label; option.selected = value === intervalMs; speed.appendChild(option);
    });
    speed.setAttribute("aria-label", "Slideshow speed");
    const progress = document.createElement("div");
    progress.className = "slideshowProgress";
    const progressFill = document.createElement("span");
    progress.appendChild(progressFill);
    const show = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        const item = items[index];
        objectUrl = item.attachment.blob ? URL.createObjectURL(item.attachment.blob) : "";
        image.src = objectUrl || item.attachment.dataUrl || "";
        image.alt = item.alt;
        caption.textContent = `${index + 1} / ${items.length} · ${item.alt}${item.channelName ? ` · # ${item.channelName}` : ""}`;
        progressFill.style.transition = "none";
        progressFill.style.width = "0%";
        if (!paused) requestAnimationFrame(() => {
            progressFill.style.transition = `width ${intervalMs}ms linear`;
            progressFill.style.width = "100%";
        });
    };
    const schedule = () => {
        window.clearTimeout(autoplayTimer);
        if (!paused) autoplayTimer = window.setTimeout(() => { change(1); }, intervalMs);
    };
    const change = (offset) => { index = (index + offset + items.length) % items.length; show(); schedule(); };
    const dismiss = () => { window.clearTimeout(autoplayTimer); window.removeEventListener("keydown", onKeydown); if (objectUrl) URL.revokeObjectURL(objectUrl); modal.remove(); };
    const onKeydown = (event) => {
        if (event.key === "Escape") dismiss();
        if (event.key === "ArrowLeft") change(-1);
        if (event.key === "ArrowRight") change(1);
        if (event.key === " ") { event.preventDefault(); pause.click(); }
    };
    close.addEventListener("click", dismiss);
    pause.addEventListener("click", () => {
        paused = !paused;
        pause.textContent = paused ? "Play" : "Pause";
        if (paused) { window.clearTimeout(autoplayTimer); progressFill.style.transition = "none"; }
        else { show(); schedule(); }
    });
    previous.addEventListener("click", () => change(-1));
    next.addEventListener("click", () => change(1));
    open.addEventListener("click", () => openImageViewer(items[index].attachment, items[index].alt, items, index));
    speed.addEventListener("change", () => { intervalMs = Number.parseInt(speed.value, 10) || 5000; show(); schedule(); });
    image.addEventListener("pointerdown", (event) => { pointerStartX = event.clientX; });
    image.addEventListener("pointerup", (event) => {
        const delta = event.clientX - pointerStartX;
        if (Math.abs(delta) > 50) change(delta < 0 ? 1 : -1);
        else pause.click();
    });
    modal.addEventListener("click", (event) => { if (event.target === modal) dismiss(); });
    controls.append(close, previous, pause, next, open, speed);
    modal.append(controls, image, caption, progress);
    document.body.appendChild(modal);
    show();
    schedule();
    window.addEventListener("keydown", onKeydown);
}

function openImageViewer(attachment, altText = "Local photo", items = null, initialIndex = 0) {
    const gallery = items?.length ? items : [{ attachment, alt: altText }];
    let index = Math.max(0, Math.min(initialIndex, gallery.length - 1));
    const viewer = document.createElement("div");
    viewer.className = "imageViewer";
    viewer.setAttribute("role", "dialog");
    viewer.setAttribute("aria-modal", "true");
    viewer.setAttribute("aria-label", "Image preview");
    const image = document.createElement("img");
    let objectUrl = "";
    let zoom = 1;
    let panX = 0;
    let panY = 0;
    const controls = document.createElement("div");
    controls.className = "imageViewerControls";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Close";
    const dismiss = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        viewer.remove();
    };
    const draw = () => { image.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`; };
    const show = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        const item = gallery[index];
        objectUrl = item.attachment.blob ? URL.createObjectURL(item.attachment.blob) : "";
        image.src = objectUrl || item.attachment.dataUrl || "";
        image.alt = item.alt || item.attachment.name || "Local photo";
        zoom = 1; panX = 0; panY = 0; draw();
        info.textContent = [`# ${item.channelName || "local"}`, item.date ? formatDate(item.date) : "", item.tags?.length ? item.tags.map((tag) => `#${tag}`).join(" ") : ""].filter(Boolean).join(" · ");
        count.textContent = gallery.length > 1 ? `${index + 1} / ${gallery.length}` : "";
    };
    close.addEventListener("click", dismiss);
    viewer.addEventListener("click", (event) => {
        if (event.target === viewer) dismiss();
    });
    const previous = document.createElement("button");
    previous.type = "button"; previous.textContent = "Previous"; previous.disabled = gallery.length < 2;
    previous.addEventListener("click", () => { index = (index - 1 + gallery.length) % gallery.length; show(); });
    const next = document.createElement("button");
    next.type = "button"; next.textContent = "Next"; next.disabled = gallery.length < 2;
    next.addEventListener("click", () => { index = (index + 1) % gallery.length; show(); });
    const zoomIn = document.createElement("button");
    zoomIn.type = "button"; zoomIn.textContent = "+"; zoomIn.addEventListener("click", () => { zoom = Math.min(4, zoom + .5); draw(); });
    const zoomOut = document.createElement("button");
    zoomOut.type = "button"; zoomOut.textContent = "−"; zoomOut.addEventListener("click", () => { zoom = Math.max(1, zoom - .5); if (zoom === 1) { panX = 0; panY = 0; } draw(); });
    const count = document.createElement("output");
    const info = document.createElement("p"); info.className = "imageViewerInfo";
    controls.append(close, previous, next, zoomOut, zoomIn, count);
    let startX = 0; let startY = 0; let startPanX = 0; let startPanY = 0;
    let pinchDistance = 0; let pinchZoom = 1; let usedPinch = false;
    const pointers = new Map();
    const distanceBetweenPointers = () => {
        const [first, second] = [...pointers.values()];
        return first && second ? Math.hypot(first.x - second.x, first.y - second.y) : 0;
    };
    image.addEventListener("pointerdown", (event) => {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        image.setPointerCapture(event.pointerId);
        if (pointers.size === 1) {
            startX = event.clientX; startY = event.clientY; startPanX = panX; startPanY = panY; usedPinch = false;
        } else if (pointers.size === 2) {
            pinchDistance = distanceBetweenPointers();
            pinchZoom = zoom;
            usedPinch = true;
        }
    });
    image.addEventListener("pointermove", (event) => {
        if (!pointers.has(event.pointerId)) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size >= 2) {
            const distance = distanceBetweenPointers();
            if (pinchDistance > 0) zoom = Math.min(4, Math.max(1, pinchZoom * (distance / pinchDistance)));
            draw();
            return;
        }
        const dx = event.clientX - startX; const dy = event.clientY - startY;
        if (zoom > 1) { panX = startPanX + dx; panY = startPanY + dy; draw(); }
    });
    const finishPointer = (event) => {
        const dx = event.clientX - startX;
        const wasPinch = usedPinch || pointers.size > 1;
        pointers.delete(event.pointerId);
        if (pointers.size === 1) {
            const remaining = [...pointers.values()][0];
            startX = remaining.x; startY = remaining.y; startPanX = panX; startPanY = panY;
        }
        if (!wasPinch && zoom === 1 && Math.abs(dx) > 70 && gallery.length > 1) {
            index = dx < 0 ? (index + 1) % gallery.length : (index - 1 + gallery.length) % gallery.length;
            show();
        }
    };
    image.addEventListener("pointerup", finishPointer);
    image.addEventListener("pointercancel", finishPointer);
    image.addEventListener("dblclick", () => { zoom = zoom === 1 ? 2 : 1; panX = 0; panY = 0; draw(); });
    viewer.append(controls, image, info);
    document.body.appendChild(viewer);
    show();
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
    return window.matchMedia("(max-width: 700px), (max-height: 520px) and (orientation: landscape) and (pointer: coarse)").matches;
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
