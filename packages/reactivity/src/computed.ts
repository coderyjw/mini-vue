import { isFunction } from '@vue/shared'
import { Dep } from './dep'
import { ReactiveEffect } from './effect'
import { trackRefValue } from './ref'

/**
 * 计算属性类
 */
export class ComputedRefImpl<T> {
  public dep?: Dep = undefined
  private _value!: T

  public readonly effect: ReactiveEffect<T>

  public readonly __v_isRef = true

  constructor(getter) {
    this.effect = new ReactiveEffect(getter)
    this.effect.computed = this
  }

  get value() {
    // 触发依赖
    trackRefValue(this)
    // 执行 run 函数
    this._value = this.effect.run()!
    // 返回计算之后的真实值
    return this._value
  }
}

/**
 * 计算属性
 */
export function computed(getterOrOptions) {
  let getter

  // 判断传入的参数是否为一个函数
  const onlyGetter = isFunction(getterOrOptions)
  if (onlyGetter) {
    // 如果是函数，则赋值给 getter
    getter = getterOrOptions
  }

  const cRef = new ComputedRefImpl(getter)

  return cRef as any
}
