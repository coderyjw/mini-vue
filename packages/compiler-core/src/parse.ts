/**
 * 解析器上下文
 */
export interface ParserContext {
  // 模板数据源
  source: string
}

/**
 * 基础的 parse 方法，生成 AST
 * @param content tempalte 模板
 * @returns
 */
export function baseParse(content: string) {
  // 创建 parser 对象，未解析器的上下文对象
  const context = createParserContext(content)
  console.log(context)
  return {}
}

/**
 * 创建解析器上下文
 */
function createParserContext(content: string): ParserContext {
  // 合成 context 上下文对象
  return {
    source: content
  }
}
