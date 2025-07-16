export const EMBEDDING_TEST_KEY = 'sample'

function calcNorm(vector: number[]): number {
  return Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
}

/**
 * 判断一个向量是否已 normalized（L2 范数 ≈ 1）
 * @param vector 输入向量
 * @param tolerance 浮点误差容忍范围，默认 1e-3
 * @returns true 表示已 normalized
 */
export function isNormalized(vector: number[], tolerance = 1e-3): boolean {
  if (!vector || !Array.isArray(vector) || vector.length === 0) return false
  if (tolerance < 0) throw new Error('Tolerance must be non-negative')
  if (vector.some((v) => typeof v !== 'number' || !isFinite(v))) return false

  const norm = calcNorm(vector)
  return Math.abs(norm - 1) <= tolerance
}
/**
 * 向量 normalized 处理
 * @param vector 输入向量
 * @returns normalized 向量
 */
export function normalized(vector: number[]): number[] {
  if (!vector || !Array.isArray(vector) || vector.length === 0) {
    throw new Error('Vector cannot be empty')
  }
  const norm = calcNorm(vector)
  if (norm === 0) {
    throw new Error('Cannot normalize zero vector')
  }
  return vector.map((v) => v / norm)
}
/**
 * 必定返回 normalized 向量
 * @param vector 输入向量
 * @param tolerance 浮点误差容忍范围，默认 1e-3
 * @returns normalized 向量
 */
export function ensureNormalized(vector: number[], tolerance = 1e-3): number[] {
  if (!vector || !Array.isArray(vector) || vector.length === 0) {
    throw new Error('Vector cannot be empty')
  }
  if (tolerance < 0) throw new Error('Tolerance must be non-negative')
  const norm = calcNorm(vector)
  if (norm === 0) {
    throw new Error('Cannot normalize zero vector')
  }
  if (Math.abs(norm - 1) <= tolerance) {
    return vector
  }
  return vector.map((v) => v / norm)
}
