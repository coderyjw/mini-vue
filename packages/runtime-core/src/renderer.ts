import { ShapeFlags } from 'packages/shared/src/shapeFlags'
import { Fragment, isSameVNodeType } from './vnode'
import { normalizeVNode } from './componentRenderUtils'
import { EMPTY_OBJ } from '@vue/shared'
import { createComponentInstance, setupComponent } from './component'
import { queuePreFlushCb } from './scheduler'
import { renderComponentRoot } from './componentRenderUtils'
import { ReactiveEffect } from '@vue/reactivity'
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
  /**
   * 卸载指定dom
   */
  remove(el): void

  /**
   * 创建 Text 节点
   */
  createText(text: string)
  /**
   * 设置 text
   */
  setText(node, text): void
  /**
   * 设置 text
   */
  createComment(text: string)
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
    setElementText: hostSetElementText,
    remove: hostRemove,
    createText: hostCreateText,
    setText: hostSetText,
    createComment: hostCreateComment
  } = options

  const unmount = vnode => {
    hostRemove(vnode.el!)
  }

  /**
   * Element 的打补丁操作
   */
  const processElement = (oldVNode, newVNode, container, anchor) => {
    if (oldVNode == null) {
      // 挂载操作
      mountElement(newVNode, container, anchor)
    } else {
      // 更新操作
      patchElement(oldVNode, newVNode)
    }
  }

  /**
   * Text 的打补丁操作
   */
  const processText = (oldVNode, newVNode, container, anchor) => {
    // 不存在旧的节点，则为 挂载 操作
    if (oldVNode == null) {
      // 生成节点
      newVNode.el = hostCreateText(newVNode.children as string)
      // 挂载
      hostInsert(newVNode.el, container, anchor)
    }
    // 存在旧的节点，则为 更新 操作
    else {
      const el = (newVNode.el = oldVNode.el!)
      if (newVNode.children !== oldVNode.children) {
        hostSetText(el, newVNode.children as string)
      }
    }
  }

  /**
   * Comment 的打补丁操作
   */
  const processCommentNode = (oldVNode, newVNode, container, anchor) => {
    if (oldVNode == null) {
      // 生成节点
      newVNode.el = hostCreateComment((newVNode.children as string) || '')
      // 挂载
      hostInsert(newVNode.el, container, anchor)
    } else {
      // 无更新
      newVNode.el = oldVNode.el
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
      // 设置 Array 子节点
      mountChildren(vnode.children, el, anchor)
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

  const mountChildren = (children, container, anchor) => {
    for (let i = 0; i < children.length; i++) {
      patch(null, children[i], container, anchor)
    }
  }

  const mountComponent = (initialVNode, container, anchor) => {
    // 生成组件实例
    initialVNode.component = createComponentInstance(initialVNode)
    // 浅拷贝，绑定同一块内存空间
    const instance = initialVNode.component

    // 标准化组件实例数据
    setupComponent(instance)

    // 设置组件渲染
    setupRenderEffect(instance, initialVNode, container, anchor)
  }

  /**
   * 设置组件渲染
   */
  const setupRenderEffect = (instance, initialVNode, container, anchor) => {
    // 组件挂载和更新的方法
    const componentUpdateFn = () => {
      // 当前处于 mounted 之前，即执行 挂载 逻辑
      if (!instance.isMounted) {
        // 获取 hook
        const { bm, m } = instance

        // beforeMount hook
        if (bm) {
          bm()
        }

        // 从 render 中获取需要渲染的内容
        const subTree = (instance.subTree = renderComponentRoot(instance))

        // 通过 patch 对 subTree，进行打补丁。即：渲染组件
        patch(null, subTree, container, anchor)

        // mounted hook
        if (m) {
          m()
        }

        // 把组件根节点的 el，作为组件的 el
        initialVNode.el = subTree.el

        // 修改 mounted 状态
        instance.isMounted = true
      } else {
        let { next, vnode } = instance
        if (!next) {
          next = vnode
        }

        // 获取下一次的 subTree
        const nextTree = renderComponentRoot(instance)

        // 保存对应的 subTree，以便进行更新操作
        const prevTree = instance.subTree
        instance.subTree = nextTree

        // 通过 patch 进行更新操作
        patch(prevTree, nextTree, container, anchor)

        // 更新 next
        next.el = nextTree.el
      }
    }

    // 创建包含 scheduler 的 effect 实例
    const effect = (instance.effect = new ReactiveEffect(
      componentUpdateFn,
      () => queuePreFlushCb(update)
    ))

    // 生成 update 函数
    const update = (instance.update = () => effect.run())

    // 触发 update 函数，本质上触发的是 componentUpdateFn
    update()
  }

  /**
   * element 的更新操作
   */
  const patchElement = (oldVNode, newVNode) => {
    // 获取指定的 el
    const el = (newVNode.el = oldVNode.el!)

    // 新旧 props
    const oldProps = oldVNode.props || EMPTY_OBJ
    const newProps = newVNode.props || EMPTY_OBJ

    // 更新子节点
    patchChildren(oldVNode, newVNode, el, null)

    // 更新 props
    patchProps(el, newVNode, oldProps, newProps)
  }

  /**
   * diff
   */
  const patchKeyedChildren = (
    oldChildren,
    newChildren,
    container,
    parentAnchor
  ) => {
    /**
     * 索引
     */
    let i = 0
    /**
     * 新的子节点的长度
     */
    const newChildrenLength = newChildren.length
    /**
     * 旧的子节点最大（最后一个）下标
     */
    let oldChildrenEnd = oldChildren.length - 1
    /**
     * 新的子节点最大（最后一个）下标
     */
    let newChildrenEnd = newChildrenLength - 1

    // 1. 自前向后的 diff 对比。经过该循环之后，从前开始的相同 vnode 将被处理
    while (i <= oldChildrenEnd && i <= newChildrenEnd) {
      const oldVNode = oldChildren[i]
      const newVNode = normalizeVNode(newChildren[i])
      // 如果 oldVNode 和 newVNode 被认为是同一个 vnode，则直接 patch 即可
      if (isSameVNodeType(oldVNode, newVNode)) {
        patch(oldVNode, newVNode, container, null)
      }
      // 如果不被认为是同一个 vnode，则直接跳出循环
      else {
        break
      }
      // 下标自增
      i++
    }

    // 2. 自后向前的 diff 对比。经过该循环之后，从后开始的相同 vnode 将被处理
    while (i <= oldChildrenEnd && i <= newChildrenEnd) {
      const oldVNode = oldChildren[oldChildrenEnd]
      const newVNode = normalizeVNode(newChildren[newChildrenEnd])
      if (isSameVNodeType(oldVNode, newVNode)) {
        patch(oldVNode, newVNode, container, null)
      } else {
        break
      }
      oldChildrenEnd--
      newChildrenEnd--
    }

    // 3. 新节点多余旧节点时的 diff 比对。
    if (i > oldChildrenEnd) {
      if (i <= newChildrenEnd) {
        const nextPos = newChildrenEnd + 1
        const anchor =
          nextPos < newChildrenLength ? newChildren[nextPos].el : parentAnchor
        while (i <= newChildrenEnd) {
          patch(null, normalizeVNode(newChildren[i]), container, anchor)
          i++
        }
      }
    }

    // 4. 旧节点多与新节点时的 diff 比对。
    else if (i > newChildrenEnd) {
      while (i <= oldChildrenEnd) {
        unmount(oldChildren[i])
        i++
      }
    }

    // 5. 乱序的 diff 比对
    else {
      const oldStartIndex = i
      const newStartIndex = i
      const keyToNewIndexMap = new Map()
      for (i = newStartIndex; i <= newChildrenEnd; i++) {
        const nextChild = normalizeVNode(newChildren[i])
        if (nextChild.key != null) {
          keyToNewIndexMap.set(nextChild.key, i)
        }
      }

      let j
      let patched = 0
      const toBePatched = newChildrenEnd - newStartIndex + 1
      let moved = false
      let maxNewIndexSoFar = 0
      const newIndexToOldIndexMap = new Array(toBePatched)
      for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0
      for (i = oldStartIndex; i <= oldChildrenEnd; i++) {
        const prevChild = oldChildren[i]
        if (patched >= toBePatched) {
          unmount(prevChild)
          continue
        }
        let newIndex
        if (prevChild.key != null) {
          newIndex = keyToNewIndexMap.get(prevChild.key)
        }

        if (newIndex === undefined) {
          unmount(prevChild)
        } else {
          newIndexToOldIndexMap[newIndex - newStartIndex] = i + 1
          if (newIndex >= maxNewIndexSoFar) {
            maxNewIndexSoFar = newIndex
          } else {
            moved = true
          }
          patch(prevChild, newChildren[newIndex], container, null)
          patched++
        }
      }

      const increasingNewIndexSequence = moved
        ? getSequence(newIndexToOldIndexMap)
        : []
      j = increasingNewIndexSequence.length - 1
      for (i = toBePatched - 1; i >= 0; i--) {
        const nextIndex = newStartIndex + i
        const nextChild = newChildren[nextIndex]
        const anchor =
          nextIndex + 1 < newChildrenLength
            ? newChildren[nextIndex + 1].el
            : parentAnchor
        if (newIndexToOldIndexMap[i] === 0) {
          patch(null, nextChild, container, anchor)
        } else if (moved) {
          if (j < 0 || i !== increasingNewIndexSequence[j]) {
            move(nextChild, container, anchor)
          } else {
            j--
          }
        }
      }
    }
  }

  /**
   * 组件的打补丁操作
   */
  const processComponent = (oldVNode, newVNode, container, anchor) => {
    if (oldVNode == null) {
      // 挂载
      mountComponent(newVNode, container, anchor)
    }
  }

  const patch = (oldVNode, newVNode, container, anchor = null) => {
    if (oldVNode === newVNode) {
      return
    }

    /**
     * 判断是否为相同类型节点
     */
    if (oldVNode && !isSameVNodeType(oldVNode, newVNode)) {
      unmount(oldVNode)
      oldVNode = null
    }

    const { type, shapeFlag } = newVNode
    switch (type) {
      case Text:
        // Text
        processText(oldVNode, newVNode, container, anchor)
        break
      // patch 方法中 switch 逻辑
      case Comment:
        // Comment
        processCommentNode(oldVNode, newVNode, container, anchor)
        break
      case Fragment:
        // TODO: Fragment
        break
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(oldVNode, newVNode, container, anchor)
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          // 组件
          processComponent(oldVNode, newVNode, container, anchor)
        }
    }
  }

  /**
   * 为子节点打补丁
   */
  const patchChildren = (oldVNode, newVNode, container, anchor) => {
    // 旧节点的 children
    const c1 = oldVNode && oldVNode.children
    // 旧节点的 prevShapeFlag
    const prevShapeFlag = oldVNode ? oldVNode.shapeFlag : 0
    // 新节点的 children
    const c2 = newVNode.children

    // 新节点的 shapeFlag
    const { shapeFlag } = newVNode

    // 新子节点为 TEXT_CHILDREN
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 旧子节点为 ARRAY_CHILDREN
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // TODO: 卸载旧子节点
      }
      // 新旧子节点不同
      if (c2 !== c1) {
        // 挂载新子节点的文本
        hostSetElementText(container, c2 as string)
      }
    } else {
      // 旧子节点为 ARRAY_CHILDREN
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // 新子节点也为 ARRAY_CHILDREN
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          //  这里要进行 diff 运算
          patchKeyedChildren(c1, c2, container, anchor)
        }
        // 新子节点不为 ARRAY_CHILDREN，则直接卸载旧子节点
        else {
          // TODO: 卸载
        }
      } else {
        // 旧子节点为 TEXT_CHILDREN
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          // 删除旧的文本
          hostSetElementText(container, '')
        }
        // 新子节点为 ARRAY_CHILDREN
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // TODO: 单独挂载新子节点操作
        }
      }
    }
  }

  /**
   * 为 props 打补丁
   */
  const patchProps = (el: Element, vnode, oldProps, newProps) => {
    // 新旧 props 不相同时才进行处理
    if (oldProps !== newProps) {
      // 遍历新的 props，依次触发 hostPatchProp ，赋值新属性
      for (const key in newProps) {
        const next = newProps[key]
        const prev = oldProps[key]
        if (next !== prev) {
          hostPatchProp(el, key, prev, next)
        }
      }
      // 存在旧的 props 时
      if (oldProps !== EMPTY_OBJ) {
        // 遍历旧的 props，依次触发 hostPatchProp ，删除不存在于新props 中的旧属性
        for (const key in oldProps) {
          if (!(key in newProps)) {
            hostPatchProp(el, key, oldProps[key], null)
          }
        }
      }
    }
  }

  /**
   * 渲染函数
   */
  const render = (vnode, container) => {
    if (vnode == null) {
      // TODO: 卸载
      if (container._vnode) {
        unmount(container._vnode)
      }
    } else {
      // 打补丁（包括了挂载和更新）
      patch(container._vnode || null, vnode, container)
    }
    container._vnode = vnode
  }

  /**
   * 移动节点到指定位置
   */
  const move = (vnode, container, anchor) => {
    const { el } = vnode
    hostInsert(el!, container, anchor)
  }

  /**
   * 获取最长递增子序列下标
   * 维基百科：https://en.wikipedia.org/wiki/Longest_increasing_subsequence
   * 百度百科：https://baike.baidu.com/item/%E6%9C%80%E9%95%BF%E9%80%92%E5%A2%9E%E5%AD%90%E5%BA%8F%E5%88%97/22828111
   */
  function getSequence(arr) {
    // 获取一个数组浅拷贝。注意 p 的元素改变并不会影响 arr
    // p 是一个最终的回溯数组，它会在最终的 result 回溯中被使用
    // 它会在每次 result 发生变化时，记录 result 更新前最后一个索引的值
    const p = arr.slice()
    // 定义返回值（最长递增子序列下标），因为下标从 0 开始，所以它的初始值为 0
    const result = [0]
    let i, j, u, v, c
    // 当前数组的长度
    const len = arr.length
    // 对数组中所有的元素进行 for 循环处理，i = 下标
    for (i = 0; i < len; i++) {
      // 根据下标获取当前对应元素
      const arrI = arr[i]
      //
      if (arrI !== 0) {
        // 获取 result 中的最后一个元素，即：当前 result 中保存的最大值的下标
        j = result[result.length - 1]
        // arr[j] = 当前 result 中所保存的最大值
        // arrI = 当前值
        // 如果 arr[j] < arrI 。那么就证明，当前存在更大的序列，那么该下标就需要被放入到 result 的最后位置
        if (arr[j] < arrI) {
          p[i] = j
          // 把当前的下标 i 放入到 result 的最后位置
          result.push(i)
          continue
        }
        // 不满足 arr[j] < arrI 的条件，就证明目前 result 中的最后位置保存着更大的数值的下标。
        // 但是这个下标并不一定是一个递增的序列，比如： [1, 3] 和 [1, 2]
        // 所以我们还需要确定当前的序列是递增的。
        // 计算方式就是通过：二分查找来进行的

        // 初始下标
        u = 0
        // 最终下标
        v = result.length - 1
        // 只有初始下标 < 最终下标时才需要计算
        while (u < v) {
          // (u + v) 转化为 32 位 2 进制，右移 1 位 === 取中间位置（向下取整）例如：8 >> 1 = 4;  9 >> 1 = 4; 5 >> 1 = 2
          // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Operators/Right_shift
          // c 表示中间位。即：初始下标 + 最终下标 / 2 （向下取整）
          c = (u + v) >> 1
          // 从 result 中根据 c（中间位），取出中间位的下标。
          // 然后利用中间位的下标，从 arr 中取出对应的值。
          // 即：arr[result[c]] = result 中间位的值
          // 如果：result 中间位的值 < arrI，则 u（初始下标）= 中间位 + 1。即：从中间向右移动一位，作为初始下标。 （下次直接从中间开始，往后计算即可）
          if (arr[result[c]] < arrI) {
            u = c + 1
          } else {
            // 否则，则 v（最终下标） = 中间位。即：下次直接从 0 开始，计算到中间位置 即可。
            v = c
          }
        }
        // 最终，经过 while 的二分运算可以计算出：目标下标位 u
        // 利用 u 从 result 中获取下标，然后拿到 arr 中对应的值：arr[result[u]]
        // 如果：arr[result[u]] > arrI 的，则证明当前  result 中存在的下标 《不是》 递增序列，则需要进行替换
        if (arrI < arr[result[u]]) {
          if (u > 0) {
            p[i] = result[u - 1]
          }
          // 进行替换，替换为递增序列
          result[u] = i
        }
      }
    }
    // 重新定义 u。此时：u = result 的长度
    u = result.length
    // 重新定义 v。此时 v = result 的最后一个元素
    v = result[u - 1]
    // 自后向前处理 result，利用 p 中所保存的索引值，进行最后的一次回溯
    while (u-- > 0) {
      result[u] = v
      v = p[v]
    }
    return result
  }

  return {
    render
  }
}
