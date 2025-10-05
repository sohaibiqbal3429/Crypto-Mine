import type { Document, Model, Schema } from "mongoose"
import mongoose from "mongoose"

function resolveModel<T extends Document>(name: string, schema: Schema<T>): Model<T> {
  const existing = mongoose.models[name]
  if (existing) {
    return existing as Model<T>
  }

  return mongoose.model<T>(name, schema)
}

export function createModelProxy<T extends Document>(name: string, schema: Schema<T>): Model<T> {
  const proxyTarget = function proxyModel(this: unknown, ...args: unknown[]) {
    const model = resolveModel(name, schema) as unknown as (...fnArgs: unknown[]) => unknown
    return model.apply(this, args)
  }

  const handler: ProxyHandler<typeof proxyTarget> = {
    apply(target, thisArg, argArray) {
      return Reflect.apply(resolveModel(name, schema) as unknown as (...args: unknown[]) => unknown, thisArg, argArray ?? [])
    },
    construct(_target, args, newTarget) {
      const ModelConstructor = resolveModel(name, schema) as unknown as new (...ctorArgs: unknown[]) => unknown
      return Reflect.construct(ModelConstructor, args ?? [], newTarget)
    },
    get(_target, property, receiver) {
      const model = resolveModel(name, schema) as unknown as Record<PropertyKey, unknown>
      const value = Reflect.get(model, property, receiver)
      if (typeof value === "function") {
        return value.bind(model)
      }
      return value
    },
    set(_target, property, value) {
      const model = resolveModel(name, schema) as unknown as Record<PropertyKey, unknown>
      Reflect.set(model, property, value)
      return true
    },
    has(_target, property) {
      const model = resolveModel(name, schema) as unknown as Record<PropertyKey, unknown>
      return Reflect.has(model, property)
    },
    ownKeys() {
      const model = resolveModel(name, schema) as unknown as Record<PropertyKey, unknown>
      return Reflect.ownKeys(model)
    },
    getOwnPropertyDescriptor(_target, property) {
      const model = resolveModel(name, schema) as unknown as Record<PropertyKey, unknown>
      const descriptor = Reflect.getOwnPropertyDescriptor(model, property)
      if (!descriptor) {
        return undefined
      }
      descriptor.configurable = true
      return descriptor
    },
  }

  return new Proxy(proxyTarget, handler) as unknown as Model<T>
}
