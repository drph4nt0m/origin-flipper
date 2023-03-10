import "reflect-metadata";
import "@material/mwc-button";
import "@material/mwc-icon";
import "@material/mwc-icon-button";
import "@material/mwc-textfield";
import "@material/mwc-top-app-bar-fixed";
import "@material/mwc-circular-progress";

import { PostConstruct } from "@decorators/PostConstruct";
import { Snackbar } from "@material/mwc-snackbar";
import { RedirectsManager } from "@src/redirects";
import { AnyFunction, RedirectConfig } from "@src/types";
import { getFileAsString } from "easy-file-picker";
import { saveAs } from "file-saver";
import { container, singleton } from "tsyringe";
import browser from "webextension-polyfill";
import { z, ZodError } from "zod";

@singleton()
class Popup {
    private redirects: RedirectConfig[] = [];
    private loadingElement: HTMLElement;
    private emptyConfigElement: HTMLElement;
    private redirectsContainerElement: HTMLButtonElement;
    private listeners = [
        {
            selector: "#add-row-btn",
            type: "click",
            func: (): void => {
                this.addRedirectRow();
            }
        },
        {
            selector: "#save-btn",
            type: "click",
            func: (): void => {
                this.saveRedirects();
            }
        },
        {
            selector: "#download-config-btn",
            type: "click",
            func: (): void => {
                this.downloadConfigs();
            }
        },
        {
            selector: "#upload-config-btn",
            type: "click",
            func: (): void => {
                this.uploadConfigs();
            }
        },
        {
            selector: "#author",
            type: "click",
            func: (): void => {
                browser.tabs.create({ url: "https://github.com/drph4nt0m", active: false });
            }
        },
        {
            selector: "#repo",
            type: "click",
            func: (): void => {
                browser.tabs.create({ url: "https://github.com/drph4nt0m/origin-flipper", active: false });
            }
        }
    ];

    public constructor(private redirectsManager: RedirectsManager) {
        this.loadingElement = document.querySelector("#loading") as HTMLElement;
        this.emptyConfigElement = document.querySelector("#empty-config") as HTMLElement;
        this.redirectsContainerElement = document.querySelector("#redirects") as HTMLButtonElement;
    }

    @PostConstruct
    private async init(): Promise<void> {
        this.toggleLoading("active");
        this.initListeners();
        await this.loadRedirects();
        this.toggleLoading("inactive");
    }

    private initListeners(listeners: { selector: string; type: string; func: AnyFunction }[] = this.listeners): void {
        for (const listener of listeners) {
            try {
                const elements = document.querySelectorAll(listener.selector);
                if (!elements || elements.length === 0) {
                    throw Error("Element not found");
                }
                elements.forEach((element) =>
                    element.addEventListener(listener.type, () => {
                        listener.func(element);
                    })
                );
            } catch (error) {
                console.error(`Unable to add event listener for ${listener.selector}`, error);
            }
        }
    }

    private toggleLoading(state: "active" | "inactive" | "toggle" = "toggle"): void {
        switch (state) {
            case "active":
                this.loadingElement.classList.add("active");
                break;
            case "inactive":
                this.loadingElement.classList.remove("active");
                break;
            case "toggle":
                this.loadingElement.classList.toggle("active");
                break;
        }
    }

    private showSnackbar(message = "Something went wrong."): void {
        const snackbarElement = new Snackbar();
        snackbarElement.setAttribute("labelText", message);
        document.body.appendChild(snackbarElement);
        snackbarElement.show();
    }

    private onRedirectFieldValueChange(index: number, type: "from" | "to", event: Event): void {
        const path = event.composedPath();
        const input = path[0];
        // @ts-ignore
        const newValue = input.value;
        this.redirects[index][type] = newValue;
    }

    private async loadRedirects(redirectConfigs: RedirectConfig[] | "FETCH" = "FETCH", resetBefore = true): Promise<void> {
        let _redirects: RedirectConfig[] = this.redirects;

        if (resetBefore) {
            this.clearRedirectRowElements();
            _redirects = [];
        }

        if (redirectConfigs === "FETCH") {
            _redirects = await this.redirectsManager.getAll();
        } else {
            _redirects = redirectConfigs;
        }

        if (_redirects.length > 0) {
            _redirects.forEach((redirect) => this.addRedirectRow(redirect));
        } else {
            this.emptyConfigElement.classList.add("active");
        }
    }

    private addRedirectRow(redirect: RedirectConfig = { from: "", to: "" }): void {
        const index = this.redirects.length;
        this.redirects.push(redirect);
        this.emptyConfigElement.classList.remove("active");

        const redirectElement = document.createElement("div");
        redirectElement.classList.add("redirect");

        const fromInputElement = document.createElement("mwc-textfield");
        fromInputElement.setAttribute("required", "true");
        fromInputElement.setAttribute("label", "From origin");
        fromInputElement.addEventListener("input", (event) => this.onRedirectFieldValueChange(index, "from", event));
        fromInputElement.value = redirect.from;

        const toInputElement = document.createElement("mwc-textfield");
        toInputElement.setAttribute("required", "true");
        toInputElement.setAttribute("label", "To origin");
        toInputElement.addEventListener("input", (event) => this.onRedirectFieldValueChange(index, "to", event));
        toInputElement.value = redirect.to;

        // <mwc-icon-button id="download-config-btn" icon="download" slot="actionItems"></mwc-icon-button>
        const removeBtnElement = document.createElement("mwc-icon-button");
        removeBtnElement.setAttribute("icon", "delete");
        removeBtnElement.addEventListener("click", async () => {
            redirectElement.remove();
            this.redirects.splice(index, 1);
            await this.loadRedirects(this.redirects);
        });

        redirectElement.appendChild(fromInputElement);
        redirectElement.appendChild(toInputElement);
        redirectElement.appendChild(removeBtnElement);

        this.redirectsContainerElement.appendChild(redirectElement);
    }

    private clearRedirectRowElements(): void {
        this.redirects = [];
        const redirectElements = this.redirectsContainerElement.querySelectorAll(".redirect");
        redirectElements.forEach((redirectElement) => redirectElement.remove());
    }

    private async saveRedirects(): Promise<void> {
        try {
            this.redirects = this.validatedRedirects(this.redirects);
            await this.redirectsManager.removeAll();
            for await (const redirect of this.redirects) {
                await this.redirectsManager.add(redirect);
            }
            await this.loadRedirects();
            this.showSnackbar("Saved configurations");
        } catch (error: any) {
            this.showSnackbar(error.message);
        }
    }

    private validateOrigin(value: string): string {
        try {
            const url = new URL(value);
            return url.origin;
        } catch (error) {
            throw new Error(`Unable to parse URL origin: ${value}`);
        }
    }

    private validatedRedirects(redirects: RedirectConfig[]): RedirectConfig[] {
        return redirects.map(({ from, to }) => {
            from = this.validateOrigin(from);
            to = this.validateOrigin(to);
            return { from, to };
        });
    }

    private downloadConfigs(): void {
        const str = JSON.stringify({ redirects: this.redirects }, null, 2);
        const bytes = new TextEncoder().encode(str);
        const file = new File([bytes], "url-redirector-config.json", { type: "application/json;charset=utf-8" });
        saveAs(file);
        this.showSnackbar("Configuration file downloaded");
    }

    private async uploadConfigs(): Promise<void> {
        const file = await getFileAsString({ acceptedExtensions: [".json"] });
        try {
            const parsedContents = JSON.parse(file.content);

            const RedirectsConfig = z.object({
                redirects: z.array(
                    z.object({
                        from: z.string(),
                        to: z.string()
                    })
                )
            });

            const validatedConfig = RedirectsConfig.parse(parsedContents);

            const _redirects = validatedConfig.redirects;
            this.loadRedirects(_redirects, false);
            this.showSnackbar("Configuration file loaded");
        } catch (error: any) {
            if (error instanceof ZodError) {
                this.showSnackbar("Configuration file doesnt match the expected JSON format.");
            } else {
                this.showSnackbar(error.message);
            }
            return;
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    container.resolve(Popup);
});
