import { ShapeFlags } from 'packages/shared/src/shapeFlags'
import { Fragment } from './vnode'

/**
 * 渲染器配置对象
 */
export interface RendererOptions {
  /**
   * 为指定 element 的 prop 打补丁
   */
  patchProp(el: Element, key: string, prevValue: any, nextValue: any): void
  /**
   * 为指定的 Element 设置 text
   */
  setElementText(node: Element, text: string): void
  /**
   * 插入指定的 el 到 parent 中，anchor 表示插入的位置，即：锚点
   */
  insert(el, parent: Element, anchor?): void
  /**
   * 创建指定的 Element
   */
  createElement(type: string)
}

/**
 * 对外暴露的创建渲染器的方法
 */
export function createRenderer(options: RendererOptions) {
  return baseCreateRenderer(options)
}

/**
 * 生成 renderer 渲染器
 * @param options 兼容性操作配置对象
 * @returns
 */
function baseCreateRenderer(options: RendererOptions): any {
  /**
   * 解构 options，获取所有的兼容性方法
   */
  const {
    insert: hostInsert,
    patchProp: hostPatchProp,
    createElement: hostCreateElement,
    setElementText: hostSetElementText
  } = options

  /**
   * Element 的打补丁操作
   */
  const processElement = (oldVNode, newVNode, container, anchor) => {
    if (oldVNode == null) {
      // 挂载操作
      mountElement(newVNode, container, anchor)
    } else {
      // TODO: 更新操作
    }
  }

  /**
   * element 的挂载操作
   */
  const mountElement = (vnode, container, anchor) => {
    const { type, props, shapeFlag } = vnode

    // 创建 element
    const el = (vnode.el = hostCreateElement(type))

    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 设置 文本子节点
      hostSetElementText(el, vnode.children as string)
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // TODO: 设置 Array 子节点
    }

    // 处理 props
    if (props) {
      // 遍历 props 对象
      for (const key in props) {
        hostPatchProp(el, key, null, props[key])
      }
    }

    // 插入 el 到指定的位置
    hostInsert(el, container, anchor)
  }

  const patch = (oldVNode, newVNode, container, anchor = null) => {
    if (oldVNode === newVNode) {
      return
    }

    const { type, shapeFlag } = newVNode
    switch (type) {
      case Text:
        // TODO: Text
        break
      case Comment:
        // TODO: Comment
        break
      case Fragment:
        // TODO: Fragment
        break
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(oldVNode, newVNode, container, anchor)
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          // TODO: 组件
        }
    }
  }

  /**
   * 渲染函数
   */
  const render = (vnode, container) => {
    if (vnode == null) {
      // TODO: 卸载
    } else {
      // 打补丁（包括了挂载和更新）
      patch(container._vnode || null, vnode, container)
    }
    container._vnode = vnode
  }
  return {
    render
  }
}
