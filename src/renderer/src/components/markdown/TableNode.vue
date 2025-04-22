<template>
  <div class="table-wrapper">
    <table class="markdown-table">
      <thead>
        <tr>
          <th v-for="(cell, index) in node.header.cells" :key="'header-' + index">
            <NodeRenderer
              :nodes="cell.children"
              :message-id="messageId"
              :thread-id="threadId"
              @copy="$emit('copy', $event)"
            />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIndex) in node.rows" :key="'row-' + rowIndex">
          <td v-for="(cell, cellIndex) in row.cells" :key="'cell-' + rowIndex + '-' + cellIndex">
            <NodeRenderer
              :nodes="cell.children"
              :message-id="messageId"
              :thread-id="threadId"
              @copy="$emit('copy', $event)"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import NodeRenderer from './NodeRenderer.vue'

// 定义单元格节点
interface TableCellNode {
  type: 'table_cell'
  header: boolean
  children: { type: string; raw: string }[]
  raw: string
}

// 定义行节点
interface TableRowNode {
  type: 'table_row'
  cells: TableCellNode[]
  raw: string
}

// 定义表格节点
interface TableNode {
  type: 'table'
  header: TableRowNode
  rows: TableRowNode[]
  raw: string
}

// 接收props
defineProps<{
  node: TableNode
  messageId?: string
  threadId?: string
}>()

// 定义事件
defineEmits(['copy'])
</script>

<style scoped>
.table-wrapper {
  overflow-x: auto;
  margin-bottom: 1rem;
}

.markdown-table {
  border-collapse: collapse;
  width: 100%;
  margin: 0;
}

.markdown-table th,
.markdown-table td {
  padding: 0.5rem;
  border: 1px solid #dfe2e5;
  text-align: left;
}

.markdown-table th {
  font-weight: 600;
  background-color: #f6f8fa;
}

.markdown-table tr:nth-child(2n) {
  background-color: #f6f8fa;
}
</style>
