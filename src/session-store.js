export class SessionStore {
  constructor() {
    this.sessions = new Map();
  }

  get(chatId) {
    if (!this.sessions.has(chatId)) {
      this.sessions.set(chatId, createDefaultSession());
    }
    return this.sessions.get(chatId);
  }

  reset(chatId) {
    const session = createDefaultSession();
    this.sessions.set(chatId, session);
    return session;
  }
}

function createDefaultSession() {
  return {
    mode: "awaiting_doc",
    isBusy: false,
    doc: null,
    providedSiteUrl: "",
    referenceImageSignals: null,
    styleProfile: null,
    headers: [],
    currentIndex: 0,
    feedback: "",
    currentRenderPath: "",
    reviewToken: 0,
    recentHeroHistory: [],
    headerConcepts: {},
    pendingFeedbackIndex: null,
    bannerStates: {},
    generationQueue: [],
    activeGenerations: 0,
    completionAnnounced: false
  };
}
