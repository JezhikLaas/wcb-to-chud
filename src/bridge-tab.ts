import { MODULE_ID } from "./constants";
import {error, info, warn} from "./utils";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export interface Participant {
    uuid: string;
    name: string;
    img: string;
    typeName: string;
}

export class WCBBridgeTab extends HandlebarsApplicationMixin(ApplicationV2) {
    private participants: Map<string, Participant>;
    private readonly dragDrop;

    constructor(options = {}) {
        super(options);
        this.dragDrop = this._createDragDropHandlers();
        this.participants = new Map();
    }

    static override DEFAULT_OPTIONS = {
        id: `{${MODULE_ID}-tab`,
        tag: "section",
        classes: ["wcb-bridge-app-shell"],
        window: {
            frame: false
        },
        dragDrop: [{
            dropSelector: ".wcb-bridge-tab"
        }],
        actions: {
            removeParticipant: WCBBridgeTab.#onRemoveParticipant,
            createConversation: WCBBridgeTab.onCreateConversation
        }
    };

    static override PARTS: any = {
        main: {
            template: `modules/${MODULE_ID}/templates/bridge-tab.hbs`
        }
    };

    private _createDragDropHandlers(): DragDrop[] {
        const dragDropOptions = (this.options as any).dragDrop || [];
        return dragDropOptions.map((d : any) => {
            d.permissions = {
                drop: this._canDragDrop.bind(this),
            };
            d.callbacks = {
                dragover: this._onDragOver.bind(this),
                drop: this._onDrop.bind(this),
            };
            return new foundry.applications.ux.DragDrop(d);
        });
    }

    private _canDragDrop(_ :string): boolean { return true; }

    private _onDragOver(event: DragEvent): void { event.preventDefault(); }

    get _onActivate() {
        return () => {
            const container = document.getElementById("wcb-bridge-sidebar");
            container?.classList.add("active");

            return this.render({
                force: true
            });
        };
    }

    get _onDeactivate() {
        return () => {
            const container = document.getElementById("wcb-bridge-sidebar");
            if (container) {
                container.classList.remove("active");
            }
        };
    }

    protected override _doEvent(
        handler: (...args: any[]) => any,
        options: { eventName?: string; hookName?: string } = {}
    ): any {
        const { eventName } = options;

        if (eventName === "activate" || eventName === "deactivate") {
            if (typeof handler === "function") {
                handler.call(this);
            }
            return;
        }

        return super._doEvent(handler as (...args: any[]) => void, options as any);
    }

    protected override _insertElement(element: HTMLElement): void {
        const container = document.getElementById("wcb-bridge-sidebar");
        if (container) {
            container.replaceChildren(element);
        }
        super._insertElement(element);
    }

    protected override async _onRender(context: any, options: any): Promise<void> {
        await super._onRender(context, options);

        if (this.dragDrop && this.element) {
            this.dragDrop.forEach((handler) => {
                handler.bind(this.element);
            });
        }
    }

    override async _prepareContext(_options: any): Promise<any> {
        return {
            participants: Array.from(this.participants.values()),
            hasParticipants: this.participants.size > 0
        };
    }

    private async _onDrop(event: DragEvent): Promise<void> {
        event.preventDefault();
        event.stopPropagation();
        const raw = event.dataTransfer?.getData("text/plain");
        if (!raw) return;

        let data: any;
        try {
            data = JSON.parse(raw);
        } catch {
            return;
        }

        if (data.type !== "JournalEntry" || !data.fcbData) return;

        if (data.fcbData.topic !== 1 && data.fcbData.topic !== 4) {
            warn("wcb-chud-bridge.sidebar.invalid_type", {
                name: data.fcbData.name
            });

            return;
        }

        const uuid = data.uuid ?? data.fcbData?.childId;
        if (!uuid) return;

        let img = "icons/svg/mystery-man.svg";
        try {
            const doc = await (fromUuid as any)(uuid);
            const page = doc?.pages?.contents?.[0];
            if (page?.system?.img) {
                img = page.system.img;
            }
        } catch {
            console.warn(`[${MODULE_ID}] Failed to fetch image for participant: ${uuid}`);
        }

        const participant: Participant = {
            uuid,
            name: data.fcbData.name ?? "Unbekannt",
            img,
            typeName: data.fcbData.typeName ?? ""
        };

        if (this.participants.has(uuid)) {
            info("wcb-chud-bridge.sidebar.already_in_list", {
                name: participant.name
            })
            return;
        }

        this.participants.set(uuid, participant);
        await this.render();
    }

    async createConversation(): Promise<void> {
        if (this.participants.size === 0) {
            warn("wcb-chud-bridge.sidebar.list_empty");
            return;
        }

        const chud = (game as any).ConversationHud;
        if (!chud) {
            error("wcb-chud-bridge.sidebar.chud_not_active");
            return;
        }

        let existing = chud.getConversation();
        let activeConversation = undefined;
        if (existing.activeConversation != undefined) {
            activeConversation = existing.activeConversation.conversationData.conversation;
            activeConversation.data.participants.push(...Array.from(this.participants.values()).map(p => ({
                name: p.name,
                img: p.img,
                displayName: true
            })));
        }

        const conversation = activeConversation != undefined
            ? { conversationData: existing.activeConversation.conversationData  }
            : { conversationData: {
                    type: "gm-controlled",
                    conversation: {
                        data: {
                            participants: Array.from(this.participants.values()).map(p => ({
                                name: p.name,
                                img: p.img,
                                displayName: true
                            }))
                        },
                        features: {
                            isBackgroundVisible: true
                        }
                    }
                }
        };

        try {
            await chud.createConversation(conversation, true);
            console.log(`[${MODULE_ID}] Conversation created with ${this.participants.size} participants.`);
            this.participants.clear();
            await this.render();

            if (ui.sidebar) {
                console.log("Delayed activation of conversation HUD tab");
                this._onDeactivate();
                ui.sidebar.changeTab("conversation", "primary");
            }
        } catch (err) {
            console.error(`[${MODULE_ID}] Failed to create conversation:`, err);
            error("wcb-chud-bridge.create_conversation_failed");
        }
    }

    static async #onRemoveParticipant(this: WCBBridgeTab, _: PointerEvent, target: HTMLElement): Promise<void> {
        const uuid = target.dataset.uuid;

        if (uuid) {
            console.log(`[WCB] Entferne NPC mit UUID: ${uuid}`);
            this.participants.delete(uuid);
            await this.render();
        }
    }

    static async onCreateConversation(this: WCBBridgeTab, _: PointerEvent, __: HTMLElement): Promise<void> {
        await this.createConversation();
    }
}