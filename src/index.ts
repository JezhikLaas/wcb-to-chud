
import { MODULE_ID } from "./constants";
import { WCBBridgeTab } from "./bridge-tab";

let bridgeTab: InstanceType<typeof WCBBridgeTab> | null = null;

Hooks.once("init", () => {
    console.log(`[${MODULE_ID}] init`);
});


Hooks.on("renderSidebar", (_app: Sidebar, html: HTMLElement, _data: any) => {
    const $html = $(html);
    const $tabs = $html.find("#sidebar-tabs");

    if ($tabs.find('[data-tab="wcb-bridge"]').length > 0) return;

    const bridgeTabButton = `
        <li class="item" data-tab="wcb-bridge">
            <button type="button" class="ui-control plain icon fa-solid fa-bridge" 
                    data-action="tab" data-tab="wcb-bridge" title="WCB Bridge" 
                    role="tab" aria-pressed="false" data-group="primary">
                <div class="notification-pip"></div>
            </button>
        </li>
    `;

    const $settingsLi = $tabs.find('[data-tab="settings"]').closest('li');

    if ($settingsLi.length > 0) {
        $settingsLi.before(bridgeTabButton);
    } else {
        $tabs.append(bridgeTabButton);
    }

    const $content = $html.find("#sidebar-content");
    if ($content.find('[data-tab="wcb-bridge"]').length === 0) {
        $content.append(`<section class="tab" data-tab="wcb-bridge" id="wcb-bridge-sidebar"></section>`);
    }
    const container = html.querySelector('#wcb-bridge-sidebar');

    if (container && !bridgeTab) {
        bridgeTab = new WCBBridgeTab();
        (ui as any)["wcb-bridge"] = bridgeTab;
        console.log("WCB Bridge: Instanz erfolgreich initialisiert.");
    }
});

Hooks.on("changeSidebarTab", (app: foundry.applications.api.ApplicationV2) => {
    const tabName = (app as any).tabName || app.id;

    if (tabName === "wcb-bridge") {
        console.log("WCB Bridge: Tab aktiviert.");
        if (bridgeTab) {
            bridgeTab.render({ force: true });
        }
    }
});
