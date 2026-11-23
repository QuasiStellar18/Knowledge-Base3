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
        interfaceMode: "classic",
        colorPalette: "discord",
        rouletteSlideshowSettings: {},
        draftHistory: [],
        hallOfFame: [],
        museumExhibits: [],
        thisOrThatHistory: [],
        censorPresets: [],
        museumQuietMode: false,
        channelQuizSettings: {},
        channelQuizHighScores: {},
        channelQuizPresets: {}
    }
};

const CHANNEL_PIN = "58008";
const UNLOCK_SESSION_KEY = "knowledgeDiscordUnlocked";
const MAX_LOCAL_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_LOCAL_IMAGES_PER_SEND = 12;
const IMAGE_DRAFT_WHEEL_SPIN_MS = 1800;
const APP_BUILD_VERSION = "99";

function hasUnlockSession() {
    try {
        return sessionStorage.getItem(UNLOCK_SESSION_KEY) === "1";
    } catch (error) {
        console.warn("Session storage is unavailable; the workspace will relock when this page closes.", error);
        return false;
    }
}

function saveUnlockSession(unlocked) {
    try {
        if (unlocked) sessionStorage.setItem(UNLOCK_SESSION_KEY, "1");
        else sessionStorage.removeItem(UNLOCK_SESSION_KEY);
    } catch (error) {
        console.warn("Could not save the temporary unlock session.", error);
    }
}

const state = {
    ready: false,
    structure: structuredClone(DEFAULT_STRUCTURE),
    activeServerId: "main",
    activeChannelId: "ideas",
    activeView: { type: "channel", id: "ideas" },
    messagesByChannel: new Map(),
    channelMessageCounts: new Map(),
    channelLoadLimits: new Map(),
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
    rouletteSlideshow: { current: null, isPlaying: false, lastChannelId: null, previousBpm: null, previousMetronomeRunning: false },
    imageDraft: { stage: "setup", mode: "visible", count: 6, sourceType: "all", sourceId: "", durationPreset: "gentle-rise", bpmPreset: "calm-rise", playOrder: "random", censorMode: false, censorMetric: "area", censorAreaStep: 8, censorGranularityStep: 2, wheelWinnerStays: false, wheelWinnerTimerSeconds: 0, candidates: [], ranked: [], historyId: null, play: null, censor: null, wheel: null },
    thisOrThat: { current: null, mode: "fresh", screen: "setup", rounds: 0, lastWinner: null },
    isUnlocked: hasUnlockSession(),
    loadingChannelId: null,
    selectedPhotoRefs: [],
    focusMode: false,
    focusSessionCollectionId: null,
    activeAdventureSessionId: null,
    focusAdventureSceneId: null,
    adventureEditorStage: "setup",
    streamlinedAdventureSceneId: null,
    hallOfFameIndex: 0,
    activeMuseumExhibitId: null,
    museumCollectionFilter: "",
    museumTagFilter: "",
    museumTour: null,
    museumWalk: { x: 680, y: 150, panX: 0, panY: 0, scale: 0.7, showMap: true, inspected: null, tour: null, needsCenter: true },
    museum3d: { x: 0, z: 0, yaw: 0, movement: { x: 0, y: 0 } },
    pendingMessageSave: false,
    lastSaveError: "",
    renderObjectUrls: new Set(),
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
let museum3dMovementFrame;
let randomZoomSlideshowTimer;
let rouletteSlideshowTimer;
let imageDraftSlideshowTimer;
let imageDraftWheelTimer;
let imageDraftWinnerTimer;

const els = {
    app: document.getElementById("app"),
    servers: document.getElementById("servers"),
    sidebar: document.getElementById("sidebar"),
    chat: document.getElementById("chat"),
    mobileStageNav: document.getElementById("mobileStageNav"),
    streamlinedHubBtn: document.getElementById("streamlinedHubBtn"),
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
        const createdDraftGallery = ensureDraftGalleryFolder();
        const createdMuseum = ensureMuseumFolder();
        selectInitialChannel();
        hydrateSettingsControls();
        state.ready = true;
        if (createdInbox || createdAdventureServer || createdDraftGallery || createdMuseum) await saveStructure(state.structure);
        if (state.isUnlocked) {
            // Never leave a saved, already-unlocked session trapped behind the
            // lock screen while a large channel is still being read.
            state.loadingChannelId = state.activeChannelId;
            render();
            renderLockScreen();
            await loadActiveChannelMessages();
            state.loadingChannelId = null;
        }
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
    els.streamlinedHubBtn.addEventListener("click", openStreamlinedHub);

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
    saveUnlockSession(true);
    els.channelPinInput.value = "";
    els.unlockError.textContent = "";
    renderLockScreen();
    state.loadingChannelId = state.activeChannelId;
    render();
    try {
        await loadActiveChannelMessages();
    } catch (error) {
        console.error("unlockWorkspace: active channel could not load", error);
        state.error = "Workspace unlocked, but the current channel could not load. Your local data was not deleted. Close and reopen the page, then try again.";
    } finally {
        state.loadingChannelId = null;
        render();
        renderLockScreen();
    }
}

function lockWorkspace() {
    stopMetronome();
    stopRandomZoomSlideshow();
    stopRouletteSlideshow({ restoreMetronome: false, render: false });
    stopImageDraftSlideshow({ restoreMetronome: false, render: false });
    clearImageDraftWheelTimer();
    stopImageDraftWinnerStay({ render: false });
    state.isUnlocked = false;
    saveUnlockSession(false);
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
            photoCollections: Array.isArray(base.settings?.photoCollections) ? base.settings.photoCollections : [],
            draftHistory: Array.isArray(base.settings?.draftHistory) ? base.settings.draftHistory.slice(-200) : [],
            hallOfFame: Array.isArray(base.settings?.hallOfFame) ? base.settings.hallOfFame.slice(-300) : [],
            museumExhibits: Array.isArray(base.settings?.museumExhibits) ? base.settings.museumExhibits.slice(-100) : [],
            thisOrThatHistory: Array.isArray(base.settings?.thisOrThatHistory) ? base.settings.thisOrThatHistory.slice(-2000) : [],
            censorPresets: Array.isArray(base.settings?.censorPresets) ? base.settings.censorPresets.slice(-12) : []
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
            isDraftGalleryCategory: Boolean(category.isDraftGalleryCategory),
            isMuseumCategory: Boolean(category.isMuseumCategory),
            isCensorFolder: Boolean(category.isCensorFolder),
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
                    isSavedArrayChannel: Boolean(channel.isSavedArrayChannel),
                    isDraftRankingsChannel: Boolean(channel.isDraftRankingsChannel),
                    isThisOrThatChannel: Boolean(channel.isThisOrThatChannel),
                    isThisOrThatRankingsChannel: Boolean(channel.isThisOrThatRankingsChannel),
                    isHolisticRankingsChannel: Boolean(channel.isHolisticRankingsChannel),
                    isHallOfFameChannel: Boolean(channel.isHallOfFameChannel),
                    isMuseumExhibitsChannel: Boolean(channel.isMuseumExhibitsChannel),
                    isExhibitStagingChannel: Boolean(channel.isExhibitStagingChannel),
                    exhibitId: channel.exhibitId || null,
                    isCensorFolderChannel: Boolean(channel.isCensorFolderChannel)
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

function ensureDraftGalleryFolder() {
    let changed = false;
    state.structure.servers.forEach((server) => {
        if (server.isAdventureServer) return;
        let category = server.categories.find((item) => item.isDraftGalleryCategory);
        if (!category) {
            category = {
                id: uniqueId("category", "draft-gallery"),
                name: "Draft gallery",
                collapsed: false,
                hidden: false,
                isDraftGalleryCategory: true,
                channels: []
            };
            server.categories.push(category);
            changed = true;
        }
        const ensureChannel = (name, flag) => {
            let channel = category.channels.find((item) => item[flag]);
            if (!channel) {
                channel = { id: uniqueId("channel", name), name, [flag]: true };
                category.channels.push(channel);
                changed = true;
            }
            return channel;
        };
        ensureChannel("draft-rankings", "isDraftRankingsChannel");
        // Versions before the game launcher used #this-or-that as a game
        // screen. Preserve that channel and its position, but turn it into
        // the results channel instead of creating a duplicate.
        const legacyThisOrThat = category.channels.find((item) => item.isThisOrThatChannel);
        if (legacyThisOrThat) {
            legacyThisOrThat.isThisOrThatChannel = false;
            legacyThisOrThat.isThisOrThatRankingsChannel = true;
            legacyThisOrThat.name = "this-or-that-rankings";
            changed = true;
        }
        ensureChannel("this-or-that-rankings", "isThisOrThatRankingsChannel");
        ensureChannel("holistic-rankings", "isHolisticRankingsChannel");
    });
    return changed;
}

function ensureMuseumFolder() {
    let changed = false;
    state.structure.servers.forEach((server) => {
        if (server.isAdventureServer) return;
        let category = server.categories.find((item) => item.isMuseumCategory);
        if (!category) {
            category = {
                id: uniqueId("category", "museum"),
                name: "Museum",
                collapsed: false,
                hidden: false,
                isMuseumCategory: true,
                channels: []
            };
            server.categories.push(category);
            changed = true;
        }
        const moveOrCreate = (name, flag) => {
            let channel = allChannels(server).find((item) => item[flag]);
            if (!channel) {
                channel = { id: uniqueId("channel", name), name, [flag]: true };
                category.channels.push(channel);
                changed = true;
                return;
            }
            const currentCategory = server.categories.find((item) => item.channels.some((candidate) => candidate.id === channel.id));
            if (currentCategory?.id !== category.id) {
                currentCategory.channels = currentCategory.channels.filter((candidate) => candidate.id !== channel.id);
                category.channels.push(channel);
                changed = true;
            }
        };
        moveOrCreate("hall-of-fame", "isHallOfFameChannel");
        moveOrCreate("exhibits", "isMuseumExhibitsChannel");
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

async function loadActiveChannelMessages(channelId = state.activeChannelId) {
    if (!channelId) return;

    const loadLimit = state.channelLoadLimits.get(channelId) || 100;
    const [rawMessages, messageCount] = await Promise.all([
        getRecentChannelMessages(channelId, loadLimit),
        getChannelMessageCount(channelId)
    ]);
    const messages = normalizeMessages(rawMessages);
    state.messagesByChannel.set(channelId, messages);
    state.channelMessageCounts.set(channelId, messageCount);
    const linkedChannels = [...new Set(messages.flatMap((message) => (message.linkedPhotoRefs || []).map((ref) => ref.channelId)).filter((linkedChannelId) => linkedChannelId && linkedChannelId !== channelId && !state.messagesByChannel.has(linkedChannelId)))];
    for (const linkedChannelId of linkedChannels) {
        try {
            state.messagesByChannel.set(linkedChannelId, normalizeMessages(await getChannelMessages(linkedChannelId)));
        } catch (error) {
            console.warn("Could not pre-load a linked media channel", error);
        }
    }
    if (state.activeChannelId === channelId) state.visibleMessageLimit = Math.max(100, messages.length);
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
            reactionEvents: Array.isArray(message.reactionEvents)
                ? message.reactionEvents.filter((event) => event?.emoji && event?.at)
                : [],
            tags: Array.isArray(message.tags) ? message.tags : extractTags(message.text || ""),
            attachments: Array.isArray(message.attachments) ? message.attachments : [],
            linkedPhotoRefs: Array.isArray(message.linkedPhotoRefs) ? message.linkedPhotoRefs.filter((ref) => ref?.channelId && ref?.messageId && ref?.attachmentId) : [],
            censoredFrom: message.censoredFrom?.channelId && message.censoredFrom?.messageId && message.censoredFrom?.attachmentId
                ? structuredClone(message.censoredFrom)
                : null
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

async function ensureServerMessagesLoaded(server = getActiveServer()) {
    // Loading every Blob in every server concurrently can make a mobile PWA
    // reload. Keep ordinary views scoped to their current server and load one
    // channel at a time, preserving the existing in-memory cache.
    for (const channel of allChannels(server)) {
        if (state.messagesByChannel.has(channel.id)) continue;
        const rawMessages = await getChannelMessages(channel.id);
        const messages = normalizeMessages(rawMessages);
        state.messagesByChannel.set(channel.id, messages);
        state.channelMessageCounts.set(channel.id, messages.length);
    }
}

async function ensureWorkspaceMessagesLoaded() {
    for (const server of state.structure.servers) {
        if (server.isAdventureServer) continue;
        await ensureServerMessagesLoaded(server);
    }
}

async function ensurePhotoReferencesLoaded(refs) {
    const channelIds = [...new Set((refs || []).map((ref) => ref?.channelId).filter(Boolean))];
    for (const channelId of channelIds) {
        const messages = normalizeMessages(await getChannelMessages(channelId));
        state.messagesByChannel.set(channelId, messages);
        state.channelMessageCounts.set(channelId, messages.length);
    }
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
        await ensureServerMessagesLoaded(server);
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
            id: "roulette-slideshow",
            type: "rouletteSlideshow",
            label: "roulette slideshow",
            prefix: "◌",
            title: "Random local images, durations, and BPMs"
        }));
        group.appendChild(renderSmartChannelRow({
            id: "image-draft",
            type: "imageDraft",
            label: "image draft",
            prefix: "✦",
            title: "Rank local images, then play their shuffled draft"
        }));
        group.appendChild(renderSmartChannelRow({
            id: "this-or-that",
            type: "thisOrThat",
            label: "this or that",
            prefix: "↔",
            title: "Choose between two local photos round after round"
        }));
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
        await openView("channel", channel.id);
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
    if (type !== "rouletteSlideshow") stopRouletteSlideshow({ render: false });
    if (type !== "imageDraft") stopImageDraftSlideshow({ render: false });
    if (type !== "imageDraft") clearImageDraftWheelTimer();
    if (type !== "imageDraft") stopImageDraftWinnerStay({ render: false });
    if (type !== "museum3d") stopMuseum3dMovement();
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
        if (getActiveChannel()?.isHolisticRankingsChannel) {
            await ensureServerMessagesLoaded();
        } else if (getActiveChannel()?.isDraftRankingsChannel || getActiveChannel()?.isThisOrThatChannel || getActiveChannel()?.isThisOrThatRankingsChannel || getActiveChannel()?.isHallOfFameChannel || getActiveChannel()?.isMuseumExhibitsChannel) {
            await ensureServerMessagesLoaded();
        }
        if (getActiveChannel()?.isHallOfFameChannel) {
            await ensurePhotoReferencesLoaded(getHallOfFameEntries().map((entry) => entry.ref));
        }
        if (getActiveChannel()?.isDraftRankingsChannel || getActiveChannel()?.isHolisticRankingsChannel) {
            await ensurePhotoReferencesLoaded((state.structure.settings.draftHistory || [])
                .filter((draft) => draft.serverId === getActiveServer()?.id)
                .flatMap((draft) => draft.items || []).map((item) => item.ref));
        }
    } else if (type === "thisOrThat") {
        await ensureServerMessagesLoaded();
    } else if (["adventureEditor", "adventurePlay"].includes(type)) {
        await ensureWorkspaceMessagesLoaded();
    } else if (type !== "adventureStudio") {
        await ensureServerMessagesLoaded();
        if (type === "stats") {
            await ensurePhotoReferencesLoaded((state.structure.settings.draftHistory || [])
                .filter((draft) => draft.serverId === getActiveServer()?.id)
                .flatMap((draft) => draft.items || []).map((item) => item.ref));
        }
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
    const compareAvailable = state.ready && state.isUnlocked && !["settings", "stats", "focusSession", "rouletteSlideshow", "imageDraft", "channelQuiz", "adventureStudio", "adventureEditor", "adventureMap", "adventurePlay"].includes(state.activeView.type);
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

    if (state.activeView.type === "rouletteSlideshow") {
        els.activeTitle.textContent = "Roulette Slideshow";
        els.activeMeta.textContent = "Random local photos from random channels, durations, and BPMs";
        return;
    }

    if (state.activeView.type === "imageDraft") {
        els.activeTitle.textContent = "Image Draft";
        els.activeMeta.textContent = "Rank local images, then play their positions with a shuffled location order";
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

    if (state.activeView.type === "museumWalk") {
        els.activeTitle.textContent = "Walkable Museum";
        els.activeMeta.textContent = "Explore local exhibits in a lightweight two-dimensional gallery";
        return;
    }

    if (state.activeView.type === "museum3d") {
        els.activeTitle.textContent = "3D Museum";
        els.activeMeta.textContent = "A lightweight local gallery walk with touch joystick controls";
        return;
    }

    if (state.activeView.type === "exhibitMap") {
        els.activeTitle.textContent = "Exhibit Map";
        els.activeMeta.textContent = "An overview of local exhibits, collections, tags, and shared photos";
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

    if (state.activeView.type === "thisOrThat") {
        els.activeTitle.textContent = "This or That";
        els.activeMeta.textContent = "Choose between two random photos from this server, round after round";
        return;
    }

    const channel = getActiveChannel();
    if (channel?.isDraftRankingsChannel) {
        els.activeTitle.textContent = "Draft Rankings";
        els.activeMeta.textContent = "Live average draft positions for photos that have appeared in an Image Draft";
        return;
    }
    if (channel?.isThisOrThatRankingsChannel || channel?.isThisOrThatChannel) {
        els.activeTitle.textContent = "This or That Rankings";
        els.activeMeta.textContent = "Results from local This or That rounds in this server";
        return;
    }
    if (channel?.isHolisticRankingsChannel) {
        els.activeTitle.textContent = "Holistic Rankings";
        els.activeMeta.textContent = "A combined local view of draft placements and This or That choices";
        return;
    }
    if (channel?.isHallOfFameChannel) {
        els.activeTitle.textContent = "Hall of Fame";
        els.activeMeta.textContent = "Nominated local photos with their draft and reaction history";
        return;
    }
    if (channel?.isMuseumExhibitsChannel) {
        els.activeTitle.textContent = "Museum Exhibits";
        els.activeMeta.textContent = "Permanent curated exhibitions built from any local photo or GIF in this workspace";
        return;
    }
    if (channel?.isExhibitStagingChannel) {
        els.activeTitle.textContent = `# ${channel.name}`;
        els.activeMeta.textContent = "Exhibit staging · upload local photos here, then return to Curate";
        return;
    }
    const category = getActiveCategory();
    const messages = getActiveMessages();
    const pinnedCount = messages.filter((message) => message.pinned).length;

    els.activeTitle.textContent = channel ? `# ${channel.name}` : "No channel selected";
    const saveState = state.pendingMessageSave
        ? " · saving locally…"
        : state.lastSaveError
            ? " · last save failed"
            : "";
    els.activeMeta.textContent = channel
        ? `${category?.name || "General"} · ${messages.length} notes · ${pinnedCount} pinned · local only${saveState}`
        : "Create a channel to start";
}

function renderMessages() {
    releaseRenderedObjectUrls();
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

    if (state.activeView.type === "rouletteSlideshow") {
        renderRouletteSlideshow();
        return;
    }

    if (state.activeView.type === "imageDraft") {
        renderImageDraft();
        return;
    }

    if (state.activeView.type === "thisOrThat") {
        renderThisOrThatGame();
        return;
    }

    if (state.activeView.type === "museumWalk") {
        renderMuseumWalk();
        return;
    }

    if (state.activeView.type === "museum3d") {
        renderMuseum3d();
        return;
    }

    if (state.activeView.type === "exhibitMap") {
        renderExhibitMap();
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

    const activeChannel = getActiveChannel();
    if (state.activeView.type === "channel" && activeChannel?.isDraftRankingsChannel) {
        renderDraftRankingsChannel();
        return;
    }
    if (state.activeView.type === "channel" && (activeChannel?.isThisOrThatRankingsChannel || activeChannel?.isThisOrThatChannel)) {
        renderThisOrThatRankingsChannel();
        return;
    }
    if (state.activeView.type === "channel" && activeChannel?.isHolisticRankingsChannel) {
        renderHolisticRankingsChannel();
        return;
    }
    if (state.activeView.type === "channel" && activeChannel?.isHallOfFameChannel) {
        renderHallOfFameChannel();
        return;
    }
    if (state.activeView.type === "channel" && activeChannel?.isMuseumExhibitsChannel) {
        renderMuseumExhibitsChannel();
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

    const channelTotal = state.activeView.type === "channel"
        ? state.channelMessageCounts.get(state.activeChannelId) || allMessages.length
        : allMessages.length;
    const unloadedCount = Math.max(0, channelTotal - allMessages.length);
    const olderCount = Math.max(unloadedCount, allMessages.length - messages.length);
    if (olderCount > 0) {
        const older = document.createElement("button");
        older.className = "loadOlder";
        older.type = "button";
        older.textContent = `Load ${Math.min(100, olderCount)} older notes`;
        older.addEventListener("click", async () => {
            if (state.activeView.type === "channel" && unloadedCount > 0) {
                const channelId = state.activeChannelId;
                state.channelLoadLimits.set(channelId, (state.channelLoadLimits.get(channelId) || allMessages.length) + 100);
                state.loadingChannelId = channelId;
                renderChannels();
                renderHeader();
                renderMessages();
                try {
                    await loadActiveChannelMessages(channelId);
                } finally {
                    if (state.activeChannelId === channelId) state.loadingChannelId = null;
                }
                renderChannels();
                renderHeader();
                renderMessages();
                renderComposer();
                return;
            }
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
    setRenderedImageSource(image, attachment);
    image.alt = attachment.name || message.text || "Local photo";
    image.loading = "lazy";

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
        action(isHallOfFameRef(ref) ? "Remove Hall of Fame nomination" : "Nominate for Hall of Fame", () => toggleHallOfFameNomination(ref)),
        action("Add to collection", () => addPhotosToCollection([ref])),
        action(attachment.note ? "Edit image note" : "Add image note", () => editAttachmentNote(message.id, attachment.id, channelId)),
        action("Blur regions & copy to #censored", () => openCensorEditor({ attachment, channelId, sourceRef: ref })),
        action(state.selectedPhotoRefs.some((item) => photoRefKey(item) === photoRefKey(ref)) ? "Remove from compare" : "Add to compare (select 2–4 photos)", () => togglePhotoSelection(ref, !state.selectedPhotoRefs.some((item) => photoRefKey(item) === photoRefKey(ref)))),
        action(attachment.hidden ? "Unhide photo" : "Hide photo", () => toggleAttachmentFlag(ref, "hidden"), !attachment.hidden),
        action("Start slideshow", () => openSlideshow(viewerItems?.length ? viewerItems : [{ attachment, alt: alt || attachment.name || "Local photo", channelName: getChannelById(channelId)?.name || "channel", date: message.createdAt, tags: message.tags || [] }])),
        action("Cancel", close)
    );
    modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
    modal.appendChild(card);
    document.body.appendChild(modal);
}

function getOrCreateCensoredChannel(sourceChannelId) {
    const server = getChannelServer(sourceChannelId);
    if (!server) return null;

    let category = server.categories.find((item) => item.isCensorFolder);
    if (!category) {
        category = {
            id: uniqueId("category", "censoring"),
            name: "Censoring",
            collapsed: false,
            hidden: false,
            isCensorFolder: true,
            channels: []
        };
        server.categories.push(category);
    }
    const existing = category.channels.find((channel) => normalizeChannelName(channel.name) === "censored");
    if (existing) return { server, channel: existing, created: false };

    const channel = {
        id: uniqueId("channel", "censored"),
        name: "censored"
    };
    category.channels.push(channel);
    return { server, channel, created: true };
}

function censorCopyName(name) {
    const base = (name || "local-image").replace(/\.[^.]+$/, "").trim() || "local-image";
    return `${base}-censored.png`;
}

function openCensorEditor({ attachment, channelId, sourceRef = null, requiredRegions = 1, requiredAreaPercent = 0, mosaicDensity = 4, onSaved = null }) {
    if (!attachment?.type?.startsWith("image/")) return;
    const requiredCount = Math.max(1, Number.parseInt(requiredRegions, 10) || 1);
    const requiredArea = Math.min(95, Math.max(0, Number(requiredAreaPercent) || 0));
    const density = Math.min(12, Math.max(1, Number(mosaicDensity) || 4));

    const modal = document.createElement("div");
    modal.className = "censorEditor";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Blur and copy image");
    const card = document.createElement("section");
    card.className = "censorEditorCard";
    const heading = document.createElement("h3");
    heading.textContent = requiredArea ? `Censor ${requiredArea}% of the image` : "Blur regions and copy";
    const help = document.createElement("p");
    help.className = "censorEditorHelp";
    help.textContent = `Drag on the image to mosaic-censor it. The original stays unchanged; the copy is saved in this server’s Censoring folder. Mosaic density: ${density}/12.`;
    const canvasWrap = document.createElement("div");
    canvasWrap.className = "censorCanvasWrap";
    const canvas = document.createElement("canvas");
    canvas.className = "censorCanvas";
    canvas.setAttribute("aria-label", "Image editing canvas. Drag to select a region to blur.");
    canvasWrap.appendChild(canvas);
    const status = document.createElement("p");
    status.className = "censorEditorStatus";
    const controls = document.createElement("div");
    controls.className = "censorEditorControls";
    const undo = document.createElement("button");
    undo.type = "button";
    undo.textContent = "Undo last blur";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = "Clear regions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    const save = document.createElement("button");
    save.type = "button";
    save.className = "adventurePrimary";
    save.textContent = "Save to #censored";
    save.disabled = true;
    controls.append(undo, clear, cancel, save);
    card.append(heading, help, canvasWrap, status, controls);
    modal.appendChild(card);
    document.body.appendChild(modal);

    let imageUrl = "";
    let sourceCanvas;
    let regions = [];
    let draft = null;
    let saving = false;
    const context = canvas.getContext("2d");
    const close = () => {
        if (imageUrl) URL.revokeObjectURL(imageUrl);
        modal.remove();
    };
    const updateControls = () => {
        const count = regions.length;
        const covered = canvas.width && canvas.height ? Math.min(100, regions.reduce((sum, region) => sum + region.width * region.height, 0) / (canvas.width * canvas.height) * 100) : 0;
        undo.disabled = count === 0 || saving;
        clear.disabled = count === 0 || saving;
        save.disabled = count < requiredCount || covered < requiredArea || saving;
        status.textContent = requiredArea
            ? `${covered.toFixed(1)}% of ${requiredArea}% required area selected · ${count} region${count === 1 ? "" : "s"}.`
            : `${count} mosaic region${count === 1 ? "" : "s"} selected. The saved copy is an optimized PNG.`;
    };
    const draw = () => {
        if (!sourceCanvas || !context) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(sourceCanvas, 0, 0);
        regions.forEach((region) => {
            // Canvas filter support has been inconsistent in iOS standalone apps.
            // A small source canvas scaled without smoothing creates a durable mosaic blur
            // in both the preview and the saved PNG.
            const blockSize = Math.max(3, Math.round(Math.min(region.width, region.height) / (4 + density * 2)));
            const preview = document.createElement("canvas");
            preview.width = Math.max(1, Math.round(region.width / blockSize));
            preview.height = Math.max(1, Math.round(region.height / blockSize));
            const previewContext = preview.getContext("2d");
            previewContext?.drawImage(sourceCanvas, region.x, region.y, region.width, region.height, 0, 0, preview.width, preview.height);
            context.save();
            context.beginPath();
            context.rect(region.x, region.y, region.width, region.height);
            context.clip();
            context.imageSmoothingEnabled = false;
            context.drawImage(preview, 0, 0, preview.width, preview.height, region.x, region.y, region.width, region.height);
            context.fillStyle = "rgba(0, 0, 0, .13)";
            context.fillRect(region.x, region.y, region.width, region.height);
            context.restore();
        });
        if (draft && draft.width > 1 && draft.height > 1) {
            context.save();
            context.setLineDash([8, 6]);
            context.lineWidth = Math.max(2, canvas.width / 700);
            context.strokeStyle = "#ffffff";
            context.fillStyle = "rgba(0, 0, 0, .24)";
            context.fillRect(draft.x, draft.y, draft.width, draft.height);
            context.strokeRect(draft.x, draft.y, draft.width, draft.height);
            context.restore();
        }
    };
    const pointFor = (event) => {
        const rect = canvas.getBoundingClientRect();
        return {
            x: Math.max(0, Math.min(canvas.width, (event.clientX - rect.left) * (canvas.width / rect.width))),
            y: Math.max(0, Math.min(canvas.height, (event.clientY - rect.top) * (canvas.height / rect.height)))
        };
    };
    const normalisedRect = (first, second) => ({
        x: Math.min(first.x, second.x),
        y: Math.min(first.y, second.y),
        width: Math.abs(second.x - first.x),
        height: Math.abs(second.y - first.y)
    });

    let startPoint = null;
    canvas.addEventListener("pointerdown", (event) => {
        if (saving || !sourceCanvas) return;
        event.preventDefault();
        startPoint = pointFor(event);
        draft = { ...startPoint, width: 0, height: 0 };
        canvas.setPointerCapture?.(event.pointerId);
        draw();
    });
    canvas.addEventListener("pointermove", (event) => {
        if (!startPoint || saving) return;
        draft = normalisedRect(startPoint, pointFor(event));
        draw();
    });
    const finishRegion = (event) => {
        if (!startPoint) return;
        const region = normalisedRect(startPoint, pointFor(event));
        startPoint = null;
        draft = null;
        if (region.width >= Math.max(8, canvas.width / 100) && region.height >= Math.max(8, canvas.height / 100)) {
            regions.push(region);
        }
        draw();
        updateControls();
    };
    canvas.addEventListener("pointerup", finishRegion);
    canvas.addEventListener("pointercancel", () => {
        startPoint = null;
        draft = null;
        draw();
    });
    undo.addEventListener("click", () => {
        if (saving) return;
        regions.pop();
        draw();
        updateControls();
    });
    clear.addEventListener("click", () => {
        if (saving) return;
        regions = [];
        draw();
        updateControls();
    });
    cancel.addEventListener("click", close);
    modal.addEventListener("click", (event) => { if (event.target === modal && !saving) close(); });

    save.addEventListener("click", async () => {
        const covered = canvas.width && canvas.height ? Math.min(100, regions.reduce((sum, region) => sum + region.width * region.height, 0) / (canvas.width * canvas.height) * 100) : 0;
        if (saving || regions.length < requiredCount || covered < requiredArea) return;
        saving = true;
        updateControls();
        save.textContent = "Saving…";
        try {
            const blob = canvas.toBlob
                ? await new Promise((resolve) => canvas.toBlob(resolve, "image/png"))
                : await fetch(canvas.toDataURL("image/png")).then((response) => response.blob());
            if (!blob) throw new Error("The edited image could not be created.");
            const file = new File([blob], censorCopyName(attachment.name), { type: "image/png" });
            if (!(await hasSpaceForLocalFiles([file]))) {
                saving = false;
                save.textContent = "Save to #censored";
                updateControls();
                return;
            }
            const destination = getOrCreateCensoredChannel(channelId);
            if (!destination) throw new Error("The source server is no longer available.");
            if (destination.created) await saveStructure(state.structure);
            if (!state.messagesByChannel.has(destination.channel.id)) {
                state.messagesByChannel.set(destination.channel.id, normalizeMessages(await getChannelMessages(destination.channel.id)));
            }
            const copiedAttachment = {
                id: crypto.randomUUID(),
                name: file.name,
                type: file.type,
                size: file.size,
                blob: file,
                note: attachment.note || ""
            };
            const sourceName = getChannelById(channelId)?.name || "source";
            const copiedMessage = createMessage(`Censored copy from #${sourceName}`, [copiedAttachment]);
            if (sourceRef?.channelId && sourceRef?.messageId && sourceRef?.attachmentId) {
                copiedMessage.censoredFrom = structuredClone(sourceRef);
            }
            const previousMessages = [...state.messagesByChannel.get(destination.channel.id)];
            const previousCount = state.channelMessageCounts.get(destination.channel.id) ?? previousMessages.length;
            state.messagesByChannel.set(destination.channel.id, [...previousMessages, copiedMessage]);
            state.channelMessageCounts.set(destination.channel.id, previousCount + 1);
            try {
                await saveChannelMessage(destination.channel.id, copiedMessage);
            } catch (error) {
                state.messagesByChannel.set(destination.channel.id, previousMessages);
                state.channelMessageCounts.set(destination.channel.id, previousCount);
                throw error;
            }
            refreshStorageEstimate();
            close();
            if (onSaved) await onSaved({ regionCount: regions.length, areaPercent: covered, mosaicDensity: density, copiedMessage, destinationChannelId: destination.channel.id });
            else alert("Saved a blurred copy in #censored. Your original photo was not changed.");
            render();
        } catch (error) {
            console.error("Could not save censored image copy:", error);
            alert("Could not save the censored copy locally. Check available browser storage, then try again.");
            saving = false;
            save.textContent = "Save to #censored";
            updateControls();
        }
    });

    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
        const maximumSide = 2048;
        const scale = Math.min(1, maximumSide / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.width = width;
        canvas.height = height;
        sourceCanvas = document.createElement("canvas");
        sourceCanvas.width = width;
        sourceCanvas.height = height;
        sourceCanvas.getContext("2d").drawImage(image, 0, 0, width, height);
        if (imageUrl) {
            URL.revokeObjectURL(imageUrl);
            imageUrl = "";
        }
        if (attachment.type === "image/gif") {
            help.textContent = "Drag on the image to blur a region. GIF copies use the first frame as a censored PNG; the original GIF stays unchanged.";
        }
        draw();
        updateControls();
    };
    image.onerror = () => {
        alert("This image could not be opened for editing.");
        close();
    };
    imageUrl = attachment.blob ? URL.createObjectURL(attachment.blob) : "";
    image.src = imageUrl || attachment.dataUrl || "";
    updateControls();
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
    await saveChannelMessage(ref.channelId, updated.find((message) => message.id === ref.messageId));
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
    const reactionEvents = [];
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
        (message.reactionEvents || []).forEach((event) => {
            const occurredAt = new Date(event.at);
            if (!event.emoji || Number.isNaN(occurredAt.getTime())) return;
            reactionEvents.push({
                emoji: event.emoji,
                channelId: entry.channelId,
                messageId: event.messageId || entry.message.id,
                at: occurredAt.toISOString()
            });
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
        reactionTotal,
        reactionInsights: getReactionInsights(reactionEvents),
        draftInsights: getImageDraftInsights(),
        exhibitInsights: getExhibitInsights()
    };
}

function getExhibitInsights() {
    const exhibits = getMuseumExhibits();
    const images = new Map();
    const collections = new Set();
    const tags = new Set();
    let placements = 0;
    exhibits.forEach((exhibit) => {
        const collection = normalizeDisplayName(exhibit.collection || "");
        if (collection) collections.add(collection);
        getMuseumExhibitTags(exhibit).forEach((tag) => tags.add(tag));
        getExhibitPhotoRefs(exhibit).forEach((ref, index) => {
            if (!ref?.channelId || !ref?.messageId || !ref?.attachmentId) return;
            placements += 1;
            const key = photoRefKey(ref);
            const attachment = findAttachment(ref);
            if (!images.has(key)) images.set(key, {
                ref,
                label: attachment?.note || attachment?.name || "Local photo",
                channelName: getChannelById(ref.channelId)?.name || "missing",
                appearances: []
            });
            images.get(key).appearances.push({
                exhibitId: exhibit.id,
                exhibitTitle: exhibit.title || "Untitled exhibit",
                stop: index + 1
            });
        });
    });
    const rankedImages = [...images.values()]
        .map((image) => ({ ...image, exhibitCount: image.appearances.length }))
        .sort((a, b) => b.exhibitCount - a.exhibitCount || a.label.localeCompare(b.label));
    return {
        exhibits: exhibits.length,
        placements,
        uniqueImages: rankedImages.length,
        collections: collections.size,
        tags: tags.size,
        images: rankedImages
    };
}

function getImageDraftInsights() {
    const serverId = getActiveServer()?.id;
    const drafts = (state.structure.settings.draftHistory || []).filter((draft) => draft.serverId === serverId && Array.isArray(draft.items));
    const placements = drafts.flatMap((draft) => draft.items
        .filter((item) => item?.ref && Number.isFinite(Number(item.rank)))
        .map((item) => ({ ...item, rank: Number(item.rank), draftId: draft.id, draftSize: draft.items.length })));
    const perImage = new Map();
    placements.forEach((item) => {
        const key = photoRefKey(item.ref);
        if (!perImage.has(key)) perImage.set(key, { ref: item.ref, label: item.label || "Local image", channelName: item.channelName || getChannelById(item.ref.channelId)?.name || "channel", spots: [], weights: [] });
        perImage.get(key).spots.push(item.rank);
        perImage.get(key).weights.push(Math.max(1, item.draftSize || 1));
    });
    const images = [...perImage.values()].map((item) => {
        const totalWeight = item.weights.reduce((sum, weight) => sum + weight, 0);
        return {
            ...item,
            count: item.spots.length,
            average: item.spots.reduce((sum, spot) => sum + spot, 0) / item.spots.length,
            weightedAverage: item.spots.reduce((sum, spot, index) => sum + spot * item.weights[index], 0) / totalWeight,
            best: Math.min(...item.spots),
            worst: Math.max(...item.spots),
            spread: Math.max(...item.spots) - Math.min(...item.spots),
            totalDraftWeight: totalWeight
        };
    }).sort((a, b) => b.count - a.count || a.average - b.average || a.label.localeCompare(b.label));
    const censorResults = drafts.flatMap((draft) => Array.isArray(draft.censorResults) ? draft.censorResults : []);
    return {
        drafts: drafts.length,
        placements,
        averageSpot: placements.length ? placements.reduce((sum, item) => sum + item.rank, 0) / placements.length : 0,
        images,
        censorDrafts: drafts.filter((draft) => draft.censorMode).length,
        censorCopies: censorResults.length,
        censorRegions: censorResults.reduce((sum, item) => sum + (item.regionCount || 0), 0)
    };
}

function getHallOfFameEntries(server = getActiveServer()) {
    return (state.structure.settings.hallOfFame || [])
        .filter((entry) => entry.serverId === server?.id && entry?.ref?.channelId && entry?.ref?.messageId && entry?.ref?.attachmentId)
        .sort((a, b) => (b.nominatedAt || "").localeCompare(a.nominatedAt || ""));
}

function getHallOfFameEntryForRef(ref) {
    if (!ref?.channelId || !ref?.messageId || !ref?.attachmentId) return null;
    return (state.structure.settings.hallOfFame || []).find((entry) => photoRefKey(entry.ref) === photoRefKey(ref)) || null;
}

function getHallOfFamePlaque(ref) {
    return String(getHallOfFameEntryForRef(ref)?.blurb || "").trim();
}

function getExhibitPlaque(exhibit, ref) {
    return String(exhibit?.plaques?.[photoRefKey(ref)] || "").trim() || getHallOfFamePlaque(ref);
}

function isHallOfFameRef(ref) {
    return (state.structure.settings.hallOfFame || []).some((entry) => photoRefKey(entry.ref) === photoRefKey(ref));
}

async function toggleHallOfFameNomination(ref) {
    const entries = state.structure.settings.hallOfFame || [];
    const existing = entries.find((entry) => photoRefKey(entry.ref) === photoRefKey(ref));
    if (existing) {
        if (!confirm("Remove this photo from the Hall of Fame? Its original local image will remain untouched.")) return;
        state.structure.settings.hallOfFame = entries.filter((entry) => entry !== existing);
    } else {
        const server = getChannelServer(ref.channelId);
        if (!server) return;
        state.structure.settings.hallOfFame = [...entries, {
            id: crypto.randomUUID(),
            serverId: server.id,
            ref: structuredClone(ref),
            nominatedAt: new Date().toISOString(),
            blurb: ""
        }].slice(-300);
    }
    await saveStructure(state.structure);
    render();
}

async function saveHallOfFameBlurb(entryId, value) {
    const entry = (state.structure.settings.hallOfFame || []).find((item) => item.id === entryId);
    if (!entry) return;
    entry.blurb = value.trim().slice(0, 2000);
    entry.updatedAt = new Date().toISOString();
    (state.structure.settings.museumExhibits || []).forEach((exhibit) => {
        const key = photoRefKey(entry.ref);
        if (getExhibitPhotoRefs(exhibit).some((ref) => photoRefKey(ref) === key) && !String(exhibit.plaques?.[key] || "").trim() && entry.blurb) {
            exhibit.plaques ||= {};
            exhibit.plaques[key] = entry.blurb;
            exhibit.updatedAt = new Date().toISOString();
        }
    });
    await saveStructure(state.structure);
}

function getDraftImageStat(ref, insights = getImageDraftInsights()) {
    return insights.images.find((item) => photoRefKey(item.ref) === photoRefKey(ref)) || null;
}

function getCensoredVariants(sourceRef) {
    const server = getChannelServer(sourceRef.channelId);
    if (!server) return [];
    return allChannels(server).flatMap((channel) => (
        (state.messagesByChannel.get(channel.id) || []).flatMap((message) => {
            if (!message.censoredFrom || photoRefKey(message.censoredFrom) !== photoRefKey(sourceRef)) return [];
            return (message.attachments || [])
                .filter((attachment) => attachment.type?.startsWith("image/"))
                .map((attachment) => ({ channelId: channel.id, message, attachment }));
        })
    ));
}

function renderDraftRankingsChannel() {
    const insights = getImageDraftInsights();
    const page = document.createElement("section");
    page.className = "draftRankingsChannel";
    const intro = document.createElement("section");
    intro.className = "focusSessionIntro";
    intro.innerHTML = "<h3>Draft Rankings</h3><p>Only photos drafted at least twice appear here. Lower average spot ranks higher; the average is weighted by draft size as the tiebreaker.</p>";
    page.appendChild(intro);
    const rankedImages = insights.images.filter((item) => item.count >= 2)
        .sort((a, b) => a.average - b.average || a.weightedAverage - b.weightedAverage || b.count - a.count || a.label.localeCompare(b.label));
    if (rankedImages.length === 0) {
        page.appendChild(emptyPanel("Draft the same local photo in at least two completed Image Drafts to add it here."));
        els.messages.appendChild(page);
        return;
    }
    const list = document.createElement("section");
    list.className = "draftRankingsList";
    rankedImages.forEach((item, index) => {
        const row = document.createElement("article");
        row.className = "draftRankingItem";
        const position = document.createElement("strong");
        position.className = "draftRankingPosition";
        position.textContent = `#${index + 1}`;
        row.appendChild(position);
        const attachment = findAttachment(item.ref);
        if (attachment) {
            const image = document.createElement("img");
            setRenderedImageSource(image, attachment);
            image.alt = item.label;
            image.addEventListener("click", () => openImageViewer(attachment, item.label));
            row.appendChild(image);
        }
        const detail = document.createElement("div");
        detail.className = "draftRankingDetail";
        const title = document.createElement("strong");
        title.textContent = item.label;
        const stat = document.createElement("span");
        stat.textContent = `Average #${item.average.toFixed(1)} · weighted #${item.weightedAverage.toFixed(1)} · ${item.count} drafts · best #${item.best}`;
        const source = document.createElement("small");
        source.textContent = `First local channel: # ${item.channelName}`;
        detail.append(title, stat, source);
        row.appendChild(detail);
        const actions = document.createElement("div");
        actions.className = "draftRankingActions";
        const open = document.createElement("button");
        open.type = "button";
        open.textContent = "Open source";
        open.addEventListener("click", () => openView("channel", item.ref.channelId));
        const nominate = document.createElement("button");
        nominate.type = "button";
        nominate.textContent = isHallOfFameRef(item.ref) ? "In Hall of Fame" : "Nominate";
        nominate.disabled = isHallOfFameRef(item.ref);
        nominate.addEventListener("click", () => toggleHallOfFameNomination(item.ref));
        actions.append(open, nominate);
        row.appendChild(actions);
        list.appendChild(row);
    });
    page.appendChild(list);
    els.messages.appendChild(page);
}

function getThisOrThatCandidates() {
    return getExhibitPhotoCandidates(getActiveServer())
        .filter((candidate) => findAttachment(candidate.ref));
}

function chooseThisOrThatPair(winnerStays = null) {
    const candidates = getThisOrThatCandidates();
    if (candidates.length < 2) return null;
    if (winnerStays) {
        const challengerPool = candidates.filter((item) => photoRefKey(item.ref) !== photoRefKey(winnerStays.ref));
        if (!challengerPool.length) return null;
        return [winnerStays, challengerPool[Math.floor(Math.random() * challengerPool.length)]];
    }
    const firstIndex = Math.floor(Math.random() * candidates.length);
    let secondIndex = Math.floor(Math.random() * (candidates.length - 1));
    if (secondIndex >= firstIndex) secondIndex += 1;
    return [candidates[firstIndex], candidates[secondIndex]];
}

function getThisOrThatInsights() {
    const serverId = getActiveServer()?.id;
    const history = (state.structure.settings.thisOrThatHistory || [])
        .filter((round) => round.winner && round.loser)
        .filter((round) => (round.serverId || getChannelServer(round.winner.channelId)?.id) === serverId);
    const records = new Map();
    const ensure = (ref) => {
        const key = photoRefKey(ref);
        if (!records.has(key)) records.set(key, { ref, wins: 0, losses: 0 });
        return records.get(key);
    };
    history.forEach((round) => {
        ensure(round.winner).wins += 1;
        ensure(round.loser).losses += 1;
    });
    const images = [...records.values()].map((item) => ({
        ...item,
        games: item.wins + item.losses,
        winRate: item.wins + item.losses ? item.wins / (item.wins + item.losses) : 0,
        score: item.wins - item.losses,
        attachment: findAttachment(item.ref)
    })).sort((a, b) => b.score - a.score || b.winRate - a.winRate || b.games - a.games);
    return { rounds: history.length, images };
}

async function chooseThisOrThatWinner(winner, loser) {
    state.structure.settings.thisOrThatHistory = [
        ...(state.structure.settings.thisOrThatHistory || []),
        { id: crypto.randomUUID(), serverId: getActiveServer()?.id, winner: structuredClone(winner.ref), loser: structuredClone(loser.ref), at: new Date().toISOString() }
    ].slice(-2000);
    state.thisOrThat.rounds += 1;
    state.thisOrThat.lastWinner = winner;
    state.thisOrThat.current = chooseThisOrThatPair(state.thisOrThat.mode === "winner-stays" ? winner : null);
    await saveStructure(state.structure);
    renderMessages();
}

function renderThisOrThatGame() {
    const game = state.thisOrThat;
    if (game.screen !== "play") {
        const page = document.createElement("section");
        page.className = "thisOrThatChannel";
        const intro = document.createElement("section");
        intro.className = "focusSessionIntro";
        intro.innerHTML = "<h3>This or That</h3><p>Two random local photos from this server face off. Your choices are saved locally and appear in #this-or-that-rankings.</p>";
        const modes = document.createElement("section");
        modes.className = "thisOrThatModes";
        [["fresh", "Fresh pair every round", "Every answer draws two new random images."], ["winner-stays", "Winner stays", "Your selected image remains and faces one new challenger."]].forEach(([value, title, detail]) => {
            const choice = document.createElement("button");
            choice.type = "button";
            choice.className = game.mode === value ? "active" : "";
            const strong = document.createElement("strong");
            strong.textContent = title;
            const small = document.createElement("span");
            small.textContent = detail;
            choice.append(strong, small);
            choice.addEventListener("click", () => { game.mode = value; renderMessages(); });
            modes.appendChild(choice);
        });
        const start = document.createElement("button");
        start.type = "button";
        start.className = "adventurePrimary";
        start.textContent = "Start This or That";
        start.addEventListener("click", () => {
            game.current = chooseThisOrThatPair();
            game.rounds = 0;
            game.lastWinner = null;
            game.screen = "play";
            renderMessages();
        });
        page.append(intro, modes, start);
        els.messages.appendChild(page);
        return;
    }
    if (!game.current || !game.current.every((item) => findAttachment(item.ref))) {
        game.current = chooseThisOrThatPair(game.mode === "winner-stays" ? game.lastWinner : null);
    }
    const pair = game.current;
    const page = document.createElement("section");
    page.className = "thisOrThatChannel";
    const intro = document.createElement("section");
    intro.className = "focusSessionIntro";
    const insights = getThisOrThatInsights();
    intro.innerHTML = `<h3>This or That</h3><p>${game.mode === "winner-stays" ? "Winner stays active: your pick faces a new challenger." : "Fresh mode: each answer draws two new random images."} ${game.rounds} round${game.rounds === 1 ? "" : "s"} this run · ${insights.rounds} saved choice${insights.rounds === 1 ? "" : "s"} in this server.</p>`;
    page.appendChild(intro);
    if (!pair) {
        page.appendChild(emptyPanel("Add at least two local images or GIFs to this server to start comparing."));
        els.messages.appendChild(page);
        return;
    }
    const matchup = document.createElement("section");
    matchup.className = "thisOrThatMatchup";
    pair.forEach((candidate, index) => {
        const other = pair[index === 0 ? 1 : 0];
        const card = document.createElement("article");
        card.className = "thisOrThatCard";
        const image = document.createElement("img");
        setRenderedImageSource(image, candidate.attachment);
        image.alt = candidate.attachment.note || candidate.attachment.name || "Local photo";
        image.addEventListener("click", () => openImageViewer(candidate.attachment, image.alt));
        const source = document.createElement("small");
        source.textContent = `# ${getChannelById(candidate.ref.channelId)?.name || "missing"}`;
        const choose = document.createElement("button");
        choose.type = "button";
        choose.className = "adventurePrimary";
        choose.textContent = "Choose this";
        choose.addEventListener("click", () => chooseThisOrThatWinner(candidate, other));
        const actions = document.createElement("div");
        const open = document.createElement("button");
        open.type = "button";
        open.textContent = "Open image";
        open.addEventListener("click", () => openImageViewer(candidate.attachment, image.alt));
        const sourceButton = document.createElement("button");
        sourceButton.type = "button";
        sourceButton.textContent = "Open source";
        sourceButton.addEventListener("click", () => openView("channel", candidate.ref.channelId));
        actions.append(open, sourceButton);
        card.append(image, source, choose, actions);
        matchup.appendChild(card);
    });
    const skip = document.createElement("button");
    skip.type = "button";
    skip.className = "thisOrThatSkip";
    skip.textContent = "Skip this pairing";
    skip.addEventListener("click", () => { game.current = chooseThisOrThatPair(game.mode === "winner-stays" ? game.lastWinner : null); renderMessages(); });
    const end = document.createElement("button");
    end.type = "button";
    end.textContent = "End game";
    end.addEventListener("click", () => { game.screen = "setup"; game.current = null; game.lastWinner = null; renderMessages(); });
    page.append(matchup, skip, end);
    els.messages.appendChild(page);
}

function renderThisOrThatRankingsChannel() {
    const insights = getThisOrThatInsights();
    const page = document.createElement("section");
    page.className = "draftRankingsChannel";
    const intro = document.createElement("section");
    intro.className = "focusSessionIntro";
    intro.innerHTML = `<h3>This or That Rankings</h3><p>${insights.rounds} local choice${insights.rounds === 1 ? "" : "s"} from this server. Score is wins minus losses; win rate breaks ties.</p>`;
    page.appendChild(intro);
    if (!insights.images.length) {
        page.appendChild(emptyPanel("Play This or That from the Workspace list to build this ranking."));
        els.messages.appendChild(page);
        return;
    }
    const list = document.createElement("section");
    list.className = "draftRankingsList";
    insights.images.forEach((item, index) => {
        const row = document.createElement("article");
        row.className = "draftRankingItem";
        const position = document.createElement("strong");
        position.className = "draftRankingPosition";
        position.textContent = `#${index + 1}`;
        const attachment = findAttachment(item.ref);
        if (attachment) {
            const image = document.createElement("img");
            setRenderedImageSource(image, attachment);
            image.alt = attachment.note || attachment.name || "Ranked photo";
            image.addEventListener("click", () => openImageViewer(attachment, image.alt));
            row.appendChild(image);
        }
        const detail = document.createElement("div");
        detail.className = "draftRankingDetail";
        const title = document.createElement("strong");
        title.textContent = attachment?.note || attachment?.name || "Local photo";
        const stats = document.createElement("span");
        const confidence = Math.min(100, Math.round(item.games / 8 * 100));
        stats.textContent = `${item.wins} wins · ${item.losses} losses · ${(item.winRate * 100).toFixed(0)}% win rate · ${confidence}% confidence${item.games < 8 ? ` · ${8 - item.games} more comparison${8 - item.games === 1 ? "" : "s"} recommended` : ""}`;
        detail.append(title, stats);
        const open = document.createElement("button");
        open.type = "button";
        open.textContent = "Open source";
        open.addEventListener("click", () => openView("channel", item.ref.channelId));
        row.append(position, detail, open);
        list.appendChild(row);
    });
    page.appendChild(list);
    els.messages.appendChild(page);
}

function renderHolisticRankingsChannel() {
    const draft = getImageDraftInsights().images.filter((item) => item.count >= 2)
        .sort((a, b) => a.average - b.average || a.weightedAverage - b.weightedAverage);
    const choices = getThisOrThatInsights().images;
    const records = new Map();
    draft.forEach((item, index) => records.set(photoRefKey(item.ref), { ref: item.ref, draftRank: index + 1, draft: item, choice: null }));
    choices.forEach((item) => {
        const key = photoRefKey(item.ref);
        records.set(key, { ...(records.get(key) || { ref: item.ref, draftRank: null, draft: null }), choice: item });
    });
    const ranked = [...records.values()].map((item) => ({
        ...item,
        holisticScore: (item.draftRank ? 1 / item.draftRank : 0) + (item.choice ? item.choice.winRate * 1.5 + Math.min(item.choice.games, 10) / 50 : 0)
    })).sort((a, b) => b.holisticScore - a.holisticScore);
    const page = document.createElement("section");
    page.className = "draftRankingsChannel";
    const intro = document.createElement("section");
    intro.className = "focusSessionIntro";
    intro.innerHTML = "<h3>Holistic Rankings</h3><p>A transparent combined list: completed draft rank carries the base score, while This or That win rate adds a smaller comparison signal. Only locally stored outcomes are used.</p>";
    page.appendChild(intro);
    if (!ranked.length) {
        page.appendChild(emptyPanel("Complete an Image Draft at least twice for a photo, or make a This or That choice, to build this ranking."));
        els.messages.appendChild(page);
        return;
    }
    const list = document.createElement("section");
    list.className = "draftRankingsList";
    ranked.forEach((item, index) => {
        const row = document.createElement("article");
        row.className = "draftRankingItem";
        const position = document.createElement("strong");
        position.className = "draftRankingPosition";
        position.textContent = `#${index + 1}`;
        const attachment = findAttachment(item.ref);
        if (attachment) {
            const image = document.createElement("img");
            setRenderedImageSource(image, attachment);
            image.alt = attachment.note || attachment.name || "Ranked photo";
            image.addEventListener("click", () => openImageViewer(attachment, image.alt));
            row.appendChild(image);
        }
        const detail = document.createElement("div");
        detail.className = "draftRankingDetail";
        const title = document.createElement("strong");
        title.textContent = attachment?.note || attachment?.name || "Local photo";
        const stat = document.createElement("span");
        stat.textContent = `${item.draft ? `Draft #${item.draftRank} · avg #${item.draft.average.toFixed(1)}` : "No repeat draft rank"}${item.choice ? ` · ${item.choice.wins}–${item.choice.losses} choices` : ""}`;
        detail.append(title, stat);
        const open = document.createElement("button");
        open.type = "button";
        open.textContent = "Open source";
        open.addEventListener("click", () => openView("channel", item.ref.channelId));
        row.append(position, detail, open);
        list.appendChild(row);
    });
    page.appendChild(list);
    els.messages.appendChild(page);
}

function renderHallOfFameChannel() {
    const insights = getImageDraftInsights();
    const entries = getHallOfFameEntries();
    const page = document.createElement("section");
    page.className = "hallOfFame";
    const intro = document.createElement("section");
    intro.className = "hallOfFameIntro";
    intro.innerHTML = "<p class=\"hallOfFameKicker\">LOCAL GALLERY</p><h3>Hall of Fame</h3><p>A focused local gallery for nominated photos. Every curator’s note can also become the default plaque when that image appears in a Museum exhibit.</p>";
    page.appendChild(intro);
    if (entries.length === 0) {
        page.appendChild(emptyPanel("No nominations yet. Open a photo’s actions and choose Nominate for Hall of Fame."));
        els.messages.appendChild(page);
        return;
    }
    state.hallOfFameIndex = Math.min(Math.max(0, state.hallOfFameIndex), entries.length - 1);
    const entry = entries[state.hallOfFameIndex];
    const attachment = findAttachment(entry.ref);
    const message = (state.messagesByChannel.get(entry.ref.channelId) || []).find((item) => item.id === entry.ref.messageId);
    const navigator = document.createElement("section");
    navigator.className = "hallOfFameNavigator";
    const previous = document.createElement("button");
    previous.type = "button";
    previous.textContent = "Previous";
    previous.disabled = state.hallOfFameIndex === 0;
    previous.addEventListener("click", () => { state.hallOfFameIndex -= 1; renderMessages(); });
    const position = document.createElement("span");
    position.textContent = `${state.hallOfFameIndex + 1} of ${entries.length}`;
    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "Next";
    next.disabled = state.hallOfFameIndex === entries.length - 1;
    next.addEventListener("click", () => { state.hallOfFameIndex += 1; renderMessages(); });
    navigator.append(previous, position, next);
    const exhibit = document.createElement("article");
    exhibit.className = "hallOfFameFeature";
    const media = document.createElement("section");
    media.className = "hallOfFameFeatureMedia";
    if (attachment) {
        const image = document.createElement("img");
        image.alt = attachment.note || attachment.name || "Hall of Fame image";
        setRenderedImageSource(image, attachment);
        image.addEventListener("click", () => openImageViewer(attachment, image.alt));
        media.appendChild(image);
    } else media.appendChild(emptyPanel("The original photo could not be found in the local cache. Reopen its source channel once, then return here."));
    const detail = document.createElement("section");
    detail.className = "hallOfFameFeatureDetail";
    const title = document.createElement("h4");
    title.textContent = attachment?.note || attachment?.name || "Untitled exhibit";
    const draftStat = getDraftImageStat(entry.ref, insights);
    const facts = document.createElement("div");
    facts.className = "hallOfFameFacts";
    [
        [`Source`, `# ${getChannelById(entry.ref.channelId)?.name || "missing"}`],
        [`Reactions`, (message?.reactions || []).join(" ") || "none"],
        [`Draft`, draftStat ? `average #${draftStat.average.toFixed(1)} across ${draftStat.count}` : "not drafted yet"],
        [`Nominated`, formatDate(entry.nominatedAt)]
    ].forEach(([label, value]) => {
        const fact = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = label;
        const valueNode = document.createElement("span");
        valueNode.textContent = value;
        fact.append(name, valueNode);
        facts.appendChild(fact);
    });
    const curator = document.createElement("section");
    curator.className = "hallOfFameCuratorNote";
    const curatorTitle = document.createElement("h5");
    curatorTitle.textContent = "Inscription";
    const inscription = document.createElement("blockquote");
    inscription.className = "hallOfFameInscription";
    inscription.textContent = entry.blurb || "No inscription has been written yet.";
    const editor = document.createElement("details");
    editor.className = "hallOfFameInscriptionEditor";
    const editorSummary = document.createElement("summary");
    editorSummary.textContent = "Edit inscription";
    const blurb = document.createElement("textarea");
    blurb.maxLength = 2000;
    blurb.rows = 7;
    blurb.placeholder = "Write a short note or essay about this image…";
    blurb.value = entry.blurb || "";
    const save = document.createElement("button");
    save.type = "button";
    save.textContent = "Save curator’s note";
    save.addEventListener("click", async () => {
        save.disabled = true;
        try {
            await saveHallOfFameBlurb(entry.id, blurb.value);
            inscription.textContent = blurb.value.trim() || "No inscription has been written yet.";
            save.textContent = "Saved locally";
        } catch (error) {
            console.error("Could not save Hall of Fame blurb:", error);
            save.textContent = "Could not save";
        } finally {
            window.setTimeout(() => { save.disabled = false; save.textContent = "Save curator’s note"; }, 1000);
        }
    });
    editor.append(editorSummary, blurb, save);
    curator.append(curatorTitle, inscription, editor);
    const variants = getCensoredVariants(entry.ref);
    const variantSection = document.createElement("section");
    variantSection.className = "hallOfFameVariants";
    const variantHeading = document.createElement("strong");
    variantHeading.textContent = `Censored variants (${variants.length})`;
    variantSection.appendChild(variantHeading);
    if (variants.length) {
        const variantGrid = document.createElement("div");
        variantGrid.className = "hallOfFameVariantGrid";
        variants.forEach((variant) => {
            const button = document.createElement("button");
            button.type = "button";
            const image = document.createElement("img");
            setRenderedImageSource(image, variant.attachment);
            image.alt = `Censored variant of ${title.textContent}`;
            button.appendChild(image);
            button.addEventListener("click", () => openImageViewer(variant.attachment, image.alt));
            variantGrid.appendChild(button);
        });
        variantSection.appendChild(variantGrid);
    }
    const actions = document.createElement("div");
    actions.className = "hallOfFameActions";
    const openImage = document.createElement("button");
    openImage.type = "button";
    openImage.textContent = "Open image";
    openImage.disabled = !attachment;
    openImage.addEventListener("click", () => attachment && openImageViewer(attachment, title.textContent));
    const source = document.createElement("button");
    source.type = "button";
    source.textContent = "Open source";
    source.addEventListener("click", () => openView("channel", entry.ref.channelId));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "dangerAction";
    remove.textContent = "Remove nomination";
    remove.addEventListener("click", () => toggleHallOfFameNomination(entry.ref));
    actions.append(openImage, source, remove);
    detail.append(title, facts, curator, variantSection, actions);
    exhibit.append(media, detail);
    const rail = document.createElement("div");
    rail.className = "hallOfFameRail";
    entries.slice(Math.max(0, state.hallOfFameIndex - 8), state.hallOfFameIndex + 9).forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        const currentIndex = entries.indexOf(item);
        button.className = currentIndex === state.hallOfFameIndex ? "active" : "";
        const thumbnail = findAttachment(item.ref);
        if (thumbnail) {
            const image = document.createElement("img");
            setRenderedImageSource(image, thumbnail);
            image.alt = thumbnail.note || thumbnail.name || "Hall of Fame item";
            button.appendChild(image);
        }
        button.addEventListener("click", () => { state.hallOfFameIndex = currentIndex; renderMessages(); });
        rail.appendChild(button);
    });
    page.append(navigator, exhibit, rail);
    els.messages.appendChild(page);
}

function getMuseumExhibits(server = getActiveServer()) {
    return (state.structure.settings.museumExhibits || [])
        .filter((exhibit) => exhibit.serverId === server?.id)
        .sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""));
}

function getMuseumExhibit(exhibitId) {
    return getMuseumExhibits().find((exhibit) => exhibit.id === exhibitId);
}

function normalizeMuseumTags(value) {
    const source = Array.isArray(value) ? value : String(value || "").split(",");
    return [...new Set(source
        .map((tag) => normalizeDisplayName(String(tag).replace(/^#/, "")).toLowerCase().slice(0, 40))
        .filter(Boolean))]
        .slice(0, 16);
}

function getMuseumExhibitTags(exhibit) {
    return normalizeMuseumTags(exhibit?.tags);
}

function appendMuseumExhibitLabels(target, exhibit) {
    const labels = document.createElement("div");
    labels.className = "museumExhibitLabels";
    const collection = normalizeDisplayName(exhibit?.collection || "").slice(0, 60);
    if (collection) {
        const chip = document.createElement("span");
        chip.className = "museumCollectionChip";
        chip.textContent = collection;
        labels.appendChild(chip);
    }
    getMuseumExhibitTags(exhibit).forEach((tag) => {
        const chip = document.createElement("span");
        chip.className = "museumTagChip";
        chip.textContent = `#${tag}`;
        labels.appendChild(chip);
    });
    if (exhibit?.smartRule?.enabled) {
        const chip = document.createElement("span");
        chip.className = "museumCollectionChip";
        chip.textContent = "Smart";
        labels.appendChild(chip);
    }
    if (labels.childElementCount) target.appendChild(labels);
}

function getMuseumRoomLayout(exhibit) {
    const saved = exhibit?.museumLayout || {};
    const styles = ["gallery", "hallway", "intimate", "grand"];
    const ambiences = ["warm", "twilight", "nocturne", "neon"];
    return {
        roomStyle: styles.includes(saved.roomStyle) ? saved.roomStyle : "gallery",
        ambience: ambiences.includes(saved.ambience) ? saved.ambience : "warm",
        mode: saved.mode === "manual" ? "manual" : "auto",
        column: clampMuseumWalkNumber(Number.parseInt(saved.column, 10) || 1, 1, 3),
        row: clampMuseumWalkNumber(Number.parseInt(saved.row, 10) || 1, 1, 12)
    };
}

function getExhibitCoverRef(exhibit) {
    const refs = getExhibitPhotoRefs(exhibit);
    if (exhibit?.coverRef && findAttachment(exhibit.coverRef)) return exhibit.coverRef;
    return refs.find((ref) => findAttachment(ref)) || refs[0] || null;
}

function getExhibitPhotoCandidates(server = getActiveServer()) {
    return getServerEntries(server)
        .flatMap(({ channelId, message }) => (message.attachments || [])
            .filter((attachment) => attachment.type?.startsWith("image/"))
            .map((attachment) => ({
                ref: { channelId, messageId: message.id, attachmentId: attachment.id },
                attachment,
                message,
                createdAt: message.createdAt || ""
            })))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function getChannelPhotoCandidates(channelId) {
    return (state.messagesByChannel.get(channelId) || [])
        .flatMap((message) => (message.attachments || [])
            .filter((attachment) => attachment.type?.startsWith("image/"))
            .map((attachment) => ({
                ref: { channelId, messageId: message.id, attachmentId: attachment.id },
                attachment,
                message,
                createdAt: message.createdAt || ""
            })))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function getOrCreateExhibitStagingChannel(exhibit) {
    const server = state.structure.servers.find((item) => item.id === exhibit?.serverId);
    if (!server || !exhibit) return null;
    const existing = allChannels(server).find((channel) => channel.id === exhibit.stagingChannelId || channel.exhibitId === exhibit.id);
    if (existing) return { channel: existing, created: false };
    let category = server.categories.find((item) => item.isMuseumCategory);
    if (!category) return null;
    const channel = {
        id: uniqueId("channel", `staging-${exhibit.title || "exhibit"}`),
        name: `staging-${slugify(exhibit.title || "exhibit").slice(0, 36) || "exhibit"}`,
        isExhibitStagingChannel: true,
        exhibitId: exhibit.id
    };
    category.channels.push(channel);
    return { channel, created: true };
}

function getExhibitPhotoRefs(exhibit, server = getActiveServer()) {
    const rule = exhibit?.smartRule;
    if (!rule?.enabled) return exhibit?.photoRefs || [];
    const targetYear = Number.parseInt(rule.year, 10);
    const wantedTag = normalizeMuseumTags(rule.tag || "")[0] || "";
    return getExhibitPhotoCandidates(server)
        .filter((candidate) => {
            if (rule.favorites && !candidate.attachment?.favorite) return false;
            if (targetYear && new Date(candidate.createdAt).getFullYear() !== targetYear) return false;
            if (wantedTag && !(candidate.message?.tags || []).map((tag) => String(tag).toLowerCase()).includes(wantedTag)) return false;
            return true;
        })
        .map((candidate) => candidate.ref);
}

function openMuseumCurationEditor(exhibit = null) {
    const existingStaging = exhibit ? getOrCreateExhibitStagingChannel(exhibit) : null;
    const candidates = existingStaging ? getChannelPhotoCandidates(existingStaging.channel.id) : [];
    const modal = document.createElement("section");
    modal.className = "museumCurationModal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", exhibit ? "Edit permanent exhibit" : "Create permanent exhibit");
    const card = document.createElement("div");
    card.className = "museumCurationCard";
    const heading = document.createElement("h3");
    heading.textContent = exhibit ? "Curate exhibit" : "Create permanent exhibit";
    const help = document.createElement("p");
    help.textContent = exhibit
        ? `Select from this exhibit’s #${existingStaging?.channel.name || "staging"} channel. Upload there first, then curate the photos into the exhibit.`
        : "Name the exhibit first. Saving creates its own staging channel, where you can upload photos before curating them into the gallery.";
    const title = document.createElement("input");
    title.type = "text";
    title.maxLength = 90;
    title.placeholder = "Exhibit title";
    title.value = exhibit?.title || "";
    const collection = document.createElement("input");
    collection.type = "text";
    collection.maxLength = 60;
    collection.placeholder = "Collection, e.g. Favorites or 2026 (optional)";
    collection.value = exhibit?.collection || "";
    const tags = document.createElement("input");
    tags.type = "text";
    tags.maxLength = 300;
    tags.placeholder = "Tags, separated by commas, e.g. surreal, blue, dream";
    tags.value = getMuseumExhibitTags(exhibit).join(", ");
    const smartDetails = document.createElement("details");
    smartDetails.className = "museumCurationSmart";
    const smartSummary = document.createElement("summary");
    smartSummary.textContent = "Smart exhibit rule (optional)";
    const smartHelp = document.createElement("p");
    smartHelp.textContent = "A smart exhibit stays separate from manual curation: it refreshes itself from your local workspace using this rule whenever you open it.";
    const smartEnabledLabel = document.createElement("label");
    const smartEnabled = document.createElement("input");
    smartEnabled.type = "checkbox";
    smartEnabled.checked = Boolean(exhibit?.smartRule?.enabled);
    smartEnabledLabel.append(smartEnabled, document.createTextNode(" Use a live smart rule instead of the manual selection"));
    const smartFavoriteLabel = document.createElement("label");
    const smartFavorites = document.createElement("input");
    smartFavorites.type = "checkbox";
    smartFavorites.checked = Boolean(exhibit?.smartRule?.favorites);
    smartFavoriteLabel.append(smartFavorites, document.createTextNode(" Favorites only"));
    const smartYearLabel = document.createElement("label");
    smartYearLabel.textContent = "Year (optional)";
    const smartYear = document.createElement("input");
    smartYear.type = "number";
    smartYear.min = "2000";
    smartYear.max = "2100";
    smartYear.inputMode = "numeric";
    smartYear.placeholder = "e.g. 2026";
    smartYear.value = exhibit?.smartRule?.year || "";
    smartYearLabel.appendChild(smartYear);
    const smartTagLabel = document.createElement("label");
    smartTagLabel.textContent = "Photo tag (optional)";
    const smartTag = document.createElement("input");
    smartTag.type = "text";
    smartTag.maxLength = 40;
    smartTag.placeholder = "e.g. surreal";
    smartTag.value = exhibit?.smartRule?.tag || "";
    smartTagLabel.appendChild(smartTag);
    smartDetails.append(smartSummary, smartHelp, smartEnabledLabel, smartFavoriteLabel, smartYearLabel, smartTagLabel);
    const doorwayField = document.createElement("label");
    doorwayField.className = "museumCurationPlaque";
    doorwayField.textContent = "Doorways to other exhibits (optional)";
    const doorways = document.createElement("select");
    doorways.multiple = true;
    doorways.size = 3;
    getMuseumExhibits().filter((item) => item.id !== exhibit?.id).forEach((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.title;
        option.selected = (exhibit?.doorwayIds || []).includes(item.id);
        doorways.appendChild(option);
    });
    doorwayField.appendChild(doorways);
    const roomLayout = getMuseumRoomLayout(exhibit);
    const placement = document.createElement("details");
    placement.className = "museumCurationPlacement";
    const placementSummary = document.createElement("summary");
    placementSummary.textContent = "Museum room layout (optional)";
    const placementHelp = document.createElement("p");
    placementHelp.textContent = "The collection name above becomes this exhibit’s wing. Leave placement on Auto for a tidy floor plan, or set a manual grid location for the Walk Museum view.";
    const roomStyleLabel = document.createElement("label");
    roomStyleLabel.textContent = "Room style";
    const roomStyle = document.createElement("select");
    [
        ["gallery", "Standard gallery"],
        ["hallway", "Long hallway"],
        ["intimate", "Intimate room"],
        ["grand", "Grand hall"]
    ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        option.selected = value === roomLayout.roomStyle;
        roomStyle.appendChild(option);
    });
    roomStyleLabel.appendChild(roomStyle);
    const ambienceLabel = document.createElement("label");
    ambienceLabel.textContent = "Room ambience";
    const ambience = document.createElement("select");
    [
        ["warm", "Warm gallery"],
        ["twilight", "Twilight"],
        ["nocturne", "Nocturne"],
        ["neon", "Neon night"]
    ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        option.selected = value === roomLayout.ambience;
        ambience.appendChild(option);
    });
    ambienceLabel.appendChild(ambience);
    const positionLabel = document.createElement("label");
    positionLabel.textContent = "Floor placement";
    const positionMode = document.createElement("select");
    [["auto", "Auto arrange"], ["manual", "Choose a grid position"]].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        option.selected = value === roomLayout.mode;
        positionMode.appendChild(option);
    });
    positionLabel.appendChild(positionMode);
    const manualPosition = document.createElement("div");
    manualPosition.className = "museumCurationManualPosition";
    const columnLabel = document.createElement("label");
    columnLabel.textContent = "Column (1–3)";
    const column = document.createElement("input");
    column.type = "number";
    column.min = "1";
    column.max = "3";
    column.inputMode = "numeric";
    column.value = String(roomLayout.column);
    columnLabel.appendChild(column);
    const rowLabel = document.createElement("label");
    rowLabel.textContent = "Row (1–12)";
    const row = document.createElement("input");
    row.type = "number";
    row.min = "1";
    row.max = "12";
    row.inputMode = "numeric";
    row.value = String(roomLayout.row);
    rowLabel.appendChild(row);
    manualPosition.append(columnLabel, rowLabel);
    const syncManualPlacement = () => { manualPosition.hidden = positionMode.value !== "manual"; };
    positionMode.addEventListener("change", syncManualPlacement);
    syncManualPlacement();
    placement.append(placementSummary, placementHelp, roomStyleLabel, ambienceLabel, positionLabel, manualPosition);
    const subtitle = document.createElement("input");
    subtitle.type = "text";
    subtitle.maxLength = 180;
    subtitle.placeholder = "Short exhibition subtitle (optional)";
    subtitle.value = exhibit?.subtitle || "";
    const note = document.createElement("textarea");
    note.rows = 5;
    note.maxLength = 3000;
    note.placeholder = "Curator’s wall text — what connects these images?";
    note.value = exhibit?.curatorNote || "";
    const selected = new Map((exhibit?.photoRefs || []).map((ref) => [photoRefKey(ref), ref]));
    const plaques = new Map(Object.entries(exhibit?.plaques || {}));
    let coverKey = exhibit?.coverRef ? photoRefKey(exhibit.coverRef) : selected.keys().next().value;
    const selectedLabel = document.createElement("p");
    selectedLabel.className = "museumCurationSelection";
    const coverField = document.createElement("label");
    coverField.className = "museumCurationCover";
    const coverLabel = document.createElement("span");
    coverLabel.textContent = "Exhibit cover";
    const cover = document.createElement("select");
    coverField.append(coverLabel, cover);
    const grid = document.createElement("div");
    grid.className = "museumCurationGrid";
    const tourHeading = document.createElement("h4");
    tourHeading.className = "museumCurationTourHeading";
    tourHeading.textContent = "Guided tour order & plaques";
    const tourHelp = document.createElement("p");
    tourHelp.className = "museumCurationTourHelp";
    tourHelp.textContent = "The first photo is the first stop. Move photos into order, then add optional text that appears only in this exhibit’s guided tour and gallery.";
    const tourPlan = document.createElement("section");
    tourPlan.className = "museumCurationTourPlan";
    const loadMore = document.createElement("button");
    loadMore.type = "button";
    loadMore.className = "museumCurationMore";
    let visibleLimit = 10;
    const refreshSelection = () => {
        if (!selected.has(coverKey)) coverKey = selected.keys().next().value;
        selectedLabel.textContent = selected.size
            ? `${selected.size} permanent exhibit photo${selected.size === 1 ? "" : "s"} selected.`
            : exhibit
                ? "Upload photos into this exhibit’s staging channel, then select them here."
                : "Save this exhibit to create its staging channel, then upload photos there.";
        cover.replaceChildren();
        selected.forEach((ref, key) => {
            const option = document.createElement("option");
            const attachment = findAttachment(ref);
            option.value = key;
            option.selected = key === coverKey;
            option.textContent = attachment?.note || attachment?.name || "Selected photo";
            cover.appendChild(option);
        });
        cover.disabled = selected.size === 0;
    };
    const moveSelectedPhoto = (key, direction) => {
        const entries = [...selected.entries()];
        const index = entries.findIndex(([entryKey]) => entryKey === key);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= entries.length) return;
        [entries[index], entries[nextIndex]] = [entries[nextIndex], entries[index]];
        selected.clear();
        entries.forEach(([entryKey, ref]) => selected.set(entryKey, ref));
        refreshSelection();
        renderChoices();
    };
    const renderTourPlan = () => {
        tourPlan.replaceChildren();
        if (!selected.size) {
            const empty = document.createElement("p");
            empty.className = "museumCurationTourEmpty";
            empty.textContent = "Select exhibit photos above to build a guided tour.";
            tourPlan.appendChild(empty);
            return;
        }
        [...selected.entries()].forEach(([key, ref], index) => {
            const attachment = findAttachment(ref);
            const stop = document.createElement("article");
            stop.className = "museumCurationTourStop";
            const number = document.createElement("span");
            number.className = "museumCurationTourNumber";
            number.textContent = String(index + 1);
            const photo = document.createElement("img");
            if (attachment) setRenderedImageSource(photo, attachment);
            photo.alt = attachment?.note || attachment?.name || `Tour stop ${index + 1}`;
            const detail = document.createElement("div");
            const name = document.createElement("strong");
            name.textContent = attachment?.note || attachment?.name || "Selected photo";
            const source = document.createElement("small");
            source.textContent = `# ${getChannelById(ref.channelId)?.name || "missing"}`;
            detail.append(name, source);
            const order = document.createElement("div");
            order.className = "museumCurationTourOrder";
            const up = document.createElement("button");
            up.type = "button";
            up.textContent = "↑";
            up.title = "Move earlier in the tour";
            up.disabled = index === 0;
            up.addEventListener("click", () => moveSelectedPhoto(key, -1));
            const down = document.createElement("button");
            down.type = "button";
            down.textContent = "↓";
            down.title = "Move later in the tour";
            down.disabled = index === selected.size - 1;
            down.addEventListener("click", () => moveSelectedPhoto(key, 1));
            order.append(up, down);
            const plaqueField = document.createElement("label");
            plaqueField.className = "museumCurationPlaque";
            const plaqueLabel = document.createElement("span");
            plaqueLabel.textContent = `Plaque for stop ${index + 1} (optional)`;
            const plaque = document.createElement("textarea");
            plaque.rows = 2;
            plaque.maxLength = 600;
            plaque.placeholder = "What should visitors read beside this image?";
            plaque.value = plaques.get(key) || getHallOfFamePlaque(ref) || "";
            plaque.addEventListener("input", () => {
                const value = plaque.value.slice(0, 600);
                if (value.trim()) plaques.set(key, value);
                else plaques.delete(key);
            });
            plaqueField.append(plaqueLabel, plaque);
            stop.append(number, photo, detail, order, plaqueField);
            tourPlan.appendChild(stop);
        });
    };
    cover.addEventListener("change", () => { coverKey = cover.value; renderChoices(); });
    const renderChoices = () => {
        grid.replaceChildren();
        candidates.slice(0, visibleLimit).forEach((candidate) => {
            const ref = candidate.ref;
            const key = photoRefKey(ref);
            const attachment = candidate.attachment;
            const choice = document.createElement("button");
            choice.type = "button";
            choice.className = `museumCurationChoice${selected.has(key) ? " isSelected" : ""}`;
            const image = document.createElement("img");
            setRenderedImageSource(image, attachment);
            image.alt = attachment.note || attachment.name || "Local photo";
            const label = document.createElement("span");
            label.textContent = attachment.note || attachment.name || "Untitled local photo";
            const marker = document.createElement("small");
            const status = selected.has(key) ? (coverKey === key ? "Cover" : "Selected") : "Select";
            marker.textContent = `${status} · # ${getChannelById(ref.channelId)?.name || "missing"}`;
            choice.append(image, label, marker);
            choice.addEventListener("click", () => {
                if (selected.has(key)) selected.delete(key);
                else selected.set(key, structuredClone(ref));
                refreshSelection();
                renderChoices();
            });
            grid.appendChild(choice);
        });
        loadMore.hidden = visibleLimit >= candidates.length;
        loadMore.textContent = `Show 10 more (${Math.max(0, candidates.length - visibleLimit)} remaining)`;
        renderTourPlan();
    };
    loadMore.addEventListener("click", () => {
        visibleLimit = Math.min(candidates.length, visibleLimit + 10);
        renderChoices();
    });
    const actions = document.createElement("div");
    actions.className = "museumCurationActions";
    const save = document.createElement("button");
    save.type = "button";
    save.className = "adventurePrimary";
    save.textContent = exhibit ? "Save exhibit" : "Create exhibit";
    save.addEventListener("click", async () => {
        const cleanedTitle = normalizeDisplayName(title.value);
        const smartRule = {
            enabled: smartEnabled.checked,
            favorites: smartFavorites.checked,
            year: Number.parseInt(smartYear.value, 10) || "",
            tag: normalizeMuseumTags(smartTag.value)[0] || ""
        };
        const refs = smartRule.enabled
            ? getExhibitPhotoRefs({ smartRule })
            : [...selected.values()];
        if (!cleanedTitle) { alert("Give the exhibit a title."); title.focus(); return; }
        save.disabled = true;
        try {
            const next = {
                id: exhibit?.id || crypto.randomUUID(),
                serverId: getActiveServer()?.id,
                title: cleanedTitle,
                collection: normalizeDisplayName(collection.value).slice(0, 60),
                tags: normalizeMuseumTags(tags.value),
                museumLayout: {
                    roomStyle: roomStyle.value,
                    ambience: ambience.value,
                    mode: positionMode.value === "manual" ? "manual" : "auto",
                    column: clampMuseumWalkNumber(Number.parseInt(column.value, 10) || 1, 1, 3),
                    row: clampMuseumWalkNumber(Number.parseInt(row.value, 10) || 1, 1, 12)
                },
                subtitle: normalizeDisplayName(subtitle.value).slice(0, 180),
                curatorNote: note.value.trim().slice(0, 3000),
                photoRefs: refs,
                smartRule,
                doorwayIds: [...doorways.selectedOptions].map((option) => option.value),
                coverRef: smartRule.enabled ? refs[0] : (selected.get(coverKey) || refs[0]),
                plaques: Object.fromEntries([...selected.keys()]
                    .map((key) => [key, String(plaques.get(key) || "").trim().slice(0, 600)])
                    .filter(([, plaque]) => plaque)),
                createdAt: exhibit?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            const staging = existingStaging || getOrCreateExhibitStagingChannel(next);
            if (!staging) throw new Error("Could not create this exhibit’s staging channel.");
            next.stagingChannelId = staging.channel.id;
            const exhibits = state.structure.settings.museumExhibits || [];
            state.structure.settings.museumExhibits = exhibit
                ? exhibits.map((item) => item.id === exhibit.id ? next : item)
                : [...exhibits, next].slice(-100);
            await saveStructure(state.structure);
            modal.remove();
            state.activeMuseumExhibitId = next.id;
            state.museumTour = null;
            if (!exhibit) {
                state.activeChannelId = staging.channel.id;
                await openView("channel", staging.channel.id);
            } else render();
        } catch (error) {
            console.error("Could not save museum exhibit:", error);
            save.disabled = false;
            alert("Could not save this exhibit locally. Try again after checking storage.");
        }
    });
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => modal.remove());
    actions.append(save, cancel);
    card.append(heading, help, title, collection, tags, smartDetails, doorwayField, placement, subtitle, note, selectedLabel, coverField, grid, loadMore, tourHeading, tourHelp, tourPlan, actions);
    modal.appendChild(card);
    modal.addEventListener("click", (event) => { if (event.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    refreshSelection();
    renderChoices();
}

async function deleteMuseumExhibit(exhibit) {
    if (!confirm(`Remove the permanent exhibit “${exhibit.title}”? The Hall of Fame nominations and original photos will remain.`)) return;
    state.structure.settings.museumExhibits = (state.structure.settings.museumExhibits || []).filter((item) => item.id !== exhibit.id);
    state.activeMuseumExhibitId = null;
    state.museumTour = null;
    await saveStructure(state.structure);
    render();
}

function renderMuseumExhibitsChannel() {
    const exhibit = getMuseumExhibit(state.activeMuseumExhibitId);
    if (exhibit) {
        if (state.museumTour?.exhibitId === exhibit.id) renderMuseumGuidedTour(exhibit);
        else renderMuseumExhibitDetail(exhibit);
        return;
    }
    state.museumTour = null;
    const allExhibits = getMuseumExhibits();
    const collections = [...new Set(allExhibits
        .map((item) => normalizeDisplayName(item.collection || "").slice(0, 60))
        .filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
    const tags = [...new Set(allExhibits.flatMap((item) => getMuseumExhibitTags(item)))]
        .sort((a, b) => a.localeCompare(b));
    if (!collections.includes(state.museumCollectionFilter)) state.museumCollectionFilter = "";
    if (!tags.includes(state.museumTagFilter)) state.museumTagFilter = "";
    const exhibits = allExhibits.filter((item) => (
        (!state.museumCollectionFilter || normalizeDisplayName(item.collection || "") === state.museumCollectionFilter)
        && (!state.museumTagFilter || getMuseumExhibitTags(item).includes(state.museumTagFilter))
    ));
    const page = document.createElement("section");
    page.className = "museumExhibits";
    const intro = document.createElement("section");
    intro.className = "museumExhibitsIntro";
    intro.innerHTML = "<p>PERMANENT COLLECTION</p><h3>Museum Exhibits</h3><span>Build lasting themed galleries from any local photo or GIF in this workspace. Every exhibit can be reopened and recut later.</span>";
    const create = document.createElement("button");
    create.type = "button";
    create.className = "adventurePrimary";
    create.textContent = "Create permanent exhibit";
    create.addEventListener("click", () => openMuseumCurationEditor());
    const walk = document.createElement("button");
    walk.type = "button";
    walk.className = "museumWalkLaunch";
    walk.textContent = "Walk museum";
    walk.disabled = allExhibits.length === 0;
    walk.addEventListener("click", () => openMuseumWalk());
    const map = document.createElement("button");
    map.type = "button";
    map.className = "museumWalkLaunch";
    map.textContent = "Exhibit map";
    map.disabled = allExhibits.length === 0;
    map.addEventListener("click", () => openView("exhibitMap", getActiveServer()?.id || "museum"));
    const walk3d = document.createElement("button");
    walk3d.type = "button";
    walk3d.className = "museumWalkLaunch";
    walk3d.textContent = "3D museum";
    walk3d.disabled = allExhibits.length === 0;
    walk3d.addEventListener("click", () => openMuseum3d());
    page.append(intro, create, walk, walk3d, map);
    if (!allExhibits.length) {
        page.appendChild(emptyPanel("No permanent exhibits yet. Create your first gallery from any local photo or GIF in this workspace."));
        els.messages.appendChild(page);
        return;
    }
    const filters = document.createElement("section");
    filters.className = "museumExhibitFilters";
    const collectionLabel = document.createElement("label");
    collectionLabel.textContent = "Collection";
    const collectionSelect = document.createElement("select");
    collectionSelect.innerHTML = "<option value=\"\">All collections</option>";
    collections.forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        option.selected = name === state.museumCollectionFilter;
        collectionSelect.appendChild(option);
    });
    collectionSelect.addEventListener("change", () => {
        state.museumCollectionFilter = collectionSelect.value;
        renderMessages();
    });
    collectionLabel.appendChild(collectionSelect);
    const tagLabel = document.createElement("label");
    tagLabel.textContent = "Tag";
    const tagSelect = document.createElement("select");
    tagSelect.innerHTML = "<option value=\"\">All tags</option>";
    tags.forEach((tag) => {
        const option = document.createElement("option");
        option.value = tag;
        option.textContent = `#${tag}`;
        option.selected = tag === state.museumTagFilter;
        tagSelect.appendChild(option);
    });
    tagSelect.addEventListener("change", () => {
        state.museumTagFilter = tagSelect.value;
        renderMessages();
    });
    tagLabel.appendChild(tagSelect);
    filters.append(collectionLabel, tagLabel);
    page.appendChild(filters);
    if (!exhibits.length) {
        page.appendChild(emptyPanel("No exhibits match those filters. Change a filter or curate a new collection."));
        els.messages.appendChild(page);
        return;
    }
    const gallery = document.createElement("section");
    gallery.className = "museumExhibitGrid";
    exhibits.forEach((item) => {
        const card = document.createElement("article");
        card.className = "museumExhibitCard";
        const cover = findAttachment(getExhibitCoverRef(item) || {});
        if (cover) {
            const image = document.createElement("img");
            setRenderedImageSource(image, cover);
            image.alt = item.title;
            card.appendChild(image);
        }
        const detail = document.createElement("div");
        const title = document.createElement("h4");
        title.textContent = item.title;
        const subtitle = document.createElement("p");
        subtitle.textContent = item.subtitle || item.curatorNote || "A permanent local exhibition";
        const meta = document.createElement("small");
        meta.textContent = `${getExhibitPhotoRefs(item).length} exhibit photos${item.smartRule?.enabled ? " · smart" : ""} · updated ${formatDate(item.updatedAt || item.createdAt)}`;
        appendMuseumExhibitLabels(detail, item);
        const actions = document.createElement("div");
        const view = document.createElement("button");
        view.type = "button";
        view.textContent = "Enter exhibit";
        view.addEventListener("click", () => { state.activeMuseumExhibitId = item.id; renderMessages(); });
        const curate = document.createElement("button");
        curate.type = "button";
        curate.textContent = "Curate";
        curate.addEventListener("click", () => openMuseumCurationEditor(item));
        actions.append(view, curate);
        detail.append(title, subtitle, meta, actions);
        card.appendChild(detail);
        gallery.appendChild(card);
    });
    page.appendChild(gallery);
    els.messages.appendChild(page);
}

function renderExhibitMap() {
    const exhibits = getMuseumExhibits();
    const page = document.createElement("section");
    page.className = "exhibitMap";
    const intro = document.createElement("section");
    intro.className = "focusSessionIntro";
    intro.innerHTML = "<h3>Exhibit map</h3><p>Collections are wings, tags are threads, and shared photos connect exhibits. This is a local overview—nothing is duplicated or uploaded.</p>";
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = "Back to exhibits";
    back.addEventListener("click", () => {
        const channel = allChannels(getActiveServer()).find((item) => item.isMuseumExhibitsChannel);
        if (channel) openView("channel", channel.id);
    });
    page.append(intro, back);
    if (!exhibits.length) {
        page.appendChild(emptyPanel("Create an exhibit to add it to the map."));
        els.messages.appendChild(page);
        return;
    }
    const byCollection = new Map();
    exhibits.forEach((exhibit) => {
        const name = normalizeDisplayName(exhibit.collection || "") || "Unsorted wing";
        if (!byCollection.has(name)) byCollection.set(name, []);
        byCollection.get(name).push(exhibit);
    });
    const photoUse = new Map();
    exhibits.forEach((exhibit) => getExhibitPhotoRefs(exhibit).forEach((ref) => {
        const key = photoRefKey(ref);
        photoUse.set(key, (photoUse.get(key) || 0) + 1);
    }));
    const summary = document.createElement("div");
    summary.className = "exhibitMapSummary";
    const allTags = new Set(exhibits.flatMap(getMuseumExhibitTags));
    summary.innerHTML = `<span>${exhibits.length} exhibits</span><span>${byCollection.size} wings</span><span>${allTags.size} tags</span><span>${[...photoUse.values()].filter((count) => count > 1).length} shared photos</span>`;
    page.appendChild(summary);
    const wings = document.createElement("section");
    wings.className = "exhibitMapWings";
    [...byCollection.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([collection, items]) => {
        const wing = document.createElement("section");
        wing.className = "exhibitMapWing";
        const title = document.createElement("h4");
        title.textContent = collection;
        const rooms = document.createElement("div");
        rooms.className = "exhibitMapRooms";
        items.forEach((exhibit) => {
            const room = document.createElement("button");
            room.type = "button";
            room.className = "exhibitMapRoom";
            const cover = findAttachment(getExhibitCoverRef(exhibit) || {});
            if (cover) {
                const image = document.createElement("img");
                setRenderedImageSource(image, cover);
                image.alt = exhibit.title;
                room.appendChild(image);
            }
            const label = document.createElement("strong");
            label.textContent = exhibit.title;
            const refs = getExhibitPhotoRefs(exhibit);
            const shared = refs.filter((ref) => photoUse.get(photoRefKey(ref)) > 1).length;
            const meta = document.createElement("small");
            meta.textContent = `${refs.length} photos${shared ? ` · ${shared} shared` : ""}${exhibit.smartRule?.enabled ? " · smart" : ""}`;
            const tags = document.createElement("span");
            tags.textContent = getMuseumExhibitTags(exhibit).map((tag) => `#${tag}`).join(" ") || "No tags";
            room.append(label, meta, tags);
            room.addEventListener("click", () => {
                state.activeMuseumExhibitId = exhibit.id;
                const channel = allChannels(getActiveServer()).find((item) => item.isMuseumExhibitsChannel);
                if (channel) openView("channel", channel.id);
            });
            rooms.appendChild(room);
        });
        wing.append(title, rooms);
        wings.appendChild(wing);
    });
    page.appendChild(wings);
    els.messages.appendChild(page);
}

function renderMuseumExhibitDetail(exhibit) {
    const page = document.createElement("section");
    page.className = "museumExhibitDetail";
    const back = document.createElement("button");
    back.type = "button";
    back.className = "museumExhibitBack";
    back.textContent = "All exhibits";
    back.addEventListener("click", () => { state.activeMuseumExhibitId = null; state.museumTour = null; renderMessages(); });
    const header = document.createElement("section");
    header.className = "museumExhibitHeader";
    const title = document.createElement("h3");
    title.textContent = exhibit.title;
    const subtitle = document.createElement("p");
    subtitle.textContent = exhibit.subtitle || "Permanent local exhibition";
    const note = document.createElement("p");
    note.className = "museumExhibitNote";
    note.textContent = exhibit.curatorNote || "No wall text has been written yet.";
    const tools = document.createElement("div");
    const tour = document.createElement("button");
    tour.type = "button";
    tour.textContent = "Start guided tour";
    tour.disabled = !getExhibitPhotoRefs(exhibit).length;
    tour.addEventListener("click", () => {
        state.museumTour = { exhibitId: exhibit.id, index: 0 };
        renderMessages();
    });
    const walk = document.createElement("button");
    walk.type = "button";
    walk.textContent = "Walk museum";
    walk.addEventListener("click", () => openMuseumWalk());
    const walk3d = document.createElement("button");
    walk3d.type = "button";
    walk3d.textContent = "Open 3D museum";
    walk3d.addEventListener("click", () => openMuseum3d(exhibit.id));
    const curate = document.createElement("button");
    curate.type = "button";
    curate.textContent = "Curate exhibit";
    curate.addEventListener("click", () => openMuseumCurationEditor(exhibit));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "dangerAction";
    remove.textContent = "Remove exhibit";
    remove.addEventListener("click", () => deleteMuseumExhibit(exhibit));
    tools.append(tour, walk, walk3d, curate, remove);
    header.append(title, subtitle, note);
    appendMuseumExhibitLabels(header, exhibit);
    header.appendChild(tools);
    const linkedExhibits = (exhibit.doorwayIds || []).map((id) => getMuseumExhibit(id)).filter(Boolean);
    if (linkedExhibits.length) {
        const doorways = document.createElement("section");
        doorways.className = "museumExhibitLabels";
        const label = document.createElement("strong");
        label.textContent = "Doorways";
        doorways.appendChild(label);
        linkedExhibits.forEach((linked) => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = linked.title;
            button.addEventListener("click", () => { state.activeMuseumExhibitId = linked.id; state.museumTour = null; renderMessages(); });
            doorways.appendChild(button);
        });
        header.appendChild(doorways);
    }
    const gallery = document.createElement("section");
    gallery.className = "museumExhibitPhotoGrid";
    getExhibitPhotoRefs(exhibit).forEach((ref, index) => {
        const attachment = findAttachment(ref);
        const item = document.createElement("article");
        item.className = "museumExhibitPhoto";
        const number = document.createElement("span");
        number.textContent = `${index + 1}`;
        item.appendChild(number);
        if (attachment) {
            const image = document.createElement("img");
            setRenderedImageSource(image, attachment);
            image.alt = attachment.note || attachment.name || "Exhibit photo";
            image.addEventListener("click", () => openImageViewer(attachment, image.alt));
            item.appendChild(image);
        } else item.appendChild(emptyPanel("Original unavailable"));
        const info = document.createElement("small");
        info.textContent = `# ${getChannelById(ref.channelId)?.name || "missing"}`;
        item.appendChild(info);
        const plaqueText = getExhibitPlaque(exhibit, ref);
        if (plaqueText) {
            const plaque = document.createElement("p");
            plaque.className = "museumExhibitPlaque";
            plaque.textContent = plaqueText;
            item.appendChild(plaque);
        }
        gallery.appendChild(item);
    });
    page.append(back, header, gallery);
    els.messages.appendChild(page);
}

function renderMuseumGuidedTour(exhibit) {
    const refs = getExhibitPhotoRefs(exhibit);
    if (!refs.length) {
        state.museumTour = null;
        renderMuseumExhibitDetail(exhibit);
        return;
    }
    const tour = state.museumTour || { exhibitId: exhibit.id, index: 0 };
    const index = Math.min(Math.max(0, Number(tour.index) || 0), refs.length - 1);
    state.museumTour = { exhibitId: exhibit.id, index };
    const ref = refs[index];
    const attachment = findAttachment(ref);
    const page = document.createElement("section");
    page.className = "museumGuidedTour";
    const header = document.createElement("section");
    header.className = "museumTourHeader";
    const identity = document.createElement("p");
    identity.textContent = "GUIDED TOUR";
    const title = document.createElement("h3");
    title.textContent = exhibit.title;
    const progress = document.createElement("span");
    progress.textContent = `Stop ${index + 1} of ${refs.length}`;
    const exit = document.createElement("button");
    exit.type = "button";
    exit.textContent = "Exit guided tour";
    exit.addEventListener("click", () => { state.museumTour = null; renderMessages(); });
    header.append(identity, title, progress, exit);
    const frame = document.createElement("article");
    frame.className = "museumTourFrame";
    if (attachment) {
        const image = document.createElement("img");
        setRenderedImageSource(image, attachment);
        image.alt = attachment.note || attachment.name || `Tour stop ${index + 1}`;
        image.addEventListener("click", () => openImageViewer(attachment, image.alt));
        frame.appendChild(image);
    } else frame.appendChild(emptyPanel("The original photo is unavailable."));
    const plaque = document.createElement("section");
    plaque.className = "museumTourPlaque";
    const plaqueHeading = document.createElement("strong");
    plaqueHeading.textContent = `Plaque ${index + 1}`;
    const plaqueText = document.createElement("p");
    plaqueText.textContent = getExhibitPlaque(exhibit, ref) || "No plaque text for this stop.";
    const source = document.createElement("small");
    source.textContent = `From # ${getChannelById(ref.channelId)?.name || "missing"}`;
    plaque.append(plaqueHeading, plaqueText, source);
    const controls = document.createElement("div");
    controls.className = "museumTourControls";
    const previous = document.createElement("button");
    previous.type = "button";
    previous.textContent = "Previous";
    previous.disabled = index === 0;
    previous.addEventListener("click", () => {
        state.museumTour = { exhibitId: exhibit.id, index: index - 1 };
        renderMessages();
    });
    const next = document.createElement("button");
    next.type = "button";
    next.textContent = index === refs.length - 1 ? "Finish tour" : "Next stop";
    next.addEventListener("click", () => {
        state.museumTour = index === refs.length - 1 ? null : { exhibitId: exhibit.id, index: index + 1 };
        renderMessages();
    });
    controls.append(previous, next);
    page.append(header, frame, plaque, controls);
    els.messages.appendChild(page);
}

function createMuseumWalkState() {
    return { x: 680, y: 150, panX: 0, panY: 0, scale: 0.7, showMap: true, inspected: null, tour: null, needsCenter: true };
}

function openMuseumWalk() {
    if (!getMuseumExhibits().length) {
        alert("Create a permanent exhibit before opening the museum walk.");
        return;
    }
    state.activeMuseumExhibitId = null;
    state.museumTour = null;
    state.museumWalk = createMuseumWalkState();
    void openView("museumWalk", getActiveServer()?.id || "museum");
}

function exitMuseumWalk(exhibitId = null) {
    const museumChannel = allChannels(getActiveServer()).find((channel) => channel.isMuseumExhibitsChannel);
    state.museumWalk.inspected = null;
    state.museumWalk.tour = null;
    state.activeMuseumExhibitId = exhibitId;
    if (museumChannel) void openView("channel", museumChannel.id);
    else render();
}

function openMuseum1dTour(exhibitId = null) {
    const exhibit = getMuseumExhibit(exhibitId) || getMuseumExhibits().find((item) => getExhibitPhotoRefs(item).length);
    const museumChannel = allChannels(getActiveServer()).find((channel) => channel.isMuseumExhibitsChannel);
    if (!exhibit || !museumChannel) return;
    state.activeMuseumExhibitId = exhibit.id;
    state.museumTour = { exhibitId: exhibit.id, index: 0 };
    void openView("channel", museumChannel.id);
}

function createMuseum3dState(exhibitId = null) {
    const exhibits = getMuseumExhibits();
    const index = Math.max(0, exhibits.findIndex((item) => item.id === exhibitId));
    return { x: 0, z: index * -860, yaw: 0, movement: { x: 0, y: 0 } };
}

function stopMuseum3dMovement() {
    if (museum3dMovementFrame) window.cancelAnimationFrame(museum3dMovementFrame);
    museum3dMovementFrame = undefined;
    if (state.museum3d?.movement) state.museum3d.movement = { x: 0, y: 0 };
}

function openMuseum3d(exhibitId = null) {
    if (!getMuseumExhibits().length) {
        alert("Create a permanent exhibit before opening the 3D museum.");
        return;
    }
    state.activeMuseumExhibitId = null;
    state.museumTour = null;
    state.museum3d = createMuseum3dState(exhibitId);
    void openView("museum3d", getActiveServer()?.id || "museum");
}

function applyMuseum3dCamera(viewport = els.messages.querySelector(".museum3dViewport")) {
    const camera = viewport?.querySelector(".museum3dCamera");
    if (!camera) return;
    const view = state.museum3d;
    camera.style.transform = `translate3d(${-view.x}px, 0px, ${-view.z}px) rotateY(${-view.yaw}deg)`;
    const position = viewport.closest(".museum3d")?.querySelector(".museum3dPosition");
    if (position) position.textContent = `Position ${Math.round(view.x)}, ${Math.round(view.z)} · facing ${Math.round((view.yaw % 360 + 360) % 360)}°`;
}

function bindMuseum3dJoystick(joystick, viewport, roomCount) {
    const stick = joystick.querySelector(".museum3dStick");
    const limit = 38;
    let pointerId = null;
    const setMovement = (event) => {
        const rect = joystick.getBoundingClientRect();
        const rawX = event.clientX - (rect.left + rect.width / 2);
        const rawY = event.clientY - (rect.top + rect.height / 2);
        const distance = Math.hypot(rawX, rawY) || 1;
        const factor = Math.min(1, limit / distance);
        const x = rawX * factor;
        const y = rawY * factor;
        stick.style.transform = `translate(${x}px, ${y}px)`;
        state.museum3d.movement = { x: x / limit, y: y / limit };
    };
    const release = () => {
        pointerId = null;
        stick.style.transform = "translate(0, 0)";
        state.museum3d.movement = { x: 0, y: 0 };
    };
    joystick.addEventListener("pointerdown", (event) => {
        pointerId = event.pointerId;
        joystick.setPointerCapture?.(pointerId);
        setMovement(event);
    });
    joystick.addEventListener("pointermove", (event) => { if (event.pointerId === pointerId) setMovement(event); });
    joystick.addEventListener("pointerup", release);
    joystick.addEventListener("pointercancel", release);
    let lookPointer = null;
    let lookX = 0;
    viewport.addEventListener("pointerdown", (event) => {
        if (event.target.closest("button, .museum3dFrame")) return;
        lookPointer = event.pointerId;
        lookX = event.clientX;
        viewport.setPointerCapture?.(lookPointer);
    });
    viewport.addEventListener("pointermove", (event) => {
        if (event.pointerId !== lookPointer) return;
        state.museum3d.yaw += (event.clientX - lookX) * 0.35;
        lookX = event.clientX;
        applyMuseum3dCamera(viewport);
    });
    viewport.addEventListener("pointerup", () => { lookPointer = null; });
    viewport.addEventListener("pointercancel", () => { lookPointer = null; });
    const tick = () => {
        if (state.activeView.type !== "museum3d") return;
        const movement = state.museum3d.movement;
        if (Math.abs(movement.x) > .02 || Math.abs(movement.y) > .02) {
            state.museum3d.yaw += movement.x * 1.8;
            const radians = state.museum3d.yaw * Math.PI / 180;
            const distance = movement.y * 4.2;
            state.museum3d.x = Math.max(-560, Math.min(560, state.museum3d.x + Math.sin(radians) * distance));
            state.museum3d.z = Math.max(-(Math.max(1, roomCount) - 1) * 860 - 380, Math.min(380, state.museum3d.z + Math.cos(radians) * distance));
            applyMuseum3dCamera(viewport);
        }
        museum3dMovementFrame = window.requestAnimationFrame(tick);
    };
    stopMuseum3dMovement();
    museum3dMovementFrame = window.requestAnimationFrame(tick);
}

function renderMuseum3d() {
    const exhibits = getMuseumExhibits();
    if (!exhibits.length) return exitMuseumWalk();
    const page = document.createElement("section");
    page.className = "museum3d";
    const header = document.createElement("section");
    header.className = "museum3dHeader";
    header.innerHTML = "<div><p>LOCAL VECTOR GALLERY</p><h3>3D Museum</h3><span>Use the joystick to walk and turn, or drag the gallery to look around. Tap a frame to open its full local image.</span></div>";
    const modes = document.createElement("div");
    modes.className = "museum3dModes";
    const one = document.createElement("button");
    one.type = "button";
    one.textContent = "1D tour";
    one.addEventListener("click", () => openMuseum1dTour());
    const two = document.createElement("button");
    two.type = "button";
    two.textContent = "2D walk";
    two.addEventListener("click", () => openMuseumWalk());
    const three = document.createElement("button");
    three.type = "button";
    three.textContent = "3D walk";
    three.disabled = true;
    const exit = document.createElement("button");
    exit.type = "button";
    exit.textContent = "Exhibits";
    exit.addEventListener("click", () => exitMuseumWalk());
    modes.append(one, two, three, exit);
    header.appendChild(modes);
    const viewport = document.createElement("div");
    viewport.className = "museum3dViewport";
    const world = document.createElement("div");
    world.className = "museum3dWorld";
    const camera = document.createElement("div");
    camera.className = "museum3dCamera";
    const floor = document.createElement("div");
    floor.className = "museum3dFloor";
    camera.appendChild(floor);
    exhibits.forEach((exhibit, index) => {
        const room = document.createElement("article");
        room.className = `museum3dRoom roomAmbience-${getMuseumRoomLayout(exhibit).ambience}`;
        room.style.transform = `translate3d(${index % 2 ? 270 : -270}px, 0px, ${-index * 860}px) rotateY(${index % 2 ? -16 : 16}deg)`;
        const sign = document.createElement("h4");
        sign.textContent = exhibit.title;
        const wall = document.createElement("div");
        wall.className = "museum3dWall";
        getExhibitPhotoRefs(exhibit).slice(0, 4).forEach((ref) => {
            const attachment = findAttachment(ref);
            if (!attachment) return;
            const frame = document.createElement("button");
            frame.type = "button";
            frame.className = "museum3dFrame";
            const image = document.createElement("img");
            setRenderedImageSource(image, attachment);
            image.alt = attachment.note || attachment.name || "Exhibit image";
            frame.appendChild(image);
            frame.title = getExhibitPlaque(exhibit, ref) || image.alt;
            frame.addEventListener("click", () => openImageViewer(attachment, image.alt));
            wall.appendChild(frame);
        });
        const plaque = document.createElement("p");
        plaque.textContent = exhibit.curatorNote || exhibit.subtitle || `${getExhibitPhotoRefs(exhibit).length} local photos`;
        room.append(sign, wall, plaque);
        camera.appendChild(room);
    });
    world.appendChild(camera);
    viewport.appendChild(world);
    const hud = document.createElement("div");
    hud.className = "museum3dHud";
    const position = document.createElement("span");
    position.className = "museum3dPosition";
    const reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = "Reset view";
    reset.addEventListener("click", () => { state.museum3d = createMuseum3dState(); applyMuseum3dCamera(viewport); });
    hud.append(position, reset);
    const joystick = document.createElement("div");
    joystick.className = "museum3dJoystick";
    joystick.setAttribute("aria-label", "Walk and turn joystick");
    joystick.innerHTML = "<span class=\"museum3dStick\"></span>";
    page.append(header, viewport, hud, joystick);
    els.messages.appendChild(page);
    applyMuseum3dCamera(viewport);
    bindMuseum3dJoystick(joystick, viewport, exhibits.length);
}

function startMuseumWalkTour(exhibitId) {
    const exhibit = getMuseumExhibit(exhibitId);
    const firstRef = getExhibitPhotoRefs(exhibit)[0];
    if (!exhibit || !firstRef) {
        alert("This exhibit needs at least one photo before it can have a guided route.");
        return;
    }
    state.museumWalk.tour = { exhibitId, index: 0 };
    state.museumWalk.inspected = { exhibitId, photoKey: photoRefKey(firstRef) };
    renderMessages();
}

function moveMuseumWalkTour(offset) {
    const tour = state.museumWalk.tour;
    const exhibit = tour && getMuseumExhibit(tour.exhibitId);
    const refs = getExhibitPhotoRefs(exhibit);
    if (!tour || !refs.length) return;
    const index = Math.min(Math.max(0, tour.index + offset), refs.length - 1);
    const ref = refs[index];
    state.museumWalk.tour = { exhibitId: exhibit.id, index };
    state.museumWalk.inspected = { exhibitId: exhibit.id, photoKey: photoRefKey(ref) };
    renderMessages();
}

function endMuseumWalkTour() {
    state.museumWalk.tour = null;
    state.museumWalk.inspected = null;
    renderMessages();
}

function getMuseumWalkCollisions(rooms) {
    const collisions = [];
    const manualRooms = rooms.filter((room) => room.manual);
    for (let firstIndex = 0; firstIndex < manualRooms.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < manualRooms.length; secondIndex += 1) {
            const first = manualRooms[firstIndex];
            const second = manualRooms[secondIndex];
            if (first.wing !== second.wing) continue;
            const overlaps = first.x < second.x + second.width
                && first.x + first.width > second.x
                && first.y < second.y + second.height
                && first.y + first.height > second.y;
            if (overlaps) collisions.push({ first, second });
        }
    }
    return collisions;
}

async function fixMuseumWalkCollisions(layout = getMuseumWalkLayout(getMuseumExhibits())) {
    if (!layout.collisions.length) return;
    const groups = new Map();
    getMuseumExhibits().forEach((exhibit) => {
        const wing = normalizeDisplayName(exhibit.collection || "") || "Main Gallery";
        if (!groups.has(wing)) groups.set(wing, []);
        groups.get(wing).push(exhibit);
    });
    let changed = false;
    groups.forEach((exhibits) => {
        const occupied = new Set();
        exhibits
            .filter((exhibit) => getMuseumRoomLayout(exhibit).mode === "manual")
            .sort((a, b) => {
                const first = getMuseumRoomLayout(a);
                const second = getMuseumRoomLayout(b);
                return first.row - second.row || first.column - second.column || a.title.localeCompare(b.title);
            })
            .forEach((exhibit) => {
                const layoutSetting = getMuseumRoomLayout(exhibit);
                let column = layoutSetting.column;
                let row = layoutSetting.row;
                let key = `${column}:${row}`;
                if (occupied.has(key)) {
                    let slot = 0;
                    do {
                        column = (slot % 3) + 1;
                        row = Math.floor(slot / 3) + 1;
                        key = `${column}:${row}`;
                        slot += 1;
                    } while (occupied.has(key));
                    exhibit.museumLayout = { ...exhibit.museumLayout, mode: "manual", column, row };
                    changed = true;
                }
                occupied.add(key);
            });
    });
    if (!changed) return;
    await saveStructure(state.structure);
    renderMessages();
}

async function toggleMuseumQuietMode() {
    const enabled = !state.structure.settings.museumQuietMode;
    state.structure.settings.museumQuietMode = enabled;
    if (enabled && metronomeTimer) stopMetronome();
    await saveStructure(state.structure);
    renderMessages();
}

function getMuseumWalkLayout(exhibits) {
    const roomWidth = 360;
    const roomHeight = 300;
    const columnGap = 58;
    const rowGap = 54;
    const columns = 3;
    const floorWidth = 1320;
    const groups = new Map();
    exhibits.forEach((exhibit) => {
        const collection = normalizeDisplayName(exhibit.collection || "") || "Main Gallery";
        if (!groups.has(collection)) groups.set(collection, []);
        groups.get(collection).push(exhibit);
    });
    let y = 175;
    const rooms = [];
    const wings = [];
    [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([name, group]) => {
        const manual = group.filter((exhibit) => getMuseumRoomLayout(exhibit).mode === "manual");
        const reservedSlots = new Set(manual.map((exhibit) => {
            const layout = getMuseumRoomLayout(exhibit);
            return `${layout.column - 1}:${layout.row - 1}`;
        }));
        let automaticIndex = 0;
        const placements = group.map((exhibit) => {
            const roomLayout = getMuseumRoomLayout(exhibit);
            if (roomLayout.mode !== "manual") {
                while (reservedSlots.has(`${automaticIndex % columns}:${Math.floor(automaticIndex / columns)}`)) automaticIndex += 1;
            }
            const column = roomLayout.mode === "manual" ? roomLayout.column - 1 : automaticIndex % columns;
            const row = roomLayout.mode === "manual" ? roomLayout.row - 1 : Math.floor(automaticIndex / columns);
            if (roomLayout.mode !== "manual") automaticIndex += 1;
            return { exhibit, roomLayout, column, row };
        });
        const rows = Math.max(1, ...placements.map((placement) => placement.row + 1));
        const height = 68 + rows * roomHeight + Math.max(0, rows - 1) * rowGap + 84;
        wings.push({ name, x: 44, y, width: floorWidth - 88, height });
        placements.forEach(({ exhibit, roomLayout, column, row }) => {
            rooms.push({
                exhibit,
                x: 84 + column * (roomWidth + columnGap),
                y: y + 62 + row * (roomHeight + rowGap),
                width: roomWidth,
                height: roomHeight,
                wing: name,
                roomStyle: roomLayout.roomStyle,
                ambience: roomLayout.ambience,
                manual: roomLayout.mode === "manual"
            });
        });
        y += height + 84;
    });
    return { width: floorWidth, height: Math.max(740, y + 36), rooms, wings, collisions: getMuseumWalkCollisions(rooms) };
}

function clampMuseumWalkNumber(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}

function applyMuseumWalkTransform(viewport = els.messages.querySelector(".museumWalkViewport")) {
    const floor = viewport?.querySelector(".museumWalkFloor");
    if (floor) {
        floor.style.transform = `translate3d(${state.museumWalk.panX}px, ${state.museumWalk.panY}px, 0) scale(${state.museumWalk.scale})`;
    }
    const avatar = viewport?.querySelector(".museumWalkAvatar");
    if (avatar) {
        avatar.style.left = `${state.museumWalk.x}px`;
        avatar.style.top = `${state.museumWalk.y}px`;
    }
    const miniAvatar = els.messages.querySelector(".museumWalkMiniAvatar");
    const miniMap = els.messages.querySelector(".museumWalkMiniMap");
    if (miniAvatar && miniMap) {
        const width = Number(miniMap.dataset.floorWidth) || 1;
        const height = Number(miniMap.dataset.floorHeight) || 1;
        miniAvatar.style.left = `${(state.museumWalk.x / width) * 100}%`;
        miniAvatar.style.top = `${(state.museumWalk.y / height) * 100}%`;
    }
}

function centerMuseumWalkOnPoint(x, y, viewport = els.messages.querySelector(".museumWalkViewport")) {
    if (!viewport) return;
    state.museumWalk.panX = (viewport.clientWidth / 2) - (x * state.museumWalk.scale);
    state.museumWalk.panY = (viewport.clientHeight / 2) - (y * state.museumWalk.scale);
    applyMuseumWalkTransform(viewport);
}

function focusMuseumWalkRoom(room) {
    centerMuseumWalkOnPoint(room.x + room.width / 2, room.y + room.height / 2);
}

function moveMuseumWalker(dx, dy, layout) {
    state.museumWalk.x = clampMuseumWalkNumber(state.museumWalk.x + dx, 34, layout.width - 34);
    state.museumWalk.y = clampMuseumWalkNumber(state.museumWalk.y + dy, 34, layout.height - 34);
    applyMuseumWalkTransform();
}

function adjustMuseumWalkZoom(amount) {
    state.museumWalk.scale = clampMuseumWalkNumber(Math.round((state.museumWalk.scale + amount) * 100) / 100, 0.45, 1.35);
    applyMuseumWalkTransform();
}

function bindMuseumWalkGestures(viewport) {
    const pointers = new Map();
    let pinchDistance = 0;
    let pinchScale = state.museumWalk.scale;
    const getDistance = () => {
        const [first, second] = [...pointers.values()];
        return first && second ? Math.hypot(first.x - second.x, first.y - second.y) : 0;
    };
    viewport.addEventListener("pointerdown", (event) => {
        if (event.target.closest("button, input, select, textarea")) return;
        viewport.setPointerCapture?.(event.pointerId);
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size === 2) {
            pinchDistance = getDistance();
            pinchScale = state.museumWalk.scale;
        }
    });
    viewport.addEventListener("pointermove", (event) => {
        const previous = pointers.get(event.pointerId);
        if (!previous) return;
        const next = { x: event.clientX, y: event.clientY };
        pointers.set(event.pointerId, next);
        if (pointers.size === 2 && pinchDistance > 0) {
            state.museumWalk.scale = clampMuseumWalkNumber(pinchScale * (getDistance() / pinchDistance), 0.45, 1.35);
            applyMuseumWalkTransform(viewport);
            return;
        }
        state.museumWalk.panX += next.x - previous.x;
        state.museumWalk.panY += next.y - previous.y;
        applyMuseumWalkTransform(viewport);
    });
    const releasePointer = (event) => {
        pointers.delete(event.pointerId);
        if (pointers.size < 2) pinchDistance = 0;
    };
    viewport.addEventListener("pointerup", releasePointer);
    viewport.addEventListener("pointercancel", releasePointer);
}

function renderMuseumWalkRoutes(layout) {
    const namespace = "http://www.w3.org/2000/svg";
    const routes = document.createElementNS(namespace, "svg");
    routes.classList.add("museumWalkRoutes");
    routes.setAttribute("width", String(layout.width));
    routes.setAttribute("height", String(layout.height));
    routes.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
    routes.setAttribute("aria-hidden", "true");
    const lobbyX = layout.width / 2;
    const lobbyY = 124;
    const tourRoom = state.museumWalk.tour && layout.rooms.find((room) => room.exhibit.id === state.museumWalk.tour.exhibitId);
    layout.wings.forEach((wing) => {
        const doorX = wing.x + wing.width / 2;
        const doorY = wing.y + 10;
        const path = document.createElementNS(namespace, "path");
        path.classList.add("museumWalkRouteLine");
        if (tourRoom?.wing === wing.name) path.classList.add("isActive");
        path.setAttribute("d", `M ${lobbyX} ${lobbyY} L ${lobbyX} ${doorY - 30} L ${doorX} ${doorY}`);
        routes.appendChild(path);
    });
    if (tourRoom) {
        const path = document.createElementNS(namespace, "path");
        path.classList.add("museumWalkRouteLine", "isTourPath");
        path.setAttribute("d", `M ${lobbyX} ${lobbyY} L ${tourRoom.x + tourRoom.width / 2} ${tourRoom.y + tourRoom.height / 2}`);
        routes.appendChild(path);
    }
    return routes;
}

function renderMuseumWalkInspector(layout) {
    const inspected = state.museumWalk.inspected;
    if (!inspected) return null;
    const room = layout.rooms.find((item) => item.exhibit.id === inspected.exhibitId);
    const roomRefs = getExhibitPhotoRefs(room?.exhibit);
    const ref = roomRefs.find((item) => photoRefKey(item) === inspected.photoKey);
    const attachment = ref && findAttachment(ref);
    if (!room || !ref) {
        state.museumWalk.inspected = null;
        return null;
    }
    const panel = document.createElement("aside");
    panel.className = "museumWalkInspector";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "museumWalkInspectorClose";
    close.textContent = "Close";
    close.addEventListener("click", () => { state.museumWalk.inspected = null; state.museumWalk.tour = null; renderMessages(); });
    const exhibit = document.createElement("span");
    exhibit.textContent = room.exhibit.title;
    const title = document.createElement("h3");
    title.textContent = attachment?.note || attachment?.name || "Exhibit photo";
    panel.append(close, exhibit, title);
    if (attachment) {
        const image = document.createElement("img");
        setRenderedImageSource(image, attachment);
        image.alt = title.textContent;
        image.addEventListener("click", () => openImageViewer(attachment, image.alt));
        panel.appendChild(image);
    } else panel.appendChild(emptyPanel("The original local photo is unavailable."));
    const plaque = document.createElement("p");
    plaque.textContent = getExhibitPlaque(room.exhibit, ref) || "No exhibit plaque text for this frame.";
    const source = document.createElement("small");
    source.textContent = `From # ${getChannelById(ref.channelId)?.name || "missing"}`;
    const tour = state.museumWalk.tour?.exhibitId === room.exhibit.id ? state.museumWalk.tour : null;
    const tourControls = document.createElement("div");
    if (tour) {
        tourControls.className = "museumWalkTourControls";
        const progress = document.createElement("span");
        progress.textContent = `Guided stop ${tour.index + 1} of ${roomRefs.length}`;
        const previous = document.createElement("button");
        previous.type = "button";
        previous.textContent = "Previous stop";
        previous.disabled = tour.index === 0;
        previous.addEventListener("click", () => moveMuseumWalkTour(-1));
        const next = document.createElement("button");
        next.type = "button";
        next.textContent = tour.index === roomRefs.length - 1 ? "End route" : "Next stop";
        next.addEventListener("click", () => {
            if (tour.index === roomRefs.length - 1) endMuseumWalkTour();
            else moveMuseumWalkTour(1);
        });
        tourControls.append(progress, previous, next);
    }
    const open = document.createElement("button");
    open.type = "button";
    open.textContent = "Open exhibit";
    open.addEventListener("click", () => exitMuseumWalk(room.exhibit.id));
    panel.append(plaque, source);
    if (tour) panel.appendChild(tourControls);
    panel.append(open);
    return panel;
}

function renderMuseumWalk() {
    const exhibits = getMuseumExhibits();
    if (!exhibits.length) {
        els.messages.appendChild(emptyPanel("No exhibits to walk through yet. Create a permanent exhibit first."));
        return;
    }
    const layout = getMuseumWalkLayout(exhibits);
    const page = document.createElement("section");
    const quietMode = Boolean(state.structure.settings.museumQuietMode);
    page.className = `museumWalk${quietMode ? " isQuiet" : ""}`;
    const toolbar = document.createElement("header");
    toolbar.className = "museumWalkToolbar";
    const exit = document.createElement("button");
    exit.type = "button";
    exit.textContent = "Exhibit shelf";
    exit.addEventListener("click", () => exitMuseumWalk());
    const title = document.createElement("div");
    const heading = document.createElement("h3");
    heading.textContent = "Walk Museum";
    const help = document.createElement("p");
    help.textContent = "Drag to look around, pinch or use zoom controls, then tap a frame to inspect it.";
    title.append(heading, help);
    const controls = document.createElement("div");
    controls.className = "museumWalkToolbarControls";
    const zoomOut = document.createElement("button");
    zoomOut.type = "button";
    zoomOut.textContent = "Zoom out";
    zoomOut.addEventListener("click", () => adjustMuseumWalkZoom(-0.1));
    const zoomIn = document.createElement("button");
    zoomIn.type = "button";
    zoomIn.textContent = "Zoom in";
    zoomIn.addEventListener("click", () => adjustMuseumWalkZoom(0.1));
    const mapToggle = document.createElement("button");
    mapToggle.type = "button";
    mapToggle.textContent = state.museumWalk.showMap ? "Hide map" : "Show map";
    mapToggle.addEventListener("click", () => { state.museumWalk.showMap = !state.museumWalk.showMap; renderMessages(); });
    const metronome = document.createElement("button");
    metronome.type = "button";
    metronome.textContent = metronomeTimer ? "Stop metronome" : "Start metronome";
    metronome.addEventListener("click", async () => {
        await toggleMetronome();
        renderMessages();
    });
    metronome.disabled = quietMode;
    const quiet = document.createElement("button");
    quiet.type = "button";
    quiet.textContent = quietMode ? "Standard mode" : "Quiet mode";
    quiet.addEventListener("click", toggleMuseumQuietMode);
    controls.append(zoomOut, zoomIn, mapToggle, metronome, quiet);
    if (state.museumWalk.tour) {
        const endRoute = document.createElement("button");
        endRoute.type = "button";
        endRoute.textContent = "End guided route";
        endRoute.addEventListener("click", endMuseumWalkTour);
        controls.appendChild(endRoute);
    }
    toolbar.append(exit, title, controls);
    if (layout.collisions.length) {
        const warning = document.createElement("section");
        warning.className = "museumWalkLayoutWarning";
        const message = document.createElement("p");
        const examples = layout.collisions.slice(0, 2).map(({ first, second }) => `“${first.exhibit.title}” and “${second.exhibit.title}”`).join("; ");
        message.textContent = `${layout.collisions.length} manual room overlap${layout.collisions.length === 1 ? "" : "s"}: ${examples}.`;
        const fix = document.createElement("button");
        fix.type = "button";
        fix.textContent = "Fix layout automatically";
        fix.addEventListener("click", async () => { await fixMuseumWalkCollisions(layout); });
        warning.append(message, fix);
        page.append(toolbar, warning);
    } else page.appendChild(toolbar);
    const viewport = document.createElement("section");
    viewport.className = "museumWalkViewport";
    viewport.setAttribute("aria-label", "Walkable museum floor");
    const floor = document.createElement("div");
    floor.className = "museumWalkFloor";
    floor.style.width = `${layout.width}px`;
    floor.style.height = `${layout.height}px`;
    const lobby = document.createElement("section");
    lobby.className = "museumWalkLobby";
    const lobbyName = document.createElement("strong");
    lobbyName.textContent = getActiveServer()?.name || "Museum";
    const lobbyDetail = document.createElement("span");
    lobbyDetail.textContent = `${exhibits.length} exhibit${exhibits.length === 1 ? "" : "s"} · entrance lobby`;
    lobby.append(lobbyName, lobbyDetail);
    floor.appendChild(lobby);
    floor.appendChild(renderMuseumWalkRoutes(layout));
    layout.wings.forEach((wing) => {
        const wingElement = document.createElement("section");
        wingElement.className = "museumWalkWing";
        wingElement.style.left = `${wing.x}px`;
        wingElement.style.top = `${wing.y}px`;
        wingElement.style.width = `${wing.width}px`;
        wingElement.style.height = `${wing.height}px`;
        const wingTitle = document.createElement("h4");
        wingTitle.textContent = wing.name;
        wingElement.appendChild(wingTitle);
        floor.appendChild(wingElement);
        const firstRoom = layout.rooms.find((room) => room.wing === wing.name);
        if (firstRoom) {
            const door = document.createElement("button");
            door.type = "button";
            door.className = "museumWalkDoor";
            door.style.left = `${wing.x + wing.width / 2 - 62}px`;
            door.style.top = `${wing.y - 14}px`;
            door.textContent = `${wing.name} entrance`;
            door.title = `Focus ${wing.name}`;
            door.addEventListener("click", () => focusMuseumWalkRoom(firstRoom));
            floor.appendChild(door);
        }
    });
    let thumbnailBudget = 48;
    layout.rooms.forEach((room) => {
        const roomElement = document.createElement("article");
        const isTourRoom = state.museumWalk.tour?.exhibitId === room.exhibit.id;
        roomElement.className = `museumWalkRoom roomStyle-${room.roomStyle} roomAmbience-${room.ambience}${room.manual ? " isManual" : ""}${isTourRoom ? " isTouring" : ""}`;
        roomElement.style.left = `${room.x}px`;
        roomElement.style.top = `${room.y}px`;
        roomElement.style.width = `${room.width}px`;
        roomElement.style.height = `${room.height}px`;
        const sign = document.createElement("div");
        sign.className = "museumWalkRoomSign";
        const roomTitle = document.createElement("h4");
        roomTitle.textContent = room.exhibit.title;
        const roomMeta = document.createElement("span");
        const roomRefs = getExhibitPhotoRefs(room.exhibit);
        roomMeta.textContent = `${roomRefs.length} framed photo${roomRefs.length === 1 ? "" : "s"}`;
        sign.append(roomTitle, roomMeta);
        const frames = document.createElement("div");
        frames.className = "museumWalkFrames";
        const visibleRefs = roomRefs.slice(0, Math.min(6, thumbnailBudget));
        thumbnailBudget -= visibleRefs.length;
        visibleRefs.forEach((ref) => {
            const attachment = findAttachment(ref);
            const frame = document.createElement("button");
            frame.type = "button";
            const isTourStop = isTourRoom && state.museumWalk.tour?.index === roomRefs.findIndex((item) => photoRefKey(item) === photoRefKey(ref));
            frame.className = `museumWalkFrame${isTourStop ? " isTourStop" : ""}`;
            frame.title = attachment?.note || attachment?.name || "Inspect exhibit frame";
            if (attachment) {
                const image = document.createElement("img");
                setRenderedImageSource(image, attachment);
                image.alt = attachment.note || attachment.name || "Exhibit frame";
                frame.appendChild(image);
            } else frame.appendChild(document.createElement("span"));
            frame.addEventListener("click", () => {
                state.museumWalk.inspected = { exhibitId: room.exhibit.id, photoKey: photoRefKey(ref) };
                renderMessages();
            });
            frames.appendChild(frame);
        });
        if (roomRefs.length > visibleRefs.length) {
            const more = document.createElement("span");
            more.className = "museumWalkMoreFrames";
            more.textContent = `+${roomRefs.length - visibleRefs.length} more`;
            frames.appendChild(more);
        }
        const roomActions = document.createElement("div");
        roomActions.className = "museumWalkRoomActions";
        const follow = document.createElement("button");
        follow.type = "button";
        follow.className = "museumWalkFollow";
        follow.textContent = isTourRoom ? "Resume route" : "Follow tour";
        follow.disabled = !roomRefs.length;
        follow.addEventListener("click", () => startMuseumWalkTour(room.exhibit.id));
        const enter = document.createElement("button");
        enter.type = "button";
        enter.className = "museumWalkEnter";
        enter.textContent = "Enter exhibit";
        enter.addEventListener("click", () => exitMuseumWalk(room.exhibit.id));
        roomActions.append(follow, enter);
        roomElement.append(sign, frames, roomActions);
        floor.appendChild(roomElement);
    });
    const avatar = document.createElement("div");
    avatar.className = "museumWalkAvatar";
    avatar.setAttribute("aria-label", "Your position");
    floor.appendChild(avatar);
    viewport.appendChild(floor);
    if (state.museumWalk.showMap) {
        const map = document.createElement("aside");
        map.className = "museumWalkMiniMap";
        map.dataset.floorWidth = String(layout.width);
        map.dataset.floorHeight = String(layout.height);
        layout.rooms.forEach((room) => {
            const roomButton = document.createElement("button");
            roomButton.type = "button";
            roomButton.title = `Focus ${room.exhibit.title}`;
            roomButton.style.left = `${(room.x / layout.width) * 100}%`;
            roomButton.style.top = `${(room.y / layout.height) * 100}%`;
            roomButton.style.width = `${(room.width / layout.width) * 100}%`;
            roomButton.style.height = `${(room.height / layout.height) * 100}%`;
            roomButton.addEventListener("click", () => focusMuseumWalkRoom(room));
            map.appendChild(roomButton);
        });
        const miniAvatar = document.createElement("span");
        miniAvatar.className = "museumWalkMiniAvatar";
        map.appendChild(miniAvatar);
        viewport.appendChild(map);
    }
    const inspector = renderMuseumWalkInspector(layout);
    if (inspector) viewport.appendChild(inspector);
    const walkPad = document.createElement("section");
    walkPad.className = "museumWalkPad";
    walkPad.setAttribute("aria-label", "Walk controls");
    [
        ["North", 0, -88],
        ["West", -88, 0],
        ["East", 88, 0],
        ["South", 0, 88]
    ].forEach(([label, dx, dy]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `museumWalkMove museumWalkMove${label}`;
        button.textContent = label;
        button.addEventListener("click", () => moveMuseumWalker(dx, dy, layout));
        walkPad.appendChild(button);
    });
    page.append(viewport, walkPad);
    els.messages.appendChild(page);
    bindMuseumWalkGestures(viewport);
    requestAnimationFrame(() => {
        if (state.museumWalk.needsCenter) {
            state.museumWalk.needsCenter = false;
            centerMuseumWalkOnPoint(state.museumWalk.x, state.museumWalk.y, viewport);
        } else {
            const tourRoom = state.museumWalk.tour && layout.rooms.find((room) => room.exhibit.id === state.museumWalk.tour.exhibitId);
            if (tourRoom) focusMuseumWalkRoom(tourRoom);
            else applyMuseumWalkTransform(viewport);
        }
    });
}

function getReactionInsights(events) {
    const dayCounts = new Map();
    const hours = Array.from({ length: 24 }, () => 0);
    const weekdays = Array.from({ length: 7 }, () => 0);
    const emojis = new Map();

    events.forEach((event) => {
        const date = new Date(event.at);
        const day = formatLocalDayKey(date);
        dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
        hours[date.getHours()] += 1;
        weekdays[date.getDay()] += 1;
        if (!emojis.has(event.emoji)) emojis.set(event.emoji, { emoji: event.emoji, total: 0, days: new Map(), hours: Array.from({ length: 24 }, () => 0), channels: new Map(), latestAt: event.at });
        const emoji = emojis.get(event.emoji);
        emoji.total += 1;
        emoji.days.set(day, (emoji.days.get(day) || 0) + 1);
        emoji.hours[date.getHours()] += 1;
        emoji.channels.set(event.channelId, (emoji.channels.get(event.channelId) || 0) + 1);
        if (event.at > emoji.latestAt) emoji.latestAt = event.at;
    });

    return {
        total: events.length,
        firstAt: events.length ? [...events].sort((a, b) => a.at.localeCompare(b.at))[0].at : null,
        days: [...dayCounts.entries()].sort((a, b) => a[0].localeCompare(b[0])),
        hours,
        weekdays,
        emojis: [...emojis.values()].sort((a, b) => b.total - a.total || a.emoji.localeCompare(b.emoji)),
        recent: [...events].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12)
    };
}

function formatLocalDayKey(date) {
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatStatsDay(day) {
    return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatStatsTime(value) {
    return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatStatsHour(hour) {
    return new Date(2000, 0, 1, hour).toLocaleTimeString(undefined, { hour: "numeric" });
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

function getRouletteSlideshowSettings() {
    const serverId = getActiveServer()?.id || "main";
    const saved = state.structure.settings.rouletteSlideshowSettings?.[serverId] || {};
    return {
        minSeconds: 3,
        maxSeconds: 10,
        minBpm: 80,
        maxBpm: 160,
        ...saved
    };
}

async function saveRouletteSlideshowSettings(settings) {
    const serverId = getActiveServer()?.id || "main";
    state.structure.settings.rouletteSlideshowSettings ||= {};
    state.structure.settings.rouletteSlideshowSettings[serverId] = settings;
    await saveStructure(state.structure);
}

function rouletteRangeValue(value, minimum, maximum, fallback) {
    return Math.min(maximum, Math.max(minimum, Number.parseInt(value, 10) || fallback));
}

function rouletteRandomInteger(first, second) {
    const minimum = Math.min(first, second);
    const maximum = Math.max(first, second);
    return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

function formatRouletteSeconds(seconds) {
    return `${seconds} second${seconds === 1 ? "" : "s"}`;
}

function getRouletteCandidatesByChannel() {
    const candidates = new Map();
    getServerEntries().forEach((entry) => {
        const images = (entry.message.attachments || [])
            .filter((attachment) => attachment.type?.startsWith("image/") && shouldShowAttachment(attachment))
            .map((attachment) => ({
                ref: { channelId: entry.channelId, messageId: entry.message.id, attachmentId: attachment.id }
            }));
        if (images.length) candidates.set(entry.channelId, [...(candidates.get(entry.channelId) || []), ...images]);
    });
    return candidates;
}

function startRouletteSlideshow() {
    const roulette = state.rouletteSlideshow;
    if (roulette.isPlaying) return;
    roulette.previousBpm = els.metronomeBpm.value || state.structure.settings.metronomeBpm || 120;
    roulette.previousMetronomeRunning = Boolean(metronomeTimer);
    roulette.isPlaying = true;
    roulette.lastChannelId = null;
    advanceRouletteSlideshow();
}

function advanceRouletteSlideshow() {
    const roulette = state.rouletteSlideshow;
    if (!roulette.isPlaying) return;
    window.clearTimeout(rouletteSlideshowTimer);
    const candidatesByChannel = getRouletteCandidatesByChannel();
    const allChannelIds = [...candidatesByChannel.keys()];
    if (!allChannelIds.length) {
        stopRouletteSlideshow({ render: false });
        alert("Add local images or GIFs to this workspace before starting Roulette Slideshow.");
        renderMessages();
        return;
    }
    const eligibleChannels = allChannelIds.length > 1
        ? allChannelIds.filter((channelId) => channelId !== roulette.lastChannelId)
        : allChannelIds;
    const channelId = randomItem(eligibleChannels);
    const selected = randomItem(candidatesByChannel.get(channelId) || []);
    if (!selected) return;
    const settings = getRouletteSlideshowSettings();
    const durationSeconds = rouletteRandomInteger(
        rouletteRangeValue(settings.minSeconds, 1, 120, 3),
        rouletteRangeValue(settings.maxSeconds, 1, 120, 10)
    );
    const bpm = rouletteRandomInteger(
        rouletteRangeValue(settings.minBpm, 20, 300, 80),
        rouletteRangeValue(settings.maxBpm, 20, 300, 160)
    );
    roulette.current = { ...selected, durationSeconds, bpm, startedAt: Date.now() };
    roulette.lastChannelId = channelId;
    els.metronomeBpm.value = String(bpm);
    startMetronome();
    rouletteSlideshowTimer = window.setTimeout(() => {
        if (state.activeView.type !== "rouletteSlideshow") {
            stopRouletteSlideshow({ render: false });
            return;
        }
        advanceRouletteSlideshow();
    }, durationSeconds * 1000);
    renderMessages();
}

function stopRouletteSlideshow({ restoreMetronome = true, render = true } = {}) {
    const roulette = state.rouletteSlideshow;
    const wasPlaying = roulette.isPlaying;
    window.clearTimeout(rouletteSlideshowTimer);
    rouletteSlideshowTimer = undefined;
    roulette.isPlaying = false;
    if (restoreMetronome && wasPlaying && roulette.previousBpm !== null) {
        els.metronomeBpm.value = String(roulette.previousBpm);
        if (roulette.previousMetronomeRunning) startMetronome();
        else stopMetronome(false);
    }
    roulette.previousBpm = null;
    roulette.previousMetronomeRunning = false;
    if (render && state.activeView.type === "rouletteSlideshow") renderMessages();
}

function renderRouletteSlideshow() {
    const roulette = state.rouletteSlideshow;
    const settings = getRouletteSlideshowSettings();
    const page = document.createElement("section");
    page.className = "rouletteSlideshow";
    const intro = document.createElement("section");
    intro.className = "focusSessionIntro";
    intro.innerHTML = "<h3>Roulette Slideshow</h3><p>Each turn chooses a channel first, then a random local image or GIF from it. The duration and metronome BPM change independently within your ranges.</p>";
    const controls = document.createElement("section");
    controls.className = "rouletteSlideshowControls";
    const makeNumber = (labelText, value, minimum, maximum) => {
        const label = document.createElement("label");
        label.textContent = labelText;
        const input = document.createElement("input");
        input.type = "number";
        input.min = String(minimum);
        input.max = String(maximum);
        input.inputMode = "numeric";
        input.value = value;
        label.appendChild(input);
        return { label, input };
    };
    const minimumDuration = makeNumber("Minimum slide seconds", settings.minSeconds, 1, 120);
    const maximumDuration = makeNumber("Maximum slide seconds", settings.maxSeconds, 1, 120);
    const minimumBpm = makeNumber("Minimum BPM", settings.minBpm, 20, 300);
    const maximumBpm = makeNumber("Maximum BPM", settings.maxBpm, 20, 300);
    const saveSettings = async () => {
        await saveRouletteSlideshowSettings({
            minSeconds: rouletteRangeValue(minimumDuration.input.value, 1, 120, 3),
            maxSeconds: rouletteRangeValue(maximumDuration.input.value, 1, 120, 10),
            minBpm: rouletteRangeValue(minimumBpm.input.value, 20, 300, 80),
            maxBpm: rouletteRangeValue(maximumBpm.input.value, 20, 300, 160)
        });
    };
    [minimumDuration.input, maximumDuration.input, minimumBpm.input, maximumBpm.input]
        .forEach((input) => input.addEventListener("change", saveSettings));
    controls.append(minimumDuration.label, maximumDuration.label, minimumBpm.label, maximumBpm.label);
    const actions = document.createElement("div");
    actions.className = "rouletteSlideshowActions";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "adventurePrimary";
    toggle.textContent = roulette.isPlaying ? "Stop roulette" : roulette.current ? "Resume roulette" : "Start roulette";
    toggle.addEventListener("click", () => {
        if (roulette.isPlaying) stopRouletteSlideshow();
        else startRouletteSlideshow();
    });
    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "Spin next now";
    next.disabled = !roulette.isPlaying;
    next.addEventListener("click", advanceRouletteSlideshow);
    actions.append(toggle, next);
    const current = roulette.current;
    const attachment = current ? findAttachment(current.ref) : null;
    if (attachment) {
        const frame = renderAdventurePlayerMedia(current.ref);
        frame.className = "rouletteSlideshowFrame";
        const caption = document.createElement("figcaption");
        caption.textContent = `# ${getChannelById(current.ref.channelId)?.name || "channel"} · ${formatRouletteSeconds(current.durationSeconds)} · ${current.bpm} BPM`;
        const progress = document.createElement("div");
        progress.className = "rouletteSlideshowProgress";
        const progressFill = document.createElement("span");
        progress.appendChild(progressFill);
        if (roulette.isPlaying) {
            requestAnimationFrame(() => {
                progressFill.style.transition = `width ${current.durationSeconds * 1000}ms linear`;
                progressFill.style.width = "100%";
            });
        } else {
            progressFill.style.width = "100%";
        }
        frame.append(caption, progress);
        page.append(intro, controls, actions, frame);
    } else {
        const empty = emptyPanel("Choose Start roulette to draw a local image or GIF from a random channel in this workspace.");
        page.append(intro, controls, actions, empty);
    }
    const note = document.createElement("p");
    note.className = "rouletteSlideshowNote";
    note.textContent = "Everything stays local. Stopping restores the metronome state you had before the roulette started.";
    page.appendChild(note);
    els.messages.appendChild(page);
}

function getImageDraftDurationPresets() {
    return {
        "gentle-rise": { label: "Top pick linger", description: "Long-to-short: 10 to 3 seconds", start: 10, end: 3 },
        "dramatic-rise": { label: "Top pick spotlight", description: "Long-to-short: 18 to 2 seconds", start: 18, end: 2 },
        "reverse-fade": { label: "Quick descent", description: "Long-to-short: 12 to 3 seconds", start: 12, end: 3 }
    };
}

function getImageDraftBpmPresets() {
    return {
        "calm-rise": { label: "Top pick energy", description: "High-to-low: 160 to 70 BPM", start: 160, end: 70 },
        "full-rise": { label: "Top pick maximum", description: "High-to-low: 220 to 60 BPM", start: 220, end: 60 },
        "reverse-calm": { label: "Steady descent", description: "High-to-low: 180 to 75 BPM", start: 180, end: 75 }
    };
}

function getImageDraftScaleValue(preset, position, total) {
    const safeTotal = Math.max(1, Number(total) || 1);
    const safePosition = Math.min(safeTotal, Math.max(1, Number(position) || 1));
    const progress = safeTotal <= 1 ? 0 : (safePosition - 1) / (safeTotal - 1);
    const start = Number(preset?.start) || 1;
    const end = Number(preset?.end) || start;
    return Math.max(1, Math.round(start + (end - start) * progress));
}

function shuffledCopy(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
}

function getImageDraftSourceChannels() {
    const draft = state.imageDraft;
    const server = getActiveServer();
    if (!server) return [];
    const visibleChannels = allChannels(server).filter((channel) => !channel.hidden && !getChannelCategory(channel.id)?.hidden);
    if (draft.sourceType === "channel") return visibleChannels.filter((channel) => channel.id === draft.sourceId);
    if (draft.sourceType === "category") {
        const category = server.categories.find((item) => item.id === draft.sourceId && !item.hidden);
        return category?.channels.filter((channel) => !channel.hidden) || [];
    }
    return visibleChannels;
}

async function getImageDraftCandidates() {
    const channels = getImageDraftSourceChannels();
    for (const channel of channels) {
        if (!state.messagesByChannel.has(channel.id)) {
            state.messagesByChannel.set(channel.id, normalizeMessages(await getChannelMessages(channel.id)));
        }
    }
    return channels.flatMap((channel) => (
        (state.messagesByChannel.get(channel.id) || []).flatMap((message) => (
            (message.attachments || [])
                .filter((attachment) => attachment.type?.startsWith("image/") && shouldShowAttachment(attachment))
                .map((attachment) => ({
                    ref: { channelId: channel.id, messageId: message.id, attachmentId: attachment.id },
                    label: attachment.note || attachment.name || "Local image",
                    channelName: channel.name
                }))
        ))
    ));
}

function imageDraftRankedItems() {
    return (state.imageDraft.ranked || []).filter(Boolean);
}

function getImageDraftSlideValues(item) {
    const total = imageDraftRankedItems().length;
    const durationPreset = getImageDraftDurationPresets()[state.imageDraft.durationPreset] || getImageDraftDurationPresets()["gentle-rise"];
    const bpmPreset = getImageDraftBpmPresets()[state.imageDraft.bpmPreset] || getImageDraftBpmPresets()["calm-rise"];
    return {
        durationSeconds: getImageDraftScaleValue(durationPreset, Number.isFinite(Number(item?.rank)) ? Number(item.rank) : 1, total),
        bpm: getImageDraftScaleValue(bpmPreset, Number.isFinite(Number(item?.rank)) ? Number(item.rank) : 1, total)
    };
}

function getImageDraftPresentationSequence() {
    const ranked = imageDraftRankedItems();
    if (state.imageDraft.playOrder === "first-to-last") return [...ranked];
    if (state.imageDraft.playOrder === "last-to-first") return [...ranked].reverse();
    return shuffledCopy(ranked);
}

function renderImageDraft() {
    const stage = state.imageDraft.stage;
    if (stage === "visible") return renderImageDraftVisible();
    if (stage === "blind") return renderImageDraftBlind();
    if (stage === "result") return renderImageDraftResult();
    if (stage === "play") return renderImageDraftPlayback();
    if (stage === "censor") return renderImageDraftCensorChallenge();
    if (stage === "wheel") return renderImageDraftWheel();
    renderImageDraftSetup();
}

function imageDraftSelect(options, selected, onChange) {
    const select = document.createElement("select");
    options.forEach(({ value, label }) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        option.selected = value === selected;
        select.appendChild(option);
    });
    select.addEventListener("change", () => onChange(select.value));
    return select;
}

function imageDraftField(labelText, control) {
    const label = document.createElement("label");
    label.textContent = labelText;
    label.appendChild(control);
    return label;
}

function getCensorPresets() {
    return state.structure.settings.censorPresets || [];
}

async function saveCensorPreset(name, draft) {
    const cleaned = normalizeDisplayName(name).slice(0, 40);
    if (!cleaned) return;
    const preset = { id: crypto.randomUUID(), name: cleaned, metric: draft.censorMetric, areaStep: draft.censorAreaStep, granularityStep: draft.censorGranularityStep };
    state.structure.settings.censorPresets = [...getCensorPresets().filter((item) => item.name.toLowerCase() !== cleaned.toLowerCase()), preset].slice(-12);
    await saveStructure(state.structure);
}

function getImageDraftSourceOptions(type) {
    const server = getActiveServer();
    if (!server) return [];
    if (type === "category") {
        return server.categories
            .filter((category) => !category.hidden && category.channels.some((channel) => !channel.hidden))
            .map((category) => ({ value: category.id, label: `${category.name} folder` }));
    }
    return allChannels(server)
        .filter((channel) => !channel.hidden && !getChannelCategory(channel.id)?.hidden)
        .map((channel) => ({ value: channel.id, label: `# ${channel.name}` }));
}

function updateImageDraftSourceDefault() {
    const draft = state.imageDraft;
    if (draft.sourceType === "all") {
        draft.sourceId = "";
        return;
    }
    const options = getImageDraftSourceOptions(draft.sourceType);
    if (!options.some((option) => option.value === draft.sourceId)) draft.sourceId = options[0]?.value || "";
}

function renderImageDraftSetup() {
    const draft = state.imageDraft;
    updateImageDraftSourceDefault();
    const page = document.createElement("section");
    page.className = "imageDraft";
    const intro = document.createElement("section");
    intro.className = "focusSessionIntro";
    intro.innerHTML = "<h3>Image Draft</h3><p>Draw a local set of images, draft them into positions, then play them in a random order. Each position controls its duration and BPM — not its location in the show.</p>";
    const setup = document.createElement("section");
    setup.className = "imageDraftSetup";
    const count = document.createElement("input");
    count.type = "number";
    count.min = "2";
    count.max = "20";
    count.inputMode = "numeric";
    count.value = String(draft.count);
    const mode = imageDraftSelect([
        { value: "visible", label: "Visible draft — see every image" },
        { value: "blind", label: "Blind draft — rank one image at a time" }
    ], draft.mode, (value) => { draft.mode = value; });
    const sourceType = imageDraftSelect([
        { value: "all", label: "All visible channels in this workspace" },
        { value: "category", label: "One folder" },
        { value: "channel", label: "One channel" }
    ], draft.sourceType, (value) => {
        draft.sourceType = value;
        draft.sourceId = "";
        renderMessages();
    });
    const source = imageDraftSelect(getImageDraftSourceOptions(draft.sourceType), draft.sourceId, (value) => { draft.sourceId = value; });
    const sourceField = imageDraftField(draft.sourceType === "category" ? "Folder" : "Channel", source);
    sourceField.hidden = draft.sourceType === "all";
    const order = imageDraftSelect([
        { value: "random", label: "Randomized locations (default)" },
        { value: "first-to-last", label: "First draft spot to last" },
        { value: "last-to-first", label: "Last draft spot to first" }
    ], draft.playOrder, (value) => { draft.playOrder = value; });
    const censor = document.createElement("input");
    censor.type = "checkbox";
    censor.checked = draft.censorMode;
    const censorLabel = document.createElement("label");
    censorLabel.className = "imageDraftToggle";
    censorLabel.append(censor, document.createTextNode(" Censor mode — draft position scales censorship difficulty"));
    const censorMetric = imageDraftSelect([
        { value: "area", label: "Increasing censored area" },
        { value: "granularity", label: "Increasing mosaic granularity" },
        { value: "both", label: "Area + granularity" }
    ], draft.censorMetric, (value) => { draft.censorMetric = value; refreshPreview(); });
    const censorArea = document.createElement("input");
    censorArea.type = "number";
    censorArea.min = "1";
    censorArea.max = "40";
    censorArea.value = String(draft.censorAreaStep || 8);
    const censorGranularity = document.createElement("input");
    censorGranularity.type = "number";
    censorGranularity.min = "1";
    censorGranularity.max = "6";
    censorGranularity.value = String(draft.censorGranularityStep || 2);
    const censorMetricField = imageDraftField("Censor challenge", censorMetric);
    const censorAreaField = imageDraftField("Area increase per draft spot (%)", censorArea);
    const censorGranularityField = imageDraftField("Granularity increase per spot", censorGranularity);
    const censorPreset = document.createElement("select");
    censorPreset.innerHTML = "<option value=\"\">Censor presets</option>";
    getCensorPresets().forEach((item) => {
        const option = document.createElement("option"); option.value = item.id; option.textContent = item.name; censorPreset.appendChild(option);
    });
    censorPreset.addEventListener("change", () => {
        const selected = getCensorPresets().find((item) => item.id === censorPreset.value);
        if (!selected) return;
        draft.censorMetric = selected.metric; draft.censorAreaStep = selected.areaStep; draft.censorGranularityStep = selected.granularityStep;
        renderMessages();
    });
    const savePreset = document.createElement("button");
    savePreset.type = "button";
    savePreset.textContent = "Save censor preset";
    savePreset.addEventListener("click", async () => {
        const name = prompt("Preset name?");
        if (!name) return;
        await saveCensorPreset(name, draft);
        renderMessages();
    });
    const censorPresetField = document.createElement("div");
    censorPresetField.className = "imageDraftActions";
    censorPresetField.append(censorPreset, savePreset);
    const duration = imageDraftSelect(Object.entries(getImageDraftDurationPresets()).map(([value, preset]) => ({ value, label: `${preset.label} · ${preset.description}` })), draft.durationPreset, (value) => { draft.durationPreset = value; });
    const bpm = imageDraftSelect(Object.entries(getImageDraftBpmPresets()).map(([value, preset]) => ({ value, label: `${preset.label} · ${preset.description}` })), draft.bpmPreset, (value) => { draft.bpmPreset = value; });
    const durationField = imageDraftField("Duration scaling", duration);
    const bpmField = imageDraftField("BPM scaling", bpm);
    const winnerStays = document.createElement("input");
    winnerStays.type = "checkbox";
    winnerStays.checked = draft.wheelWinnerStays;
    const winnerTimer = document.createElement("input");
    winnerTimer.type = "number";
    winnerTimer.min = "0";
    winnerTimer.max = "7200";
    winnerTimer.inputMode = "numeric";
    winnerTimer.value = String(draft.wheelWinnerTimerSeconds || 0);
    const winnerField = document.createElement("label");
    winnerField.className = "imageDraftWinnerStay";
    winnerField.append(winnerStays, document.createTextNode(" Winner stays — keep the wheel result’s BPM running"));
    const winnerTimerField = imageDraftField("Winner-stays timer (seconds, 0 = until exit)", winnerTimer);
    const preview = document.createElement("p");
    preview.className = "imageDraftPreview";
    const getPreviewCount = () => Math.min(20, Math.max(2, Number.parseInt(count.value, 10) || draft.count || 6));
    const refreshPreview = (commit = false) => {
        const previewCount = getPreviewCount();
        if (commit) {
            draft.count = previewCount;
            count.value = String(previewCount);
        }
        if (draft.censorMode) {
            preview.textContent = `Censor mode: draft spot #1 needs 1 blur region; #${previewCount} needs ${previewCount}. The challenge order follows your selected location order.`;
            durationField.hidden = true;
            bpmField.hidden = true;
            winnerField.hidden = true;
            winnerTimerField.hidden = true;
            censorMetricField.hidden = false;
            censorAreaField.hidden = !["area", "both"].includes(draft.censorMetric);
            censorGranularityField.hidden = !["granularity", "both"].includes(draft.censorMetric);
            censorPresetField.hidden = false;
            const area = Math.min(95, Math.max(0, (Number(draft.censorAreaStep) || 8) * previewCount));
            const density = Math.min(12, Math.max(1, 2 + (Number(draft.censorGranularityStep) || 2) * previewCount));
            preview.textContent = `${draft.censorMetric === "granularity" ? `Mosaic density grows to ${density}/12 at #${previewCount}.` : draft.censorMetric === "area" ? `Censored area grows to ${area}% at #${previewCount}.` : `At #${previewCount}: censor ${area}% with mosaic density ${density}/12.`}`;
        } else {
            const durationPreset = getImageDraftDurationPresets()[draft.durationPreset] || getImageDraftDurationPresets()["gentle-rise"];
            const bpmPreset = getImageDraftBpmPresets()[draft.bpmPreset] || getImageDraftBpmPresets()["calm-rise"];
            const firstValues = { durationSeconds: getImageDraftScaleValue(durationPreset, 1, previewCount), bpm: getImageDraftScaleValue(bpmPreset, 1, previewCount) };
            const lastValues = { durationSeconds: getImageDraftScaleValue(durationPreset, previewCount, previewCount), bpm: getImageDraftScaleValue(bpmPreset, previewCount, previewCount) };
            preview.textContent = `Scale preview: #1 is ${firstValues.durationSeconds}s at ${firstValues.bpm} BPM; #${previewCount} is ${lastValues.durationSeconds}s at ${lastValues.bpm} BPM.`;
            durationField.hidden = false;
            bpmField.hidden = false;
            winnerField.hidden = false;
            winnerTimerField.hidden = !draft.wheelWinnerStays;
            censorMetricField.hidden = true;
            censorAreaField.hidden = true;
            censorGranularityField.hidden = true;
            censorPresetField.hidden = true;
        }
    };
    count.addEventListener("input", () => refreshPreview(false));
    count.addEventListener("change", () => refreshPreview(true));
    duration.addEventListener("change", refreshPreview);
    bpm.addEventListener("change", refreshPreview);
    censor.addEventListener("change", () => { draft.censorMode = censor.checked; refreshPreview(); });
    censorArea.addEventListener("input", () => { draft.censorAreaStep = Math.min(40, Math.max(1, Number.parseInt(censorArea.value, 10) || 8)); refreshPreview(); });
    censorGranularity.addEventListener("input", () => { draft.censorGranularityStep = Math.min(6, Math.max(1, Number.parseInt(censorGranularity.value, 10) || 2)); refreshPreview(); });
    winnerStays.addEventListener("change", () => { draft.wheelWinnerStays = winnerStays.checked; refreshPreview(); });
    winnerTimer.addEventListener("input", () => {
        draft.wheelWinnerTimerSeconds = Math.min(7200, Math.max(0, Number.parseInt(winnerTimer.value, 10) || 0));
    });
    setup.append(
        imageDraftField("Images to draft", count),
        imageDraftField("Draft mode", mode),
        imageDraftField("Draw from", sourceType),
        sourceField,
        imageDraftField("Playback order", order),
        durationField,
        bpmField,
        winnerField,
        winnerTimerField,
        censorLabel,
        censorMetricField,
        censorAreaField,
        censorGranularityField,
        censorPresetField,
        preview
    );
    const start = document.createElement("button");
    start.type = "button";
    start.className = "adventurePrimary";
    start.textContent = "Draw images and begin draft";
    start.addEventListener("click", () => {
        refreshPreview(true);
        beginImageDraft().catch((error) => {
        console.error("Could not start image draft:", error);
        alert("Could not load the selected local images for this draft.");
        });
    });
    page.append(intro, setup, start);
    els.messages.appendChild(page);
    refreshPreview(false);
}

async function beginImageDraft() {
    const draft = state.imageDraft;
    updateImageDraftSourceDefault();
    const candidates = await getImageDraftCandidates();
    const count = Math.min(20, Math.max(2, Number.parseInt(draft.count, 10) || 6));
    draft.count = count;
    if (candidates.length < count) {
        alert(`The selected source has ${candidates.length} available local image${candidates.length === 1 ? "" : "s"}. Choose ${Math.max(2, Math.min(count, candidates.length))} or fewer, or select another source.`);
        return;
    }
    draft.candidates = shuffledCopy(candidates).slice(0, count);
    draft.ranked = draft.mode === "blind" ? Array(count).fill(null) : [];
    draft.blindIndex = 0;
    draft.historyId = null;
    draft.play = null;
    draft.censor = null;
    draft.wheel = null;
    draft.stage = draft.mode;
    renderMessages();
}

function renderImageDraftCandidate(item, rank = null, blind = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `imageDraftCandidate${rank ? " isRanked" : ""}`;
    const attachment = findAttachment(item.ref);
    if (attachment) {
        const image = document.createElement("img");
        setRenderedImageSource(image, attachment);
        image.alt = blind ? "Draft image" : item.label;
        button.appendChild(image);
    }
    const detail = document.createElement("span");
    detail.className = "imageDraftCandidateDetail";
    const title = document.createElement("strong");
    title.textContent = blind ? "Current image" : item.label;
    detail.appendChild(title);
    if (!blind) {
        const channel = document.createElement("small");
        channel.textContent = `# ${item.channelName}`;
        detail.appendChild(channel);
    }
    button.appendChild(detail);
    if (rank) {
        const badge = document.createElement("span");
        badge.className = "imageDraftRankBadge";
        badge.textContent = `#${rank}`;
        button.appendChild(badge);
        button.disabled = true;
    }
    return button;
}

function renderImageDraftVisible() {
    const draft = state.imageDraft;
    const page = document.createElement("section");
    page.className = "imageDraft";
    const intro = document.createElement("section");
    intro.className = "focusSessionIntro";
    intro.innerHTML = `<h3>Visible draft</h3><p>Tap an image to assign the next spot. Choose #${draft.ranked.length + 1} of ${draft.candidates.length}.</p>`;
    const selected = document.createElement("section");
    selected.className = "imageDraftOrder";
    const selectedHeading = document.createElement("strong");
    selectedHeading.textContent = "Your draft order";
    selected.appendChild(selectedHeading);
    if (draft.ranked.length === 0) selected.appendChild(emptyPanel("Nothing drafted yet."));
    else {
        draft.ranked.forEach((item, index) => {
            const row = document.createElement("button");
            row.type = "button";
            row.className = "imageDraftOrderItem";
            row.textContent = `#${index + 1} · ${item.label} · #${item.channelName} · remove`;
            row.addEventListener("click", () => {
                draft.ranked.splice(index, 1);
                renderMessages();
            });
            selected.appendChild(row);
        });
    }
    const grid = document.createElement("div");
    grid.className = "imageDraftGrid";
    const rankedByKey = new Map(draft.ranked.map((item, index) => [photoRefKey(item.ref), index + 1]));
    draft.candidates.forEach((item) => {
        const rank = rankedByKey.get(photoRefKey(item.ref));
        const card = renderImageDraftCandidate(item, rank);
        if (!rank) card.addEventListener("click", () => {
            draft.ranked.push(item);
            renderMessages();
        });
        grid.appendChild(card);
    });
    const actions = document.createElement("div");
    actions.className = "imageDraftActions";
    const restart = document.createElement("button");
    restart.type = "button";
    restart.textContent = "Start over";
    restart.addEventListener("click", resetImageDraft);
    const complete = document.createElement("button");
    complete.type = "button";
    complete.className = "adventurePrimary";
    complete.textContent = "Complete draft";
    complete.disabled = draft.ranked.length !== draft.candidates.length;
    complete.addEventListener("click", () => finalizeImageDraft().catch(reportImageDraftSaveError));
    actions.append(restart, complete);
    page.append(intro, selected, grid, actions);
    els.messages.appendChild(page);
}

function renderImageDraftBlind() {
    const draft = state.imageDraft;
    const current = draft.candidates[draft.blindIndex];
    if (!current) return finalizeImageDraft().catch(reportImageDraftSaveError);
    const page = document.createElement("section");
    page.className = "imageDraft imageDraftBlind";
    const intro = document.createElement("section");
    intro.className = "focusSessionIntro";
    intro.innerHTML = `<h3>Blind draft</h3><p>Image ${draft.blindIndex + 1} of ${draft.candidates.length}. Pick its draft spot without seeing the other images.</p>`;
    const attachment = findAttachment(current.ref);
    const media = attachment ? renderAdventurePlayerMedia(current.ref, "Assign this image a draft spot") : emptyPanel("This source image is no longer available.");
    media.classList.add("imageDraftBlindMedia");
    const slots = document.createElement("section");
    slots.className = "imageDraftSlots";
    const slotHeading = document.createElement("strong");
    slotHeading.textContent = "Choose an available draft spot";
    slots.appendChild(slotHeading);
    draft.ranked.forEach((item, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = item ? `#${index + 1} filled` : `Draft spot #${index + 1}`;
        button.disabled = Boolean(item) || !attachment;
        button.addEventListener("click", () => assignBlindImageDraftSpot(index));
        slots.appendChild(button);
    });
    const restart = document.createElement("button");
    restart.type = "button";
    restart.className = "imageDraftBack";
    restart.textContent = "Cancel this draft";
    restart.addEventListener("click", resetImageDraft);
    page.append(intro, media, slots, restart);
    els.messages.appendChild(page);
}

async function assignBlindImageDraftSpot(index) {
    const draft = state.imageDraft;
    const candidate = draft.candidates[draft.blindIndex];
    if (!candidate || draft.ranked[index]) return;
    draft.ranked[index] = candidate;
    draft.blindIndex += 1;
    if (draft.blindIndex >= draft.candidates.length) await finalizeImageDraft();
    else renderMessages();
}

function resetImageDraft() {
    stopImageDraftSlideshow({ render: false });
    clearImageDraftWheelTimer();
    stopImageDraftWinnerStay({ render: false });
    state.imageDraft.stage = "setup";
    state.imageDraft.candidates = [];
    state.imageDraft.ranked = [];
    state.imageDraft.historyId = null;
    state.imageDraft.play = null;
    state.imageDraft.censor = null;
    state.imageDraft.wheel = null;
    renderMessages();
}

function reportImageDraftSaveError(error) {
    console.error("Could not save image draft statistics:", error);
    alert("Your draft could not be saved to local statistics. Please try the draft again.");
}

async function finalizeImageDraft() {
    const draft = state.imageDraft;
    if (imageDraftRankedItems().length !== draft.candidates.length) return;
    const server = getActiveServer();
    if (!server) return;
    const rankedItems = draft.ranked.map((item, index) => ({ ...item, rank: index + 1 }));
    draft.ranked = rankedItems;
    const record = {
        id: crypto.randomUUID(),
        serverId: server.id,
        createdAt: new Date().toISOString(),
        mode: draft.mode,
        sourceType: draft.sourceType,
        sourceId: draft.sourceId,
        playOrder: draft.playOrder,
        durationPreset: draft.durationPreset,
        bpmPreset: draft.bpmPreset,
        censorMode: Boolean(draft.censorMode),
        censorMetric: draft.censorMetric,
        censorAreaStep: draft.censorAreaStep,
        censorGranularityStep: draft.censorGranularityStep,
        items: rankedItems.map((item, index) => ({
            ref: structuredClone(item.ref),
            rank: index + 1,
            label: item.label,
            channelName: item.channelName
        })),
        censorResults: []
    };
    state.structure.settings.draftHistory = [...(state.structure.settings.draftHistory || []), record].slice(-200);
    await saveStructure(state.structure);
    draft.historyId = record.id;
    draft.stage = "result";
    renderMessages();
}

function renderImageDraftResult() {
    const draft = state.imageDraft;
    const page = document.createElement("section");
    page.className = "imageDraft";
    const intro = document.createElement("section");
    intro.className = "focusSessionIntro";
    intro.innerHTML = draft.censorMode
        ? "<h3>Draft saved</h3><p>The draft positions are now stored in local statistics. Start the censor challenge to make an increasing number of blur regions based on each image’s draft spot.</p>"
        : "<h3>Draft saved</h3><p>The draft positions are now stored in local statistics. Playback uses your selected duration and BPM scaling while locations follow your selected order.</p>";
    const list = document.createElement("section");
    list.className = "imageDraftResultList";
    imageDraftRankedItems().forEach((item) => {
        const values = getImageDraftSlideValues(item);
        const row = document.createElement("article");
        row.className = "imageDraftResultItem";
        const attachment = findAttachment(item.ref);
        if (attachment) {
            const image = document.createElement("img");
            setRenderedImageSource(image, attachment);
            image.alt = item.label;
            row.appendChild(image);
        }
        const detail = document.createElement("div");
        const label = document.createElement("strong");
        label.textContent = `#${item.rank} · ${item.label}`;
        const meta = document.createElement("span");
        meta.textContent = draft.censorMode
            ? `# ${item.channelName} · ${getImageDraftCensorRequirement(item).label}`
            : `# ${item.channelName} · ${values.durationSeconds}s · ${values.bpm} BPM`;
        detail.append(label, meta);
        row.appendChild(detail);
        list.appendChild(row);
    });
    const actions = document.createElement("div");
    actions.className = "imageDraftActions";
    const play = document.createElement("button");
    play.type = "button";
    play.className = "adventurePrimary";
    play.textContent = draft.censorMode ? "Start censor challenge" : "Start draft slideshow";
    play.addEventListener("click", () => {
        if (draft.censorMode) startImageDraftCensorChallenge();
        else startImageDraftSlideshow();
    });
    const newDraft = document.createElement("button");
    newDraft.type = "button";
    newDraft.textContent = "New draft";
    newDraft.addEventListener("click", resetImageDraft);
    actions.append(play, newDraft);
    page.append(intro, list, actions);
    els.messages.appendChild(page);
}

function startImageDraftSlideshow() {
    const draft = state.imageDraft;
    const sequence = getImageDraftPresentationSequence();
    if (!sequence.length) return;
    draft.play = {
        sequence,
        index: 0,
        isPlaying: true,
        previousBpm: els.metronomeBpm.value || state.structure.settings.metronomeBpm || 120,
        previousMetronomeRunning: Boolean(metronomeTimer)
    };
    draft.stage = "play";
    advanceImageDraftSlideshow();
}

function advanceImageDraftSlideshow() {
    const draft = state.imageDraft;
    const play = draft.play;
    if (!play?.isPlaying) return;
    window.clearTimeout(imageDraftSlideshowTimer);
    if (play.index >= play.sequence.length) {
        stopImageDraftSlideshow({ render: false });
        startImageDraftWheel();
        return;
    }
    const item = play.sequence[play.index];
    const values = getImageDraftSlideValues(item);
    play.current = { item, values, startedAt: Date.now() };
    els.metronomeBpm.value = String(values.bpm);
    startMetronome();
    imageDraftSlideshowTimer = window.setTimeout(() => {
        if (state.activeView.type !== "imageDraft" || state.imageDraft.stage !== "play") {
            stopImageDraftSlideshow({ render: false });
            return;
        }
        play.index += 1;
        advanceImageDraftSlideshow();
    }, values.durationSeconds * 1000);
    renderMessages();
}

function stopImageDraftSlideshow({ restoreMetronome = true, render = true } = {}) {
    const draft = state.imageDraft;
    const play = draft.play;
    window.clearTimeout(imageDraftSlideshowTimer);
    imageDraftSlideshowTimer = undefined;
    if (play?.isPlaying && restoreMetronome && play.previousBpm !== undefined) {
        els.metronomeBpm.value = String(play.previousBpm);
        if (play.previousMetronomeRunning) startMetronome();
        else stopMetronome(false);
    }
    if (play) play.isPlaying = false;
    draft.play = null;
    if (draft.stage === "play") draft.stage = "result";
    if (render && state.activeView.type === "imageDraft") renderMessages();
}

function renderImageDraftPlayback() {
    const draft = state.imageDraft;
    const current = draft.play?.current;
    if (!current) return renderImageDraftResult();
    const page = document.createElement("section");
    page.className = "imageDraft imageDraftPlayback";
    const heading = document.createElement("section");
    heading.className = "focusSessionIntro";
    heading.innerHTML = `<h3>Draft slideshow</h3><p>Slide ${draft.play.index + 1} of ${draft.play.sequence.length} · draft spot #${current.item.rank}</p>`;
    const media = renderAdventurePlayerMedia(current.item.ref);
    media.className = "imageDraftPlaybackFrame";
    const caption = document.createElement("figcaption");
    caption.textContent = `Draft spot #${current.item.rank} · ${current.values.durationSeconds} seconds · ${current.values.bpm} BPM`;
    const progress = document.createElement("div");
    progress.className = "rouletteSlideshowProgress";
    const fill = document.createElement("span");
    progress.appendChild(fill);
    requestAnimationFrame(() => {
        fill.style.transition = `width ${current.values.durationSeconds * 1000}ms linear`;
        fill.style.width = "100%";
    });
    media.append(caption, progress);
    const actions = document.createElement("div");
    actions.className = "imageDraftActions";
    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "Next now";
    next.addEventListener("click", () => {
        draft.play.index += 1;
        advanceImageDraftSlideshow();
    });
    const stop = document.createElement("button");
    stop.type = "button";
    stop.textContent = "Stop slideshow";
    stop.addEventListener("click", stopImageDraftSlideshow);
    actions.append(next, stop);
    page.append(heading, media, actions);
    els.messages.appendChild(page);
}

function clearImageDraftWheelTimer() {
    window.clearTimeout(imageDraftWheelTimer);
    imageDraftWheelTimer = undefined;
}

function clearImageDraftWinnerTimer() {
    window.clearTimeout(imageDraftWinnerTimer);
    imageDraftWinnerTimer = undefined;
}

function startImageDraftWinnerStay() {
    const draft = state.imageDraft;
    const wheel = draft.wheel;
    if (!wheel?.result || !draft.wheelWinnerStays || wheel.winnerStayActive) return;
    const values = getImageDraftSlideValues(wheel.result);
    wheel.previousBpm = els.metronomeBpm.value || state.structure.settings.metronomeBpm || 120;
    wheel.previousMetronomeRunning = Boolean(metronomeTimer);
    wheel.winnerBpm = values.bpm;
    wheel.winnerStayActive = true;
    els.metronomeBpm.value = String(values.bpm);
    startMetronome();
    const seconds = Math.min(7200, Math.max(0, Number.parseInt(draft.wheelWinnerTimerSeconds, 10) || 0));
    if (seconds > 0) {
        imageDraftWinnerTimer = window.setTimeout(() => {
            if (state.imageDraft.wheel === wheel) stopImageDraftWinnerStay();
        }, seconds * 1000);
    }
}

function stopImageDraftWinnerStay({ render = true } = {}) {
    clearImageDraftWinnerTimer();
    const wheel = state.imageDraft.wheel;
    if (!wheel?.winnerStayActive) return;
    els.metronomeBpm.value = String(wheel.previousBpm || state.structure.settings.metronomeBpm || 120);
    if (wheel.previousMetronomeRunning) startMetronome();
    else stopMetronome(false);
    wheel.winnerStayActive = false;
    if (render && state.activeView.type === "imageDraft" && state.imageDraft.stage === "wheel") renderMessages();
}

function startImageDraftWheel() {
    clearImageDraftWheelTimer();
    clearImageDraftWinnerTimer();
    const items = imageDraftRankedItems();
    if (!items.length) {
        state.imageDraft.stage = "result";
        renderMessages();
        return;
    }
    state.imageDraft.wheel = {
        items,
        result: null,
        spinning: false,
        rotation: 0,
        fromRotation: 0,
        winnerStayActive: false
    };
    state.imageDraft.stage = "wheel";
    renderMessages();
}

function getImageDraftWheelWeight(item, items) {
    const rank = Number.isFinite(Number(item?.rank)) ? Number(item.rank) : items.indexOf(item) + 1;
    return Math.max(1, items.length - rank + 1);
}

function drawImageDraftWheel(canvas, items) {
    const context = canvas.getContext("2d");
    if (!context) return;
    const size = 640;
    const center = size / 2;
    const radius = center - 16;
    const totalWeight = items.reduce((sum, item) => sum + getImageDraftWheelWeight(item, items), 0);
    const colors = ["#5865f2", "#57f287", "#fee75c", "#eb459e", "#ed4245", "#00b0f4", "#9b59b6", "#e67e22"];
    canvas.width = size;
    canvas.height = size;
    context.clearRect(0, 0, size, size);
    let start = -Math.PI / 2;
    items.forEach((item, index) => {
        const weight = getImageDraftWheelWeight(item, items);
        const arc = (weight / totalWeight) * Math.PI * 2;
        context.beginPath();
        context.moveTo(center, center);
        context.arc(center, center, radius, start, start + arc);
        context.closePath();
        context.fillStyle = colors[index % colors.length];
        context.fill();
        context.strokeStyle = "rgba(17, 18, 20, .9)";
        context.lineWidth = 3;
        context.stroke();
        const labelAngle = start + arc / 2;
        context.save();
        context.translate(center, center);
        context.rotate(labelAngle);
        context.fillStyle = "#ffffff";
        context.font = "800 25px system-ui, sans-serif";
        context.textAlign = "center";
        context.fillText(`#${item.rank}`, radius * .67, 8);
        context.restore();
        start += arc;
    });
    context.beginPath();
    context.arc(center, center, 38, 0, Math.PI * 2);
    context.fillStyle = "#1e1f22";
    context.fill();
    context.strokeStyle = "rgba(255,255,255,.34)";
    context.lineWidth = 4;
    context.stroke();
}

function chooseImageDraftWheelResult(wheel) {
    const totalWeight = wheel.items.reduce((sum, item) => sum + getImageDraftWheelWeight(item, wheel.items), 0);
    let roll = Math.random() * totalWeight;
    let before = 0;
    for (const item of wheel.items) {
        const weight = getImageDraftWheelWeight(item, wheel.items);
        if (roll < weight) return { item, weight, before, totalWeight };
        roll -= weight;
        before += weight;
    }
    const item = wheel.items[wheel.items.length - 1];
    const weight = getImageDraftWheelWeight(item, wheel.items);
    return { item, weight, before: totalWeight - weight, totalWeight };
}

function spinImageDraftWheel() {
    const wheel = state.imageDraft.wheel;
    if (!wheel || wheel.spinning || wheel.result) return;
    const selection = chooseImageDraftWheelResult(wheel);
    const midpoint = -90 + ((selection.before + selection.weight / 2) / selection.totalWeight) * 360;
    const desired = ((-90 - midpoint) % 360 + 360) % 360;
    const currentMod = ((wheel.rotation % 360) + 360) % 360;
    wheel.fromRotation = wheel.rotation;
    wheel.rotation = wheel.rotation + 2160 + ((desired - currentMod + 360) % 360);
    wheel.result = selection.item;
    wheel.spinning = true;
    renderMessages();
    imageDraftWheelTimer = window.setTimeout(() => {
        if (state.imageDraft.stage !== "wheel" || state.imageDraft.wheel !== wheel) return;
        wheel.spinning = false;
        startImageDraftWinnerStay();
        renderMessages();
    }, IMAGE_DRAFT_WHEEL_SPIN_MS + 50);
}

function renderImageDraftWheel() {
    const draft = state.imageDraft;
    const wheel = draft.wheel;
    if (!wheel?.items?.length) return renderImageDraftResult();
    const page = document.createElement("section");
    page.className = "imageDraft imageDraftWheel";
    const intro = document.createElement("section");
    intro.className = "focusSessionIntro";
    intro.innerHTML = wheel.result
        ? "<h3>Draft wheel settled</h3><p>The wheel uses one slice per drafted image. Earlier draft spots have larger slices. This result will remain here until you exit the draft.</p>"
        : "<h3>Draft end wheel</h3><p>The slideshow reached its natural end. Each drafted image gets a wheel slice; earlier draft spots receive larger slices.</p>";
    const stage = document.createElement("div");
    stage.className = "imageDraftWheelStage";
    const pointer = document.createElement("span");
    pointer.className = "imageDraftWheelPointer";
    pointer.setAttribute("aria-hidden", "true");
    const canvas = document.createElement("canvas");
    canvas.className = "imageDraftWheelCanvas";
    drawImageDraftWheel(canvas, wheel.items);
    canvas.style.transform = `rotate(${wheel.spinning ? wheel.fromRotation : wheel.rotation}deg)`;
    if (wheel.spinning) {
        requestAnimationFrame(() => {
            canvas.style.transition = `transform ${IMAGE_DRAFT_WHEEL_SPIN_MS}ms cubic-bezier(.12, .72, .1, 1)`;
            canvas.style.transform = `rotate(${wheel.rotation}deg)`;
        });
    }
    stage.append(pointer, canvas);
    const legend = document.createElement("div");
    legend.className = "imageDraftWheelLegend";
    wheel.items.forEach((item) => {
        const label = document.createElement("span");
        const weight = getImageDraftWheelWeight(item, wheel.items);
        label.textContent = `#${item.rank} = ${weight} slice${weight === 1 ? "" : "s"}`;
        legend.appendChild(label);
    });
    const winnerStatus = document.createElement("p");
    winnerStatus.className = "imageDraftWinnerStatus";
    if (wheel.result && draft.wheelWinnerStays) {
        const limit = Number.parseInt(draft.wheelWinnerTimerSeconds, 10) || 0;
        winnerStatus.textContent = wheel.winnerStayActive
            ? `Winner stays active at ${wheel.winnerBpm} BPM${limit > 0 ? ` for up to ${limit} seconds` : " until you exit the draft"}.`
            : "Winner-stays BPM finished; the selected image remains on display.";
    }
    const actions = document.createElement("div");
    actions.className = "imageDraftActions";
    const spin = document.createElement("button");
    spin.type = "button";
    spin.className = "adventurePrimary";
    spin.textContent = wheel.spinning ? "Spinning…" : wheel.result ? "Wheel settled" : "Spin wheel";
    spin.disabled = wheel.spinning || Boolean(wheel.result);
    spin.addEventListener("click", spinImageDraftWheel);
    const exit = document.createElement("button");
    exit.type = "button";
    exit.textContent = "Exit draft";
    exit.addEventListener("click", resetImageDraft);
    actions.append(spin, exit);
    page.append(intro, stage, legend);
    if (winnerStatus.textContent) page.appendChild(winnerStatus);
    page.appendChild(actions);
    if (wheel.result && !wheel.spinning) {
        const attachment = findAttachment(wheel.result.ref);
        const result = attachment
            ? renderAdventurePlayerMedia(wheel.result.ref, `Wheel result · draft spot #${wheel.result.rank}`)
            : emptyPanel("The selected local image is no longer available.");
        result.classList.add("imageDraftWheelResult");
        page.appendChild(result);
    }
    els.messages.appendChild(page);
}

function startImageDraftCensorChallenge() {
    const sequence = getImageDraftPresentationSequence();
    if (!sequence.length) return;
    state.imageDraft.censor = { sequence, index: 0, results: [] };
    state.imageDraft.stage = "censor";
    renderMessages();
}

function getImageDraftCensorRequirement(item) {
    const draft = state.imageDraft;
    const metric = ["area", "granularity", "both"].includes(draft.censorMetric) ? draft.censorMetric : "area";
    return {
        metric,
        areaPercent: ["area", "both"].includes(metric) ? Math.min(95, Math.max(1, (Number(draft.censorAreaStep) || 8) * item.rank)) : 0,
        mosaicDensity: ["granularity", "both"].includes(metric) ? Math.min(12, Math.max(1, 2 + (Number(draft.censorGranularityStep) || 2) * item.rank)) : 4,
        label: metric === "area" ? `censor ${Math.min(95, Math.max(1, (Number(draft.censorAreaStep) || 8) * item.rank))}% of the image` : metric === "granularity" ? `use mosaic density ${Math.min(12, Math.max(1, 2 + (Number(draft.censorGranularityStep) || 2) * item.rank))}/12` : `censor ${Math.min(95, Math.max(1, (Number(draft.censorAreaStep) || 8) * item.rank))}% at density ${Math.min(12, Math.max(1, 2 + (Number(draft.censorGranularityStep) || 2) * item.rank))}/12`
    };
}

async function saveImageDraftCensorResult(item, result) {
    const draft = state.imageDraft;
    const record = (state.structure.settings.draftHistory || []).find((entry) => entry.id === draft.historyId);
    if (!record) return;
    record.censorResults ||= [];
    record.censorResults = record.censorResults.filter((result) => photoRefKey(result.ref) !== photoRefKey(item.ref));
    record.censorResults.push({ ref: structuredClone(item.ref), rank: item.rank, ...result, at: new Date().toISOString() });
    if (record.censorResults.length >= record.items.length) record.censorCompletedAt = new Date().toISOString();
    await saveStructure(state.structure);
}

async function completeImageDraftCensorStep(item, result) {
    const draft = state.imageDraft;
    await saveImageDraftCensorResult(item, result);
    draft.censor.results.push({ ref: item.ref, rank: item.rank, ...result });
    draft.censor.index += 1;
    if (draft.censor.index >= draft.censor.sequence.length) {
        draft.stage = "result";
        alert("Censor challenge complete. The blurred copies are in #censored and the results were added to local draft statistics.");
    }
    renderMessages();
}

function renderImageDraftCensorChallenge() {
    const draft = state.imageDraft;
    const challenge = draft.censor;
    const item = challenge?.sequence[challenge.index];
    if (!item) {
        draft.stage = "result";
        return renderImageDraftResult();
    }
    const page = document.createElement("section");
    page.className = "imageDraft imageDraftCensor";
    const intro = document.createElement("section");
    intro.className = "focusSessionIntro";
    const requirement = getImageDraftCensorRequirement(item);
    intro.innerHTML = `<h3>Censor draft</h3><p>Challenge ${challenge.index + 1} of ${challenge.sequence.length}. This image was drafted in spot #${item.rank}: ${requirement.label}.</p>`;
    const attachment = findAttachment(item.ref);
    const media = attachment ? renderAdventurePlayerMedia(item.ref, "Blur the required regions, then save the local copy") : emptyPanel("This source image is no longer available.");
    const actions = document.createElement("div");
    actions.className = "imageDraftActions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "adventurePrimary";
    edit.textContent = "Censor and save";
    edit.disabled = !attachment;
    edit.addEventListener("click", () => openCensorEditor({
        attachment,
        channelId: item.ref.channelId,
        sourceRef: item.ref,
        requiredRegions: 1,
        requiredAreaPercent: requirement.areaPercent,
        mosaicDensity: requirement.mosaicDensity,
        onSaved: (result) => completeImageDraftCensorStep(item, result).catch(reportImageDraftSaveError)
    }));
    const end = document.createElement("button");
    end.type = "button";
    end.textContent = "End challenge";
    end.addEventListener("click", () => { draft.stage = "result"; renderMessages(); });
    actions.append(edit, end);
    page.append(intro, media, actions);
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
    const correctPreview = document.createElement("label");
    correctPreview.textContent = "Keep a correct image visible (seconds)";
    const correctPreviewInput = document.createElement("input");
    correctPreviewInput.type = "number";
    correctPreviewInput.min = "0.5";
    correctPreviewInput.max = "60";
    correctPreviewInput.step = "0.5";
    correctPreviewInput.inputMode = "decimal";
    correctPreviewInput.value = quizSettings.correctRevealSeconds;
    correctPreview.appendChild(correctPreviewInput);
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
            correctRevealSeconds: clampQuizSeconds(correctPreviewInput.value, 0.5, 60, 1.2),
            punishmentEnabled: punishmentInput.checked,
            punishmentChannelId: punishmentChannelInput.value || null,
            punishmentSeconds: clampAdventureNumber(punishmentSecondsInput.value, 1, 60, 5),
            randomCropEnabled: randomCropInput.checked,
            randomCropSize: clampAdventureNumber(cropSizeInput.value, 20, 100, 60)
        });
    };
    [bpmPenaltyInput, bpmStepInput, correctPreviewInput, punishmentInput, punishmentChannelInput, punishmentSecondsInput, randomCropInput, cropSizeInput].forEach((input) => input.addEventListener("change", saveQuizSettings));
    settings.append(settingsSummary, bpmPenalty, bpmStep, correctPreview, punishment, punishmentChannel, punishmentSeconds, randomCrop, cropPreset, cropSize);
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
        feedback.textContent = quiz.feedback.correct
            ? `Correct — it was #${quiz.feedback.sourceName}. Keeping the full image visible for ${formatQuizSeconds(quiz.feedback.previewSeconds)}…`
            : `Not quite — it was #${quiz.feedback.sourceName}. Revealing the full image…`;
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
        setRenderedImageSource(image, attachment);
        image.alt = attachment.note || attachment.name || "Random local photo";
        image.style.transform = `scale(${zoom.scale})`;
        image.style.transformOrigin = `${zoom.x}% ${zoom.y}%`;
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
    const previewSeconds = correct ? getChannelQuizSettings().correctRevealSeconds : 1.2;
    quiz.feedback = { correct, sourceName, previewSeconds };
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
    }, Math.round(previewSeconds * 1000));
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
        correctRevealSeconds: 1.2,
        punishmentEnabled: false,
        punishmentChannelId: defaultPunishment,
        punishmentSeconds: 5,
        randomCropEnabled: false,
        randomCropSize: 60,
        ...saved
    };
}

function clampQuizSeconds(value, minimum, maximum, fallback) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.round(Math.min(maximum, Math.max(minimum, parsed)) * 10) / 10;
}

function formatQuizSeconds(value) {
    const seconds = clampQuizSeconds(value, 0.5, 60, 1.2);
    return `${seconds} second${seconds === 1 ? "" : "s"}`;
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
        ["Favorite photos", stats.favorites],
        ["Completed drafts", stats.draftInsights.drafts],
        ["Permanent exhibits", stats.exhibitInsights.exhibits],
        ["Exhibit placements", stats.exhibitInsights.placements]
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
    page.append(intro, metricGrid, reactionSection, channelSection, tagSection, renderImageDraftStats(stats.draftInsights), renderExhibitStats(stats.exhibitInsights), renderReactionTimingStats(stats.reactionInsights));
    els.messages.appendChild(page);
}

function renderImageDraftStats(insights) {
    const section = document.createElement("section");
    section.className = "statsSection imageDraftStats";
    const heading = document.createElement("h3");
    heading.textContent = "Image draft statistics";
    const help = document.createElement("p");
    help.textContent = "Every completed visible or blind draft is recorded locally. Censor-mode results are shown separately without replacing the draft positions.";
    section.append(heading, help);
    if (insights.drafts === 0) {
        section.appendChild(emptyPanel("Complete an Image Draft to begin tracking positions and image averages."));
        return section;
    }
    const overview = document.createElement("div");
    overview.className = "statsInsightGrid";
    [
        ["Drafts", insights.drafts],
        ["Images ranked", insights.placements.length],
        ["Average draft spot", insights.averageSpot.toFixed(1)],
        ["Censor copies", insights.censorCopies]
    ].forEach(([label, value]) => {
        const card = document.createElement("article");
        card.className = "statsInsightMetric";
        const number = document.createElement("strong");
        number.textContent = String(value);
        const caption = document.createElement("span");
        caption.textContent = label;
        card.append(number, caption);
        overview.appendChild(card);
    });
    section.appendChild(overview);
    const repeatImages = insights.images.filter((image) => image.count >= 2)
        .sort((a, b) => a.average - b.average || a.weightedAverage - b.weightedAverage || b.count - a.count);
    const highlight = document.createElement("p");
    highlight.className = "imageDraftCensorStat";
    if (repeatImages.length) {
        const mostRepeated = [...repeatImages].sort((a, b) => b.count - a.count || a.average - b.average)[0];
        const mostConsistent = [...repeatImages].sort((a, b) => a.spread - b.spread || a.average - b.average)[0];
        highlight.textContent = `Repeat contenders: ${repeatImages.length}. Most repeated: ${mostRepeated.label} (${mostRepeated.count} drafts). Most consistent: ${mostConsistent.label} (range #${mostConsistent.spread}).`;
    } else highlight.textContent = "Repeat-image highlights appear after an image has been drafted at least twice.";
    const imageList = document.createElement("section");
    imageList.className = "imageDraftStatsGallery";
    const imageHeading = document.createElement("h4");
    imageHeading.textContent = "Repeat image averages";
    imageList.appendChild(imageHeading);
    repeatImages.slice(0, 24).forEach((image) => {
        const row = document.createElement("article");
        row.className = "imageDraftStatsCard";
        const attachment = findAttachment(image.ref);
        if (attachment) {
            const photo = document.createElement("img");
            setRenderedImageSource(photo, attachment);
            photo.alt = image.label;
            photo.addEventListener("click", () => openImageViewer(attachment, image.label));
            row.appendChild(photo);
        }
        const detail = document.createElement("div");
        const label = document.createElement("strong");
        label.textContent = image.label;
        const stats = document.createElement("span");
        stats.textContent = `# ${image.channelName} · avg #${image.average.toFixed(1)} · weighted #${image.weightedAverage.toFixed(1)} · ${image.count} drafts`;
        const open = document.createElement("button");
        open.type = "button";
        open.textContent = "Open source";
        open.addEventListener("click", () => openView("channel", image.ref.channelId));
        detail.append(label, stats, open);
        row.appendChild(detail);
        imageList.appendChild(row);
    });
    const censor = document.createElement("p");
    censor.className = "imageDraftCensorStat";
    censor.textContent = insights.censorDrafts
        ? `${insights.censorDrafts} censor-mode draft${insights.censorDrafts === 1 ? "" : "s"} · ${insights.censorCopies} saved blurred cop${insights.censorCopies === 1 ? "y" : "ies"} · ${insights.censorRegions} total blur regions.`
        : "No censor-mode drafts completed yet.";
    section.append(highlight, imageList, censor);
    return section;
}

function renderExhibitStats(insights) {
    const section = document.createElement("section");
    section.className = "statsSection exhibitStats";
    const heading = document.createElement("h3");
    heading.textContent = "Museum exhibit statistics";
    const help = document.createElement("p");
    help.textContent = "Tracks permanent exhibit placements and guided-tour stops. Hall of Fame nominations are independent and do not affect these totals.";
    section.append(heading, help);
    if (insights.exhibits === 0) {
        section.appendChild(emptyPanel("No permanent exhibits yet. Add any local photo or GIF to an exhibit from the Museum channel."));
        return section;
    }
    const overview = document.createElement("div");
    overview.className = "statsInsightGrid";
    [
        ["Exhibits", insights.exhibits],
        ["Photo placements", insights.placements],
        ["Unique photos", insights.uniqueImages],
        ["Collections", insights.collections]
    ].forEach(([label, value]) => {
        const card = document.createElement("article");
        card.className = "statsInsightMetric";
        const number = document.createElement("strong");
        number.textContent = String(value);
        const caption = document.createElement("span");
        caption.textContent = label;
        card.append(number, caption);
        overview.appendChild(card);
    });
    const imageList = document.createElement("section");
    imageList.className = "statsTimingList exhibitImageStats";
    const imageHeading = document.createElement("h4");
    imageHeading.textContent = "Most exhibited photos";
    imageList.appendChild(imageHeading);
    insights.images.slice(0, 20).forEach((image) => {
        const row = document.createElement("button");
        row.type = "button";
        const label = document.createElement("strong");
        label.textContent = image.label;
        const detail = document.createElement("span");
        const exhibits = image.appearances.map((appearance) => appearance.exhibitTitle).join(", ");
        detail.textContent = `# ${image.channelName} · ${image.exhibitCount} exhibit${image.exhibitCount === 1 ? "" : "s"} · ${exhibits}`;
        row.append(label, detail);
        row.addEventListener("click", () => openView("channel", image.ref.channelId));
        imageList.appendChild(row);
    });
    const tags = document.createElement("p");
    tags.className = "exhibitStatsFootnote";
    tags.textContent = `${insights.collections} collection${insights.collections === 1 ? "" : "s"} and ${insights.tags} exhibit tag${insights.tags === 1 ? "" : "s"} are in use.`;
    section.append(overview, imageList, tags);
    return section;
}

function renderReactionTimingStats(insights) {
    const section = document.createElement("section");
    section.className = "statsSection statsReactionTiming";
    const heading = document.createElement("h3");
    heading.textContent = "Reaction timing";
    const help = document.createElement("p");
    help.textContent = "Timing is recorded locally whenever you add an emoji reaction. Existing reactions remain in the totals above, but do not have a historical reaction time.";
    section.append(heading, help);

    if (insights.total === 0) {
        section.appendChild(emptyPanel("Timing starts with the next emoji reaction you add."));
        return section;
    }

    const busiestHour = getMostActiveIndex(insights.hours);
    const busiestWeekday = getMostActiveIndex(insights.weekdays);
    const mostUsed = insights.emojis[0];
    const overview = document.createElement("div");
    overview.className = "statsInsightGrid";
    [
        ["Recorded adds", insights.total],
        ["Most active hour", insights.hours[busiestHour] ? formatStatsHour(busiestHour) : "—"],
        ["Most active day", insights.weekdays[busiestWeekday] ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][busiestWeekday] : "—"],
        ["Most added emoji", mostUsed ? `${mostUsed.emoji} · ${mostUsed.total}` : "—"]
    ].forEach(([label, value]) => {
        const card = document.createElement("article");
        card.className = "statsInsightMetric";
        const number = document.createElement("strong");
        number.textContent = String(value);
        const caption = document.createElement("span");
        caption.textContent = label;
        card.append(number, caption);
        overview.appendChild(card);
    });
    section.appendChild(overview);

    const dailyMap = new Map(insights.days);
    const dailyValues = getRecentStatsDays(insights.days, 14).map((day) => ({ label: formatStatsDay(day), value: dailyMap.get(day) || 0, title: `${formatStatsDay(day)} · ${dailyMap.get(day) || 0} reactions` }));
    section.append(
        createStatsBarChart("Daily activity", "The last 14 calendar days", dailyValues),
        createStatsBarChart("Time of day", "When reactions are added on this device", insights.hours.map((value, hour) => ({ label: hour % 3 === 0 ? formatStatsHour(hour) : "", value, title: `${formatStatsHour(hour)} · ${value} reactions` })), "hour"),
        createStatsBarChart("Day of week", "Your local weekday pattern", insights.weekdays.map((value, day) => ({ label: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day], value, title: `${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day]} · ${value} reactions` })), "weekday")
    );

    const emojiSection = document.createElement("section");
    emojiSection.className = "statsTimingList";
    const emojiHeading = document.createElement("h4");
    emojiHeading.textContent = "Emoji timing detail";
    insights.emojis.slice(0, 12).forEach((emoji) => {
        const peakHour = getMostActiveIndex(emoji.hours);
        const topChannel = [...emoji.channels.entries()].sort((a, b) => b[1] - a[1])[0];
        const row = document.createElement("button");
        row.type = "button";
        const icon = document.createElement("strong");
        icon.textContent = emoji.emoji;
        const detail = document.createElement("span");
        const channel = topChannel ? getChannelById(topChannel[0]) : null;
        detail.textContent = `${emoji.total} added · ${emoji.days.size} active days · most often ${formatStatsHour(peakHour)}${channel ? ` · # ${channel.name}` : ""}`;
        const latest = document.createElement("small");
        latest.textContent = `Last added ${formatStatsTime(emoji.latestAt)}`;
        row.append(icon, detail, latest);
        row.addEventListener("click", () => openView("emoji", emoji.emoji));
        emojiSection.appendChild(row);
    });
    section.append(emojiHeading, emojiSection);

    const recentSection = document.createElement("section");
    recentSection.className = "statsTimingList";
    const recentHeading = document.createElement("h4");
    recentHeading.textContent = "Recent reaction activity";
    insights.recent.forEach((event) => {
        const row = document.createElement("button");
        row.type = "button";
        const icon = document.createElement("strong");
        icon.textContent = event.emoji;
        const detail = document.createElement("span");
        detail.textContent = `# ${getChannelById(event.channelId)?.name || "channel"} · ${formatStatsTime(event.at)}`;
        row.append(icon, detail);
        row.addEventListener("click", () => openView("channel", event.channelId));
        recentSection.appendChild(row);
    });
    section.append(recentHeading, recentSection);
    return section;
}

function createStatsBarChart(title, help, values, modifier = "") {
    const chart = document.createElement("section");
    chart.className = `statsBarChart ${modifier}`.trim();
    const heading = document.createElement("h4");
    heading.textContent = title;
    const description = document.createElement("p");
    description.textContent = help;
    const bars = document.createElement("div");
    bars.className = "statsBars";
    const highest = Math.max(1, ...values.map((item) => item.value));
    values.forEach((item) => {
        const bar = document.createElement("div");
        bar.className = "statsBar";
        bar.title = item.title;
        const value = document.createElement("span");
        value.className = "statsBarValue";
        value.textContent = item.value ? String(item.value) : "";
        const fill = document.createElement("span");
        fill.className = "statsBarFill";
        fill.style.height = `${Math.max(item.value ? 8 : 0, (item.value / highest) * 100)}%`;
        const label = document.createElement("small");
        label.textContent = item.label;
        bar.append(value, fill, label);
        bars.appendChild(bar);
    });
    chart.append(heading, description, bars);
    return chart;
}

function getMostActiveIndex(values) {
    return values.reduce((best, value, index) => value > values[best] ? index : best, 0);
}

function getRecentStatsDays(days, count) {
    const latest = days.length ? new Date(`${days[days.length - 1][0]}T12:00:00`) : new Date();
    return Array.from({ length: count }, (_, index) => {
        const date = new Date(latest);
        date.setDate(date.getDate() - (count - index - 1));
        return formatLocalDayKey(date);
    });
}

function renderSettingsPage() {
    const server = getActiveServer();
    const page = document.createElement("section");
    page.className = "settingsPage";

    const build = document.createElement("p");
    build.className = "settingsBuildVersion";
    build.textContent = `Build ${APP_BUILD_VERSION} · local-only`;
    page.appendChild(build);

    const intro = document.createElement("div");
    intro.className = "settingsIntro";
    intro.innerHTML = `<h3>${escapeHTML(server?.name || "Workspace")}</h3><p>Organize channels under categories. Everything is saved in this browser on this device.</p>`;
    page.appendChild(intro);
    page.appendChild(renderAppearanceSettings());

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

function renderAppearanceSettings() {
    const section = document.createElement("section");
    section.className = "settingsCategory appearanceSettings";
    section.innerHTML = "<h4>Appearance</h4><p>Classic keeps the current layout. Streamlined is a mobile-first navigation layout with a dedicated Tools hub. Both use the same local data and features.</p>";

    const mode = document.createElement("label");
    mode.className = "appearanceField";
    const modeLabel = document.createElement("span");
    modeLabel.textContent = "Interface";
    const modeSelect = document.createElement("select");
    [["classic", "Classic (current layout)"], ["streamlined", "Streamlined mobile layout"]].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        option.selected = value === getInterfaceMode();
        modeSelect.appendChild(option);
    });
    modeSelect.addEventListener("change", () => saveInterfaceMode(modeSelect.value));
    mode.append(modeLabel, modeSelect);

    const palette = document.createElement("label");
    palette.className = "appearanceField";
    const paletteLabel = document.createElement("span");
    paletteLabel.textContent = "Color palette";
    const paletteSelect = document.createElement("select");
    [["discord", "Discord dark"], ["midnight", "Midnight blue"], ["violet", "Lavender dusk"], ["forest", "Forest"], ["sunset", "Sunset"]].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        option.selected = value === getColorPalette();
        paletteSelect.appendChild(option);
    });
    paletteSelect.addEventListener("change", () => saveColorPalette(paletteSelect.value));
    palette.append(paletteLabel, paletteSelect);

    section.append(mode, palette);
    return section;
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
    const messages = [];
    for (const { channelId, messages: channelMessages } of entries) {
        const copiedMessages = [];
        for (const message of channelMessages) {
            const attachments = [];
            for (const attachment of (message.attachments || [])) attachments.push(await attachmentToBackup(attachment));
            copiedMessages.push({ ...message, attachments });
        }
        messages.push({ channelId, messages: copiedMessages });
    }
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
            state.adventureEditorStage = "scenes";
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
        edit.addEventListener("click", () => {
            state.adventureEditorStage = "setup";
            state.streamlinedAdventureSceneId = null;
            state.focusAdventureSceneId = null;
            openView("adventureEditor", adventure.id);
        });
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

    if (getInterfaceMode() === "streamlined") {
        renderStreamlinedAdventureEditor(adventureId);
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

function renderStreamlinedAdventureEditor(adventureId) {
    const adventure = getAdventure(adventureId);
    if (!adventure) {
        els.messages.appendChild(emptyPanel("Adventure not found."));
        return;
    }
    if (!["setup", "scenes", "test"].includes(state.adventureEditorStage)) state.adventureEditorStage = "setup";

    const page = document.createElement("section");
    page.className = "streamlinedAdventureEditor";
    const header = document.createElement("header");
    header.className = "streamlinedAdventureHeader";
    const headerText = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.textContent = "ADVENTURE BUILDER";
    const heading = document.createElement("h3");
    heading.textContent = adventure.title || "Untitled adventure";
    const description = document.createElement("span");
    description.textContent = adventure.description || "A private story made from your local media.";
    headerText.append(eyebrow, heading, description);
    const leave = document.createElement("button");
    leave.type = "button";
    leave.className = "streamlinedAdventureBack";
    leave.textContent = "All adventures";
    leave.addEventListener("click", () => openView("adventureStudio", "studio"));
    header.append(headerText, leave);

    const stage = state.adventureEditorStage;
    const stages = document.createElement("nav");
    stages.className = "streamlinedAdventureStages";
    [["setup", "1", "Basics"], ["scenes", "2", "Scenes"], ["test", "3", "Review"]].forEach(([id, number, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = id === stage ? "active" : "";
        button.setAttribute("aria-current", id === stage ? "step" : "false");
        button.innerHTML = `<span>${number}</span>${escapeHTML(label)}`;
        button.addEventListener("click", () => {
            state.adventureEditorStage = id;
            if (id !== "scenes") state.streamlinedAdventureSceneId = null;
            renderMessages();
        });
        stages.appendChild(button);
    });
    page.append(header, stages);

    if (stage === "setup") page.appendChild(renderStreamlinedAdventureBasics(adventure));
    if (stage === "scenes") {
        const scene = adventure.scenes.find((item) => item.id === state.streamlinedAdventureSceneId)
            || adventure.scenes.find((item) => item.id === state.focusAdventureSceneId);
        if (scene) {
            state.streamlinedAdventureSceneId = scene.id;
            state.focusAdventureSceneId = null;
            page.appendChild(renderStreamlinedAdventureSceneEditor(adventure, scene));
        } else {
            page.appendChild(renderStreamlinedAdventureSceneList(adventure));
        }
    }
    if (stage === "test") page.appendChild(renderStreamlinedAdventureReview(adventure));
    els.messages.appendChild(page);
}

function renderStreamlinedAdventureBasics(adventure) {
    const panel = document.createElement("section");
    panel.className = "streamlinedAdventurePanel streamlinedAdventureBasics";
    const heading = document.createElement("h4");
    heading.textContent = "Start with the essentials";
    const help = document.createElement("p");
    help.textContent = "Name the adventure, choose its opening scene, then build one scene at a time.";
    const status = document.createElement("output");
    status.className = "streamlinedAdventureSave";
    status.textContent = "Saved locally";
    const title = document.createElement("input");
    title.type = "text";
    title.value = adventure.title || "";
    title.placeholder = "Adventure title";
    const description = document.createElement("textarea");
    description.rows = 3;
    description.value = adventure.description || "";
    description.placeholder = "What is this adventure about? (optional)";
    const start = adventureTargetSelect(adventure, "__start__", adventure.startSceneId || adventure.scenes[0]?.id, "Opening scene");
    start.select.querySelector('option[value=""]').remove();
    const metronome = document.createElement("label");
    metronome.className = "streamlinedAdventureToggle";
    const metronomeInput = document.createElement("input");
    metronomeInput.type = "checkbox";
    metronomeInput.checked = adventure.metronomeEnabled !== false;
    metronome.append(metronomeInput, " Include metronome controls while playing");
    const bpm = numericField("Metronome BPM", adventure.metronomeBpm || state.structure.settings.metronomeBpm || 120);
    bpm.input.min = "20";
    bpm.input.max = "300";
    const progress = document.createElement("label");
    progress.className = "streamlinedAdventureToggle";
    const progressInput = document.createElement("input");
    progressInput.type = "checkbox";
    progressInput.checked = adventure.showProgress !== false;
    progress.append(progressInput, " Show progress while playing");
    const update = () => {
        adventure.title = normalizeDisplayName(title.value) || "Untitled adventure";
        adventure.description = description.value;
        adventure.startSceneId = start.select.value || adventure.scenes[0]?.id;
        adventure.metronomeEnabled = metronomeInput.checked;
        adventure.metronomeBpm = clampAdventureNumber(bpm.input.value, 20, 300, 120);
        adventure.showProgress = progressInput.checked;
        queueAdventureAutosave(status);
    };
    [title, description, bpm.input].forEach((input) => input.addEventListener("input", update));
    [start.select, metronomeInput, progressInput].forEach((input) => input.addEventListener("change", update));
    const next = document.createElement("button");
    next.type = "button";
    next.className = "adventurePrimary";
    next.textContent = "Continue to scenes";
    next.addEventListener("click", async () => {
        update();
        await saveAdventures();
        state.adventureEditorStage = "scenes";
        renderMessages();
    });
    const optional = document.createElement("details");
    optional.className = "streamlinedAdventureDetails";
    const optionalSummary = document.createElement("summary");
    optionalSummary.textContent = "Optional gameplay settings";
    const stats = document.createElement("label");
    stats.className = "streamlinedAdventureToggle";
    const statsInput = document.createElement("input");
    statsInput.type = "checkbox";
    statsInput.checked = Boolean(adventure.showStats);
    stats.append(statsInput, " Show stats while playing (off by default)");
    const variables = document.createElement("label");
    variables.className = "streamlinedAdventureToggle";
    const variablesInput = document.createElement("input");
    variablesInput.type = "checkbox";
    variablesInput.checked = Boolean(adventure.enableVariables);
    variables.append(variablesInput, " Enable stats and variables for this adventure");
    const inventory = document.createElement("label");
    inventory.className = "streamlinedAdventureToggle";
    const inventoryInput = document.createElement("input");
    inventoryInput.type = "checkbox";
    inventoryInput.checked = Boolean(adventure.enableInventory);
    inventory.append(inventoryInput, " Enable a simple inventory");
    [statsInput, variablesInput, inventoryInput].forEach((input) => input.addEventListener("change", () => {
        adventure.showStats = statsInput.checked;
        adventure.enableVariables = variablesInput.checked;
        adventure.enableInventory = inventoryInput.checked;
        queueAdventureAutosave(status);
    }));
    optional.append(optionalSummary, stats, variables, inventory);
    panel.append(heading, help, title, description, start.label, metronome, bpm.label, progress, optional, status, next);
    return panel;
}

function renderStreamlinedAdventureSceneList(adventure) {
    const panel = document.createElement("section");
    panel.className = "streamlinedAdventurePanel streamlinedSceneList";
    const heading = document.createElement("div");
    heading.className = "streamlinedSceneListHeading";
    const headingText = document.createElement("div");
    const title = document.createElement("h4");
    title.textContent = "Your scenes";
    const help = document.createElement("p");
    help.textContent = "Tap one scene to edit it. You only work on one scene at a time.";
    headingText.append(title, help);
    const add = document.createElement("button");
    add.type = "button";
    add.className = "adventurePrimary";
    add.textContent = "Add scene";
    add.addEventListener("click", async () => {
        const scene = {
            id: crypto.randomUUID(),
            title: `Scene ${adventure.scenes.length + 1}`,
            text: "",
            isEnding: false,
            mediaRefs: [],
            choices: []
        };
        adventure.scenes.push(scene);
        await saveAdventures();
        state.streamlinedAdventureSceneId = scene.id;
        renderMessages();
    });
    heading.append(headingText, add);
    panel.appendChild(heading);

    adventure.scenes.forEach((scene, index) => {
        const card = document.createElement("article");
        card.className = "streamlinedSceneCard";
        const meta = document.createElement("div");
        meta.className = "streamlinedSceneMeta";
        const number = document.createElement("span");
        number.textContent = `SCENE ${index + 1}`;
        if (scene.id === (adventure.startSceneId || adventure.scenes[0]?.id)) {
            const start = document.createElement("span");
            start.textContent = "START";
            meta.appendChild(start);
        }
        meta.prepend(number);
        const name = document.createElement("h5");
        name.textContent = scene.title || "Untitled scene";
        const summary = document.createElement("p");
        summary.textContent = streamlinedSceneSummary(scene);
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "streamlinedSceneEdit";
        edit.textContent = "Edit scene";
        edit.addEventListener("click", () => {
            state.streamlinedAdventureSceneId = scene.id;
            renderMessages();
        });
        const more = document.createElement("details");
        more.className = "streamlinedSceneMore";
        const moreSummary = document.createElement("summary");
        moreSummary.textContent = "More";
        const tools = document.createElement("div");
        tools.className = "streamlinedSceneMoreActions";
        const up = document.createElement("button");
        up.type = "button";
        up.textContent = "Move earlier";
        up.disabled = index === 0;
        up.addEventListener("click", () => moveAdventureScene(adventure.id, scene.id, -1));
        const down = document.createElement("button");
        down.type = "button";
        down.textContent = "Move later";
        down.disabled = index === adventure.scenes.length - 1;
        down.addEventListener("click", () => moveAdventureScene(adventure.id, scene.id, 1));
        const duplicate = document.createElement("button");
        duplicate.type = "button";
        duplicate.textContent = "Duplicate";
        duplicate.addEventListener("click", () => duplicateAdventureScene(adventure.id, scene.id));
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "dangerAction";
        remove.textContent = "Delete";
        remove.disabled = adventure.scenes.length <= 1;
        remove.addEventListener("click", () => deleteAdventureScene(adventure.id, scene.id));
        tools.append(up, down, duplicate, remove);
        more.append(moreSummary, tools);
        card.append(meta, name, summary, edit, more);
        panel.appendChild(card);
    });
    return panel;
}

function streamlinedSceneSummary(scene) {
    const items = [];
    if (scene.isEnding) items.push("Ends the story");
    else if (scene.randomEvent) items.push(streamlinedEventName(scene.randomEvent));
    else items.push(`${(scene.choices || []).length} ${(scene.choices || []).length === 1 ? "path" : "paths"}`);
    if ((scene.mediaRefs || []).length) items.push(`${scene.mediaRefs.length} ${(scene.mediaRefs || []).length === 1 ? "media item" : "media items"}`);
    return items.join(" · ");
}

function streamlinedEventName(event) {
    return {
        dice: "Dice challenge",
        weighted: "Random path",
        wheel: "Spinning wheel",
        timer: "Timer challenge",
        image: "Random image",
        quiz: String(event.mode || "").startsWith("random-source") ? "Channel quiz" : "Quiz"
    }[event?.type] || "Game element";
}

function renderStreamlinedAdventureSceneEditor(adventure, scene) {
    const panel = document.createElement("section");
    panel.className = "streamlinedAdventurePanel streamlinedSceneEditor";
    const index = adventure.scenes.findIndex((item) => item.id === scene.id);
    const back = document.createElement("button");
    back.type = "button";
    back.className = "streamlinedSceneBack";
    back.textContent = "← All scenes";
    back.addEventListener("click", () => {
        state.streamlinedAdventureSceneId = null;
        renderMessages();
    });
    const heading = document.createElement("h4");
    heading.textContent = `Scene ${index + 1}`;
    const help = document.createElement("p");
    help.textContent = "Choose a simple starting pattern, then write the scene and set what happens next.";
    const status = document.createElement("output");
    status.className = "streamlinedAdventureSave";
    status.textContent = "Saved locally";
    panel.append(back, heading, help);

    const patterns = document.createElement("section");
    patterns.className = "streamlinedScenePatterns";
    const patternTitle = document.createElement("strong");
    patternTitle.textContent = "1. Choose a scene type";
    const patternHelp = document.createElement("span");
    patternHelp.textContent = "This only changes this scene. Your photos stay in their original channels.";
    const buttons = document.createElement("div");
    buttons.className = "streamlinedPatternButtons";
    const applyStory = async () => {
        scene.isEnding = false;
        scene.randomEvent = null;
        scene.choices = (scene.choices || []).length ? scene.choices : [{ id: crypto.randomUUID(), label: "Continue", targetSceneId: null }];
        scene.text ||= "Write what happens here.";
        await saveAdventures();
        renderMessages();
    };
    [
        ["Story", "Text and a path", applyStory],
        ["Decision", "Two player choices", () => applyAdventureSceneTemplate(adventure.id, scene.id, "twoPath")],
        ["Image / GIF", "Add local media", () => applyAdventureSceneTemplate(adventure.id, scene.id, "imageScene")],
        ["Ending", "Finish the story", () => applyAdventureSceneTemplate(adventure.id, scene.id, "ending")]
    ].forEach(([label, note, action]) => {
        const button = document.createElement("button");
        button.type = "button";
        const strong = document.createElement("strong");
        strong.textContent = label;
        const span = document.createElement("span");
        span.textContent = note;
        button.append(strong, span);
        button.addEventListener("click", action);
        buttons.appendChild(button);
    });
    patterns.append(patternTitle, patternHelp, buttons);
    const challenges = document.createElement("details");
    challenges.className = "streamlinedAdventureDetails streamlinedChallengeChoices";
    const challengeSummary = document.createElement("summary");
    challengeSummary.textContent = scene.randomEvent ? `Challenge: ${streamlinedEventName(scene.randomEvent)}` : "Optional: add a game element";
    const challengeHelp = document.createElement("p");
    challengeHelp.textContent = "Use one only when the scene needs chance, a timer, a random image, or a quiz.";
    const challengeButtons = document.createElement("div");
    challengeButtons.className = "streamlinedChallengeButtons";
    [["Dice", "dice"], ["Wheel", "wheel"], ["Timer", "timer"], ["Random image", "randomImage"], ["Channel quiz", "randomChannelQuiz"]].forEach(([label, template]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", () => applyAdventureSceneTemplate(adventure.id, scene.id, template));
        challengeButtons.appendChild(button);
    });
    challenges.append(challengeSummary, challengeHelp, challengeButtons);
    patterns.appendChild(challenges);
    const savedComponents = state.structure.settings.adventureComponents || [];
    if (savedComponents.length) {
        const saved = document.createElement("details");
        saved.className = "streamlinedAdventureDetails";
        const savedSummary = document.createElement("summary");
        savedSummary.textContent = "Use one of your saved scene templates";
        const select = document.createElement("select");
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Choose a saved template…";
        select.appendChild(placeholder);
        savedComponents.forEach((component) => {
            const option = document.createElement("option");
            option.value = component.id;
            option.textContent = component.name;
            select.appendChild(option);
        });
        select.addEventListener("change", () => {
            if (select.value) applyAdventureSceneTemplate(adventure.id, scene.id, `component:${select.value}`);
        });
        saved.append(savedSummary, select);
        patterns.appendChild(saved);
    }
    panel.appendChild(patterns);

    const content = document.createElement("section");
    content.className = "streamlinedSceneContent";
    const contentTitle = document.createElement("strong");
    contentTitle.textContent = "2. Write this scene";
    const title = document.createElement("input");
    title.type = "text";
    title.value = scene.title || "";
    title.placeholder = "Scene title";
    const text = document.createElement("textarea");
    text.rows = 5;
    text.value = scene.text || "";
    text.placeholder = "Story text or instructions";
    const updateDraft = () => {
        scene.title = normalizeDisplayName(title.value) || "Untitled scene";
        scene.text = text.value;
        queueAdventureAutosave(status);
    };
    title.addEventListener("input", updateDraft);
    text.addEventListener("input", updateDraft);
    content.append(contentTitle, title, text);
    panel.appendChild(content);

    const media = document.createElement("section");
    media.className = "streamlinedSceneMedia";
    const mediaHeading = document.createElement("div");
    const mediaTitle = document.createElement("strong");
    mediaTitle.textContent = `3. Local media (${(scene.mediaRefs || []).length})`;
    const mediaHelp = document.createElement("span");
    mediaHelp.textContent = "Optional — select from a channel, gallery, or this device.";
    mediaHeading.append(mediaTitle, mediaHelp);
    const mediaList = document.createElement("div");
    mediaList.className = "adventureMediaList streamlinedAdventureMediaList";
    (scene.mediaRefs || []).forEach((ref) => {
        const item = renderAdventureMedia(adventure.id, scene.id, ref);
        const caption = document.createElement("input");
        caption.type = "text";
        caption.placeholder = "Caption (optional)";
        caption.value = scene.mediaCaptions?.[photoRefKey(ref)] || "";
        caption.addEventListener("input", () => {
            scene.mediaCaptions ||= {};
            scene.mediaCaptions[photoRefKey(ref)] = caption.value;
            queueAdventureAutosave(status);
        });
        item.appendChild(caption);
        mediaList.appendChild(item);
    });
    const addMedia = document.createElement("button");
    addMedia.type = "button";
    addMedia.textContent = "Add image or GIF";
    addMedia.addEventListener("click", () => pickAdventureMedia(adventure.id, scene.id));
    media.append(mediaHeading, mediaList, addMedia);
    panel.appendChild(media);

    let randomEditor = null;
    if (scene.randomEvent) {
        const eventPanel = document.createElement("details");
        eventPanel.className = "streamlinedAdventureDetails streamlinedEventSettings";
        const eventSummary = document.createElement("summary");
        eventSummary.textContent = `Configure ${streamlinedEventName(scene.randomEvent).toLowerCase()}`;
        const eventHelp = document.createElement("p");
        eventHelp.textContent = "Set destinations and options for this one game element.";
        randomEditor = renderAdventureRandomEditor(adventure, scene);
        eventPanel.append(eventSummary, eventHelp, randomEditor.element);
        panel.appendChild(eventPanel);
    } else if (!scene.isEnding) {
        panel.appendChild(renderStreamlinedAdventureChoices(adventure, scene, status));
    } else {
        const ending = document.createElement("p");
        ending.className = "streamlinedEndingNotice";
        ending.textContent = "This scene ends the adventure. Choose Story or Decision above if it should continue instead.";
        panel.appendChild(ending);
    }

    const optional = document.createElement("details");
    optional.className = "streamlinedAdventureDetails";
    const optionalSummary = document.createElement("summary");
    optionalSummary.textContent = "Optional scene controls";
    const ready = document.createElement("label");
    ready.className = "streamlinedAdventureToggle";
    const readyInput = document.createElement("input");
    readyInput.type = "checkbox";
    readyInput.checked = Boolean(scene.requireReady);
    ready.append(readyInput, " Require “Continue when ready”");
    const sceneBpm = numericField("Scene metronome BPM (blank uses adventure BPM)", scene.ambience?.metronomeBpm || "");
    sceneBpm.input.placeholder = "Optional";
    const saveOptional = () => {
        scene.requireReady = readyInput.checked;
        const bpmValue = Number.parseInt(sceneBpm.input.value, 10);
        scene.ambience = { ...(scene.ambience || {}), metronomeBpm: bpmValue ? clampAdventureNumber(bpmValue, 20, 300, 120) : null };
        queueAdventureAutosave(status);
    };
    readyInput.addEventListener("change", saveOptional);
    sceneBpm.input.addEventListener("input", saveOptional);
    optional.append(optionalSummary, ready, sceneBpm.label);
    panel.appendChild(optional);

    const actions = document.createElement("div");
    actions.className = "streamlinedSceneActions";
    const save = document.createElement("button");
    save.type = "button";
    save.className = "adventurePrimary";
    save.textContent = "Save changes";
    const saveScene = async () => {
        updateDraft();
        saveOptional();
        if (randomEditor) randomEditor.save();
        await saveAdventures();
        status.textContent = "Saved locally";
    };
    save.addEventListener("click", saveScene);
    const test = document.createElement("button");
    test.type = "button";
    test.textContent = "Test from here";
    test.addEventListener("click", async () => {
        await saveScene();
        startAdventureTest(adventure.id, scene.id);
    });
    const finish = document.createElement("button");
    finish.type = "button";
    finish.textContent = "Done with scene";
    finish.addEventListener("click", async () => {
        await saveScene();
        state.streamlinedAdventureSceneId = null;
        renderMessages();
    });
    actions.append(save, test, finish);
    panel.append(status, actions);
    return panel;
}

function renderStreamlinedAdventureChoices(adventure, scene, status) {
    const section = document.createElement("section");
    section.className = "streamlinedSceneChoices";
    const heading = document.createElement("strong");
    heading.textContent = "4. What can the player do next?";
    const help = document.createElement("p");
    help.textContent = "Add a button for each path. It can lead to another scene or end the story.";
    const rows = document.createElement("div");
    rows.className = "streamlinedChoiceRows";
    const addRow = (choice) => {
        const row = document.createElement("div");
        row.className = "streamlinedChoiceRow";
        const label = document.createElement("input");
        label.type = "text";
        label.value = choice.label || "";
        label.placeholder = "Button text, for example: Open the door";
        const target = adventureTargetSelect(adventure, scene.id, choice.targetSceneId, "Next scene").select;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => {
            scene.choices = (scene.choices || []).filter((item) => item.id !== choice.id);
            queueAdventureAutosave(status);
            row.remove();
        });
        label.addEventListener("input", () => {
            choice.label = label.value;
            queueAdventureAutosave(status);
        });
        target.addEventListener("change", () => {
            choice.targetSceneId = target.value || null;
            queueAdventureAutosave(status);
        });
        row.append(label, target, remove);
        rows.appendChild(row);
    };
    (scene.choices || []).forEach(addRow);
    const add = document.createElement("button");
    add.type = "button";
    add.textContent = "Add a path";
    add.addEventListener("click", () => {
        const choice = { id: crypto.randomUUID(), label: "", targetSceneId: null };
        scene.choices = [...(scene.choices || []), choice];
        queueAdventureAutosave(status);
        addRow(choice);
        rows.lastElementChild?.querySelector("input")?.focus();
    });
    section.append(heading, help, rows, add);
    return section;
}

function renderStreamlinedAdventureReview(adventure) {
    const panel = document.createElement("section");
    panel.className = "streamlinedAdventurePanel streamlinedAdventureReview";
    const heading = document.createElement("h4");
    heading.textContent = "Ready to try it?";
    const help = document.createElement("p");
    help.textContent = "Review any incomplete paths, look at the scene map, or play a private test run.";
    const actions = document.createElement("div");
    actions.className = "streamlinedSceneActions";
    const test = document.createElement("button");
    test.type = "button";
    test.className = "adventurePrimary";
    test.textContent = "Play adventure";
    test.addEventListener("click", () => startAdventurePlay(adventure.id));
    const map = document.createElement("button");
    map.type = "button";
    map.textContent = "View scene map";
    map.addEventListener("click", () => openView("adventureMap", adventure.id));
    const scenes = document.createElement("button");
    scenes.type = "button";
    scenes.textContent = "Back to scenes";
    scenes.addEventListener("click", () => {
        state.adventureEditorStage = "scenes";
        renderMessages();
    });
    actions.append(test, map, scenes);
    panel.append(heading, help, renderAdventureValidation(adventure), actions);
    return panel;
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
        queueAdventureAutosave();
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
            queueAdventureAutosave();
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
            queueAdventureAutosave();
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
            queueAdventureAutosave();
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
        setRenderedImageSource(image, attachment);
        image.alt = attachment.note || attachment.name || "Adventure media";
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
    setRenderedImageSource(image, attachment);
    image.alt = caption || attachment.note || attachment.name || "Adventure media";
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
    state.adventureEditorStage = "setup";
    state.streamlinedAdventureSceneId = null;
    state.focusAdventureSceneId = null;
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
    await saveChannelMessage(channel.id, message);
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
    } else if (getChannelCategory(sourceChannelId)?.isCensorFolder && message.censoredFrom) {
        const sortButton = document.createElement("button");
        sortButton.className = "iconButton";
        sortButton.type = "button";
        sortButton.textContent = "Sort";
        sortButton.addEventListener("click", () => sortCensoredMessage(message.id, sourceChannelId));
        actions.append(pinButton, reactButton, sortButton, deleteButton);
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
        setRenderedImageSource(image, item.attachment);
        image.alt = item.alt;
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
            setRenderedImageSource(image, attachment);
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
    const channel = getActiveChannel();
    const isGalleryChannel = Boolean(channel?.isDraftRankingsChannel || channel?.isThisOrThatChannel || channel?.isThisOrThatRankingsChannel || channel?.isHolisticRankingsChannel || channel?.isHallOfFameChannel || channel?.isMuseumExhibitsChannel);
    const enabled = state.ready && state.isUnlocked && hasChannel && state.activeView.type === "channel" && !isGalleryChannel;
    const canCompose = enabled && !state.pendingMessageSave;
    els.noteInput.disabled = !canCompose;
    els.sendBtn.disabled = !canCompose;
    els.sendBtn.textContent = state.pendingMessageSave ? "Saving…" : "Send";
    els.attachImageBtn.disabled = !canCompose;
    els.linkPhotosBtn.disabled = !canCompose;
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

function openStreamlinedHub() {
    if (document.querySelector(".streamlinedHub")) return;

    const modal = document.createElement("section");
    modal.className = "streamlinedHub";
    modal.setAttribute("aria-label", "Workspace tools");
    const card = document.createElement("div");
    card.className = "streamlinedHubCard";
    const header = document.createElement("div");
    header.className = "streamlinedHubHeader";
    const heading = document.createElement("div");
    heading.innerHTML = "<p>PRIVATE WORKSPACE</p><h3>Tools & shortcuts</h3>";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "streamlinedHubClose";
    close.textContent = "Close";
    const dismiss = () => modal.remove();
    close.addEventListener("click", dismiss);
    header.append(heading, close);

    const addGroup = (title, actions) => {
        const group = document.createElement("section");
        group.className = "streamlinedHubGroup";
        const label = document.createElement("h4");
        label.textContent = title;
        const grid = document.createElement("div");
        grid.className = "streamlinedHubActions";
        actions.forEach(([labelText, handler, disabled = false]) => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = labelText;
            button.disabled = disabled;
            button.addEventListener("click", () => { dismiss(); handler(); });
            grid.appendChild(button);
        });
        group.append(label, grid);
        return group;
    };

    const isChannel = state.activeView.type === "channel" && Boolean(state.activeChannelId);
    const adventureServer = state.structure.servers.find((server) => server.isAdventureServer);
    const openAdventureStudio = async () => {
        if (!adventureServer) return;
        state.activeServerId = adventureServer.id;
        state.activeChannelId = allChannels(adventureServer)[0]?.id || null;
        await openView("adventureStudio", "studio");
    };

    card.append(
        header,
        addGroup("Browse", [
            ["Random channel", selectRandomChannel],
            ["Random note", selectRandomMessageInAnyChannel],
            ["Random array", createRandomPhotoArray],
            ["Set array size", configureRandomPhotoCount],
            ["Random zoom", () => openView("randomZoom", "random-zoom")],
            ["Favorite photos", () => openView("favorites", "favorites")],
            ["Pinned notes", () => openView("pinned", "pinned")]
        ]),
        addGroup("Create & organize", [
            ["New channel", createChannel],
            ["New folder", createCategory],
            ["Add image", () => els.imageInput.click(), !isChannel],
            ["Workspace settings", openSettings],
            ["Statistics", () => openView("stats", "stats")],
            ["Adventure studio", openAdventureStudio, !adventureServer]
        ]),
        addGroup("Play & focus", [
            ["Channel quiz", () => openView("channelQuiz", "quiz")],
            ["Zoom quiz", () => openView("zoomQuiz", "zoom-quiz")],
            ["Roulette slideshow", () => openView("rouletteSlideshow", "roulette-slideshow")],
            ["Image draft", () => openView("imageDraft", "image-draft")],
            ["Focus session", () => openView("focusSession", "focus")],
            [countdownTimer ? "Pause timer" : "Start timer", () => els.chatTimerQuick.click()],
            [metronomeTimer ? "Stop metronome" : "Start metronome", toggleMetronome]
        ])
    );
    modal.addEventListener("click", (event) => { if (event.target === modal) dismiss(); });
    modal.appendChild(card);
    document.body.appendChild(modal);
}

function configureRandomPhotoCount() {
    const current = Number.parseInt(els.randomPhotoCount.value, 10) || 9;
    const next = Number.parseInt(prompt("How many photos should a random array contain?", current), 10);
    if (!Number.isFinite(next)) return;
    els.randomPhotoCount.value = Math.min(500, Math.max(1, next));
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
        || state.pendingMessageSave
    ) {
        return;
    }

    const channelId = state.activeChannelId;
    const previousMessages = [...getActiveMessages()];
    const previousMessageCount = state.channelMessageCounts.get(channelId) ?? previousMessages.length;
    const attachments = [...state.draftAttachments];
    const linkedPhotoRefs = [...state.draftLinkedPhotoRefs];
    const newMessage = createMessage(text, attachments, linkedPhotoRefs);
    const messages = [...previousMessages, newMessage];
    state.messagesByChannel.set(channelId, messages);
    state.channelMessageCounts.set(channelId, previousMessageCount + 1);
    state.draftAttachments = [];
    state.draftLinkedPhotoRefs = [];
    state.visibleMessageLimit = 100;
    state.pendingMessageSave = true;
    state.lastSaveError = "";
    els.noteInput.value = "";
    render();

    try {
        await saveChannelMessage(channelId, newMessage);
        state.pendingMessageSave = false;
        if (state.activeChannelId === channelId) els.messages.scrollTop = els.messages.scrollHeight;
        refreshStorageEstimate();
    } catch (error) {
        console.error("Could not save local message:", error);
        state.messagesByChannel.set(channelId, previousMessages);
        state.channelMessageCounts.set(channelId, previousMessageCount);
        state.draftAttachments = attachments;
        state.draftLinkedPhotoRefs = linkedPhotoRefs;
        if (state.activeChannelId === channelId) els.noteInput.value = text;
        state.pendingMessageSave = false;
        state.lastSaveError = "Could not save this note locally. Free browser space and try again.";
        alert(state.lastSaveError);
    }
    render();
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
    ensureDraftGalleryFolder();
    ensureMuseumFolder();
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

    await saveChannelMessage(channelId, messages.find((message) => message.id === messageId));
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
            reactions: newReactions,
            // Old reactions have no reliable timestamp. From this point on,
            // every time an emoji is added is recorded for local statistics.
            reactionEvents: has
                ? (message.reactionEvents || [])
                : [...(message.reactionEvents || []), { emoji, at: new Date().toISOString(), messageId: message.id }]
        };
    });

    state.messagesByChannel.set(channelId, messages);
    await saveChannelMessage(channelId, messages.find((message) => message.id === messageId));
    render();
}

async function deleteMessage(messageId, channelId = state.activeChannelId) {
    const confirmed = confirm("Delete this note?");
    if (!confirmed) return;

    const messages = (state.messagesByChannel.get(channelId) || []).filter((message) => message.id !== messageId);

    state.messagesByChannel.set(channelId, messages);
    state.channelMessageCounts.set(channelId, Math.max(0, (state.channelMessageCounts.get(channelId) ?? messages.length + 1) - 1));
    render();

    await deleteChannelMessage(channelId, messageId);
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
    await saveChannelMessage(channelId, updated.find((message) => message.id === messageId));
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
    await deleteChannelMessage(inboxChannelId, messageId);
    await saveChannelMessage(destination.id, message);
    render();
}

async function sortCensoredMessage(messageId, sourceChannelId) {
    const category = getChannelCategory(sourceChannelId);
    const server = getChannelServer(sourceChannelId);
    if (!category?.isCensorFolder || !server) return;
    const available = category.channels.filter((channel) => channel.id !== sourceChannelId);
    const answer = prompt(`Move censored copy to a channel in Censoring.\n${available.map((channel, index) => `${index + 1}. #${channel.name}`).join("\n")}\n\nChoose a number, or type a new channel name.`);
    if (!answer?.trim()) return;
    const index = Number.parseInt(answer, 10) - 1;
    let destination = available[index];
    if (!destination) {
        const name = normalizeChannelName(answer);
        if (!name) return;
        destination = category.channels.find((channel) => normalizeChannelName(channel.name) === name);
        if (!destination) {
            destination = { id: uniqueId("channel", name), name };
            category.channels.push(destination);
            await saveStructure(state.structure);
        }
    }
    const sourceMessages = state.messagesByChannel.get(sourceChannelId) || [];
    const message = sourceMessages.find((item) => item.id === messageId);
    if (!message) return;
    const destinationMessages = state.messagesByChannel.get(destination.id) || normalizeMessages(await getChannelMessages(destination.id));
    state.messagesByChannel.set(sourceChannelId, sourceMessages.filter((item) => item.id !== messageId));
    state.messagesByChannel.set(destination.id, [...destinationMessages, message]);
    await deleteChannelMessage(sourceChannelId, messageId);
    await saveChannelMessage(destination.id, message);
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

    const newMessages = state.randomPhotoArray.map((item) => createMessage(item.message.text, [item.attachment]));
    const messages = [
        ...state.messagesByChannel.get(channel.id),
        ...newMessages
    ];
    state.messagesByChannel.set(channel.id, messages);
    state.channelMessageCounts.set(channel.id, (state.channelMessageCounts.get(channel.id) ?? messages.length - newMessages.length) + newMessages.length);
    for (const message of newMessages) await saveChannelMessage(channel.id, message);
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
    applyAppearanceSettings();
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

function getInterfaceMode() {
    return state.structure.settings.interfaceMode === "streamlined" ? "streamlined" : "classic";
}

function getColorPalette() {
    return ["discord", "midnight", "violet", "forest", "sunset"].includes(state.structure.settings.colorPalette)
        ? state.structure.settings.colorPalette
        : "discord";
}

function applyAppearanceSettings() {
    document.body.classList.toggle("interface-streamlined", getInterfaceMode() === "streamlined");
    document.body.dataset.palette = getColorPalette();
}

async function saveInterfaceMode(mode) {
    state.structure.settings.interfaceMode = mode === "streamlined" ? "streamlined" : "classic";
    applyAppearanceSettings();
    await saveStructure(state.structure);
    render();
}

async function saveColorPalette(palette) {
    state.structure.settings.colorPalette = ["discord", "midnight", "violet", "forest", "sunset"].includes(palette)
        ? palette
        : "discord";
    applyAppearanceSettings();
    await saveStructure(state.structure);
    render();
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
    const settings = getMetronomeSettings();
    els.metronomeBpm.value = settings.bpm;
    // Any tool that starts a beat (drafts, slideshows, adventures, or the timer)
    // now leaves the same BPM behind for every workspace tab.
    if (state.structure.settings.metronomeBpm !== settings.bpm) {
        state.structure.settings.metronomeBpm = settings.bpm;
        void saveStructure(state.structure).catch(() => {});
    }
    const period = 60000 / settings.bpm;
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
        reactionEvents: [],
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
    const selected = files.filter((file) => file.type.startsWith("image/")).slice(0, MAX_LOCAL_IMAGES_PER_SEND);
    const accepted = selected.filter((file) => file.size <= MAX_LOCAL_IMAGE_BYTES);
    if (accepted.length === 0) {
        alert("Choose up to 12 images or GIFs under 25 MB each. Large files can crash a mobile browser before they can be saved.");
        return;
    }
    if (accepted.length < files.length) {
        alert("Some files were skipped. A single send supports up to 12 images or GIFs under 25 MB each.");
    }
    if (!(await hasSpaceForLocalFiles(accepted))) return;
    const attachments = accepted.map(fileToAttachment);

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

function releaseRenderedObjectUrls() {
    state.renderObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    state.renderObjectUrls.clear();
}

function setRenderedImageSource(image, attachment) {
    const objectUrl = attachment.blob ? URL.createObjectURL(attachment.blob) : "";
    image.src = objectUrl || attachment.dataUrl || "";
    if (!objectUrl) return;

    state.renderObjectUrls.add(objectUrl);
    // Keep the object URL alive for the lifetime of this render. Revoking it
    // immediately after `load` is usually fine on desktop, but iOS can later
    // discard the decoded frame and leave a previously visible local image
    // blank. `releaseRenderedObjectUrls` frees these on the next render.
    const release = () => {
        if (!state.renderObjectUrls.delete(objectUrl)) return;
        URL.revokeObjectURL(objectUrl);
    };
    image.addEventListener("error", release, { once: true });
}

async function hasSpaceForLocalFiles(files) {
    if (!navigator.storage?.estimate) return true;
    try {
        const estimate = await navigator.storage.estimate();
        const required = files.reduce((total, file) => total + file.size, 0);
        if (estimate.quota && (estimate.usage || 0) + required > estimate.quota * 0.9) {
            alert("This upload is close to your browser's local storage limit. Export a backup or free browser storage before adding it.");
            return false;
        }
    } catch {
        // Storage estimates are optional; IndexedDB will still report any real save failure.
    }
    return true;
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
    try {
        const estimate = await navigator.storage.estimate();
        const used = formatBytes(estimate.usage || 0);
        const quota = formatBytes(estimate.quota || 0);
        state.storageText = `Storage: ${used} used of ${quota} available on this device`;
    } catch {
        state.storageText = "Storage: estimate unavailable; saves still stay on this device";
    }
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
