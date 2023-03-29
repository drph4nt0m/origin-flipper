import "reflect-metadata";

import { OriginRedirectsManager } from "@manager/originRedirects";
import { container, singleton } from "tsyringe";
import browser, { tabs } from "webextension-polyfill";

@singleton()
class Worker {
    private originRedirectsManager: OriginRedirectsManager;

    public constructor() {
        this.originRedirectsManager = container.resolve(OriginRedirectsManager);
        browser.webNavigation.onBeforeNavigate.addListener((details) => this.handleOnBeforeNavigate(details));
    }

    private async handleOnBeforeNavigate(details: browser.WebNavigation.OnBeforeNavigateDetailsType): Promise<void> {
        if (details.url) {
            const url = new URL(details.url);
            const { origin, pathname } = url;
            if (!origin) {
                return;
            }

            const redirect = await this.originRedirectsManager.get(origin);

            if (!redirect) {
                return;
            }

            const redirectUrl = `${redirect.to}/${pathname}`;
            tabs.update(details.tabId, { url: redirectUrl });
        }
    }
}

container.resolve(Worker);
