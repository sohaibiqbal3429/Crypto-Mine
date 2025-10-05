"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createModelProxy = createModelProxy;
const mongoose_1 = __importDefault(require("mongoose"));
function resolveModel(name, schema) {
    const existing = mongoose_1.default.models[name];
    if (existing) {
        return existing;
    }
    return mongoose_1.default.model(name, schema);
}
function createModelProxy(name, schema) {
    const proxyTarget = function proxyModel(...args) {
        const model = resolveModel(name, schema);
        return model.apply(this, args);
    };
    const handler = {
        apply(target, thisArg, argArray) {
            return Reflect.apply(resolveModel(name, schema), thisArg, argArray ?? []);
        },
        construct(_target, args, newTarget) {
            const ModelConstructor = resolveModel(name, schema);
            return Reflect.construct(ModelConstructor, args ?? [], newTarget);
        },
        get(_target, property, receiver) {
            const model = resolveModel(name, schema);
            const value = Reflect.get(model, property, receiver);
            if (typeof value === "function") {
                return value.bind(model);
            }
            return value;
        },
        set(_target, property, value) {
            const model = resolveModel(name, schema);
            Reflect.set(model, property, value);
            return true;
        },
        has(_target, property) {
            const model = resolveModel(name, schema);
            return Reflect.has(model, property);
        },
        ownKeys() {
            const model = resolveModel(name, schema);
            return Reflect.ownKeys(model);
        },
        getOwnPropertyDescriptor(_target, property) {
            const model = resolveModel(name, schema);
            const descriptor = Reflect.getOwnPropertyDescriptor(model, property);
            if (!descriptor) {
                return undefined;
            }
            descriptor.configurable = true;
            return descriptor;
        },
    };
    return new Proxy(proxyTarget, handler);
}
