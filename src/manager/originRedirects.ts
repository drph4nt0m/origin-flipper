import { PostConstruct } from "@decorators/PostConstruct";
import { OriginRedirectConfig } from "@src/types";
import { sleep } from "@src/utils";
import { singleton } from "tsyringe";
import browser from "webextension-polyfill";

@singleton()
export class OriginRedirectsManager {
    private _redirects: OriginRedirectConfig[];
    private hasInitialized: boolean;

    public constructor() {
        this._redirects = [];
        this.hasInitialized = false;
    }

    private get redirects(): OriginRedirectConfig[] {
        return [...this._redirects];
    }

    @PostConstruct
    private async init(): Promise<void> {
        const storage = (await browser.storage.local.get()) as { originRedirects?: OriginRedirectConfig[] };
        this._redirects = storage.originRedirects ?? [];
        this.hasInitialized = true;
    }

    private async checkConfigLoaded(): Promise<void> {
        if (!this.hasInitialized) {
            await sleep(200);
            await this.checkConfigLoaded();
        }
    }

    public async add(redirect: OriginRedirectConfig): Promise<void> {
        await this.checkConfigLoaded();

        if (await this.get(redirect.from)) {
            await this.remove(redirect.from);
        }
        this._redirects.push(redirect);

        await this.syncToStorage();
    }

    public async remove(redirectFrom: string): Promise<void> {
        await this.checkConfigLoaded();

        this._redirects = this.redirects.filter((r) => r.from !== redirectFrom);

        await this.syncToStorage();
    }

    public async removeAll(): Promise<void> {
        await this.checkConfigLoaded();

        this._redirects = [];

        await this.syncToStorage();
    }

    public async get(redirectFrom: string): Promise<OriginRedirectConfig | undefined> {
        await this.checkConfigLoaded();

        const redirect = this.redirects.find((r) => r.from === redirectFrom);
        return redirect;
    }

    public async getAll(): Promise<OriginRedirectConfig[]> {
        await this.checkConfigLoaded();

        return this.redirects;
    }

    private async syncToStorage(): Promise<void> {
        await browser.storage.local.set({ originRedirects: this.redirects });
    }
}
