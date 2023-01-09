import { ShapeFlags } from 'packages/shared/src/shapeFlags'

/**
 * 解析 render 函数的返回值
 */
export function renderComponentRoot(instance) {
  const { vnode, render } = instance

  let result
  try {
    // 解析到状态组件
    if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
      // 获取到 result 返回值
      result = normalizeVNode(render!())
    }
  } catch (err) {
    console.error(err)
  }

  return result
}

/**
 * 标准化 VNode
 */
export function normalizeVNode(child) {
  if (typeof child === 'object') {
    return cloneIfMounted(child)
  }
}

/**
 * clone VNode
 */
export function cloneIfMounted(child) {
  return child
}
