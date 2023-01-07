var Vue = (function (exports) {
    'use strict';

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __values(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m) return m.call(o);
        if (o && typeof o.length === "number") return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    }

    function __read(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    }

    function __spreadArray(to, from, pack) {
        if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
            if (ar || !(i in from)) {
                if (!ar) ar = Array.prototype.slice.call(from, 0, i);
                ar[i] = from[i];
            }
        }
        return to.concat(ar || Array.prototype.slice.call(from));
    }

    /**
     * 规范化 class 类，处理 class 的增强
     */
    function normalizeClass(value) {
        var res = '';
        // 判断是否为 string，如果是 string 就不需要专门处理
        if (isString(value)) {
            res = value;
        }
        // 额外的数组增强。官方案例：https://cn.vuejs.org/guide/essentials/class-and-style.html#binding-to-arrays
        else if (isArray(value)) {
            // 循环得到数组中的每个元素，通过 normalizeClass 方法进行迭代处理
            for (var i = 0; i < value.length; i++) {
                var normalized = normalizeClass(value[i]);
                if (normalized) {
                    res += normalized + ' ';
                }
            }
        }
        // 额外的对象增强。官方案例：https://cn.vuejs.org/guide/essentials/class-and-style.html#binding-html-classes
        else if (isObject(value)) {
            // for in 获取到所有的 key，这里的 key（name） 即为 类名。value 为 boolean 值
            for (var name_1 in value) {
                // 把 value 当做 boolean 来看，拼接 name
                if (value[name_1]) {
                    res += name_1 + ' ';
                }
            }
        }
        // 去左右空格
        return res.trim();
    }

    /**
     * 判断是否为一个数组
     */
    var isArray = Array.isArray;
    /**
     * 判断是否为一个对象
     */
    var isObject = function (val) {
        return val !== null && typeof val === 'object';
    };
    /**
     * 对比两个数据是否发生了改变
     */
    var hasChanged = function (value, oldValue) {
        return !Object.is(value, oldValue);
    };
    /**
     * 是否为一个 function
     */
    var isFunction = function (val) {
        return typeof val === 'function';
    };
    /**
     * 是否为一个 String
     */
    var isString = function (val) { return typeof val === 'string'; };
    /**
     * Object.assign
     */
    var extend = Object.assign;
    /**
     * 只读的空对象
     */
    var EMPTY_OBJ = {};
    var onRE = /^on[^a-z]/;
    /**
     * 是否 on 开头
     */
    var isOn = function (key) { return onRE.test(key); };

    /**
     * 依据 effects 生成 dep 实例
     */
    var createDep = function (effects) {
        var dep = new Set(effects);
        return dep;
    };

    /**
     * 单例的，当前的 effect
     */
    var activeEffect;
    /**
     * 响应性触发依赖时的执行类
     */
    var ReactiveEffect = /** @class */ (function () {
        function ReactiveEffect(fn, scheduler) {
            if (scheduler === void 0) { scheduler = null; }
            this.fn = fn;
            this.scheduler = scheduler;
        }
        ReactiveEffect.prototype.run = function () {
            // 为 activeEffect 赋值
            activeEffect = this;
            // 执行 fn 函数
            return this.fn();
        };
        ReactiveEffect.prototype.stop = function () { };
        return ReactiveEffect;
    }());
    /**
     * effect 函数
     * @param fn 执行方法
     * @returns 以 ReactiveEffect 实例为 this 的执行函数
     */
    function effect(fn, options) {
        // 生成 ReactiveEffect 实例
        var _effect = new ReactiveEffect(fn);
        // 存在 options，则合并配置对象
        if (options) {
            extend(_effect, options);
        }
        // !options.lazy 时
        if (!options || !options.lazy) {
            // 执行 run 函数
            _effect.run();
        }
    }
    /**
     * 收集所有依赖的 WeakMap 实例：
     * 1. `key`：响应性对象
     * 2. `value`：`Map` 对象
     * 		1. `key`：响应性对象的指定属性
     * 		2. `value`：指定对象的指定属性的 执行函数
     */
    var targetMap = new WeakMap();
    /**
     * 用于收集依赖的方法
     * @param target WeakMap 的 key
     * @param key 代理对象的 key，当依赖被触发时，需要根据该 key 获取
     */
    function track(target, key) {
        // 如果当前不存在执行函数，则直接 return
        if (!activeEffect)
            return;
        // 尝试从 targetMap 中，根据 target 获取 map
        var depsMap = targetMap.get(target);
        // 如果获取到的 map 不存在，则生成新的 map 对象，并把该对象赋值给对应的 value
        if (!depsMap) {
            targetMap.set(target, (depsMap = new Map()));
        }
        // 获取指定 key 的 dep
        var dep = depsMap.get(key);
        // 如果 dep 不存在，则生成一个新的 dep，并放入到 depsMap 中
        if (!dep) {
            depsMap.set(key, (dep = createDep()));
        }
        trackEffects(dep);
    }
    /**
     * 利用 dep 依次跟踪指定 key 的所有 effect
     * @param dep
     */
    function trackEffects(dep) {
        dep.add(activeEffect);
    }
    function trigger(target, key) {
        // 依据 target 获取存储的 map 实例
        var depsMap = targetMap.get(target);
        // 如果 map 不存在，则直接 return
        if (!depsMap) {
            return;
        }
        // 依据指定的 key，获取 dep 实例
        var dep = depsMap.get(key);
        // dep 不存在则直接 return
        if (!dep) {
            return;
        }
        // 触发 dep
        triggerEffects(dep);
    }
    /**
     * 依次触发 dep 中保存的依赖
     */
    function triggerEffects(dep) {
        var e_1, _a, e_2, _b;
        // 把 dep 构建为一个数组
        var effects = isArray(dep) ? dep : __spreadArray([], __read(dep), false);
        try {
            // 不在依次触发，而是先触发所有的计算属性依赖，再触发所有的非计算属性依赖
            for (var effects_1 = __values(effects), effects_1_1 = effects_1.next(); !effects_1_1.done; effects_1_1 = effects_1.next()) {
                var effect_1 = effects_1_1.value;
                if (effect_1.computed) {
                    triggerEffect(effect_1);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (effects_1_1 && !effects_1_1.done && (_a = effects_1.return)) _a.call(effects_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        try {
            for (var effects_2 = __values(effects), effects_2_1 = effects_2.next(); !effects_2_1.done; effects_2_1 = effects_2.next()) {
                var effect_2 = effects_2_1.value;
                if (!effect_2.computed) {
                    triggerEffect(effect_2);
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (effects_2_1 && !effects_2_1.done && (_b = effects_2.return)) _b.call(effects_2);
            }
            finally { if (e_2) throw e_2.error; }
        }
    }
    /**
     * 触发指定的依赖
     */
    function triggerEffect(effect) {
        // 存在调度器就执行调度函数
        if (effect.scheduler) {
            effect.scheduler();
        }
        // 否则直接执行 run 函数即可
        else {
            effect.run();
        }
    }

    /**
     * getter 回调方法
     */
    var get = createGetter();
    /**
     * 创建 getter 回调方法
     */
    function createGetter() {
        return function get(target, key, receiver) {
            // 利用 Reflect 得到返回值
            var res = Reflect.get(target, key, receiver);
            // 收集依赖
            track(target, key);
            return res;
        };
    }
    /**
     * setter 回调方法
     */
    var set = createSetter();
    /**
     * 创建 setter 回调方法
     */
    function createSetter() {
        return function set(target, key, value, receiver) {
            // 利用 Reflect.set 设置新值
            var result = Reflect.set(target, key, value, receiver);
            // 触发依赖
            trigger(target, key);
            return result;
        };
    }
    /**
     * 响应性的 handler
     */
    var mutableHandlers = {
        get: get,
        set: set
    };

    /**
     * 响应性 Map 缓存对象
     * key：target
     * val：proxy
     */
    var reactiveMap = new WeakMap();
    /**
     * 为复杂数据类型，创建响应性对象
     * @param target 被代理对象
     * @returns 代理对象
     */
    function reactive(target) {
        return createReactiveObject(target, mutableHandlers, reactiveMap);
    }
    /**
     * 创建响应性对象
     * @param target 被代理对象
     * @param baseHandlers handler
     */
    function createReactiveObject(target, baseHandlers, proxyMap) {
        // 如果该实例已经被代理，则直接读取即可
        var existingProxy = proxyMap.get(target);
        if (existingProxy) {
            return existingProxy;
        }
        // 未被代理则生成 proxy 实例
        var proxy = new Proxy(target, baseHandlers);
        // 为 Reactive 增加标记
        proxy["__v_isReactive" /* ReactiveFlags.IS_REACTIVE */] = true;
        // 缓存代理对象
        proxyMap.set(target, proxy);
        return proxy;
    }
    /**
     * 将指定数据变为 reactive 数据
     */
    var toReactive = function (value) {
        return isObject(value) ? reactive(value) : value;
    };
    /**
     * 判断一个数据是否为 Reactive
     */
    function isReactive(value) {
        return !!(value && value["__v_isReactive" /* ReactiveFlags.IS_REACTIVE */]);
    }

    /**
     * ref 函数
     * @param value unknown
     */
    function ref(value) {
        return createRef(value, false);
    }
    /**
     * 创建 RefImpl 实例
     * @param rawValue 原始数据
     * @param shallow boolean 形数据，表示《浅层的响应性（即：只有 .value 是响应性的）》
     * @returns
     */
    function createRef(rawValue, shallow) {
        if (isRef(rawValue)) {
            return rawValue;
        }
        return new RefImpl(rawValue, shallow);
    }
    var RefImpl = /** @class */ (function () {
        function RefImpl(value, __v_isShallow) {
            this.__v_isShallow = __v_isShallow;
            this.dep = undefined;
            // 是否为 ref 类型数据的标记
            this.__v_isRef = true;
            // 如果 __v_isShallow 为 true，则 value 不会被转化为 reactive 数据，即如果当前 value 为复杂数据类型，则会失去响应性。对应官方文档 shallowRef ：https://cn.vuejs.org/api/reactivity-advanced.html#shallowref
            // 原始数据
            this._rawValue = value;
            this._value = __v_isShallow ? value : toReactive(value);
        }
        Object.defineProperty(RefImpl.prototype, "value", {
            /**
             * get语法将对象属性绑定到查询该属性时将被调用的函数。
             * 即：xxx.value 时触发该函数
             */
            get: function () {
                trackRefValue(this);
                return this._value;
            },
            set: function (newVal) {
                /**
                 * newVal 为新数据
                 * this._rawValue 为旧数据（原始数据）
                 * 对比两个数据是否发生了变化
                 */
                if (hasChanged(newVal, this._rawValue)) {
                    // 更新原始数据
                    this._rawValue = newVal;
                    // 更新 .value 的值
                    this._value = toReactive(newVal);
                    // 触发依赖
                    triggerRefValue(this);
                }
            },
            enumerable: false,
            configurable: true
        });
        return RefImpl;
    }());
    /**
     * 为 ref 的 value 进行依赖收集工作
     */
    function trackRefValue(ref) {
        if (activeEffect) {
            trackEffects(ref.dep || (ref.dep = createDep()));
        }
    }
    /**
     * 为 ref 的 value 进行触发依赖工作
     */
    function triggerRefValue(ref) {
        if (ref.dep) {
            triggerEffects(ref.dep);
        }
    }
    /**
     * 指定数据是否为 RefImpl 类型
     */
    function isRef(r) {
        return !!(r && r.__v_isRef === true);
    }

    /**
     * 计算属性类
     */
    var ComputedRefImpl = /** @class */ (function () {
        function ComputedRefImpl(getter) {
            var _this = this;
            this.dep = undefined;
            this.__v_isRef = true;
            /**
             * 脏：为 false 时，表示需要触发依赖。为 true 时表示需要重新执行 run 方法，获取数据。即：数据脏了
             */
            this._dirty = true;
            this.effect = new ReactiveEffect(getter, function () {
                // 判断当前脏的状态，如果为 false，表示需要《触发依赖》
                if (!_this._dirty) {
                    // 将脏置为 true，表示
                    _this._dirty = true;
                    triggerRefValue(_this);
                }
            });
            this.effect.computed = this;
        }
        Object.defineProperty(ComputedRefImpl.prototype, "value", {
            get: function () {
                // 触发依赖
                trackRefValue(this);
                // 判断当前脏的状态，如果为 true ，则表示需要重新执行 run，获取最新数据
                if (this._dirty) {
                    this._dirty = false;
                    // 执行 run 函数
                    this._value = this.effect.run();
                }
                // 返回计算之后的真实值
                return this._value;
            },
            enumerable: false,
            configurable: true
        });
        return ComputedRefImpl;
    }());
    /**
     * 计算属性
     */
    function computed(getterOrOptions) {
        var getter;
        // 判断传入的参数是否为一个函数
        var onlyGetter = isFunction(getterOrOptions);
        if (onlyGetter) {
            // 如果是函数，则赋值给 getter
            getter = getterOrOptions;
        }
        var cRef = new ComputedRefImpl(getter);
        return cRef;
    }

    // 对应 promise 的 pending 状态
    var isFlushPending = false;
    /**
     * promise.resolve()
     */
    var resolvedPromise = Promise.resolve();
    /**
     * 待执行的任务队列
     */
    var pendingPreFlushCbs = [];
    /**
     * 队列预处理函数
     */
    function queuePreFlushCb(cb) {
        queueCb(cb, pendingPreFlushCbs);
    }
    /**
     * 队列处理函数
     */
    function queueCb(cb, pendingQueue) {
        // 将所有的回调函数，放入队列中
        pendingQueue.push(cb);
        queueFlush();
    }
    /**
     * 依次处理队列中执行函数
     */
    function queueFlush() {
        if (!isFlushPending) {
            isFlushPending = true;
            resolvedPromise.then(flushJobs);
        }
    }
    /**
     * 处理队列
     */
    function flushJobs() {
        isFlushPending = false;
        flushPreFlushCbs();
    }
    /**
     * 依次处理队列中的任务
     */
    function flushPreFlushCbs() {
        if (pendingPreFlushCbs.length) {
            var activePreFlushCbs = __spreadArray([], __read(new Set(pendingPreFlushCbs)), false);
            pendingPreFlushCbs.length = 0;
            for (var i = 0; i < activePreFlushCbs.length; i++) {
                activePreFlushCbs[i]();
            }
        }
    }

    /**
     * 指定的 watch 函数
     * @param source 监听的响应性数据
     * @param cb 回调函数
     * @param options 配置对象
     * @returns
     */
    function watch(source, cb, options) {
        return doWatch(source, cb, options);
    }
    function doWatch(source, cb, _a) {
        var _b = _a === void 0 ? EMPTY_OBJ : _a, immediate = _b.immediate, deep = _b.deep;
        // 触发 getter 的指定函数
        var getter;
        // 判断 source 的数据类型
        if (isReactive(source)) {
            // 指定 getter
            getter = function () { return source; };
            // 深度
            deep = true;
        }
        else {
            getter = function () { };
        }
        // 存在回调函数和deep
        if (cb && deep) {
            // TODO
            var baseGetter_1 = getter;
            getter = function () { return traverse(baseGetter_1()); };
        }
        // 旧值
        var oldValue = {};
        // job 执行方法
        var job = function () {
            if (cb) {
                // watch(source, cb)
                var newValue = effect.run();
                if (deep || hasChanged(newValue, oldValue)) {
                    cb(newValue, oldValue);
                    oldValue = newValue;
                }
            }
        };
        // 调度器
        var scheduler = function () { return queuePreFlushCb(job); };
        var effect = new ReactiveEffect(getter, scheduler);
        if (cb) {
            if (immediate) {
                job();
            }
            else {
                oldValue = effect.run();
            }
        }
        else {
            effect.run();
        }
        return function () {
            effect.stop();
        };
    }
    /**
     * 依次执行 getter，从而触发依赖收集
     */
    function traverse(value) {
        if (!isObject(value)) {
            return value;
        }
        for (var key in value) {
            traverse(value[key]);
        }
        return value;
    }

    var Fragment = Symbol('Fragment');
    var Text$1 = Symbol('Text');
    var Comment$1 = Symbol('Comment');
    function isVNode(value) {
        return value ? value.__v_isVNode === true : false;
    }
    /**
     * 生成一个 VNode 对象，并返回
     * @param type vnode.type
     * @param props 标签属性或自定义属性
     * @param children 子节点
     * @returns vnode 对象
     */
    function createVNode(type, props, children) {
        // 通过 bit 位处理 shapeFlag 类型
        var shapeFlag = isString(type)
            ? 1 /* ShapeFlags.ELEMENT */
            : isObject(type)
                ? 4 /* ShapeFlags.STATEFUL_COMPONENT */
                : 0;
        if (props) {
            // 处理 class
            var klass = props.class; props.style;
            if (klass && !isString(klass)) {
                props.class = normalizeClass(klass);
            }
        }
        return createBaseVNode(type, props, children, shapeFlag);
    }
    /**
     * 构建基础 vnode
     */
    function createBaseVNode(type, props, children, shapeFlag) {
        var vnode = {
            __v_isVNode: true,
            type: type,
            props: props,
            shapeFlag: shapeFlag
        };
        normalizeChildren(vnode, children);
        return vnode;
    }
    function normalizeChildren(vnode, children) {
        var type = 0;
        vnode.shapeFlag;
        if (children == null) {
            children = null;
        }
        else if (isArray(children)) {
            // TODO: array
            type = 16 /* ShapeFlags.ARRAY_CHILDREN */;
        }
        else if (typeof children === 'object') ;
        else if (isFunction(children)) ;
        else {
            // children 为 string
            children = String(children);
            // 为 type 指定 Flags
            type = 8 /* ShapeFlags.TEXT_CHILDREN */;
        }
        // 修改 vnode 的 chidlren
        vnode.children = children;
        // 按位或赋值
        vnode.shapeFlag |= type;
    }
    /**
     * 根据 key || type 判断是否为相同类型节点
     */
    function isSameVNodeType(n1, n2) {
        return n1.type === n2.type && n1.key === n2.key;
    }

    function h(type, propsOrChildren, children) {
        // 获取用户传递的参数数量
        var l = arguments.length;
        // 如果用户只传递了两个参数，那么证明第二个参数可能是 props , 也可能是 children
        if (l === 2) {
            // 如果 第二个参数是对象，但不是数组。则第二个参数只有两种可能性：1. VNode 2.普通的 props
            if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
                // 如果是 VNode，则 第二个参数代表了 children
                if (isVNode(propsOrChildren)) {
                    return createVNode(type, null, [propsOrChildren]);
                }
                // 如果不是 VNode， 则第二个参数代表了 props
                return createVNode(type, propsOrChildren, []);
            }
            // 如果第二个参数不是单纯的 object，则 第二个参数代表了 props
            else {
                return createVNode(type, null, propsOrChildren);
            }
        }
        // 如果用户传递了三个或以上的参数，那么证明第二个参数一定代表了 props
        else {
            // 如果参数在三个以上，则从第二个参数开始，把后续所有参数都作为 children
            if (l > 3) {
                children = Array.prototype.slice.call(arguments, 2);
            }
            // 如果传递的参数只有三个，则 children 是单纯的 children
            else if (l === 3 && isVNode(children)) {
                children = [children];
            }
            // 触发 createVNode 方法，创建 VNode 实例
            return createVNode(type, propsOrChildren, children);
        }
    }

    /**
     * 对外暴露的创建渲染器的方法
     */
    function createRenderer(options) {
        return baseCreateRenderer(options);
    }
    /**
     * 生成 renderer 渲染器
     * @param options 兼容性操作配置对象
     * @returns
     */
    function baseCreateRenderer(options) {
        /**
         * 解构 options，获取所有的兼容性方法
         */
        var hostInsert = options.insert, hostPatchProp = options.patchProp, hostCreateElement = options.createElement, hostSetElementText = options.setElementText, hostRemove = options.remove, hostCreateText = options.createText, hostSetText = options.setText, hostCreateComment = options.createComment;
        var unmount = function (vnode) {
            hostRemove(vnode.el);
        };
        /**
         * Element 的打补丁操作
         */
        var processElement = function (oldVNode, newVNode, container, anchor) {
            if (oldVNode == null) {
                // 挂载操作
                mountElement(newVNode, container, anchor);
            }
            else {
                // 更新操作
                patchElement(oldVNode, newVNode);
            }
        };
        /**
         * Text 的打补丁操作
         */
        var processText = function (oldVNode, newVNode, container, anchor) {
            // 不存在旧的节点，则为 挂载 操作
            if (oldVNode == null) {
                // 生成节点
                newVNode.el = hostCreateText(newVNode.children);
                // 挂载
                hostInsert(newVNode.el, container, anchor);
            }
            // 存在旧的节点，则为 更新 操作
            else {
                var el = (newVNode.el = oldVNode.el);
                if (newVNode.children !== oldVNode.children) {
                    hostSetText(el, newVNode.children);
                }
            }
        };
        /**
         * Comment 的打补丁操作
         */
        var processCommentNode = function (oldVNode, newVNode, container, anchor) {
            if (oldVNode == null) {
                // 生成节点
                newVNode.el = hostCreateComment(newVNode.children || '');
                // 挂载
                hostInsert(newVNode.el, container, anchor);
            }
            else {
                // 无更新
                newVNode.el = oldVNode.el;
            }
        };
        /**
         * element 的挂载操作
         */
        var mountElement = function (vnode, container, anchor) {
            var type = vnode.type, props = vnode.props, shapeFlag = vnode.shapeFlag;
            // 创建 element
            var el = (vnode.el = hostCreateElement(type));
            if (shapeFlag & 8 /* ShapeFlags.TEXT_CHILDREN */) {
                // 设置 文本子节点
                hostSetElementText(el, vnode.children);
            }
            // 处理 props
            if (props) {
                // 遍历 props 对象
                for (var key in props) {
                    hostPatchProp(el, key, null, props[key]);
                }
            }
            // 插入 el 到指定的位置
            hostInsert(el, container, anchor);
        };
        /**
         * element 的更新操作
         */
        var patchElement = function (oldVNode, newVNode) {
            // 获取指定的 el
            var el = (newVNode.el = oldVNode.el);
            // 新旧 props
            var oldProps = oldVNode.props || EMPTY_OBJ;
            var newProps = newVNode.props || EMPTY_OBJ;
            // 更新子节点
            patchChildren(oldVNode, newVNode, el);
            // 更新 props
            patchProps(el, newVNode, oldProps, newProps);
        };
        var patch = function (oldVNode, newVNode, container, anchor) {
            if (anchor === void 0) { anchor = null; }
            if (oldVNode === newVNode) {
                return;
            }
            /**
             * 判断是否为相同类型节点
             */
            if (oldVNode && !isSameVNodeType(oldVNode, newVNode)) {
                unmount(oldVNode);
                oldVNode = null;
            }
            var type = newVNode.type, shapeFlag = newVNode.shapeFlag;
            switch (type) {
                case Text:
                    // Text
                    processText(oldVNode, newVNode, container, anchor);
                    break;
                // patch 方法中 switch 逻辑
                case Comment:
                    // Comment
                    processCommentNode(oldVNode, newVNode, container, anchor);
                    break;
                case Fragment:
                    // TODO: Fragment
                    break;
                default:
                    if (shapeFlag & 1 /* ShapeFlags.ELEMENT */) {
                        processElement(oldVNode, newVNode, container, anchor);
                    }
            }
        };
        /**
         * 为子节点打补丁
         */
        var patchChildren = function (oldVNode, newVNode, container, anchor) {
            // 旧节点的 children
            var c1 = oldVNode && oldVNode.children;
            // 旧节点的 prevShapeFlag
            var prevShapeFlag = oldVNode ? oldVNode.shapeFlag : 0;
            // 新节点的 children
            var c2 = newVNode.children;
            // 新节点的 shapeFlag
            var shapeFlag = newVNode.shapeFlag;
            // 新子节点为 TEXT_CHILDREN
            if (shapeFlag & 8 /* ShapeFlags.TEXT_CHILDREN */) {
                // 新旧子节点不同
                if (c2 !== c1) {
                    // 挂载新子节点的文本
                    hostSetElementText(container, c2);
                }
            }
            else {
                // 旧子节点为 ARRAY_CHILDREN
                if (prevShapeFlag & 16 /* ShapeFlags.ARRAY_CHILDREN */) ;
                else {
                    // 旧子节点为 TEXT_CHILDREN
                    if (prevShapeFlag & 8 /* ShapeFlags.TEXT_CHILDREN */) {
                        // 删除旧的文本
                        hostSetElementText(container, '');
                    }
                }
            }
        };
        /**
         * 为 props 打补丁
         */
        var patchProps = function (el, vnode, oldProps, newProps) {
            // 新旧 props 不相同时才进行处理
            if (oldProps !== newProps) {
                // 遍历新的 props，依次触发 hostPatchProp ，赋值新属性
                for (var key in newProps) {
                    var next = newProps[key];
                    var prev = oldProps[key];
                    if (next !== prev) {
                        hostPatchProp(el, key, prev, next);
                    }
                }
                // 存在旧的 props 时
                if (oldProps !== EMPTY_OBJ) {
                    // 遍历旧的 props，依次触发 hostPatchProp ，删除不存在于新props 中的旧属性
                    for (var key in oldProps) {
                        if (!(key in newProps)) {
                            hostPatchProp(el, key, oldProps[key], null);
                        }
                    }
                }
            }
        };
        /**
         * 渲染函数
         */
        var render = function (vnode, container) {
            if (vnode == null) {
                // TODO: 卸载
                if (container._vnode) {
                    unmount(container._vnode);
                }
            }
            else {
                // 打补丁（包括了挂载和更新）
                patch(container._vnode || null, vnode, container);
            }
            container._vnode = vnode;
        };
        return {
            render: render
        };
    }

    var doc = document;
    var nodeOps = {
        /**
         * 插入指定元素到指定位置
         */
        insert: function (child, parent, anchor) {
            parent.insertBefore(child, anchor || null);
        },
        /**
         * 创建指定 Element
         */
        createElement: function (tag) {
            var el = doc.createElement(tag);
            return el;
        },
        /**
         * 为指定的 element 设置 textContent
         */
        setElementText: function (el, text) {
            el.textContent = text;
        },
        /**
         * 删除指定元素
         */
        remove: function (child) {
            var parent = child.parentNode;
            if (parent) {
                parent.removeChild(child);
            }
        },
        /**
         * 创建 Text 节点
         */
        createText: function (text) { return doc.createTextNode(text); },
        /**
         * 设置 text
         */
        setText: function (node, text) {
            node.nodeValue = text;
        },
        /**
         * 创建 Comment 节点
         */
        createComment: function (text) { return doc.createComment(text); }
    };

    /**
     * 为 class 打补丁
     */
    function patchClass(el, value) {
        if (value == null) {
            el.removeAttribute('class');
        }
        else {
            el.className = value;
        }
    }

    /**
     * 通过 DOM Properties 指定属性
     */
    function patchDOMProp(el, key, value) {
        try {
            el[key] = value;
        }
        catch (e) { }
    }

    /**
     * 通过 setAttribute 设置属性
     */
    function patchAttr(el, key, value) {
        if (value == null) {
            el.removeAttribute(key);
        }
        else {
            el.setAttribute(key, value);
        }
    }

    /**
     * 为 style 属性进行打补丁
     */
    function patchStyle(el, prev, next) {
        // 获取 style 对象
        var style = el.style;
        // 判断新的样式是否为纯字符串
        var isCssString = isString(next);
        if (next && !isCssString) {
            // 赋值新样式
            for (var key in next) {
                setStyle(style, key, next[key]);
            }
            // 清理旧样式
            if (prev && !isString(prev)) {
                for (var key in prev) {
                    if (next[key] == null) {
                        setStyle(style, key, '');
                    }
                }
            }
        }
    }
    /**
     * 赋值样式
     */
    function setStyle(style, name, val) {
        style[name] = val;
    }

    /**
     * 为 event 事件进行打补丁
     */
    function patchEvent(el, rawName, prevValue, nextValue) {
        // vei = vue event invokers
        var invokers = el._vei || (el._vei = {});
        // 是否存在缓存事件
        var existingInvoker = invokers[rawName];
        // 如果当前事件存在缓存，并且存在新的事件行为，则判定为更新操作。直接更新 invoker 的 value 即可
        if (nextValue && existingInvoker) {
            // patch
            existingInvoker.value = nextValue;
        }
        else {
            // 获取用于 addEventListener || removeEventListener 的事件名
            var name_1 = parseName(rawName);
            if (nextValue) {
                // add
                var invoker = (invokers[rawName] = createInvoker(nextValue));
                el.addEventListener(name_1, invoker);
            }
            else if (existingInvoker) {
                // remove
                el.removeEventListener(name_1, existingInvoker);
                // 删除缓存
                invokers[rawName] = undefined;
            }
        }
    }
    /**
     * 直接返回剔除 on，其余转化为小写的事件名即可
     */
    function parseName(name) {
        return name.slice(2).toLowerCase();
    }
    /**
     * 生成 invoker 函数
     */
    function createInvoker(initialValue) {
        var invoker = function (e) {
            invoker.value && invoker.value();
        };
        // value 为真实的事件行为
        invoker.value = initialValue;
        return invoker;
    }

    /**
     * 为 prop 进行打补丁操作
     */
    var patchProp = function (el, key, prevValue, nextValue) {
        if (key === 'class') {
            patchClass(el, nextValue);
        }
        else if (key === 'style') {
            // TODO: style
            patchStyle(el, prevValue, nextValue);
        }
        else if (isOn(key)) {
            // 事件
            patchEvent(el, key, prevValue, nextValue);
        }
        else if (shouldSetAsProp(el, key)) {
            // 通过 DOM Properties 指定
            patchDOMProp(el, key, nextValue);
        }
        else {
            // 其他属性
            patchAttr(el, key, nextValue);
        }
    };
    /**
     * 判断指定元素的指定属性是否可以通过 DOM Properties 指定
     */
    function shouldSetAsProp(el, key) {
        // #1787, #2840 表单元素的表单属性是只读的，必须设置为属性 attribute
        if (key === 'form') {
            return false;
        }
        // #1526 <input list> 必须设置为属性 attribute
        if (key === 'list' && el.tagName === 'INPUT') {
            return false;
        }
        // #2766 <textarea type> 必须设置为属性 attribute
        if (key === 'type' && el.tagName === 'TEXTAREA') {
            return false;
        }
        return key in el;
    }

    var rendererOptions = extend({ patchProp: patchProp }, nodeOps);
    var renderer;
    function ensureRenderer() {
        return renderer || (renderer = createRenderer(rendererOptions));
    }
    var render = function () {
        var _a;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        (_a = ensureRenderer()).render.apply(_a, __spreadArray([], __read(args), false));
    };

    exports.Comment = Comment$1;
    exports.Fragment = Fragment;
    exports.Text = Text$1;
    exports.computed = computed;
    exports.createRenderer = createRenderer;
    exports.effect = effect;
    exports.h = h;
    exports.queuePreFlushCb = queuePreFlushCb;
    exports.reactive = reactive;
    exports.ref = ref;
    exports.render = render;
    exports.watch = watch;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({});
//# sourceMappingURL=vue.js.map
