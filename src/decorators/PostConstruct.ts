import { container, InjectionToken } from "tsyringe";

/**
 * Spring-like post construction executor, this will fire after a dependency is resolved and constructed
 * @param target
 * @param propertyKey
 * @param descriptor
 * @constructor
 */
export function PostConstruct<T>(target: T, propertyKey: string, descriptor: PropertyDescriptor): void {
    container.afterResolution(
        // @ts-ignore
        target.constructor as InjectionToken<T>,
        // @ts-ignore
        async (_t, result: T) => {
            await descriptor.value.call(result);
        },
        {
            frequency: "Once"
        }
    );
}
