import "reflect-metadata";

import { RedirectsManager } from "@src/redirects";
import { container, singleton } from "tsyringe";
import browser, { tabs } from "webextension-polyfill";

@singleton()
class Worker {
    public constructor(private redirectsManager: RedirectsManager) {
        browser.webNavigation.onBeforeNavigate.addListener((details) => this.handleOnBeforeNavigate(details));
    }

    private async handleOnBeforeNavigate(details: browser.WebNavigation.OnBeforeNavigateDetailsType): Promise<void> {
        if (details.url) {
            const url = new URL(details.url);
            const { origin, pathname } = url;
            if (!origin) {
                return;
            }

            const redirect = await this.redirectsManager.get(origin);

            if (!redirect) {
                return;
            }

            const redirectUrl = `${redirect.to}/${pathname}`;
            tabs.update(details.tabId, { url: redirectUrl });
        }
    }
}

container.resolve(Worker);
