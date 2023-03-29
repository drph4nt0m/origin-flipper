import "@material/mwc-button";
import "@material/mwc-circular-progress";
import "@material/mwc-icon";
import "@material/mwc-icon-button";
import "@material/mwc-tab";
import "@material/mwc-tab-bar";
import "@material/mwc-textfield";
import "@material/mwc-top-app-bar-fixed";
import "reflect-metadata";

import { PostConstruct } from "@decorators/PostConstruct";
import { OriginRedirectsManager } from "@manager/originRedirects";
import { PathRedirectsManager } from "@manager/pathRedirects";
import { Snackbar } from "@material/mwc-snackbar";
import { AnyFunction, OriginRedirectConfig, PathRedirectConfig } from "@src/types";
import { getFileAsString } from "easy-file-picker";
import { saveAs } from "file-saver";
import { container, singleton } from "tsyringe";
import browser from "webextension-polyfill";
import { z, ZodError } from "zod";

@singleton()
class Popup {
    private originRedirects: OriginRedirectConfig[] = [];
    private pathRedirects: PathRedirectConfig[] = [];
    private loadingElement: HTMLElement;
    private emptyConfigElement: HTMLElement;
    private originsContainerElement: HTMLButtonElement;
    private pathsContainerElement: HTMLButtonElement;
    private listeners = [
        {
            selector: "#add-row-btn",
            type: "click",
            func: (): void => {
                // this.addOriginRedirectRow();
                this.addPathRedirectGroup();
            }
        },
        {
            selector: "#save-btn",
            type: "click",
            func: (): void => {
                // this.saveOriginRedirects();
                this.savePathRedirects();
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

    public constructor(private originRedirectsManager: OriginRedirectsManager, private pathRedirectsManager: PathRedirectsManager) {
        this.loadingElement = document.querySelector("#loading") as HTMLElement;
        this.emptyConfigElement = document.querySelector("#empty-config") as HTMLElement;
        this.originsContainerElement = document.querySelector("#origins") as HTMLButtonElement;
        this.pathsContainerElement = document.querySelector("#paths") as HTMLButtonElement;
    }

    @PostConstruct
    private async init(): Promise<void> {
        this.toggleLoading("active");
        this.initListeners();
        await this.loadOriginRedirects();
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

    private onOriginRedirectFieldValueChange(index: number, type: "from" | "to", event: Event): void {
        const path = event.composedPath();
        const input = path[0];
        // @ts-ignore
        const newValue = input.value;
        this.originRedirects[index][type] = newValue;
    }

    private onPathRedirectFieldValueChange(index: number, type: "origin" | "path" | "to", event: Event): void {
        const path = event.composedPath();
        const input = path[0];
        // @ts-ignore
        const newValue = input.value;
        this.pathRedirects[index][type] = newValue;
    }

    private async loadOriginRedirects(redirectConfigs: OriginRedirectConfig[] | "FETCH" = "FETCH", resetBefore = true): Promise<void> {
        let _redirects: OriginRedirectConfig[] = this.originRedirects;

        if (resetBefore) {
            this.clearOriginRedirectRowElements();
            _redirects = [];
        }

        if (redirectConfigs === "FETCH") {
            _redirects = await this.originRedirectsManager.getAll();
        } else {
            _redirects = redirectConfigs;
        }

        if (_redirects.length > 0) {
            _redirects.forEach((redirect) => this.addOriginRedirectRow(redirect));
        } else {
            this.emptyConfigElement.classList.add("active");
        }
    }

    private async loadPathRedirects(redirectConfigs: PathRedirectConfig[] | "FETCH" = "FETCH", resetBefore = true): Promise<void> {
        let _redirects: PathRedirectConfig[] = this.pathRedirects;

        if (resetBefore) {
            this.clearPathRedirectRowElements();
            _redirects = [];
        }

        if (redirectConfigs === "FETCH") {
            _redirects = await this.pathRedirectsManager.getAll();
        } else {
            _redirects = redirectConfigs;
        }

        if (_redirects.length > 0) {
            _redirects.forEach((redirect) => this.addPathRedirectGroup(redirect));
        } else {
            this.emptyConfigElement.classList.add("active");
        }
    }

    private addOriginRedirectRow(redirect: OriginRedirectConfig = { from: "", to: "" }): void {
        return;
        const index = this.originRedirects.length;
        this.originRedirects.push(redirect);
        this.emptyConfigElement.classList.remove("active");

        const redirectElement = document.createElement("div");
        redirectElement.classList.add("redirect");

        const fromInputElement = document.createElement("mwc-textfield");
        fromInputElement.setAttribute("required", "true");
        fromInputElement.setAttribute("label", "From origin");
        fromInputElement.addEventListener("input", (event) => this.onOriginRedirectFieldValueChange(index, "from", event));
        fromInputElement.value = redirect.from;

        const toInputElement = document.createElement("mwc-textfield");
        toInputElement.setAttribute("required", "true");
        toInputElement.setAttribute("label", "To origin");
        toInputElement.addEventListener("input", (event) => this.onOriginRedirectFieldValueChange(index, "to", event));
        toInputElement.value = redirect.to;

        // <mwc-icon-button id="download-config-btn" icon="download" slot="actionItems"></mwc-icon-button>
        const removeBtnElement = document.createElement("mwc-icon-button");
        removeBtnElement.setAttribute("icon", "delete");
        removeBtnElement.addEventListener("click", async () => {
            redirectElement.remove();
            this.originRedirects.splice(index, 1);
            await this.loadOriginRedirects(this.originRedirects);
        });

        redirectElement.appendChild(fromInputElement);
        redirectElement.appendChild(toInputElement);
        redirectElement.appendChild(removeBtnElement);

        this.originsContainerElement?.appendChild(redirectElement);
    }

    private addPathRedirectGroup(redirect: PathRedirectConfig = { origin: "", path: "", to: "" }): void {
        const index = this.originRedirects.length;
        this.pathRedirects.push(redirect);
        this.emptyConfigElement.classList.remove("active");

        const redirectElement = document.createElement("div");
        redirectElement.classList.add("path");

        const originInputElement = document.createElement("mwc-textfield");
        originInputElement.setAttribute("required", "true");
        originInputElement.setAttribute("label", "Origin");
        originInputElement.addEventListener("input", (event) => this.onPathRedirectFieldValueChange(index, "origin", event));
        originInputElement.value = redirect.origin;

        const pathInputElement = document.createElement("mwc-textfield");
        pathInputElement.setAttribute("required", "true");
        pathInputElement.setAttribute("label", "Path");
        pathInputElement.addEventListener("input", (event) => this.onPathRedirectFieldValueChange(index, "path", event));
        pathInputElement.value = redirect.path;

        const toInputElement = document.createElement("mwc-textfield");
        toInputElement.setAttribute("required", "true");
        toInputElement.setAttribute("label", "To");
        toInputElement.addEventListener("input", (event) => this.onPathRedirectFieldValueChange(index, "to", event));
        toInputElement.value = redirect.to;

        // <mwc-icon-button id="download-config-btn" icon="download" slot="actionItems"></mwc-icon-button>
        const removeBtnElement = document.createElement("mwc-icon-button");
        removeBtnElement.setAttribute("icon", "delete");
        removeBtnElement.addEventListener("click", async () => {
            redirectElement.remove();
            this.pathRedirects.splice(index, 1);
            await this.loadPathRedirects(this.pathRedirects);
        });

        redirectElement.appendChild(originInputElement);
        redirectElement.appendChild(pathInputElement);
        redirectElement.appendChild(toInputElement);
        redirectElement.appendChild(removeBtnElement);

        this.pathsContainerElement?.appendChild(redirectElement);
    }

    private clearOriginRedirectRowElements(): void {
        this.originRedirects = [];
        const redirectElements = this.originsContainerElement?.querySelectorAll(".redirect");
        redirectElements?.forEach((redirectElement) => redirectElement.remove());
    }

    private clearPathRedirectRowElements(): void {
        this.pathRedirects = [];
        const redirectElements = this.pathsContainerElement?.querySelectorAll(".redirect");
        redirectElements?.forEach((redirectElement) => redirectElement.remove());
    }

    private async saveOriginRedirects(): Promise<void> {
        try {
            this.originRedirects = this.validatedOriginRedirects(this.originRedirects);
            await this.originRedirectsManager.removeAll();
            for await (const redirect of this.originRedirects) {
                await this.originRedirectsManager.add(redirect);
            }
            await this.loadOriginRedirects();
            this.showSnackbar("Saved configurations");
        } catch (error: any) {
            this.showSnackbar(error.message);
        }
    }

    private async savePathRedirects(): Promise<void> {
        try {
            this.pathRedirects = this.validatedPathRedirects(this.pathRedirects);
            await this.pathRedirectsManager.removeAll();
            for await (const redirect of this.pathRedirects) {
                await this.pathRedirectsManager.add(redirect);
            }
            await this.loadPathRedirects();
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

    private validatedOriginRedirects(redirects: OriginRedirectConfig[]): OriginRedirectConfig[] {
        return redirects.map(({ from, to }) => {
            from = this.validateOrigin(from);
            to = this.validateOrigin(to);
            return { from, to };
        });
    }

    private validatedPathRedirects(redirects: PathRedirectConfig[]): PathRedirectConfig[] {
        return redirects.map(({ origin, path, to }) => {
            origin = this.validateOrigin(origin);
            to = new URL(to).toString();
            return { origin, path, to };
        });
    }

    private downloadConfigs(): void {
        const str = JSON.stringify({ originRedirects: this.originRedirects }, null, 2);
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
                originRedirects: z.array(
                    z.object({
                        from: z.string(),
                        to: z.string()
                    })
                ),
                pathRedirects: z.array(
                    z.object({
                        origin: z.string(),
                        path: z.string(),
                        to: z.string()
                    })
                )
            });

            const validatedConfig = RedirectsConfig.parse(parsedContents);

            const _originRedirects = validatedConfig.originRedirects ?? [];
            const _pathRedirects = validatedConfig.pathRedirects ?? [];
            this.loadOriginRedirects(_originRedirects, false);
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
