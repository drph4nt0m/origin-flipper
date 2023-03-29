import { PostConstruct } from "@decorators/PostConstruct";
import { PathRedirectConfig } from "@src/types";
import { sleep } from "@src/utils";
import { singleton } from "tsyringe";
import browser from "webextension-polyfill";

@singleton()
export class PathRedirectsManager {
    private _redirects: PathRedirectConfig[];
    private hasInitialized: boolean;

    public constructor() {
        this._redirects = [];
        this.hasInitialized = false;
    }

    private get redirects(): PathRedirectConfig[] {
        return [...this._redirects];
    }

    @PostConstruct
    private async init(): Promise<void> {
        const storage = (await browser.storage.local.get()) as { pathRedirects?: PathRedirectConfig[] };
        this._redirects = storage.pathRedirects ?? [];
        this.hasInitialized = true;
    }

    private async checkConfigLoaded(): Promise<void> {
        if (!this.hasInitialized) {
            await sleep(200);
            await this.checkConfigLoaded();
        }
    }

    public async add(redirect: PathRedirectConfig): Promise<void> {
        await this.checkConfigLoaded();

        if (await this.get(redirect.origin, redirect.path)) {
            await this.remove(redirect.origin, redirect.path);
        }
        this._redirects.push(redirect);

        await this.syncToStorage();
    }

    public async remove(origin: string, path: string): Promise<void> {
        await this.checkConfigLoaded();

        this._redirects = this.redirects.filter((r) => r.origin !== origin && r.path !== path);

        await this.syncToStorage();
    }

    public async removeAll(): Promise<void> {
        await this.checkConfigLoaded();

        this._redirects = [];

        await this.syncToStorage();
    }

    public async get(origin: string, path: string): Promise<PathRedirectConfig | undefined> {
        await this.checkConfigLoaded();

        const redirect = this.redirects.find((r) => r.origin === origin && r.path === path);

        // if (!redirect) {
        //     redirect = this.redirects.find((r) => r.origin === origin && r.path.match(path));
        // }

        return redirect;
    }

    public async getAll(): Promise<PathRedirectConfig[]> {
        await this.checkConfigLoaded();

        return this.redirects;
    }

    private async syncToStorage(): Promise<void> {
        await browser.storage.local.set({ pathRedirects: this.redirects });
    }
}
