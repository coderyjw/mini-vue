import { isObject } from '@vue/shared'
import { reactive } from '@vue/reactivity'
import { onBeforeMount, onMounted } from './apiLifecycle'
/**
 * 生命周期钩子
 */
export const enum LifecycleHooks {
  BEFORE_CREATE = 'bc',
  CREATED = 'c',
  BEFORE_MOUNT = 'bm',
  MOUNTED = 'm'
}

let uid = 0

/**
 * 创建组件实例
 */
export function createComponentInstance(vnode) {
  const type = vnode.type

  const instance = {
    uid: uid++, // 唯一标记
    vnode, // 虚拟节点
    type, // 组件类型
    subTree: null!, // render 函数的返回值
    effect: null!, // ReactiveEffect 实例
    update: null!, // update 函数，触发 effect.run
    render: null, // 组件内的 render 函数
    // 生命周期相关
    isMounted: false, // 是否挂载
    bc: null, // beforeCreate
    c: null, // created
    bm: null, // beforeMount
    m: null // mounted
  }

  return instance
}

/**
 * 规范化组件实例数据
 */
export function setupComponent(instance) {
  // 为 render 赋值
  const setupResult = setupStatefulComponent(instance)
  return setupResult
}

function setupStatefulComponent(instance) {
  finishComponentSetup(instance)
}

function applyOptions(instance: any) {
  const {
    data: dataOptions,
    beforeCreate,
    created,
    beforeMount,
    mounted
  } = instance.type

  // hooks
  if (beforeCreate) {
    callHook(beforeCreate)
  }

  // 存在 data 选项时
  if (dataOptions) {
    // 触发 dataOptions 函数，拿到 data 对象
    const data = dataOptions()
    // 如果拿到的 data 是一个对象
    if (isObject(data)) {
      // 则把 data 包装成 reactiv 的响应性数据，赋值给 instance
      instance.data = reactive(data)
    }
  }

  // hooks
  if (created) {
    callHook(created)
  }

  function registerLifecycleHook(register: Function, hook?: Function) {
    register(hook, instance)
  }

  // 注册 hooks
  registerLifecycleHook(onBeforeMount, beforeMount)
  registerLifecycleHook(onMounted, mounted)
}

export function finishComponentSetup(instance) {
  const Component = instance.type

  instance.render = Component.render

  // 改变 options 中的 this 指向
  applyOptions(instance)
}

/**
 * 触发 hooks
 */
function callHook(hook: Function) {
  hook()
}
